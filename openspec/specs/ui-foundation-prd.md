# PRD — UI Foundation

## 1. Decision summary

**Feature:** UI Foundation
**Branch:** `feature/ui-foundation`
**Status:** Refined — ready for SDD
**Project:** Movie discovery and recommendation MVP

This feature establishes the shared visual foundation for Butaca. It extracts the smallest reusable system justified by the approved prototype and introduces two deliberate shell-level deviations approved after exploration:

1. Replace the attached desktop sidebar with a detached, rounded vertical floating navigation.
2. Place application content inside a rounded main surface separated from the viewport background.

This PRD is the product and visual source of truth for downstream proposal, specification, design, task, implementation, and verification phases.

---

## 2. Objective

Create a reusable, accessible, and responsive UI foundation that lets contributors build product screens from one coherent visual language without introducing a speculative component library.

The feature must:

- Implement semantic design tokens extracted from the prototype.
- Implement only primitives and shared components justified by observed reuse.
- Establish the global responsive application shell.
- Implement the approved floating navigation and rounded main surface.
- Define variants, interactive states, and accessibility behavior.
- Provide a lightweight internal validation surface.
- Keep domain behavior inside its owning feature.

---

## 3. Sources of truth

### Primary prototype

https://claude.ai/code/artifact/49675cbe-b1bb-44f5-a4fd-575f7fbadb36

### Exploration status

```text
COMPLETE
```

The accessible prototype was inspected on desktop and mobile across Discover, Liked Movies, AI Assistant, and Profile. Desktop movie detail was also inspected.

### Approved deviations

The following requirements override the corresponding prototype behavior:

| Area | Prototype | Approved foundation behavior |
|---|---|---|
| Desktop navigation | Attached left sidebar with persistent labels | Detached rounded vertical floating navigation; five icon controls; each label reveals on hover and keyboard focus |
| Application background | Flat viewport composition | Rounded main content surface separated from the viewport background using semantic tokens |

All other visual decisions should remain faithful to the prototype unless this PRD states otherwise.

---

## 4. Product principles

1. **Prototype first, explicit exceptions only** — Extract from the prototype except for the two approved deviations above.
2. **Semantic tokens** — Shared components consume semantic tokens instead of repeated raw values.
3. **Real reuse only** — Repeated patterns may become shared components; one-off and domain patterns remain local.
4. **Domain isolation** — Movie, reaction, review, discovery, onboarding, and chat behavior do not belong in the global primitive layer.
5. **Accessibility by default** — Hover behavior must have equivalent keyboard behavior and must not be the only way to identify navigation.
6. **Minimal abstraction** — Prefer a small, explicit set of components over speculative flexibility.
7. **Stable layout** — Hover and focus affordances must not reflow or shift page content.

---

## 5. Scope

### In scope

- Semantic color, typography, radius, border, shadow, focus, and motion tokens.
- Dark theme implementation.
- Responsive shell behavior.
- Floating desktop navigation with five primary destinations.
- Mobile bottom navigation with the same destinations.
- Rounded main application surface.
- `Button`, `Avatar`, and `Input` primitives.
- `AppShell`, `FloatingNavigation`, `PageHeader`, and `MoviePosterCard` shared components.
- Component states observed in the prototype or required for accessibility.
- Global reduced-motion behavior.
- Lightweight internal component and state gallery.
- Replacement of the default Next.js starter screen with the foundation validation entry point or shell integration.
- Relevant component tests and project quality checks.

### Out of scope

- Full Discover, Liked Movies, AI, Profile, or Movie Detail feature implementation.
- Onboarding screens and onboarding-specific components.
- Empty states for Liked Movies, AI, or Profile.
- Offline, retry, and feature-specific error states.
- Complete AI conversation UI and persistence.
- Review form behavior and trailer playback.
- Mobile Movie Detail composition, which was not observable in the prototype.
- Recommendation, TMDB, database, authentication, or AI application logic.
- Light mode and advanced theming.
- Storybook.
- A global animation framework.
- Domain-specific components listed in Section 12.

The foundation must still provide accessible primitives that future feature-level empty, error, and loading states can consume.

