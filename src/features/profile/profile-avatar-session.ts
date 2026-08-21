import {
  DEFAULT_PROFILE_AVATAR_CHOICE,
  ProfileAvatarChoiceSchema,
  type ProfileAvatarChoice,
} from "./profile-avatar-choice";

export const PROFILE_AVATAR_SESSION_KEY = "butaca:profile-avatar";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function readProfileAvatarChoice(
  storage: ReadableStorage,
): ProfileAvatarChoice {
  try {
    const storedValue = storage.getItem(PROFILE_AVATAR_SESSION_KEY);

    if (storedValue === null) {
      return { ...DEFAULT_PROFILE_AVATAR_CHOICE };
    }

    const result = ProfileAvatarChoiceSchema.safeParse(
      JSON.parse(storedValue) as unknown,
    );

    return result.success ? result.data : { ...DEFAULT_PROFILE_AVATAR_CHOICE };
  } catch {
    return { ...DEFAULT_PROFILE_AVATAR_CHOICE };
  }
}

export function writeProfileAvatarChoice(
  storage: WritableStorage,
  choice: unknown,
) {
  const result = ProfileAvatarChoiceSchema.safeParse(choice);

  if (!result.success) {
    return false;
  }

  try {
    storage.setItem(PROFILE_AVATAR_SESSION_KEY, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}
