# Specification: Discover and Onboarding Frontend Flow

## Requirement: Discover MUST fit the available viewport

The Discover initial surface MUST use the available viewport height without requiring document scrolling at supported mobile and desktop sizes. At mobile viewport heights up to 700 CSS pixels, the surface MUST hide the mobile Buti card and redundant helper hint, compact the header, and keep reaction controls usable.

### Scenario: Short mobile Discover viewport

- **Given** Discover is rendered on a mobile viewport with a height of 700 CSS pixels or less
- **When** the initial recommendation surface is displayed
- **Then** the mobile Buti card and swipe helper hint are not rendered
- **And** the poster receives the reclaimed vertical space
- **And** reaction controls remain individually actionable with touch targets of at least 44 CSS pixels

### Scenario: Normal mobile Discover viewport

- **Given** Discover is rendered on a mobile viewport taller than 700 CSS pixels
- **When** the initial recommendation surface is displayed
- **Then** the normal mobile Buti card and helper presentation remain available

## Requirement: Movie search MUST be an inline control

The Discover and onboarding movie search controls MUST share one inline interaction model. The control MUST transform from a trigger into an input, submit from Enter or its trailing icon, remain inline after submission, and expose a contextual clear action instead of an overlay.

### Scenario: Open and submit Discover search

- **Given** Discover is displaying its compact search trigger
- **When** the user activates the trigger and submits a non-empty title
- **Then** the trigger transforms into an input
- **And** the search results replace the recommendation stack without an overlay
- **And** the input remains available for query refinement

### Scenario: Clear Discover search

- **Given** Discover is displaying results for the submitted query
- **When** the user activates the clear action or presses Escape
- **Then** the query is cleared
- **And** the Discover recommendation stack is restored

## Requirement: Onboarding primary actions MUST remain visible

The onboarding flow MUST render the step primary action beside its progress indicator. The action MUST preserve the existing validation, loading, retry, and persistence behavior.

### Scenario: Continue from genres

- **Given** the user is on onboarding step 1
- **When** fewer than 2 genres are selected
- **Then** `Continuar con películas` is visible beside `Paso 1 de 2` and disabled
- **When** at least 2 genres are selected
- **Then** the same button is enabled and advances to step 2

### Scenario: Complete onboarding

- **Given** the user is on onboarding step 2
- **When** fewer than 3 movies are selected
- **Then** `Completar perfil` is visible beside `Paso 2 de 2` and disabled
- **When** at least 3 movies are selected
- **Then** the action submits the existing onboarding transaction
- **And** `Volver a géneros` remains below the movie content as the secondary action

## Requirement: Onboarding MUST show popular movies before search

The onboarding movie step MUST preload canonical popular TMDB movies and render them in the existing selectable movie grid before the user submits a search.

### Scenario: Initial movie picker

- **Given** onboarding popular movies are available
- **When** the user enters step 2 without searching
- **Then** a `Películas populares` grid is displayed
- **And** the user can select or deselect movies from that grid
- **And** the existing minimum of 3 and maximum of 8 movie selections remain enforced

### Scenario: Popular catalog failure

- **Given** the popular catalog request fails
- **When** the onboarding movie step is displayed
- **Then** a recoverable catalog error is shown
- **And** retrying requests the popular catalog again

## Requirement: Search and popular results MUST share selection state

Switching between popular movies and search results MUST preserve selected movies and MUST use the same selection limits and accessible action labels.

### Scenario: Return from search to popular movies

- **Given** the user selected movies from the popular grid and submitted a search
- **When** the user activates the onboarding clear action or presses Escape
- **Then** the popular movie grid is restored
- **And** previously selected movies remain selected
