import { describe, expect, it } from "vitest";
import {
  avatarErrorMessage,
  getAvatarColor,
  getAvatarInitials,
  validateAvatarFile,
} from "./avatar";

describe("getAvatarInitials", () => {
  it("uses first and last name initials", () => {
    expect(getAvatarInitials("Guillaume Dupont", "guillaume@example.com")).toBe("GD");
  });

  it("falls back to email when display name is empty", () => {
    expect(getAvatarInitials("", "marie@example.com")).toBe("MA");
  });
});

describe("getAvatarColor", () => {
  it("returns a stable deterministic color", () => {
    expect(getAvatarColor("user-123")).toBe(getAvatarColor("user-123"));
    expect(getAvatarColor("user-123")).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("validateAvatarFile", () => {
  it("accepts supported image formats", () => {
    expect(() =>
      validateAvatarFile(new File(["content"], "avatar.webp", { type: "image/webp" })),
    ).not.toThrow();
  });

  it("rejects unsupported formats", () => {
    expect(() =>
      validateAvatarFile(new File(["content"], "avatar.gif", { type: "image/gif" })),
    ).toThrow("AVATAR_INVALID_TYPE");
  });
});

describe("avatarErrorMessage", () => {
  it("maps avatar validation errors", () => {
    expect(avatarErrorMessage("AVATAR_INVALID_TYPE")).toBe("Choisis une image JPEG, PNG ou WebP.");
  });
});
