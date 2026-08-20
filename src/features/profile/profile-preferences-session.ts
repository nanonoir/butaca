import { UpdatePreferencesRequestSchema } from "@/contracts/preferences";

export const PROFILE_PREFERENCES_SESSION_KEY = "butaca:preferred-genre-ids";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function readPreferredGenreIds(
  storage: ReadableStorage,
  fallbackIds: readonly number[],
  allowedIds: readonly number[],
) {
  try {
    const storedValue = storage.getItem(PROFILE_PREFERENCES_SESSION_KEY);

    if (storedValue === null) {
      return [...fallbackIds];
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    const result = UpdatePreferencesRequestSchema.safeParse({
      preferredGenreIds: parsedValue,
    });

    if (!result.success) {
      return [...fallbackIds];
    }

    const allowedIdSet = new Set(allowedIds);
    const containsUnknownGenre = result.data.preferredGenreIds.some(
      (genreId) => !allowedIdSet.has(genreId),
    );

    return containsUnknownGenre
      ? [...fallbackIds]
      : result.data.preferredGenreIds;
  } catch {
    return [...fallbackIds];
  }
}

export function writePreferredGenreIds(
  storage: WritableStorage,
  preferredGenreIds: readonly number[],
) {
  const result = UpdatePreferencesRequestSchema.safeParse({
    preferredGenreIds: [...preferredGenreIds],
  });

  if (!result.success) {
    return false;
  }

  try {
    storage.setItem(
      PROFILE_PREFERENCES_SESSION_KEY,
      JSON.stringify(result.data.preferredGenreIds),
    );
    return true;
  } catch {
    return false;
  }
}
