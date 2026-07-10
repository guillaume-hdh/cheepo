import { useEffect, useState } from "react";
import { getAvatarColor, getAvatarInitials } from "../lib/avatar";
import { supabase } from "../lib/supabase";

type AvatarProps = {
  userId?: string | null;
  displayName?: string | null;
  email?: string | null;
  avatarPath?: string | null;
  size?: "sm" | "md" | "lg";
};

export default function Avatar({
  userId,
  displayName,
  email,
  avatarPath,
  size = "md",
}: AvatarProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getAvatarInitials(displayName, email);
  const background = getAvatarColor(userId, displayName || email || "Invite");

  useEffect(() => {
    let active = true;
    setImageUrl(null);
    setImageFailed(false);

    if (!avatarPath) {
      return () => {
        active = false;
      };
    }

    const path = avatarPath;

    async function createSignedAvatarUrl() {
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);

      if (!active) {
        return;
      }

      if (error || !data?.signedUrl) {
        setImageFailed(true);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    void createSignedAvatarUrl();

    return () => {
      active = false;
    };
  }, [avatarPath]);

  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ backgroundColor: background }}
      aria-label={displayName || email || "Invite"}
    >
      {imageUrl && !imageFailed ? (
        <img
          className="avatar-image"
          src={imageUrl}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="avatar-initials">{initials}</span>
      )}
    </span>
  );
}
