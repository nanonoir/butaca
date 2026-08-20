# Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the responsive `/profile` screen from the approved reference with local data and no simulated account behavior.

**Architecture:** The App Router page imports one serializable fixture and renders a server-side feature component. The feature reuses `Avatar` and `Button`; `Avatar` receives the only shared extension, an explicit 88px `lg` size. Profile-specific tags and statistics remain private to `features/profile`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints

- Existing UI Foundation tokens and components are the visual source of truth.
- Do not add dependencies, client state, authentication, persistence, or unrelated refactors.
- Keep `Editar gustos` and `Cerrar sesión` disabled while preserving their reference appearance.
- Preserve the existing Me gusta implementation and all other routes.
- Use UTF-8 Spanish copy and verify `1440x900` plus `390x844`.
- Do not create a git commit because the user did not request one.

---

### Task 1: Add the approved large Avatar size

**Files:**

- Modify: `src/components/ui/avatar.test.tsx`
- Modify: `src/components/ui/avatar.tsx`

**Interfaces:**

- Consumes: Existing `AvatarProps`, `AVATAR_SIZE.SM`, and `AVATAR_SIZE.MD`.
- Produces: `AVATAR_SIZE.LG = "lg"`, an 88px initials avatar, and an 88px image dimension.

- [ ] **Step 1: Write the failing test**

```tsx
it("renders the approved large profile size", () => {
  render(<Avatar initials="SR" alt="Sofía Ramírez" size="lg" />);

  const avatar = screen.getByRole("img", { name: "Sofía Ramírez" });
  expect(avatar).toHaveTextContent("SR");
  expect(avatar.className).toContain("size-[5.5rem]");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/components/ui/avatar.test.tsx`

Expected: FAIL because `lg` is outside `AvatarSize` and no 88px class exists.

- [ ] **Step 3: Implement the minimal extension**

```tsx
export const AVATAR_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
} as const;

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-[5.5rem] text-2xl",
};

const sizeDimensions: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 88,
};
```

Replace the image dimension conditional with `const dimension = sizeDimensions[size]`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/components/ui/avatar.test.tsx`

Expected: all three Avatar tests pass.

### Task 2: Build the server-rendered ProfileScreen

**Files:**

- Create: `src/features/profile/profile-screen.test.tsx`
- Create: `src/features/profile/profile-screen.tsx`

**Interfaces:**

- Consumes: `Avatar`, `AVATAR_SIZE.LG`, `Button`, `BUTTON_VARIANT.OUTLINE`, and one `profile` view model.
- Produces: `ProfileScreen({ profile }: ProfileScreenProps)`.

- [ ] **Step 1: Write the failing component test**

Use this exact test data:

```tsx
const PROFILE = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
  preferredGenres: ["Ciencia ficción", "Drama", "Thriller"],
  activity: [
    { label: "Me gusta", value: 10, tone: "primary" as const },
    { label: "Vistas", value: 6, tone: "default" as const },
    { label: "Reseñas", value: 1, tone: "default" as const },
  ],
};
```

Render `ProfileScreen` and assert:

```tsx
expect(
  screen.getByRole("heading", { level: 1, name: "Sofía Ramírez" }),
).toBeTruthy();
expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveTextContent(
  "SR",
);
expect(screen.getByText("sofia.ramirez@correo.com")).toBeTruthy();
expect(
  screen.getByRole("list", { name: "Géneros preferidos" }).children,
).toHaveLength(3);
expect(screen.getByText("10")).toBeTruthy();
expect(screen.getByText("6")).toBeTruthy();
expect(screen.getByText("1")).toBeTruthy();
expect(screen.getByRole("button", { name: "Editar gustos" })).toBeDisabled();
expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeDisabled();
```

- [ ] **Step 2: Run the feature test and verify RED**

Run: `pnpm exec vitest run src/features/profile/profile-screen.test.tsx`

Expected: FAIL because the profile module does not exist.

- [ ] **Step 3: Implement ProfileScreen**

Create a server component with this public shape:

```tsx
interface ProfileActivityItem {
  label: string;
  value: number;
  tone: "primary" | "default";
}

