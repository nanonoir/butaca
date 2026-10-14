# PRD — Authentication Flow

## 1. Overview

**Feature:** Authentication Flow  
**Status:** Canonical Product Spec  
**Scope:** Auth UI + shared contracts + client auth flows  

This specification defines the MVP authentication experience:

- Sign in
- Register
- Forgot password
- Reset password
- Shared Zod contracts
- Loading, validation, success, and error states

---

## 2. Core Decisions & Rules

- **Visual Alignment**: Uses the established dark semantic token system (`background`, `surface`, `border`, `primary`), Bricolage Grotesque for titles, Instrument Sans for form copy, and Space Mono for utility/hints.
- **Shell Separation**: Auth screens do **not** render `AppShell`, `FloatingNavigation`, or `MainSurface`. They use a focused layout (`src/app/(auth)/layout.tsx`).
- **Validation**:
  - Email: normalized/trimmed, standard email format.
  - Password: minimum 8 characters, maximum 1024 characters, must include at least 1 uppercase letter, 1 lowercase letter, and 1 digit.
  - Username (registration): 3 to 30 characters, letters, digits, and underscores, trimmed.
- **Security & Password Recovery**: Reset flows redirect through `/confirm` and `/reset-password`.
- **Navigation Guard**: Incomplete authenticated users are redirected to `/onboarding`. Unauthenticated users attempting to access protected routes are redirected to `/login`.

## Registration Field UX

- Order: email, nickname (visible label "Nombre de usuario"), password, confirmation.
- Email keeps `autocomplete="email"`; the nickname uses `name="nickname"` and `autocomplete="nickname"`. The HTTP payload remains `username`. Autocomplete hints reduce incorrect associations but cannot override every browser or password manager.
- Password requirements are hidden initially and during first typing. On password blur or submit, show only rules not met, using the canonical password schema. Later corrections immediately remove satisfied rules; a valid password leaves no checklist.
- Do not duplicate a checklist item as a separate field error. Keep other provider errors visible, first-error focus in visual order, and password accessibility descriptions linked only to visible feedback. Other auth forms retain their existing behavior.
