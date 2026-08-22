# Profile Avatar Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline Profile avatar editor with six colors, validated photo upload, instant feedback, and browser-session persistence.

**Architecture:** Keep `ProfileScreen` server-rendered and replace only its identity header with a focused client component. A feature-owned Zod contract validates avatar choices, a storage adapter contains `sessionStorage` access, and a small hook follows the existing Profile preferences snapshot pattern.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zod, Vitest, Testing Library.

## Global Constraints

- Treat the existing UI Foundation and `/profile` screen as the visual source of truth.
- Reuse `Avatar` and `Button`; do not add a UI library or icon dependency.
- Keep `ProfileScreen` as a server component.
- Persist only in `sessionStorage` under `butaca:profile-avatar`; do not claim account persistence.
- Accept only JPEG, PNG, and WebP files of 2 MiB or less.
- Keep the editor inline with no modal, cropper, save action, API, server action, Supabase call, or remote upload.
- Apply a valid choice in the same event and show `Avatar actualizado` after a successful session write.
- Apply the mounted-view update when storage fails, then show `No pudimos conservar el avatar en esta sesión.`
- Keep controls at least 44 px high, preserve focus-visible styles, and prevent horizontal overflow.
- Modify only Avatar and Profile files required by this feature.
- Preserve UTF-8 Spanish copy and use Zod as the validation source of truth.
- Follow RED, GREEN, REFACTOR for every production change.
- Do not push, merge, or open a PR unless the user requests it.

---

### Task 1: Let the shared Avatar accept feature styling

**Files:**

- Modify: `src/components/ui/avatar.test.tsx:29-37`
- Modify: `src/components/ui/avatar.tsx:11-49`

**Interfaces:**

- Consumes: existing `AvatarProps`, size classes, and accessible fallback behavior.
- Produces: `AvatarProps.className?: string` applied to both image and initials rendering without changing defaults.

- [ ] **Step 1: Write the failing custom-class test**

Append this test inside the existing `describe("Avatar", ...)` block:

```tsx
it("accepts feature styling without replacing its base classes", () => {
  render(
    <Avatar
      initials="SR"
      alt="Sofía Ramírez"
      size="lg"
      className="bg-surface-elevated!"
    />,
  );

  const avatar = screen.getByRole("img", { name: "Sofía Ramírez" });
  expect(avatar).toHaveClass(
    "rounded-full",
    "size-[5.5rem]",
    "bg-surface-elevated!",
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run src/components/ui/avatar.test.tsx
```

Expected: FAIL because `Avatar` ignores `className` and the rendered element lacks `bg-surface-elevated!`.

- [ ] **Step 3: Add the minimal className support**

Update the public props and class composition:

```tsx
export interface AvatarProps {
  src?: string;
  initials: string;
  alt: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({
  src,
  initials,
  alt,
  size = AVATAR_SIZE.MD,
  className,
}: AvatarProps) {
  const classes = [
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-medium text-primary-foreground forced-colors-boundary",
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Keep the existing image and fallback branches unchanged.
}
```

- [ ] **Step 4: Run Avatar tests and typecheck**

Run:

```bash
pnpm exec vitest run src/components/ui/avatar.test.tsx
pnpm typecheck
```

Expected: all Avatar tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the shared extension**

```bash
git add src/components/ui/avatar.tsx src/components/ui/avatar.test.tsx
git diff --cached --check
git diff --cached
git commit -m "feat(ui): permite personalizar el avatar"
```

### Task 2: Define validated avatar choices and file limits

**Files:**

- Create: `src/features/profile/profile-avatar-choice.test.ts`
- Create: `src/features/profile/profile-avatar-choice.ts`

**Interfaces:**

