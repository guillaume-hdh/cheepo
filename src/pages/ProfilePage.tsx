import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import AppShell from "../components/AppShell";
import Avatar from "../components/Avatar";
import LoaderButton from "../components/LoaderButton";
import { avatarErrorMessage, prepareAvatarUpload } from "../lib/avatar";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";
import { useSession } from "../lib/useSession";
import type {
  NotificationCategory,
  UserNotificationPreference,
  UserProfile,
} from "../lib/types";

type PreferenceDraft = Pick<
  UserNotificationPreference,
  "in_app_enabled" | "email_enabled" | "push_enabled"
>;

function preferenceFromCategory(category: NotificationCategory): PreferenceDraft {
  return {
    in_app_enabled: category.default_in_app,
    email_enabled: category.default_email,
    push_enabled: category.default_push,
  };
}

export default function ProfilePage() {
  const { user } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [preferences, setPreferences] = useState<Record<string, PreferenceDraft>>({});
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  const orderedCategories = useMemo(
    () => [...categories].sort((left, right) => left.sort_order - right.sort_order),
    [categories],
  );

  const loadProfile = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);

    await supabase.rpc("ensure_user_notification_preferences", {
      p_user_id: user.id,
    });

    const [profileResult, categoriesResult, preferencesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,display_name,avatar_path,avatar_mime_type,avatar_updated_at,created_at,updated_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("notification_categories")
        .select("key,label,sort_order,default_in_app,default_email,default_push")
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_notification_preferences")
        .select("user_id,category,in_app_enabled,email_enabled,push_enabled,created_at,updated_at")
        .eq("user_id", user.id),
    ]);

    setLoading(false);

    if (profileResult.error || !profileResult.data) {
      toast("Impossible de charger le profil");
      return;
    }

    if (categoriesResult.error || preferencesResult.error) {
      toast("Impossible de charger les preferences");
      return;
    }

    const nextCategories = (categoriesResult.data ?? []) as NotificationCategory[];
    const nextPreferences = new Map(
      ((preferencesResult.data ?? []) as UserNotificationPreference[]).map((preference) => [
        preference.category,
        preference,
      ]),
    );

    setProfile(profileResult.data as UserProfile);
    setDisplayName(profileResult.data.display_name ?? "");
    setCategories(nextCategories);
    setPreferences(
      Object.fromEntries(
        nextCategories.map((category) => {
          const preference = nextPreferences.get(category.key);

          return [
            category.key,
            preference
              ? {
                  in_app_enabled: preference.in_app_enabled,
                  email_enabled: preference.email_enabled,
                  push_enabled: preference.push_enabled,
                }
              : preferenceFromCategory(category),
          ];
        }),
      ),
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadProfile();
  }, [loadProfile, user]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);

    if (file) {
      setRemoveAvatar(false);
    }
  }

  function updatePreference(
    category: string,
    field: keyof PreferenceDraft,
    value: boolean,
  ) {
    setPreferences((current) => ({
      ...current,
      [category]: {
        ...(current[category] ?? {
          in_app_enabled: true,
          email_enabled: false,
          push_enabled: false,
        }),
        [field]: value,
      },
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !profile) {
      return;
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      toast("Le nom affiche doit faire au moins 2 caracteres.");
      return;
    }

    setSaving(true);

    let uploadedAvatarPath: string | null = null;
    let nextAvatarPath = removeAvatar ? null : profile.avatar_path;
    let nextAvatarMimeType = removeAvatar ? null : profile.avatar_mime_type;

    try {
      if (avatarFile) {
        const preparedAvatar = await prepareAvatarUpload(avatarFile);
        uploadedAvatarPath = `${user.id}/avatar-${Date.now()}.${preparedAvatar.extension}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(uploadedAvatarPath, preparedAvatar.blob, {
            contentType: preparedAvatar.mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        nextAvatarPath = uploadedAvatarPath;
        nextAvatarMimeType = preparedAvatar.mimeType;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: trimmedName,
          avatar_path: nextAvatarPath,
          avatar_mime_type: nextAvatarMimeType,
          avatar_updated_at: nextAvatarPath ? new Date().toISOString() : null,
        })
        .eq("id", user.id);

      if (profileError) {
        throw profileError;
      }

      const preferencePayload = orderedCategories.map((category) => ({
        user_id: user.id,
        category: category.key,
        ...(preferences[category.key] ?? preferenceFromCategory(category)),
      }));

      const { error: preferenceError } = await supabase
        .from("user_notification_preferences")
        .upsert(preferencePayload, {
          onConflict: "user_id,category",
        });

      if (preferenceError) {
        throw preferenceError;
      }

      await supabase.auth.updateUser({
        data: {
          display_name: trimmedName,
        },
      });

      if (profile.avatar_path && (removeAvatar || uploadedAvatarPath)) {
        await supabase.storage.from("avatars").remove([profile.avatar_path]);
      }

      setAvatarFile(null);
      setRemoveAvatar(false);
      toast("Profil enregistre");
      await loadProfile();
    } catch (error) {
      if (uploadedAvatarPath) {
        await supabase.storage.from("avatars").remove([uploadedAvatarPath]);
      }

      const message = error instanceof Error ? error.message : "";
      toast(message.startsWith("AVATAR_") ? avatarErrorMessage(message) : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Profil"
      subtitle="Gere ton nom visible, ta photo et tes preferences de notifications."
    >
      {loading ? (
        <section className="panel">Chargement du profil...</section>
      ) : !profile ? (
        <section className="panel">Impossible de charger ton profil.</section>
      ) : (
        <form className="stack-lg" onSubmit={handleSave}>
          <section className="panel stack-lg">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Identite</p>
                <h2>Nom visible et avatar</h2>
              </div>
            </div>

            <div className="profile-avatar-row">
              {avatarPreviewUrl ? (
                <span className="avatar avatar-lg">
                  <img className="avatar-image" src={avatarPreviewUrl} alt="" />
                </span>
              ) : (
                <Avatar
                  userId={profile.id}
                  displayName={displayName || profile.display_name}
                  email={profile.email}
                  avatarPath={removeAvatar ? null : profile.avatar_path}
                  size="lg"
                />
              )}

              <div className="stack-md">
                <label className="field-block">
                  <span>Photo de profil</span>
                  <input
                    className="field-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                  />
                </label>
                {profile.avatar_path ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setAvatarFile(null);
                      setRemoveAvatar(true);
                    }}
                  >
                    Supprimer la photo
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid-two">
              <label className="field-block">
                <span>Nom visible</span>
                <input
                  className="field-input"
                  value={displayName}
                  minLength={2}
                  maxLength={80}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              <label className="field-block">
                <span>Email</span>
                <input className="field-input" value={profile.email ?? ""} readOnly />
              </label>
            </div>
          </section>

          <section className="panel stack-lg">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Notifications</p>
                <h2>Preferences</h2>
              </div>
            </div>

            <div>
              {orderedCategories.map((category) => {
                const preference = preferences[category.key] ?? preferenceFromCategory(category);

                return (
                  <div key={category.key} className="preference-row">
                    <strong>{category.label}</strong>
                    <label className="preference-toggle">
                      <input
                        type="checkbox"
                        checked={preference.in_app_enabled}
                        onChange={(event) =>
                          updatePreference(category.key, "in_app_enabled", event.target.checked)
                        }
                      />
                      App
                    </label>
                    <label className="preference-toggle">
                      <input
                        type="checkbox"
                        checked={preference.email_enabled}
                        onChange={(event) =>
                          updatePreference(category.key, "email_enabled", event.target.checked)
                        }
                      />
                      Email
                    </label>
                    <label className="preference-toggle">
                      <input
                        type="checkbox"
                        checked={preference.push_enabled}
                        onChange={(event) =>
                          updatePreference(category.key, "push_enabled", event.target.checked)
                        }
                      />
                      Push
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="callout">
              Les notifications push demanderont une autorisation explicite du navigateur
              lors du lot dedie. Ici, seules les preferences sont enregistrees.
            </div>
          </section>

          <LoaderButton type="submit" loading={saving}>
            Enregistrer le profil
          </LoaderButton>
        </form>
      )}
    </AppShell>
  );
}
