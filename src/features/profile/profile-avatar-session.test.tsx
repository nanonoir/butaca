import { describe, expect, it } from "vitest";

import {
  PROFILE_AVATAR_SESSION_KEY,
  readProfileAvatarChoice,
  writeProfileAvatarChoice,
} from "./profile-avatar-session";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("profile avatar session", () => {
  it("returns lilac when the session has no choice", () => {
    expect(readProfileAvatarChoice(new MemoryStorage())).toEqual({
      kind: "color",
      colorId: "lilac",
    });
  });

  it.each([
    { kind: "color", colorId: "sage" },
    { kind: "photo", dataUrl: "data:image/png;base64,AQID" },
  ])("reads a valid $kind choice", (choice) => {
    const storage = new MemoryStorage();
    storage.setItem(PROFILE_AVATAR_SESSION_KEY, JSON.stringify(choice));

    expect(readProfileAvatarChoice(storage)).toEqual(choice);
  });

  it.each([
    "not-json",
    JSON.stringify({ kind: "color", colorId: "blue" }),
    JSON.stringify({
      kind: "photo",
      dataUrl: "data:image/svg+xml;base64,AQID",
    }),
  ])("falls back for invalid stored data", (storedValue) => {
    const storage = new MemoryStorage();
    storage.setItem(PROFILE_AVATAR_SESSION_KEY, storedValue);

    expect(readProfileAvatarChoice(storage)).toEqual({
      kind: "color",
      colorId: "lilac",
    });
  });

  it("validates and writes a choice", () => {
    const storage = new MemoryStorage();

    expect(
      writeProfileAvatarChoice(storage, {
        kind: "color",
        colorId: "graphite",
      }),
    ).toBe(true);
    expect(storage.getItem(PROFILE_AVATAR_SESSION_KEY)).toBe(
      JSON.stringify({ kind: "color", colorId: "graphite" }),
    );
    expect(
      writeProfileAvatarChoice(storage, { kind: "color", colorId: "blue" }),
    ).toBe(false);
  });

  it("contains browser storage failures", () => {
    const throwingStorage = {
      getItem() {
        throw new Error("Storage unavailable");
      },
      setItem() {
        throw new Error("Storage unavailable");
      },
    };

    expect(readProfileAvatarChoice(throwingStorage)).toEqual({
      kind: "color",
      colorId: "lilac",
    });
    expect(
      writeProfileAvatarChoice(throwingStorage, {
        kind: "color",
        colorId: "sage",
      }),
    ).toBe(false);
  });
});
