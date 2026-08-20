"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { Genre } from "@/contracts/movies";

import {
  PROFILE_PREFERENCES_SESSION_KEY,
  readPreferredGenreIds,
} from "./profile-preferences-session";

function subscribeToSessionPreferences() {
  return () => undefined;
}

function readSessionSnapshot() {
  try {
    return window.sessionStorage.getItem(PROFILE_PREFERENCES_SESSION_KEY);
  } catch {
    return null;
  }
}

function readServerSnapshot() {
  return null;
}

export function useProfilePreferencesSession(
  genreOptions: readonly Genre[],
  initialPreferredGenreIds: readonly number[],
) {
  const storedValue = useSyncExternalStore(
    subscribeToSessionPreferences,
    readSessionSnapshot,
    readServerSnapshot,
  );

  return useMemo(
    () =>
      readPreferredGenreIds(
        { getItem: () => storedValue },
        initialPreferredGenreIds,
        genreOptions.map((genre) => genre.id),
      ),
    [genreOptions, initialPreferredGenreIds, storedValue],
  );
}
