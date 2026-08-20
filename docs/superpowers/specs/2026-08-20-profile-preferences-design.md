# Profile Preferences Design

## Goal

Make the existing `Editar gustos` control open `/profile/preferences`, where a user can select movie genres, keep at least two selected, and save the choice for the current browser session.

## Scope

The approved frontend-only flow is:

1. `/profile` shows the current preferred genres.
2. `Editar gustos` opens `/profile/preferences`.
3. The edit screen starts with the current session selection, or the local profile fixture when the session has no valid value.
4. Genre pills toggle independently and expose pressed state to assistive technology.
5. `Guardar cambios` is enabled only when the existing preferences contract accepts the selection.
6. Saving writes the selected TMDB genre IDs to `sessionStorage` and returns to `/profile`.
7. `/profile` reads the saved session value and shows the selected genre names.

This is explicitly temporary UI state. It must not be described as account persistence and must not introduce Supabase, APIs, server actions, repositories, authentication, or new dependencies.

## Existing UI and contracts to reuse

- Reuse `Button` for the selectable pills and primary save action.
- Reuse the current profile container width, typography, semantic colors, borders, radii, focus rings, transitions, and responsive shell.
- Reuse the `aria-pressed` interaction pattern already present in the Me gusta filters.
- Validate saved values with `UpdatePreferencesRequestSchema`; its `PreferredGenreIdsSchema` is the source of truth for the minimum of two unique positive TMDB IDs.
- Use the exported `Genre` contract shape for the local genre catalog.
- Keep the existing `FloatingNavigation`; `/profile/preferences` already remains under the active Perfil navigation branch.

No existing selectable-genre, breadcrumb, or session-preferences component is available. Those pieces stay feature-owned under `src/features/profile`.

## Data model

The local fixture exposes the reference genres with canonical TMDB IDs:

- `878` Ciencia ficción
- `18` Drama
- `53` Thriller
- `27` Terror
- `35` Comedia
- `10749` Romance
- `14` Fantasía
- `28` Acción
- `16` Animación
- `9648` Misterio
- `12` Aventura
- `99` Documental

The initial preferred IDs are `878`, `18`, and `53`.

The session key is `butaca:preferred-genre-ids`. Storage helpers accept the allowed genre IDs and a validated fallback. A stored value is used only when it:

- parses as JSON;
- passes `UpdatePreferencesRequestSchema`;
- contains only IDs offered by the current local genre catalog.

Invalid, unavailable, or inaccessible storage falls back to the fixture without throwing during rendering.

## Component boundaries

### `ProfilePreferencesSummary`

A small client component replaces only the current static taste list and disabled edit control. It receives serializable genre options and initial IDs, subscribes to the session-backed preference snapshot through `useSyncExternalStore`, renders the selected names, and uses the existing `Button` to navigate to `/profile/preferences`.

`ProfileScreen` remains a server component and continues to own identity, activity, and account layout.

### `EditProfilePreferencesScreen`

A client component receives the same genre options and initial IDs. It owns the unsaved selection, derives validity during render with `UpdatePreferencesRequestSchema`, and writes only from the save event handler.

The screen contains:

- a back link to Perfil;
- the `Editar gustos` title and minimum-two guidance;
- wrapping genre buttons with `aria-pressed` and a check icon when selected;
- an `aria-live` selected-count label;
- a primary save button at the bottom of the available content area.

Private icons remain at module scope. A new shared component is not justified because no second consumer exists.

## Interaction and error behavior

- Toggling is always allowed so the user can see the minimum validation state.
- Fewer than two selections disables `Guardar cambios`.
- Valid saves write the session value and navigate to `/profile`.
- If browser storage throws, the screen stays open and shows a concise live error. The unsaved selection is preserved.
- The back link leaves without writing changes.
- Reloading the tab preserves the value for that browser session; closing the browser session may clear it.

## Layout and responsive behavior

- Use a centered `max-w-3xl` column inside the existing `MainSurface`.
- Match the reference hierarchy and spacing without introducing design tokens.
- Pills wrap naturally with touch targets of at least 44px.
- The action row uses the available width on desktop and stacks cleanly on narrow screens.
- Mobile bottom padding must keep the save action above the existing fixed navigation.
- The selected state uses the current primary color for the border, text, and check, plus a subtle primary-tinted surface rather than a new palette.

## Accessibility

- Use one `h1` for `Editar gustos`.
- Use a real link for the Perfil breadcrumb and native buttons for genre toggles and save.
- Expose selected genres through `aria-pressed` and a decorative check icon.
- Associate the genre group with the minimum-two guidance.
- Announce selection count and storage errors without moving focus unexpectedly.
- Preserve the shared focus-visible ring and reduced-motion behavior.

## Testing

- Unit-test session read/write, invalid JSON, contract-invalid values, unknown IDs, and storage failures.
- Component-test initial selection, toggling, selected count, the minimum-two disabled state, successful save, navigation, and storage failure.
- Update Profile tests to prove `Editar gustos` is interactive and session-selected names render.
- Add a route test for `/profile/preferences`.
- Run the complete Vitest suite, typecheck, lint, Prettier check, and production build.
- Validate the full flow in the in-app browser at desktop and mobile widths, including console health and fixed-navigation clearance.

## Out of scope

- Database or Supabase persistence
- Authentication and user identity lookup
- Server actions, API routes, application services, or repositories
- Synchronization across tabs, browsers, or devices
- Onboarding changes
- Changes to Discover, Me gusta, or UI Foundation

## Acceptance criteria

- `Editar gustos` opens `/profile/preferences`.
- The twelve reference genres render with the first three selected initially.
- Selection, count, minimum-two validation, save, and back navigation work with native accessible semantics.
- Saving updates the genres shown on `/profile` for the current browser session.
- Desktop and mobile layouts avoid clipping, horizontal overflow, and bottom-navigation overlap.
- No unrelated screen, dependency, global token, backend layer, or account-persistence claim is introduced.
