import { z } from "zod";

export const PROFILE_AVATAR_COLOR_IDS = [
  "lilac",
  "sage",
  "terracotta",
  "sand",
  "graphite",
  "gray",
] as const;

export const ProfileAvatarColorIdSchema = z.enum(PROFILE_AVATAR_COLOR_IDS);
export type ProfileAvatarColorId = z.infer<typeof ProfileAvatarColorIdSchema>;

interface ProfileAvatarColorOption {
  id: ProfileAvatarColorId;
  label: string;
  avatarClassName: string;
}

export const PROFILE_AVATAR_COLORS = [
  {
    id: "lilac",
    label: "Lila",
    avatarClassName: "bg-primary! text-primary-foreground!",
  },
  {
    id: "sage",
    label: "Verde salvia",
    avatarClassName: "bg-[#6faaa1]! text-primary-foreground!",
  },
  {
    id: "terracotta",
    label: "Terracota",
    avatarClassName: "bg-[#b8746a]! text-primary-foreground!",
  },
  {
    id: "sand",
    label: "Arena",
    avatarClassName: "bg-[#a5977d]! text-primary-foreground!",
  },
  {
    id: "graphite",
    label: "Grafito",
    avatarClassName: "bg-[#232532]! text-foreground!",
  },
  {
    id: "gray",
    label: "Gris",
    avatarClassName: "bg-[#a6a7b0]! text-primary-foreground!",
  },
] as const satisfies readonly ProfileAvatarColorOption[];

export const PROFILE_AVATAR_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const PROFILE_AVATAR_MAX_DATA_URL_LENGTH =
  4 * Math.ceil(PROFILE_AVATAR_MAX_FILE_BYTES / 3) + 32;
export const PROFILE_AVATAR_FILE_ACCEPT = "image/jpeg,image/png,image/webp";
export const PROFILE_AVATAR_FILE_ERROR =
  "Elegí una imagen JPG, PNG o WebP de hasta 2 MB.";

const ProfileAvatarPhotoDataUrlSchema = z
  .string()
  .max(PROFILE_AVATAR_MAX_DATA_URL_LENGTH)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);

export const ProfileAvatarChoiceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("color"),
      colorId: ProfileAvatarColorIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("photo"),
      dataUrl: ProfileAvatarPhotoDataUrlSchema,
    })
    .strict(),
]);

export type ProfileAvatarChoice = z.infer<typeof ProfileAvatarChoiceSchema>;

export const DEFAULT_PROFILE_AVATAR_CHOICE = {
  kind: "color",
  colorId: "lilac",
} as const satisfies ProfileAvatarChoice;

const acceptedMimeTypes = new Set(PROFILE_AVATAR_FILE_ACCEPT.split(","));

export function getProfileAvatarFileError(file: Pick<File, "size" | "type">) {
  const validType = acceptedMimeTypes.has(file.type);
  const validSize = file.size > 0 && file.size <= PROFILE_AVATAR_MAX_FILE_BYTES;

  return validType && validSize ? null : PROFILE_AVATAR_FILE_ERROR;
}
