# Profile Preferences Implementation Plan

> Steps use checkbox (`- [ ]`) syntax to preserve the implementation sequence and verification intent.

**Goal:** Add a responsive `/profile/preferences` genre selector that saves validated TMDB genre IDs for the current browser session and updates the Profile summary.

**Architecture:** Keep `ProfileScreen` server-rendered and place session behavior in two focused client components under `features/profile`. A small storage adapter validates all stored values with `UpdatePreferencesRequestSchema`; local fixtures provide the allowed TMDB genre catalog and initial selection.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zod, Vitest, Testing Library.

## Global Constraints

- Existing UI Foundation tokens and components are the visual source of truth.
- Persist only in `sessionStorage` under `butaca:preferred-genre-ids`; do not claim account persistence.
- Use `UpdatePreferencesRequestSchema` as the minimum-two and uniqueness source of truth.
- Use canonical TMDB genre IDs and the exported `Genre` contract shape.
- Do not add dependencies, Supabase, APIs, server actions, repositories, authentication, or unrelated refactors.
- Modify only Profile files and directly required tests, fixtures, docs, or route configuration.
- Preserve UTF-8 Spanish copy and validate desktop plus mobile behavior.
- Do not create a git commit unless the user explicitly requests one after implementation.

---

### Task 1: Add validated genre fixtures and session storage adapter

**Files:**

- Modify: `src/fixtures/profile.ts`
- Create: `src/features/profile/profile-preferences-session.test.tsx`
- Create: `src/features/profile/profile-preferences-session.ts`

**Interfaces:**

- Consumes: `GenreSchema`, `UpdatePreferencesRequestSchema`, and Storage-compatible `getItem`/`setItem` methods.
- Produces: `PROFILE_GENRE_OPTIONS_FIXTURE`, `PROFILE_PREFERRED_GENRE_IDS_FIXTURE`, `PROFILE_PREFERENCES_SESSION_KEY`, `readPreferredGenreIds`, and `writePreferredGenreIds`.

- [ ] **Step 1: Write failing storage behavior tests**

Create tests with an in-memory storage double and assert the public behavior:

```ts
const allowedIds = [878, 18, 53, 27];
const fallback = [878, 18, 53];

expect(readPreferredGenreIds(storage, fallback, allowedIds)).toEqual(fallback);

storage.setItem(PROFILE_PREFERENCES_SESSION_KEY, JSON.stringify([878, 27]));
expect(readPreferredGenreIds(storage, fallback, allowedIds)).toEqual([878, 27]);

storage.setItem(PROFILE_PREFERENCES_SESSION_KEY, "not-json");
expect(readPreferredGenreIds(storage, fallback, allowedIds)).toEqual(fallback);

storage.setItem(PROFILE_PREFERENCES_SESSION_KEY, JSON.stringify([878]));
expect(readPreferredGenreIds(storage, fallback, allowedIds)).toEqual(fallback);

storage.setItem(PROFILE_PREFERENCES_SESSION_KEY, JSON.stringify([878, 999]));
expect(readPreferredGenreIds(storage, fallback, allowedIds)).toEqual(fallback);
```

Also assert that `writePreferredGenreIds(storage, [878, 27])` returns `true`, writes JSON, and that a throwing storage returns `false` without leaking an exception.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-preferences-session.test.tsx
```

Expected: FAIL because the storage module does not exist.

- [ ] **Step 3: Implement the minimal validated adapter**

Use these public signatures:

```ts
export const PROFILE_PREFERENCES_SESSION_KEY = "butaca:preferred-genre-ids";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function readPreferredGenreIds(
  storage: ReadableStorage,
  fallbackIds: readonly number[],
  allowedIds: readonly number[],
): number[];

