# Tasks: Discover and Onboarding Frontend Flow

## Phase 1: Responsive Discover Fix

- [x] 1.1 Establish a flex height contract in the shared surface.
- [x] 1.2 Make the Discover poster row consume remaining viewport height.
- [x] 1.3 Add the mobile short-height mode through 700 CSS pixels.
- [x] 1.4 Preserve normal-height Buti behavior and minimum touch targets.

## Phase 2: Shared Inline Search

- [x] 2.1 Extract the inline morphing search control from Discover.
- [x] 2.2 Support Enter, trailing-icon submit, contextual X, Escape, reduced motion, and focus restoration.
- [x] 2.3 Adopt the shared control in Discover without an overlay.
- [x] 2.4 Generalize the movie grid heading for popular and search result modes.

## Phase 3: Onboarding Movie Picker

- [x] 3.1 Move Continue and Complete Profile actions beside the progress indicator.
- [x] 3.2 Keep Back to genres at the bottom of the movie step.
- [x] 3.3 Add the TMDB popular movie adapter, service, API route, and browser client.
- [x] 3.4 Prefetch popular movies and render them before search.
- [x] 3.5 Reuse shared search and selection state between popular and searched movies.

## Phase 4: Verification and Test Alignment

- [x] 4.1 Align unit selectors with the shared inline search accessible names.
- [x] 4.2 Align onboarding Playwright Page Object interactions with the collapsed search trigger.
- [x] 4.3 Restore Jest-DOM matchers for structural class assertions.
- [x] 4.4 Run lint, typecheck, unit, integration, E2E, and production build checks.

## Completion

All implementation tasks are complete. Verification passed with 618 unit tests, 40 integration tests, 9 E2E tests, lint, typecheck, and production build.
