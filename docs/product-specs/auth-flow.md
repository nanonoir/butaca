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
  - Password: minimum 8 characters, must include at least 1 uppercase letter, 1 lowercase letter, and 1 digit. The shared password schema imposes no maximum length.
  - Username (registration): 3 to 30 characters, letters, digits, and underscores, trimmed.
- **Security & Password Recovery**: Reset flows redirect through `/confirm` and `/reset-password`.
- **Navigation Guard**: Incomplete authenticated users are redirected to `/onboarding`. Unauthenticated users attempting to access protected routes are redirected to `/login`.

## Registration Field UX

- Order: username (visible label "Nombre de usuario"), email, password, confirmation.
- Username uses `name="username"` and `autocomplete="username"`; email uses `autocomplete="email"`. Password and confirmation use `autocomplete="new-password"`.
- The password requirements checklist is always visible, including before typing, and indicates which requirements are met as the password changes.
- Fields validate on blur and submit; after a field has been touched or the form submitted, changes revalidate it. Invalid submission focuses the first invalid field in visual order. Provider errors remain visible as field or form feedback.