export function writePreferredGenreIds(
  storage: WritableStorage,
  preferredGenreIds: readonly number[],
): boolean;
```

Read inside `try/catch`, parse JSON, validate `{ preferredGenreIds }` with `UpdatePreferencesRequestSchema.safeParse`, reject IDs outside `allowedIds`, and return a copy of the fallback for every invalid state. Validate before writing and return `false` for contract or storage failures.

- [ ] **Step 4: Replace name-only fixture data with validated IDs and genre options**

Build `PROFILE_GENRE_OPTIONS_FIXTURE` through `z.array(GenreSchema).parse` with the twelve reference genres and build the initial `[878, 18, 53]` value through `UpdatePreferencesRequestSchema.parse`.

Change `PROFILE_FIXTURE.preferredGenres` to:

```ts
preferredGenreIds: PROFILE_PREFERRED_GENRE_IDS_FIXTURE,
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-preferences-session.test.tsx
pnpm typecheck
```

Expected: storage tests pass; typecheck reports the Profile consumers that still need the new ID-based props, which Task 2 resolves.

### Task 2: Make the Profile taste summary session-aware

**Files:**

- Create: `src/features/profile/profile-preferences-summary.test.tsx`
- Create: `src/features/profile/profile-preferences-summary.tsx`
- Create: `src/features/profile/use-profile-preferences-session.ts`
- Modify: `src/features/profile/profile-screen.test.tsx`
- Modify: `src/features/profile/profile-screen.tsx`
- Modify: `src/app/profile/page.test.tsx`
- Modify: `src/app/profile/page.tsx`

**Interfaces:**

- Consumes: `Button`, `useRouter`, `useSyncExternalStore`, `Genre`, the initial preferred IDs, and the storage adapter from Task 1.
- Produces: `ProfilePreferencesSummary({ genreOptions, initialPreferredGenreIds })` and a working `Editar gustos` control.

- [ ] **Step 1: Write failing summary tests**

Mock `useRouter` with a stable `push` function. Render:

```tsx
<ProfilePreferencesSummary
  genreOptions={GENRES}
  initialPreferredGenreIds={[878, 18, 53]}
/>
```

Assert the initial three names render, clicking `Editar gustos` calls `push("/profile/preferences")`, and a valid stored `[878, 27]` value replaces the initial names after effects settle.

- [ ] **Step 2: Run the summary test and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-preferences-summary.test.tsx
```

Expected: FAIL because the summary module does not exist.

- [ ] **Step 3: Implement the focused client summary**

Create a client component with this public contract:

```tsx
interface ProfilePreferencesSummaryProps {
  genreOptions: readonly Genre[];
  initialPreferredGenreIds: readonly number[];
}
```

Create `useProfilePreferencesSession` around `useSyncExternalStore` so both Profile consumers read the same validated session snapshot without effect-driven state. Derive selected genre names from `genreOptions`, render the existing outline `Button`, and navigate from its click handler. Keep the genre list markup and visual classes from the current Profile screen.

- [ ] **Step 4: Integrate without making ProfileScreen a client component**

Change `ProfileScreenProps.profile` to use `preferredGenreIds: readonly number[]` and add `genreOptions: readonly Genre[]`. Replace only the tastes heading/action/list block with `ProfilePreferencesSummary`.

Pass `PROFILE_GENRE_OPTIONS_FIXTURE` from `src/app/profile/page.tsx`. Update Profile and route tests to use the ID-based fixture and assert `Editar gustos` is enabled instead of disabled. Keep `Cerrar sesión` disabled.