- Consumes: Zod.
- Produces: `PROFILE_AVATAR_COLORS`, `PROFILE_AVATAR_FILE_ACCEPT`, `PROFILE_AVATAR_MAX_FILE_BYTES`, `PROFILE_AVATAR_FILE_ERROR`, `ProfileAvatarChoiceSchema`, `ProfileAvatarChoice`, `DEFAULT_PROFILE_AVATAR_CHOICE`, and `getProfileAvatarFileError(file)`.

- [ ] **Step 1: Write failing contract and file-validation tests**

Create `src/features/profile/profile-avatar-choice.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-avatar-choice.test.ts
```

Expected: FAIL because `profile-avatar-choice.ts` does not exist.

- [ ] **Step 3: Implement the choice contract and palette**

Create `src/features/profile/profile-avatar-choice.ts`:

```ts
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
```

- [ ] **Step 4: Run the focused test and typecheck**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-avatar-choice.test.ts
pnpm typecheck
```

Expected: the contract tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the validated model**

```bash
git add src/features/profile/profile-avatar-choice.ts src/features/profile/profile-avatar-choice.test.ts
git diff --cached --check
git diff --cached
git commit -m "feat(profile): define opciones válidas de avatar"
```

### Task 3: Add safe session persistence and the client snapshot hook

**Files:**

- Create: `src/features/profile/profile-avatar-session.test.ts`
- Create: `src/features/profile/profile-avatar-session.ts`
- Create: `src/features/profile/use-profile-avatar-session.ts`

**Interfaces:**

- Consumes: `DEFAULT_PROFILE_AVATAR_CHOICE`, `ProfileAvatarChoiceSchema`, and `ProfileAvatarChoice` from Task 2.
- Produces: `PROFILE_AVATAR_SESSION_KEY`, `readProfileAvatarChoice(storage)`, `writeProfileAvatarChoice(storage, choice)`, and `useProfileAvatarSession()`.

- [ ] **Step 1: Write failing session adapter tests**

Create `src/features/profile/profile-avatar-session.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the session test and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-avatar-session.test.ts
```

Expected: FAIL because `profile-avatar-session.ts` does not exist.

- [ ] **Step 3: Implement the storage adapter**

Create `src/features/profile/profile-avatar-session.ts`:

```ts
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
```

- [ ] **Step 4: Implement the session snapshot hook**

Create `src/features/profile/use-profile-avatar-session.ts`:

```ts
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
```

- [ ] **Step 5: Run session tests, existing preference tests, and typecheck**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-avatar-session.test.ts src/features/profile/profile-preferences-session.test.tsx
pnpm typecheck
```

Expected: both session adapters pass their tests and TypeScript exits with code 0.

- [ ] **Step 6: Commit the session boundary**

```bash
git add src/features/profile/profile-avatar-session.ts src/features/profile/profile-avatar-session.test.ts src/features/profile/use-profile-avatar-session.ts
git diff --cached --check
git diff --cached
git commit -m "feat(profile): persiste el avatar por sesión"
```

### Task 4: Build the inline editor with instant updates

**Files:**

- Create: `src/features/profile/profile-avatar-editor.test.tsx`
- Create: `src/features/profile/profile-avatar-editor.tsx`

**Interfaces:**

- Consumes: `Avatar`, `Button`, all Task 2 choice exports, `writeProfileAvatarChoice`, and `useProfileAvatarSession`.
- Produces: `ProfileAvatarEditor({ displayName, email, initials })`.

- [ ] **Step 1: Write the failing interaction tests**

