import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROFILE_AVATAR_CHOICE,
  PROFILE_AVATAR_COLORS,
  PROFILE_AVATAR_FILE_ERROR,
  PROFILE_AVATAR_MAX_DATA_URL_LENGTH,
  PROFILE_AVATAR_MAX_FILE_BYTES,
  ProfileAvatarChoiceSchema,
  getProfileAvatarFileError,
} from "./profile-avatar-choice";

describe("profile avatar choice", () => {
  it("defines the six reference colors with lilac as the default", () => {
    expect(PROFILE_AVATAR_COLORS).toHaveLength(6);
    expect(PROFILE_AVATAR_COLORS.map((color) => color.id)).toEqual([
      "lilac",
      "sage",
      "terracotta",
      "sand",
      "graphite",
      "gray",
    ]);
    expect(DEFAULT_PROFILE_AVATAR_CHOICE).toEqual({
      kind: "color",
      colorId: "lilac",
    });
  });

  it.each([
    { kind: "color", colorId: "sage" },
    { kind: "photo", dataUrl: "data:image/png;base64,AQID" },
  ])("accepts a valid $kind choice", (choice) => {
    expect(ProfileAvatarChoiceSchema.safeParse(choice).success).toBe(true);
  });

  it.each([
    { kind: "color", colorId: "blue" },
    { kind: "photo", dataUrl: "data:image/svg+xml;base64,AQID" },
    { kind: "photo", dataUrl: "https://example.com/avatar.png" },
  ])("rejects an invalid choice", (choice) => {
    expect(ProfileAvatarChoiceSchema.safeParse(choice).success).toBe(false);
  });

  it("rejects an encoded photo above the session limit", () => {
    const dataUrl = `data:image/png;base64,${"A".repeat(
      PROFILE_AVATAR_MAX_DATA_URL_LENGTH,
    )}`;

    expect(
      ProfileAvatarChoiceSchema.safeParse({ kind: "photo", dataUrl }).success,
    ).toBe(false);
  });

  it("accepts supported files up to 2 MiB", () => {
    expect(
      getProfileAvatarFileError({
        type: "image/webp",
        size: PROFILE_AVATAR_MAX_FILE_BYTES,
      }),
    ).toBeNull();
  });

  it.each([
    { type: "image/gif", size: 1024 },
    { type: "image/png", size: 0 },
    { type: "image/png", size: PROFILE_AVATAR_MAX_FILE_BYTES + 1 },
  ])("rejects unsupported or invalid files", (file) => {
    expect(getProfileAvatarFileError(file)).toBe(PROFILE_AVATAR_FILE_ERROR);
  });
});