---

## 6. Prototype coverage

| Screen / state | Location | Desktop | Mobile | Notes |
|---|---|---:|---:|---|
| Discover | Default destination | Yes | Yes | Movie stack, action controls, hints, Buti teaser |
| Liked Movies | “Me gusta” navigation item | Yes | Yes | Filter pills, poster grid, watched badge |
| AI Assistant | “IA” navigation item | Yes | Yes | Prompt chips, chat input, disabled send button |
| Profile | “Perfil” navigation item | Yes | Yes | Avatar, genre tags, stats, logout |
| About | `Acerca` navigation item | Yes | Yes | Product summary and TMDB attribution |
| Movie Detail | “Más información” from Discover | Yes | No | Desktop overlay/sheet inspected |
| Initial loading | Artifact startup | Yes | Yes | Plain loading text before hydration |

### Missing or inaccessible areas

- Onboarding.
- Feature empty, offline, retry, and error states.
- Complete AI conversation history.
- Review form and trailer playback.
- Mobile Movie Detail.
- Light theme.

These areas do not block UI Foundation because they are explicitly out of scope.

---

## 7. Design tokens

### 7.1 Color system

**Theme:** dark only.

| Semantic token | Raw value | Usage |
|---|---|---|
| `background` | `#070811` | Viewport and outer shell background |
| `foreground` | `#EFEFF6` | Primary text and headings |
| `surface` | `#14151F` | Main application surface and cards |
| `surface-muted` | `#12131D` | Inputs and quiet nested surfaces |
| `surface-elevated` | `#101220` | Floating navigation and elevated shell regions |
| `primary` | `#B9A5FF` | Active navigation, primary actions, links, ratings, focus |
| `primary-hover` | `#CBBBFF` | Primary hover state |
| `primary-foreground` | `#0A0B14` | Text/icons on primary |
| `secondary` | `rgba(255, 255, 255, 0.05)` | Selected navigation and quiet tags |
| `muted` | `#8A8AA2` | Secondary text and inactive navigation |
| `muted-foreground` | `#6C6C84` | Tertiary text and placeholders |
| `border` | `rgba(255, 255, 255, 0.10)` | Default subtle border |
| `input` | `rgba(255, 255, 255, 0.11)` | Input border |
| `ring` | `#B9A5FF` | Focus-visible ring |
| `overlay` | `rgba(10, 11, 13, 0.72)` | Scrims and inactive card overlays |

Raw colors may appear only inside the token definitions. Components must consume semantic Tailwind classes or CSS variables.

### 7.2 Typography

| Role | Family | Fallback | Source |
|---|---|---|---|
| Display and headings | Bricolage Grotesque | `sans-serif` | Google Fonts through `next/font` |
| Body and UI | Instrument Sans | `system-ui, sans-serif` | Google Fonts through `next/font` |
| Captions and metadata | Space Mono | `monospace` | Google Fonts through `next/font` |

| Token / role | Size | Weight | Line height | Letter spacing | Usage |
|---|---:|---:|---:|---:|---|
| `page-title` | `1.6875rem` | 700 | 1 | normal | Page H1 |
| `detail-title` | `1.8125rem` | 700 | 1.05 | `-0.022em` | Movie detail title |
| `movie-title` | `2rem` | 700 | 1.02 | `-0.022em` | Discover movie title |
| `brand` | `1.375rem` | 700 | 1 | `0.01em` | Butaca wordmark |
| `section-label` | `0.6875rem` | 500 | 1 | normal | Eyebrows and section labels |
| `body` | `0.8125rem–0.9375rem` | 400–500 | 1.5–1.7 | normal | Body copy and metadata |
| `caption-mono` | `0.5625rem–0.75rem` | 500–600 | 1.2–1.4 | `0.05em` | Badges and compact metadata |

### 7.3 Spacing

Use the Tailwind spacing scale where it matches the following repeated values. Add semantic spacing only when it clarifies shell structure.

