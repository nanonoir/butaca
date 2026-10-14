# PRD — UI Foundation

## 1. Decision summary

**Feature:** UI Foundation  
**Status:** Canonical Product Spec  
**Project:** Movie discovery and recommendation MVP  

This feature establishes the shared visual foundation for Butaca. It extracts the smallest reusable system justified by the approved prototype and introduces two deliberate shell-level deviations approved after exploration:

1. Replace the attached desktop sidebar with a detached, rounded vertical floating navigation.
2. Place application content inside a rounded main surface separated from the viewport background.

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

## 3. Approved Shell Deviations

| Area | Prototype | Approved foundation behavior |
|---|---|---|
| Desktop navigation | Attached left sidebar with persistent labels | Detached rounded vertical floating navigation; five icon controls; each label reveals on hover and keyboard focus |
| Application background | Flat viewport composition | Rounded main content surface separated from the viewport background using semantic tokens |

All other visual decisions remain faithful to the prototype.

---

## 4. Design tokens

### 4.1 Color system

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

Raw colors may appear only inside token definitions. Components must consume semantic Tailwind classes or CSS variables.

### 4.2 Typography

| Role | Family | Fallback | Source |
|---|---|---|---|
| Display and headings | Bricolage Grotesque | `sans-serif` | Google Fonts through `next/font` |
| Body and UI | Instrument Sans | `system-ui, sans-serif` | Google Fonts through `next/font` |
| Captions and metadata | Space Mono | `monospace` | Google Fonts through `next/font` |

### 4.3 Radius

| Token | Value | Usage |
|---|---:|---|
| `radius-sm` | `0.625rem` | Small buttons and compact controls |
| `radius-md` | `0.75rem` | Navigation items and inputs |
| `radius-lg` | `1rem` | Input bars and elevated controls |
| `radius-xl` | `1.375rem` | Cards, chips, and tags |
| `radius-shell` | `1.75rem` | Main application surface |
| `radius-full` | `9999px` | Floating navigation container, avatars, circular actions |

---

## 5. Responsive Shell & Navigation

- **Desktop (`md` and above)**: Main content is rendered inside `MainSurface` (`surface`, `border-subtle`, `radius-shell`), subtly detached from viewport edges with `0.5rem` outer inset. `FloatingNavigation` is rendered structurally and visually inside `MainSurface`, vertically centered. On pointer hover or `focus-visible`, items reveal their labels to the right without moving page content.
- **Mobile (below `md`)**: Floating vertical navigation is hidden; a bottom navigation presents five destinations with icons and visible labels.

### Primary Destinations

| Destination | Visible label | Icon meaning |
|---|---|---|
| Discover | `Descubrir` | Discovery / browse |
| Liked Movies | `Me gusta` | Heart / liked collection |
| AI Assistant | `IA` | Assistant / sparkle |
| Profile | `Perfil` | User profile |
| About | `Acerca` | Product information |

---

## 6. Global UI Primitives & Shared Components

### Primitives (`src/components/ui/`)
- `Button`: `primary`, `outline`, `ghost`, `icon`
- `Avatar`: `sm`, `md`, `lg` (88px)
- `Input`: standard text input

### Shared Components (`src/components/shared/`)
- `AppShell`: provides subtle viewport frame
- `FloatingNavigation`: desktop vertical floating rail & mobile bottom counterpart
- `MainSurface`: structural rounded application surface
- `PageHeader`: repeated eyebrow, title, action/status slot
- `MoviePosterCard`: shared poster, title, year, presentation slots

---

## 7. Validation Surface

Development route at `/ui-foundation` demonstrating design tokens, primitives, navigation states, shell behavior, responsive layout, and accessibility features.