- [ ] **Step 5: Run Profile tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/features/profile/profile-preferences-summary.test.tsx src/features/profile/profile-screen.test.tsx src/app/profile/page.test.tsx
pnpm typecheck
```

Expected: all focused tests and typecheck pass.

### Task 3: Build the interactive `/profile/preferences` screen

**Files:**

- Create: `src/features/profile/edit-profile-preferences-screen.test.tsx`
- Create: `src/features/profile/edit-profile-preferences-screen.tsx`
- Create: `src/app/profile/preferences/page.test.tsx`
- Create: `src/app/profile/preferences/page.tsx`

**Interfaces:**

- Consumes: `Button`, `Genre`, `UpdatePreferencesRequestSchema`, `useRouter`, `next/link`, the genre fixtures, and the storage adapter.
- Produces: `EditProfilePreferencesScreen({ genreOptions, initialPreferredGenreIds })` and the `/profile/preferences` route.

- [ ] **Step 1: Write failing interaction tests**

Render the screen with the twelve genres and `[878, 18, 53]`. Assert:

```tsx
expect(screen.getByRole("heading", { name: "Editar gustos" })).toBeTruthy();
expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
expect(screen.getByText("3 seleccionados")).toBeTruthy();
```

Deselect Drama and Thriller, then assert `1 seleccionado` and a disabled save button. Select Terror, assert `2 seleccionados`, save, and verify session storage contains `[878, 27]` and `push("/profile")` ran.

Add a separate test with a throwing storage implementation or a spy that throws from `sessionStorage.setItem`; assert the screen stays open and announces `No pudimos guardar tus gustos. Intentá de nuevo.`

- [ ] **Step 2: Run the screen test and verify RED**

Run:

```bash
pnpm exec vitest run src/features/profile/edit-profile-preferences-screen.test.tsx
```

Expected: FAIL because the edit screen module does not exist.

- [ ] **Step 3: Implement selectable pills and save behavior**

Use module-scope `CheckIcon` and `BackIcon` helpers. Render a `max-w-3xl` flex column with:

```tsx
<Link href="/profile">Perfil</Link>
<h1>Editar gustos</h1>
<p id="genre-guidance">Agregá o quitá géneros. Mínimo 2.</p>
<div role="group" aria-describedby="genre-guidance">
  {genreOptions.map((genre) => (
    <Button
      key={genre.id}
      aria-pressed={selectedIds.includes(genre.id)}
      onClick={() => toggleGenre(genre.id)}
      variant={BUTTON_VARIANT.OUTLINE}
    >
      {selected ? <CheckIcon /> : null}
      {genre.name}
    </Button>
  ))}
</div>
```

Derive `validationResult` with `UpdatePreferencesRequestSchema.safeParse({ preferredGenreIds: selectedIds })`. Disable save when invalid. On valid save, call `writePreferredGenreIds(window.sessionStorage, validationResult.data.preferredGenreIds)` and route to `/profile` only when it returns `true`.

- [ ] **Step 4: Add the App Router page and route test**

The server page passes `PROFILE_GENRE_OPTIONS_FIXTURE` and `PROFILE_PREFERRED_GENRE_IDS_FIXTURE` to the client screen. The route test renders the page and asserts the title, twelve genre buttons, three selected states, counter, and save action.

- [ ] **Step 5: Run the complete Profile test slice**

Run:

```bash
pnpm exec vitest run src/features/profile src/app/profile
```

Expected: every Profile storage, component, and route test passes.

### Task 4: Verify static and rendered behavior

**Files:**

- Verify only; save screenshots outside the repository.

**Interfaces:**

- Consumes: the final code and `http://localhost:3000/profile`.
- Produces: static gate evidence and desktop/mobile browser evidence for the full preference flow.

- [ ] **Step 1: Format and inspect scope**

Run Prettier on the new and modified Profile files and docs. Then run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors and no unrelated source changes.

- [ ] **Step 2: Run all static gates**

Run independently:

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits with code 0 and the build lists `/profile/preferences` as a static route.

- [ ] **Step 3: Validate the target flow in the in-app browser**

The flow under test is: `/profile` loads -> `Editar gustos` opens `/profile/preferences` -> genres toggle and minimum-two validation updates -> save returns to `/profile` -> the saved names remain visible for the session.

At desktop and `390x844`, verify page identity, meaningful DOM, framework-overlay absence, console health, no horizontal overflow, visible save action, and clearance above the fixed mobile navigation. Save final screenshots outside the repository, reset the viewport override, and leave `/profile` open.

## Execution

Inline execution was selected by the user's explicit request to implement the recommended approach. The existing `nuria/frontend-views` branch remains the working branch. Publication is handled separately only when the user explicitly requests it.