| Token / pattern | Value | Usage |
|---|---:|---|
| `shell-inset-mobile` | `0.5rem` | Mobile main-surface separation from viewport |
| `shell-inset-desktop` | `0.5rem` | Desktop main-surface separation from viewport; intentionally subtle |
| `navigation-inset` | `1rem` | Floating navigation distance from the MainSurface inner edge |
| `navigation-item-gap` | `0.5rem` | Vertical navigation rhythm |
| `navigation-item-size` | `2.75rem` | Collapsed desktop navigation item |
| `nav-item-padding` | `0.75rem` | Navigation controls |
| `tab-padding-x` | `1rem` | Filter pills |
| `chip-padding-x` | `0.9375rem` | Prompt chips |
| `input-padding-x` | `1rem` | Input container |
| `section-gap` | `1.125rem` | Repeated section rhythm |
| `content-gap` | `0.75rem` | Icon/text and compact content gap |

### 7.4 Radius

| Token | Value | Usage |
|---|---:|---|
| `radius-sm` | `0.625rem` | Small buttons and compact controls |
| `radius-md` | `0.75rem` | Navigation items and inputs |
| `radius-lg` | `1rem` | Input bars and elevated controls |
| `radius-xl` | `1.375rem` | Cards, chips, and tags |
| `radius-shell` | `1.75rem` | Main application surface |
| `radius-full` | `9999px` | Floating navigation container, avatars, circular actions |

`radius-shell` is an approved deviation introduced for the rounded application background.

### 7.5 Borders and elevation

| Token | Value | Usage |
|---|---|---|
| `border-subtle` | `1px solid rgba(255,255,255,0.10)` | Main surface, cards, floating navigation |
| `border-input` | `1px solid rgba(255,255,255,0.11)` | Inputs |
| `border-control` | `1px solid rgba(255,255,255,0.12)` | Outline controls |
| `border-emphasis` | `1px solid rgba(255,255,255,0.14)` | Emphasized outline action |
| `shadow-primary` | `0 12px 30px -10px rgba(185,165,255,0.60)` | Primary circular action only |
| `shadow-floating` | `0 16px 40px -24px rgba(0,0,0,0.70)` | Floating desktop navigation |

The main application surface should rely on tonal separation and `border-subtle`, not a heavy shadow.

### 7.6 Focus styles

- Default focus-visible ring: `2px solid ring` with `2px` offset.
- Icon-only and floating navigation controls may use a `3px` offset where needed for separation.
- Input focus changes its border to `ring`; it must also remain perceptible in forced-colors mode.
- Focus must never be removed without an accessible replacement.

---

## 8. Motion

### Shared motion tokens

| Token | Duration | Easing | Usage |
|---|---:|---|---|
| `motion-fast` | `120ms` | `cubic-bezier(0.23, 1, 0.32, 1)` | Press and immediate feedback |
| `motion-ui` | `160ms` | `cubic-bezier(0.23, 1, 0.32, 1)` | Floating navigation label reveal |
| `motion-enter` | `240ms` | `cubic-bezier(0.23, 1, 0.32, 1)` | Optional non-repeated surface entry |

### Floating navigation interaction

- Labels are always present in accessible text and visually concealed only in the collapsed presentation.
- On pointer hover or `focus-visible`, the item reveals its label to the right of its icon.
- Label reveal uses opacity plus a maximum `4px` horizontal translation.
- The item may visually extend to the right, but must not change the shell's layout width or move page content.
- No bounce or spring is used for this frequent interaction.
- Active press feedback may scale the control to `0.97` for `120ms`.
- Hover-only behavior must be gated behind `(hover: hover) and (pointer: fine)`.

### Reduced motion

With `prefers-reduced-motion: reduce`:

- Remove translation, scale, particle, bobbing, and sheet movement.
- Preserve short opacity and color feedback where it aids comprehension.
- Floating navigation labels appear through opacity only or immediately.

No global animation framework should be introduced.

---

## 9. Responsive shell

### Breakpoint strategy

Use Tailwind's `md` breakpoint (`48rem` / `768px`) as the single shell transition point unless implementation evidence proves an additional breakpoint necessary.

### Desktop (`md` and above)