Create `src/features/profile/profile-avatar-editor.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROFILE_AVATAR_MAX_FILE_BYTES,
  PROFILE_AVATAR_FILE_ERROR,
} from "./profile-avatar-choice";
import { PROFILE_AVATAR_SESSION_KEY } from "./profile-avatar-session";
import { ProfileAvatarEditor } from "./profile-avatar-editor";

const PROPS = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
};

function renderEditor() {
  return render(<ProfileAvatarEditor {...PROPS} />);
}

function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));
}

describe("ProfileAvatarEditor", () => {
  beforeEach(() => window.sessionStorage.clear());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens from the avatar and closes with Listo", () => {
    renderEditor();

    const avatarButton = screen.getByRole("button", {
      name: "Cambiar avatar",
    });
    expect(avatarButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeEnabled();
    expect(
      screen.queryByRole("group", { name: "Opciones de avatar" }),
    ).toBeNull();

    fireEvent.click(avatarButton);

    expect(avatarButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("group", { name: "Opciones de avatar" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /^Usar color / }),
    ).toHaveLength(6);
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Subir foto" })).toBeEnabled();
    expect(screen.getByLabelText("Seleccionar foto de perfil")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(
      screen.queryByRole("group", { name: "Opciones de avatar" }),
    ).toBeNull();
  });

  it("opens from Cambiar and applies a color in the same interaction", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Usar color Verde salvia" }),
    );

    expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
      "bg-[#6faaa1]!",
    );
    expect(
      screen.getByRole("button", { name: "Usar color Verde salvia" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Avatar actualizado");
    expect(window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY)).toBe(
      JSON.stringify({ kind: "color", colorId: "sage" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(
      screen.queryByRole("group", { name: "Opciones de avatar" }),
    ).toBeNull();
    expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
      "bg-[#6faaa1]!",
    );
  });

  it("hydrates a valid saved color", async () => {
    window.sessionStorage.setItem(
      PROFILE_AVATAR_SESSION_KEY,
      JSON.stringify({ kind: "color", colorId: "terracotta" }),
    );

    renderEditor();
    openEditor();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
        "bg-[#b8746a]!",
      );
      expect(
        screen.getByRole("button", { name: "Usar color Terracota" }),
      ).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("uploads a valid photo and confirms the update", async () => {
    renderEditor();
    openEditor();
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", {
      type: "image/png",
    });
    const fileInput = screen.getByLabelText("Seleccionar foto de perfil");

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Sofía Ramírez" }),
      ).toHaveAttribute("src", "data:image/png;base64,AQID");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Avatar actualizado",
      );
    });
    expect(fileInput).toHaveValue("");

    expect(
      JSON.parse(
        window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY) ?? "null",
      ),
    ).toEqual({ kind: "photo", dataUrl: "data:image/png;base64,AQID" });
  });

  it.each([
    new File([new Uint8Array([1])], "avatar.gif", { type: "image/gif" }),
    new File(
      [new Uint8Array(PROFILE_AVATAR_MAX_FILE_BYTES + 1)],
      "avatar.png",
      { type: "image/png" },
    ),
  ])("rejects an invalid photo without changing the avatar", async (file) => {
    renderEditor();
    openEditor();

    fireEvent.change(screen.getByLabelText("Seleccionar foto de perfil"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      PROFILE_AVATAR_FILE_ERROR,
    );
    expect(
      screen.getByRole("img", { name: "Sofía Ramírez" }),
    ).toHaveTextContent("SR");
    expect(
      window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY),
    ).toBeNull();
  });

  it("reports a FileReader failure without changing the avatar", async () => {
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(
      function failRead(this: FileReader) {
        this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      },
    );
    renderEditor();
    openEditor();

    fireEvent.change(screen.getByLabelText("Seleccionar foto de perfil"), {
      target: {
        files: [
          new File([new Uint8Array([1])], "avatar.png", {
            type: "image/png",
          }),
        ],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos leer esa imagen. Intentá de nuevo.",
    );
    expect(
      screen.getByRole("img", { name: "Sofía Ramírez" }),
    ).toHaveTextContent("SR");
  });

  it("keeps the mounted update visible when storage fails", () => {
    renderEditor();
    openEditor();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    fireEvent.click(screen.getByRole("button", { name: "Usar color Grafito" }));

    expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
      "bg-[#232532]!",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos conservar el avatar en esta sesión.",
    );
  });
});
```