export interface ProfileScreenProps {
  profile: {
    displayName: string;
    email: string;
    initials: string;
    preferredGenres: readonly string[];
    activity: readonly ProfileActivityItem[];
  };
}
```

Render a `max-w-4xl` page with:

```tsx
<header className="flex min-w-0 items-center gap-5">
  <Avatar
    alt={profile.displayName}
    initials={profile.initials}
    size={AVATAR_SIZE.LG}
  />
  <div className="min-w-0">
    <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
      {profile.displayName}
    </h1>
    <p className="mt-1 break-all text-base text-muted">{profile.email}</p>
  </div>
</header>
```

Use private `SectionHeading` and `ActivityStat` helpers defined at module scope. Render genres as `ul[aria-label="Géneros preferidos"]`. Render activity as a three-column `dl` with borders between columns. Apply `disabled` and `disabled:opacity-100` to both existing outline Buttons. Keep the account button full width, left aligned, and `min-h-[4.375rem]`.

- [ ] **Step 4: Run the feature test and verify GREEN**

Run: `pnpm exec vitest run src/features/profile/profile-screen.test.tsx`

Expected: the profile component test passes with no warnings.

### Task 3: Connect the local fixture to `/profile`

**Files:**

- Create: `src/fixtures/profile.ts`
- Create: `src/app/profile/page.test.tsx`
- Create: `src/app/profile/page.tsx`
- Modify: `vitest.config.ts`

**Interfaces:**

- Consumes: `ProfileScreen` and `PROFILE_FIXTURE`.
- Produces: a statically renderable `/profile` route.

- [ ] **Step 1: Add the route test include and write the failing test**

Add `"src/app/profile/**/*.test.tsx"` to `vitest.config.ts`, then create:

```tsx
/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import ProfilePage from "./page";

afterEach(cleanup);

describe("ProfilePage", () => {
  it("connects the local profile fixture to the profile screen", () => {
    render(<ProfilePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sofía Ramírez" }),
    ).toBeTruthy();
    expect(screen.getByText("Ciencia ficción")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `pnpm exec vitest run src/app/profile/page.test.tsx`

Expected: FAIL because `page.tsx` does not exist.

- [ ] **Step 3: Add the exact fixture and route**

```ts
export const PROFILE_FIXTURE = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
  preferredGenres: ["Ciencia ficción", "Drama", "Thriller"],
  activity: [
    { label: "Me gusta", value: 10, tone: "primary" },
    { label: "Vistas", value: 6, tone: "default" },
    { label: "Reseñas", value: 1, tone: "default" },
  ],
} as const;
```

```tsx
import { ProfileScreen } from "@/features/profile/profile-screen";
import { PROFILE_FIXTURE } from "@/fixtures/profile";

export default function ProfilePage() {
  return <ProfileScreen profile={PROFILE_FIXTURE} />;
}
```

- [ ] **Step 4: Run the route test and verify GREEN**

Run: `pnpm exec vitest run src/app/profile/page.test.tsx`

Expected: the route test passes.

### Task 4: Verify the final implementation

**Files:**

- Verify only. Save screenshots outside the repository.

**Interfaces:**

- Consumes: the final code and `http://localhost:3000/profile`.
- Produces: static and rendered evidence.

- [ ] **Step 1: Format and inspect scope**

Run Prettier on the Profile files and changed Avatar files. Then run `git diff --check` and `git status --short`.

Expected: no whitespace errors; only Profile work and the existing Me gusta work appear.

- [ ] **Step 2: Run static gates**

Run independently: `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.

Expected: every command exits with code 0 and `/profile` appears as a static route in the build output.

- [ ] **Step 3: Verify the target flow in the in-app browser**

The flow under test is: `/profile` loads -> identity, three genres, three activity metrics, and disabled account controls render -> the same content remains readable at `390x844` without overlapping the mobile navigation.

Check page identity, meaningful DOM, framework overlay absence, console health, disabled semantics, desktop screenshot, and mobile screenshot. Reset the temporary viewport override and leave `/profile` open.

## Execution

Inline execution was selected by the user's explicit request to implement the recommended option. No subagents, worktree, commit, or dependency changes are authorized.
