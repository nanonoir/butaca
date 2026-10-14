# Design: Profile Screen, Preferences, and Avatar Sessions

## 1. Goal

Provide the user profile experience (`/profile`), allowing users to inspect their taste profile, stats (likes, watched movies, reviews), edit their avatar, and update preferred genres.

## 2. Key Architectural Decisions

### 2.1 Profile View Model
- `ProfileScreen` is structured as a React Server Component that receives a serializable profile view model containing:
  - Identity: display name, email, avatar URL / initials.
  - Tastes: preferred genre labels.
  - Activity counts: likes count, watched movies count, reviews count.
  - Recent likes: list of recently liked movies with artwork.
  - Recent reviews: list of user reviews with verdict and metadata.

### 2.2 Client State & Session Handlers
- Editing avatar (`ProfileAvatarEditor`) and preferences (`EditProfilePreferencesScreen`) utilize dedicated client state hooks:
  - `useProfileAvatarSession`: manages avatar presets / custom image choice.
  - `useProfilePreferencesSession`: manages genre selection toggle with local draft and rollback capability.
- Synchronizes with server-side repositories (`UserRepository`, `UserPreferencesRepository`) via dedicated server actions / route handlers.

### 2.3 Component Composition
- `Avatar` primitive extended with `lg` (88px) variant for profile header display.
- Layout keeps consistent semantic styling and respects responsive constraints (`max-w-4xl` centered container in `MainSurface`).
