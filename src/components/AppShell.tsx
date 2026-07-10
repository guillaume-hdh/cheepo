import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import LoaderButton from "./LoaderButton";
import { PENDING_JOIN_CODE_KEY } from "../lib/constants";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/toast";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "admin";
};

function displayName(email: string | null, metadataName: unknown) {
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (!email) {
    return "Invite";
  }

  return email.split("@")[0];
}

export default function AppShell({
  title,
  subtitle,
  actions,
  children,
  tone = "default",
}: AppShellProps) {
  const navigate = useNavigate();
  const { user, isPlatformAdmin } = useSession();
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_path: string | null;
  } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("display_name,avatar_path")
        .eq("id", user.id)
        .maybeSingle();

      if (active) {
        setProfile(data ?? null);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleSignOut() {
    setSigningOut(true);

    const { error } = await supabase.auth.signOut({ scope: "local" });
    setSigningOut(false);

    if (error) {
      toast("Deconnexion impossible");
      return;
    }

    localStorage.removeItem(PENDING_JOIN_CODE_KEY);

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    }

    toast("A bientot");
    navigate("/", { replace: true });
    window.location.assign("/");
  }

  return (
    <div className={tone === "admin" ? "app-shell app-shell-admin" : "app-shell"}>
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="shell-topbar">
        <Link to="/" className="brand-mark">
          <span className="brand-dot" />
          <span>Cheepo</span>
        </Link>

        <div className="shell-toolbar">
          <Link to="/events" className="btn btn-ghost">
            Tableau de bord
          </Link>

          {isPlatformAdmin ? (
            <Link to="/admin" className="btn btn-ghost">
              Super-Admin
            </Link>
          ) : null}

          <Link to="/profile" className="user-chip user-chip-profile">
            <Avatar
              userId={user?.id}
              displayName={profile?.display_name ?? undefined}
              email={user?.email ?? null}
              avatarPath={profile?.avatar_path ?? null}
              size="sm"
            />
            <span>
              <span className="chip-label">Profil</span>
              <strong>
                {displayName(
                  user?.email ?? null,
                  profile?.display_name ?? user?.user_metadata.display_name,
                )}
              </strong>
            </span>
          </Link>

          <LoaderButton tone="secondary" loading={signingOut} onClick={handleSignOut}>
            Se deconnecter
          </LoaderButton>
        </div>
      </header>

      <main className="shell-main">
        <section className="page-hero">
          <div>
            <p className="eyebrow">Coordination barbecue</p>
            <h1>{title}</h1>
            {subtitle ? <p className="hero-copy">{subtitle}</p> : null}
          </div>
          {actions ? <div className="hero-actions">{actions}</div> : null}
        </section>

        {children}
      </main>
    </div>
  );
}
