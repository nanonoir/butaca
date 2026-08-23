# Fix: Discover and Onboarding Frontend Flow

## Type

`fix`

## Intent

Improve the Discover and onboarding frontend flows so their primary actions, movie selection, search behavior, and responsive layout are clear and usable without unnecessary scrolling or empty states.

## Scope

### In Scope

- Make the Discover surface fit the available viewport, including a compact mode for mobile viewports up to 700 CSS pixels high.
- Replace the Discover search overlay with a shared inline morphing search control.
- Keep search controls inline after submission and provide contextual clear actions.
- Move onboarding Continue and Complete Profile actions beside the step indicator.
- Keep Back to Genres at the bottom of the onboarding movie step.
- Preload canonical TMDB popular movies for onboarding before a search is submitted.
- Reuse the shared inline search and movie selection grid in onboarding.
- Align unit, integration, and end-to-end test selectors with the new interaction model.

### Out of Scope

- Changes to recommendation ranking or onboarding business limits.
- Changes to the Buti recommendation component's normal-height presentation.
- Collaborative filtering, embeddings, or a second recommendation algorithm.
- Git commits, pushes, or release changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| Discover UI | Modified | Viewport-aware layout and shared inline search |
| Onboarding UI | Modified | Header actions, popular movie picker, and inline search |
| Movie catalog | Extended | Canonical TMDB popular movie route and client |
| Shared movie UI | Modified | Reusable inline search and configurable movie grid heading |
| Tests | Modified | Updated unit and Playwright selectors and coverage |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Short-height layouts become too dense | Medium | Scope compact rules to Discover and preserve minimum touch targets |
| Search behavior diverges between surfaces | Low | Use one shared inline search component |
| Popular catalog provider is unavailable | Medium | Reuse the existing catalog error and retry state |
| Existing E2E selectors become stale | Low | Keep contextual accessible names and update the Page Object |

## Rollback Plan

Revert the shared inline search adoption, remove the popular catalog route/client additions, and restore the previous onboarding and Discover layout components. The core onboarding persistence and recommendation contracts remain independent of this change.

## Success Criteria

- [x] Discover no longer requires document scrolling for its initial viewport composition at supported mobile and desktop sizes.
- [x] Search opens inline, submits from the input, and clears without an overlay.
- [x] Onboarding primary actions are visible beside the step indicator.
- [x] Onboarding displays popular movies before the first search.
- [x] Search and popular results preserve the existing selection limits and persistence behavior.
- [x] Lint, typecheck, unit, integration, E2E, and production build checks pass.
