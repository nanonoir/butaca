"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  PROFILE_AVATAR_SESSION_KEY,
  readProfileAvatarChoice,
} from "./profile-avatar-session";

function subscribeToProfileAvatar() {
  return () => undefined;
}

function readSessionSnapshot() {
  try {
    return window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY);
  } catch {
    return null;
  }
}

function readServerSnapshot() {
  return null;
}

export function useProfileAvatarSession() {
  const storedValue = useSyncExternalStore(
    subscribeToProfileAvatar,
    readSessionSnapshot,
    readServerSnapshot,
  );

  return useMemo(
    () => readProfileAvatarChoice({ getItem: () => storedValue }),
    [storedValue],
  );
}