- Viewport uses `background`.
- Main content is rendered inside `MainSurface` using `surface`, `border-subtle`, and `radius-shell`.
- Main surface remains subtly detached from viewport edges using the uniform `shell-inset-desktop` value of `0.5rem`.
- `FloatingNavigation` is rendered structurally and visually inside `MainSurface`, anchored by `navigation-inset`, and vertically centered.
- The left-side safe gutter required by the rail and expanded labels is reserved inside `MainSurface`, not as outer body/AppShell margin.
- Navigation labels may overlay the reserved inner gutter, but must not cross the MainSurface boundary, cover essential controls, or reflow content.

### Mobile (below `md`)

- Floating vertical navigation is hidden.
- A bottom navigation presents the five icons with visible text labels because touch has no hover.
- Main surface uses the same subtle `0.5rem` outer inset and a reduced practical radius if viewport width requires it, while preserving the rounded-background concept.
- The mobile navigation remains visually inside the MainSurface boundary and aligned to its inner edge.
- Content includes safe bottom padding so the mobile navigation never obscures interactive controls.

---

## 10. Navigation specification

### Destinations

| Destination | Visible label | Icon meaning |
|---|---|---|
| Discover | `Descubrir` | Discovery / browse |
| Liked Movies | `Me gusta` | Heart / liked collection |
| AI Assistant | `IA` | Assistant / sparkle |
| Profile | `Perfil` | User profile |
| About | `Acerca` | Product information |

Final icons must come from one existing or approved icon source and use consistent stroke weight and optical size.

### Desktop behavior

- Container: vertical, rounded, elevated, detached from the viewport edge.
- Collapsed navigation item: `2.75rem × 2.75rem` minimum visual size.
- Minimum interactive target: `44px × 44px`.
- Labels reveal on hover and keyboard focus.
- Inactive desktop items use the same light primary treatment on hover and keyboard focus as the selected destination; the icon remains visibly above the expanded label layer.
- Current destination remains visually identifiable while collapsed through `primary`, background treatment, or a clear active indicator.
- Use `aria-current="page"` for the active destination.
- Every icon-only collapsed state has an accessible name.
- Label reveal is not implemented as a second tooltip; it is the same navigation item's visible label.

### Mobile behavior

- Five evenly distributed destinations.
- Icon and visible label for every item.
- Active destination uses `primary` and `aria-current="page"`.
- Respect safe-area insets.

---

## 11. Global UI primitives

These belong in `src/components/ui/`.

| Component | Variants | Required states | Accessibility |
|---|---|---|---|
| `Button` | `primary`, `outline`, `ghost`, `icon`; explicit supported sizes | default, hover, active, focus-visible, disabled | Native button/link semantics; accessible name for icon-only controls; disabled semantics |
| `Avatar` | `sm`, `md`; initials and image content | default | Meaningful alt text or accessible initials; decorative avatars hidden when appropriate |
| `Input` | Standard text input; optional adjacent action composition | default, focus, disabled, invalid | Programmatic label, described errors, native input semantics |

Primitive APIs must be small, explicit, typed, and based on these observed requirements. Do not add speculative variants.

---

## 12. Shared and excluded components

### Shared cross-feature components

These belong in `src/components/shared/` unless colocated privately under the shell.

| Component | Responsibility | Variants / states |
|---|---|---|
| `AppShell` | Provides the subtle viewport frame and composes the MainSurface | desktop / mobile |
| `FloatingNavigation` | Desktop floating rail and mobile bottom-navigation counterpart or composition | collapsed, item hover/focus reveal, active destination |
| `MainSurface` | Structural rounded application background containing responsive navigation and page content | desktop / mobile radius and inset behavior |
| `PageHeader` | Repeated eyebrow, page title, and optional status/action region | default, with status/action |
| `MoviePosterCard` | Shared poster, title, year, and optional presentation slots | default; optional watched presentation supplied by owner |

`MainSurface` is structural shell composition, not a generic `Card` primitive. `NavigationItem` remains private to `FloatingNavigation` unless future verified reuse justifies promotion.

### Domain-specific components excluded from UI Foundation

