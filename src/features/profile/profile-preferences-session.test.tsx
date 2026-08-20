import { describe, expect, it } from "vitest";

import {
  PROFILE_PREFERENCES_SESSION_KEY,
  readPreferredGenreIds,
  writePreferredGenreIds,
} from "./profile-preferences-session";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const ALLOWED_IDS = [878, 18, 53, 27];
const FALLBACK_IDS = [878, 18, 53];

describe("profile preferences session storage", () => {
  it("returns the fallback when the session has no saved selection", () => {
    const storage = new MemoryStorage();

    expect(readPreferredGenreIds(storage, FALLBACK_IDS, ALLOWED_IDS)).toEqual(
      FALLBACK_IDS,
    );
  });

  it("returns a saved selection that passes the preferences contract", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROFILE_PREFERENCES_SESSION_KEY, JSON.stringify([878, 27]));

    expect(readPreferredGenreIds(storage, FALLBACK_IDS, ALLOWED_IDS)).toEqual([
      878, 27,
    ]);
  });

  it.each([
    ["invalid JSON", "not-json"],
    ["fewer than two genres", JSON.stringify([878])],
    ["duplicate genres", JSON.stringify([878, 878])],
    ["an unknown genre", JSON.stringify([878, 999])],
  ])("falls back for %s", (_label, storedValue) => {
    const storage = new MemoryStorage();
    storage.setItem(PROFILE_PREFERENCES_SESSION_KEY, storedValue);

    expect(readPreferredGenreIds(storage, FALLBACK_IDS, ALLOWED_IDS)).toEqual(
      FALLBACK_IDS,
    );
  });

  it("writes a valid selection as JSON", () => {
    const storage = new MemoryStorage();

    expect(writePreferredGenreIds(storage, [878, 27])).toBe(true);
    expect(storage.getItem(PROFILE_PREFERENCES_SESSION_KEY)).toBe(
      JSON.stringify([878, 27]),
    );
  });

  it("rejects contract-invalid values before writing", () => {
    const storage = new MemoryStorage();

    expect(writePreferredGenreIds(storage, [878])).toBe(false);
    expect(storage.getItem(PROFILE_PREFERENCES_SESSION_KEY)).toBeNull();
  });

  it("contains storage access failures", () => {
    const throwingStorage = {
      getItem() {
        throw new Error("Storage unavailable");
      },
      setItem() {
        throw new Error("Storage unavailable");
      },
    };

    expect(
      readPreferredGenreIds(throwingStorage, FALLBACK_IDS, ALLOWED_IDS),
    ).toEqual(FALLBACK_IDS);
    expect(writePreferredGenreIds(throwingStorage, [878, 27])).toBe(false);
  });
});
