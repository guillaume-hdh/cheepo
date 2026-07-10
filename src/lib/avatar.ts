const AVATAR_COLORS = [
  "#155E75",
  "#166534",
  "#7C2D12",
  "#7F1D1D",
  "#4C1D95",
  "#1E3A8A",
  "#365314",
  "#831843",
];

const MAX_AVATAR_SIZE = 1_048_576;
const MAX_AVATAR_DIMENSION = 512;

export type PreparedAvatarUpload = {
  blob: Blob;
  mimeType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getAvatarInitials(displayName: string | null | undefined, email?: string | null) {
  const source = (displayName?.trim() || email?.split("@")[0] || "Invite").trim();
  const parts = source
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return "I";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getAvatarColor(userId: string | null | undefined, fallback = "Invite") {
  const key = userId || fallback;
  return AVATAR_COLORS[hashString(key) % AVATAR_COLORS.length];
}

export function validateAvatarFile(file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("AVATAR_INVALID_TYPE");
  }

  if (file.size > MAX_AVATAR_SIZE * 4) {
    throw new Error("AVATAR_TOO_LARGE");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: "image/webp" | "image/jpeg") {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("AVATAR_PROCESSING_FAILED"));
          return;
        }

        resolve(blob);
      },
      mimeType,
      0.82,
    );
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("AVATAR_PROCESSING_FAILED"));
    };

    image.src = url;
  });
}

export async function prepareAvatarUpload(file: File): Promise<PreparedAvatarUpload> {
  validateAvatarFile(file);

  const image = await loadImage(file);
  const scale = Math.min(
    1,
    MAX_AVATAR_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("AVATAR_PROCESSING_FAILED");
  }

  context.drawImage(image, 0, 0, width, height);

  try {
    const webpBlob = await canvasToBlob(canvas, "image/webp");
    if (webpBlob.size <= MAX_AVATAR_SIZE) {
      return {
        blob: webpBlob,
        mimeType: "image/webp",
        extension: "webp",
      };
    }
  } catch {
    // Some browsers do not support WebP canvas export.
  }

  const jpegBlob = await canvasToBlob(canvas, "image/jpeg");
  if (jpegBlob.size > MAX_AVATAR_SIZE) {
    throw new Error("AVATAR_TOO_LARGE");
  }

  return {
    blob: jpegBlob,
    mimeType: "image/jpeg",
    extension: "jpg",
  };
}

export function avatarErrorMessage(message: string) {
  if (message === "AVATAR_INVALID_TYPE") {
    return "Choisis une image JPEG, PNG ou WebP.";
  }

  if (message === "AVATAR_TOO_LARGE") {
    return "L image est trop lourde. Choisis une image plus legere.";
  }

  return "Impossible de preparer cette image.";
}