| Component / pattern | Owner | Reason |
|---|---|---|
| Discover movie stack and swipe card | `features/discovery` | Gesture and ranking domain behavior |
| Reaction controls | `features/discovery` | Persisted reaction behavior |
| Buti opinion teaser | `features/discovery` or `features/chat` | Product-specific single-use composition |
| Watched badge behavior | `features/likes` | User interaction domain state |
| AI prompt chips | `features/chat` | Chat intent and copy |
| Profile statistics and taste tags | Profile/onboarding feature | User data presentation |
| Movie Detail sheet, cast, and reviews | Movie feature | Rich movie domain composition |
| `PillTabs` | Likes feature initially | Only one verified use; promote later only after identical reuse exists |

### One-off compositions

- “Cómo funciona” instruction list.
- “Afinado hoy” status label.
- Keyboard gesture hints.
- Community review summary.

---

## 13. Accessibility requirements

- Semantic HTML is preferred over ARIA recreation.
- All interactive controls support keyboard operation.
- Hover-revealed navigation labels also reveal on `focus-visible`.
- Active navigation uses `aria-current="page"`.
- Icon-only states always have accessible names.
- Focus-visible treatment meets contrast requirements.
- Form controls have programmatic labels.
- Disabled and invalid states are exposed semantically.
- State is never communicated through color alone.
- Motion respects `prefers-reduced-motion`.
- Mobile controls meet a minimum `44px × 44px` target.
- Navigation remains understandable at 200% zoom and with long localized labels.
- Forced-colors mode retains visible focus and boundaries.

---

## 14. Implementation rules

### Styling

- Implement semantic tokens in `src/app/globals.css` using Tailwind CSS v4 theme conventions.
- Components consume semantic utilities such as `bg-surface`, `text-foreground`, and `border-border`.
- Do not use repeated hexadecimal or arbitrary color values in component class names.
- Do not introduce a second styling system.
- Use arbitrary dimensions only for verified one-off geometry, never for reusable colors.

### Components

- Prefer Server Components; use client boundaries only where interaction requires them.
- Keep navigation data typed and centralized.
- Do not animate `transition: all`.
- Do not use manual React memoization without measured need.
- Do not add a component dependency unless it solves a concrete accessibility or behavior requirement better than a small local implementation.

### Location rules

```text
src/components/ui/
  Low-level reusable primitives

src/components/shared/
  Cross-feature and shell components

src/features/*
  Domain-specific components and behavior
```

---

## 15. Expected implementation plan

### Files to create

```text
src/components/ui/button.tsx
src/components/ui/avatar.tsx
src/components/ui/input.tsx
src/components/shared/app-shell.tsx
src/components/shared/floating-navigation.tsx
src/components/shared/main-surface.tsx
src/components/shared/page-header.tsx
src/components/shared/movie-poster-card.tsx
src/app/ui-foundation/page.tsx
```

Test files should be colocated according to the repository's established testing convention.

### Files to modify

```text
src/app/layout.tsx
src/app/globals.css
src/app/page.tsx
package.json              # only if an approved dependency is demonstrably required
```

### Implementation order

1. Define fonts and semantic tokens.
2. Implement and test UI primitives.
3. Implement `MainSurface`, responsive `FloatingNavigation`, and `AppShell`.
4. Implement `PageHeader` and `MoviePosterCard`.
5. Build the internal validation route.
6. Integrate the shell entry point.
7. Run accessibility, responsive, test, lint, typecheck, and build verification.

The exact file list may be refined by the technical design, but scope and component ownership must remain consistent with this PRD.

---

## 16. Validation surface

Create a development-oriented route at `/ui-foundation` that demonstrates:

- All semantic colors and typography roles.
- Every primitive variant and supported state.
- Floating navigation collapsed, active, hover, focus, and mobile behavior.
- Main surface radius, border, and inset behavior.
- Page headers and movie poster cards.
- Keyboard focus order.
- Reduced-motion behavior.
- Desktop and mobile responsive layouts.

The route must not require Storybook and must not contain product business logic.

---