- [ ] **Step 2: Run the editor test and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-avatar-editor.test.tsx
```

Expected: FAIL because `profile-avatar-editor.tsx` does not exist.

- [ ] **Step 3: Implement the editor**

Create `src/features/profile/profile-avatar-editor.tsx`:

```tsx
"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";

import { AVATAR_SIZE, Avatar } from "@/components/ui/avatar";
import { BUTTON_VARIANT, CONTROL_SIZE, Button } from "@/components/ui/button";

import {
  PROFILE_AVATAR_COLORS,
  PROFILE_AVATAR_FILE_ACCEPT,
  PROFILE_AVATAR_FILE_ERROR,
  ProfileAvatarChoiceSchema,
  getProfileAvatarFileError,
  type ProfileAvatarChoice,
} from "./profile-avatar-choice";
import { writeProfileAvatarChoice } from "./profile-avatar-session";
import { useProfileAvatarSession } from "./use-profile-avatar-session";

interface ProfileAvatarEditorProps {
  displayName: string;
  email: string;
  initials: string;
}

interface Feedback {
  tone: "success" | "error";
  message: string;
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M6.8 5.5 8 3.8h4l1.2 1.7h1.9A1.9 1.9 0 0 1 17 7.4v7A1.9 1.9 0 0 1 15.1 16H4.9A1.9 1.9 0 0 1 3 14.4v-7a1.9 1.9 0 0 1 1.9-1.9h1.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="10"
        cy="10.5"
        r="2.7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 12.5V16h12v-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readPhotoChoice(file: File) {
  return new Promise<ProfileAvatarChoice>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = ProfileAvatarChoiceSchema.safeParse({
        kind: "photo",
        dataUrl: reader.result,
      });

      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error("Invalid avatar data URL"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function ProfileAvatarEditor({
  displayName,
  email,
  initials,
}: ProfileAvatarEditorProps) {
  const editorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionChoice = useProfileAvatarSession();
  const [choiceOverride, setChoiceOverride] =
    useState<ProfileAvatarChoice | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const choice = choiceOverride ?? sessionChoice;
  const selectedColor =
    choice.kind === "color"
      ? PROFILE_AVATAR_COLORS.find((color) => color.id === choice.colorId)
      : undefined;

  function openEditor() {
    setFeedback(null);
    setIsOpen(true);
  }

  function closeEditor() {
    setFeedback(null);
    setIsOpen(false);
  }

  function applyChoice(nextChoice: ProfileAvatarChoice) {
    setChoiceOverride(nextChoice);
    const persisted = writeProfileAvatarChoice(
      window.sessionStorage,
      nextChoice,
    );

    setFeedback(
      persisted
        ? { tone: "success", message: "Avatar actualizado" }
        : {
            tone: "error",
            message: "No pudimos conservar el avatar en esta sesión.",
          },
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";

    if (!file) {
      return;
    }

    const validationError = getProfileAvatarFileError(file);

    if (validationError) {
      setFeedback({ tone: "error", message: PROFILE_AVATAR_FILE_ERROR });
      return;
    }

    try {
      applyChoice(await readPhotoChoice(file));
    } catch {
      setFeedback({
        tone: "error",
        message: "No pudimos leer esa imagen. Intentá de nuevo.",
      });
    }
  }

  return (
    <header>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-5">
        <button
          type="button"
          aria-controls={editorId}
          aria-expanded={isOpen}
          aria-label="Cambiar avatar"
          className="relative shrink-0 rounded-full transition-transform duration-fast ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.97]"
          data-motion-transform
          onClick={openEditor}
        >
          <Avatar
            alt={displayName}
            className={selectedColor?.avatarClassName}
            initials={initials}
            size={AVATAR_SIZE.LG}
            src={choice.kind === "photo" ? choice.dataUrl : undefined}
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-primary-foreground">
            <CameraIcon />
          </span>
        </button>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
              {displayName}
            </h1>
            <Button
              className={
                isOpen
                  ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
                  : "text-primary hover:text-primary"
              }
              onClick={isOpen ? closeEditor : openEditor}
              size={CONTROL_SIZE.SM}
              variant={BUTTON_VARIANT.GHOST}
            >
              {isOpen ? "Listo" : "Cambiar"}
            </Button>
          </div>
          <p className="mt-1 break-words text-base text-muted">{email}</p>
        </div>
      </div>

      {isOpen ? (
        <div
          id={editorId}
          aria-label="Opciones de avatar"
          className="mt-5 rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
          role="group"
        >
          <div className="flex flex-wrap items-center gap-3">
            {PROFILE_AVATAR_COLORS.map((color) => (
              <Button
                key={color.id}
                aria-label={`Usar color ${color.label}`}
                aria-pressed={
                  choice.kind === "color" && choice.colorId === color.id
                }
                className="size-14! rounded-full border-2 border-transparent p-1! aria-pressed:border-primary! aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface-elevated"
                onClick={() =>
                  applyChoice({ kind: "color", colorId: color.id })
                }
                size={CONTROL_SIZE.LG}
                variant={BUTTON_VARIANT.ICON}
              >
                <Avatar
                  alt={`Vista previa ${color.label}`}
                  className={color.avatarClassName}
                  initials={initials}
                  size={AVATAR_SIZE.MD}
                />
              </Button>
            ))}

            <span
              aria-hidden="true"
              className="mx-1 hidden h-10 w-px bg-border sm:block"
            />

            <input
              ref={fileInputRef}
              aria-label="Seleccionar foto de perfil"
              accept={PROFILE_AVATAR_FILE_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
              tabIndex={-1}
              type="file"
            />
            <Button
              className="rounded-full border-dashed px-5 text-base"
              onClick={() => fileInputRef.current?.click()}
              size={CONTROL_SIZE.LG}
              variant={BUTTON_VARIANT.OUTLINE}
            >
              <UploadIcon />
              Subir foto
            </Button>
          </div>

          {feedback ? (
            <p
              className="mt-4 text-sm text-primary"
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 4: Run the editor tests and fix only implementation defects**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-avatar-editor.test.tsx
```

Expected: all editor tests pass with no React warnings.

- [ ] **Step 5: Run the complete Profile feature slice**

Run:

```bash
pnpm exec vitest run src/features/profile
pnpm typecheck
pnpm lint
```

Expected: all Profile tests pass; TypeScript and ESLint exit with code 0.

- [ ] **Step 6: Commit the editor**

```bash
git add src/features/profile/profile-avatar-editor.tsx src/features/profile/profile-avatar-editor.test.tsx
git diff --cached --check
git diff --cached
git commit -m "feat(profile): implementa la edición inline del avatar"
```

### Task 5: Integrate the editor into Profile and verify responsive behavior

**Files:**

- Modify: `src/features/profile/profile-screen.test.tsx:36-52`
- Modify: `src/features/profile/profile-screen.tsx:1-78`
- Modify: `src/app/profile/page.test.tsx:17-30`

**Interfaces:**

- Consumes: `ProfileAvatarEditor` from Task 4 and the current profile fixture fields.
- Produces: `/profile` with the inline editor in place of the static identity header.

- [ ] **Step 1: Write failing Profile integration assertions**

Add these assertions to the identity test in `profile-screen.test.tsx`:

```tsx
const avatarButton = screen.getByRole("button", { name: "Cambiar avatar" });
expect(avatarButton).toHaveAttribute("aria-expanded", "false");
expect(screen.getByRole("button", { name: "Cambiar" })).toBeEnabled();
```

Add the route-level assertion to `src/app/profile/page.test.tsx`:

```tsx
expect(screen.getByRole("button", { name: "Cambiar avatar" })).toHaveAttribute(
  "aria-expanded",
  "false",
);
```

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-screen.test.tsx src/app/profile/page.test.tsx
```

Expected: FAIL because the static Profile header has no avatar button or `Cambiar` action.

- [ ] **Step 3: Replace only the static identity header**

Remove the direct `Avatar` import from `profile-screen.tsx`, import the new editor, and replace the current `<header>` block:

```tsx
import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import type { Genre } from "@/contracts/movies";

import { ProfileAvatarEditor } from "./profile-avatar-editor";
import { ProfilePreferencesSummary } from "./profile-preferences-summary";

// Keep ProfileActivityItem, ProfileScreenProps, SectionHeading, and ActivityStat unchanged.

export function ProfileScreen({ genreOptions, profile }: ProfileScreenProps) {
  return (
    <div className="mx-auto w-full max-w-4xl py-2 md:py-0">
      <ProfileAvatarEditor
        displayName={profile.displayName}
        email={profile.email}
        initials={profile.initials}
      />

      <div className="mt-8 space-y-10">
        {/* Keep tastes, activity, and account sections unchanged. */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run Profile and route tests**

Run:

```bash
pnpm exec vitest run src/features/profile src/app/profile
```

Expected: the new identity assertions and all existing taste/activity tests pass.

- [ ] **Step 5: Start the app and inspect desktop behavior**

Run:

```bash
pnpm dev
```

Open `http://localhost:3000/profile` at 1280 by 720 and verify:

- the main avatar keeps its 88 px size and camera badge;
- `Cambiar` sits in the identity row;
- clicking the avatar opens the same inline panel as `Cambiar`;
- exactly six colors render with one selected double ring;
- each color applies with no save action and shows `Avatar actualizado`;
- `Listo` closes the panel without reverting the avatar;
- a valid PNG uploads, displays, and survives a page reload;
- the console has no errors or hydration warnings.

- [ ] **Step 6: Inspect mobile behavior**

Resize to 390 by 844 and verify:

- the identity and action wrap without clipping;
- color controls and `Subir foto` wrap inside the panel;
- no horizontal scrolling appears;
- every control remains at least 44 px high;
- the panel clears the fixed navigation.

If browser inspection finds a defect, add a focused failing test before changing production code, then repeat the focused test and browser check.

If `next dev` re-adds its generated agent-rules block to `AGENTS.md`, remove only that generated block before staging and confirm `git diff -- AGENTS.md` is empty.

- [ ] **Step 7: Run the repository verification gate**

Stop the dev server before the production build, then run:

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm exec prettier --check -- src/components/ui/avatar.tsx src/components/ui/avatar.test.tsx src/features/profile/profile-avatar-choice.ts src/features/profile/profile-avatar-choice.test.ts src/features/profile/profile-avatar-session.ts src/features/profile/profile-avatar-session.test.ts src/features/profile/use-profile-avatar-session.ts src/features/profile/profile-avatar-editor.tsx src/features/profile/profile-avatar-editor.test.tsx src/features/profile/profile-screen.tsx src/features/profile/profile-screen.test.tsx src/app/profile/page.test.tsx
pnpm build
```

Expected: all tests pass, TypeScript and ESLint exit with code 0, all changed files pass Prettier, and the production route list includes `/profile`.

- [ ] **Step 8: Commit the Profile integration**

```bash
git add src/features/profile/profile-screen.tsx src/features/profile/profile-screen.test.tsx src/app/profile/page.test.tsx
git diff --cached --check
git diff --cached
git commit -m "feat(profile): integra el editor de avatar"
```

- [ ] **Step 9: Confirm the final branch state**

Run:

```bash
git status --short --branch
git log -6 --oneline --decorate
```

Expected: no unstaged or untracked implementation files remain. The branch stays local until the user requests a push.

## Execution

Choose the execution method at handoff. Do not dispatch subagents until the user selects that option. Do not create a new worktree unless the chosen execution skill requires one and the workspace state supports it.
