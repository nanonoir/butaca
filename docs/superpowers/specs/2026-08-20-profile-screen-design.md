# Profile Screen Design

## Goal

Add the `/profile` screen shown in the approved reference while preserving Butaca's current UI Foundation and server-first architecture.

## Scope

The screen renders one local profile snapshot:

- Name: `Sofía Ramírez`
- Email: `sofia.ramirez@correo.com`
- Initials: `SR`
- Preferred genres: `Ciencia ficción`, `Drama`, `Thriller`
- Activity: `10` likes, `6` watched movies, `1` review

`Editar gustos` and `Cerrar sesión` remain visible native buttons with disabled semantics. They keep the reference appearance with `disabled:opacity-100`. The project has no preferences route, authentication state, or session operation to connect them to.

## Reuse and ownership

- Extend `Avatar` with an `lg` size equal to `88px`. Preserve the current `sm` and `md` contracts.
- Reuse the existing `Button` outline variant. Do not add a profile-only button variant.
- Keep the profile identity layout, genre tags, section labels, and activity statistics in `src/features/profile`.
- Keep fixture data in `src/fixtures/profile.ts`.
- Add only the `/profile` route. Do not change Discover, Me gusta, or UI Foundation pages.

## Component design

`ProfileScreen` receives a serializable profile view model. It remains a server component because the approved controls do not change state.

The component renders:

1. An identity header with the large initials avatar, display name, and email.
2. A `Mis gustos` section with the disabled edit button and wrapping genre tags.
3. A `Mi actividad` section with a semantic description list split into three equal columns.
4. A `Cuenta` section with a full-width disabled logout button.

Feature-private helpers may render section labels or individual statistics when that keeps the main component readable. They must stay in the same profile module until reuse appears elsewhere.

## Layout and responsive behavior

- Center the page in a `max-w-4xl` container within `MainSurface`.
- Use existing semantic colors, fonts, borders, radii, and spacing utilities.
- Preserve the horizontal identity row at mobile widths; allow the text column to shrink and wrap safely.
- Stack the tastes heading and edit control on narrow screens, then align them horizontally from `sm` upward.
- Keep the three activity metrics in one row. Reduce padding and number size on mobile instead of changing their order.
- Let genre tags wrap without horizontal scrolling.
- Keep enough bottom spacing for the existing mobile navigation.

## Accessibility

- Use one `h1` for the user's name.
- Use `h2` headings for `Mis gustos`, `Mi actividad`, and `Cuenta`.
- Give the initials avatar the user's display name as its accessible name.
- Render genres as a list and activity metrics as a `dl`.
- Use native `disabled` attributes for controls without behavior.

## Testing

- Extend the Avatar tests first and verify the new `lg` contract fails before implementation.
- Test ProfileScreen identity, genres, activity values, semantic structure, and disabled controls.
- Add a route test that verifies the local fixture reaches `/profile`.
- Run the full Vitest suite, typecheck, lint, Prettier check, and production build.
- Validate `/profile` in the in-app browser at `1440x900` and `390x844`, including console health and mobile navigation clearance.

## Out of scope

- Preference editing
- Authentication or logout logic
- Persistence, APIs, loading states, or errors
- Avatar upload
- Changes to existing product screens

## Acceptance criteria

- `/profile` matches the supplied desktop composition and current UI Foundation.
- The desktop and mobile layouts avoid clipping, overflow, and navigation overlap.
- No new dependency or global design token is introduced.
- Existing tests and quality gates remain green.