## 17. Acceptance criteria

### Exploration and alignment

- [x] Complete accessible prototype inspected before implementation.
- [x] Desktop and mobile reachable screens documented.
- [x] Token candidates extracted from computed styles.
- [x] Global, shared, domain, and one-off patterns classified.
- [x] Approved prototype deviations documented explicitly.
- [x] Undefined feature states moved out of UI Foundation scope.

### Tokens

- [ ] Semantic color tokens are implemented.
- [ ] Typography roles use the approved font families.
- [ ] Radius, border, shadow, focus, and motion tokens are implemented.
- [ ] `radius-shell` creates a visibly rounded main application surface.
- [ ] Shared components contain no repeated raw color values.

### Navigation and shell

- [ ] Desktop navigation is detached from the left viewport edge.
- [ ] Desktop navigation is structurally and visually contained inside `MainSurface`.
- [ ] Desktop navigation is vertical, rounded, and visually floating.
- [ ] It contains exactly the five primary destinations defined in this PRD.
- [ ] Each label reveals on pointer hover and keyboard focus.
- [ ] Inactive desktop hover and keyboard focus use the selected primary treatment, with the icon remaining visible above the expanded label.
- [ ] Label reveal does not reflow or move application content.
- [ ] Active destination remains identifiable while labels are collapsed.
- [ ] Mobile uses a bottom navigation with visible labels.
- [ ] Main content renders inside the rounded `MainSurface`.
- [ ] The outer viewport-to-surface frame is uniformly `0.5rem` on desktop and mobile.
- [ ] Navigation clearance is reserved inside `MainSurface`, not through an oversized AppShell/body margin.
- [ ] Viewport and main surface use semantic tokens with sufficient visual separation.

### Components

- [ ] `Button`, `Avatar`, and `Input` expose only approved variants.
- [ ] `AppShell`, `FloatingNavigation`, `MainSurface`, `PageHeader`, and `MoviePosterCard` are implemented.
- [ ] Domain-specific components remain outside the global primitive layer.
- [ ] `PillTabs` remains feature-owned unless new verified reuse is introduced.

### Accessibility and responsive behavior

- [ ] Keyboard navigation and focus order work.
- [ ] Focus-visible styles remain visible on all surfaces.
- [ ] Navigation exposes accessible names and `aria-current`.
- [ ] Touch targets meet minimum size requirements.
- [ ] Mobile navigation respects safe-area insets.
- [ ] Layout remains usable at 200% zoom and with long labels.
- [ ] Reduced-motion preferences remove non-essential transforms and movement.

### Quality

- [ ] `/ui-foundation` demonstrates all approved variants and states.
- [ ] Relevant Vitest and Testing Library tests pass.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test:run` passes.
- [ ] `pnpm build` passes.
- [ ] No unrelated business logic or unnecessary dependency is introduced.

---

## 18. Definition of done

`feature/ui-foundation` is complete when:

1. Semantic tokens and approved fonts are implemented.
2. The minimal primitive inventory is implemented and tested.
3. The floating desktop navigation and mobile bottom navigation satisfy this PRD.
4. The rounded main application surface is integrated through `AppShell`.
5. Shared components remain separate from domain behavior.
6. Accessibility and reduced-motion requirements pass verification.
7. The internal validation route demonstrates the complete foundation.
8. Required quality commands pass.
9. The implementation is ready to become the shared UI base for feature work.

---

## 19. Final inventory

### Global primitives

```text
Button
Avatar
Input
```

### Shared components

```text
AppShell
FloatingNavigation
MainSurface
PageHeader
MoviePosterCard
```

### Intentionally excluded domain components

```text
Discover movie stack and swipe card
Reaction controls
Buti opinion teaser
Watched behavior
AI prompt chips and conversations
Profile statistics and taste tags
Movie Detail composition
Review form
Onboarding UI
Feature empty, offline, retry, and error states
```

### Open questions before proposal

```text
None
```

---

## 20. Final rule

Build the smallest reusable foundation supported by the prototype and the two approved shell deviations. Do not turn this change into a full product-screen implementation or a speculative design system.
