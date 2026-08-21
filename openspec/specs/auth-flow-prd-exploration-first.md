# PRD — Authentication Flow

## 1. Overview

**Feature:** Authentication Flow
**Suggested branch:** `feature/auth-flow`
**Status:** Refined — Ready for SDD
**Scope:** Auth UI + shared contracts
**Backend integration:** Deferred until the backend PR / implementation is reviewed

This feature defines the MVP authentication experience:

- Sign in
- Register
- Forgot password
- Reset password
- Shared Zod contracts
- Reusable auth-related UI composition
- Loading, validation, success, and error states

The existing product prototype does **not** contain authentication screens.

Therefore, the auth UI must be designed from scratch while remaining visually consistent with:

- the current UI foundation;
- the existing product prototype;
- the established product language;
- the project accessibility and reuse rules.

This PRD was completed through the required exploration-first process and is now implementation-ready for the SDD workflow.

---

# 2. Workflow

This PRD completed the required exploration-first workflow:

```text
DRAFT PRD
    ↓
Codebase and UI foundation investigation
    ↓
Visual and component direction approved
    ↓
PRD updated in place
    ↓
REFINED — READY FOR SDD
    ↓
SDD proposal, specification, design, and tasks
    ↓
Implementation
```

The exploration is complete. This document is the implementation source of truth for the auth UI and shared contracts. The SDD proposal may start from this version, while backend integration remains a separately reconciled boundary.

# 2.1 Codebase Alignment & Invariants

- The current product foundation uses a dark semantic token system, Bricolage Grotesque for display text, Instrument Sans for sans text, and Space Mono for utility text.
- Existing `Button`, `Input`, and `Avatar` primitives are reusable. Existing `AppShell`, `MainSurface`, and `FloatingNavigation` belong to the authenticated product shell and must not be rendered by auth routes.
- The local `/ui-foundation` page is the available visual reference. The existing product prototype contains no authentication screens, so auth uses the established tokens and restrained surface language rather than copying a nonexistent screen.
- Auth routes use a dedicated `src/app/(auth)/layout.tsx` and do not reserve space for the desktop rail or mobile bottom navigation.
- Generic controls remain in `src/components/ui/`, cross-feature patterns remain in `src/components/shared/`, and auth-only compositions remain in `src/features/auth/`.
- Zod schemas in `src/contracts/auth.ts` are the single source of truth for frontend and backend-facing request contracts. TypeScript types are inferred with `z.infer`.
- The product-facing `AuthUser` contract remains `id`, `username`, and normalized `email`. A backend adapter must reconcile this contract with the current backend foundation model, which exposes `displayName` and does not currently persist `username` or `email` in the `users` table.
- No provider secrets, passwords, or raw provider errors may reach the browser. The UI depends on a typed `AuthService` boundary and a development stub until the real backend adapter is approved.

---

# 3. Fixed Product Decisions

The decisions in this section are fixed and must not change unless an explicit blocking technical conflict is discovered.

If a conflict exists, document it under `Open Questions` instead of silently changing the requirement.

---

## 3.1 Email confirmation

```text
DISABLED for MVP
```

Registration should create an active session immediately.

There is no mandatory email-verification step.

---

## 3.2 Registration fields

Registration requires exactly:

```text
username
email
password
confirmPassword
```

No other profile information is requested during account creation.

Movie preferences belong to onboarding.

---

## 3.3 Username

Username must be:

```text
globally unique
case-insensitive
```

Validation:

```text
minimum: 3 characters
maximum: 30 characters

allowed:
letters
numbers
underscore
```

Recommended pattern:

```regex
^[A-Za-z0-9_]+$
```

Normalization:

```text
trim
lowercase for uniqueness comparison
```

The UI may preserve the user's chosen display casing if supported by the backend.

---

## 3.4 Password policy

Password requirements:

```text
minimum 8 characters
at least 1 uppercase letter
at least 1 lowercase letter
at least 1 number
```

No special character is required.

---

## 3.5 Registration success

```text
successful register
→ active session
→ /onboarding
```

---

## 3.6 Login success

```text
authenticated
+
onboarding incomplete
→ /onboarding
```

```text
authenticated
+
onboarding complete
→ /discover
```

The final routing implementation belongs to the auth/session integration layer.

---

## 3.7 Forgot password

Forgot password uses an email recovery flow.

The UI must not reveal whether an account exists for the supplied email.

Expected neutral success message semantics:

```text
If an account exists for this email,
a recovery link has been sent.
```

Exact copy may be adapted to the product language.

---

## 3.8 Reset password success

```text
password reset successful
→ /login
```

Do not automatically continue into the application.

The login screen must support a reset-success state.

---

## 3.9 Email provider

Use:

```text
Resend SMTP
```

for both:

```text
development
production
```

Target sending subdomain:

```text
auth.noirnahuel.com
```

Suggested sender:

```text
no-reply@auth.noirnahuel.com
```

Actual Resend, SMTP, Supabase, DNS, and email-template configuration is backend/infrastructure work and is not implemented by this feature unless explicitly coordinated with the backend owner.

---

# 4. Primary Auth States

The product recognizes:

```text
UNAUTHENTICATED

AUTHENTICATED
+
ONBOARDING_INCOMPLETE

AUTHENTICATED
+
ONBOARDING_COMPLETE
```

Expected navigation:

```text
Unauthenticated
→ auth routes

Authenticated + onboarding incomplete
→ /onboarding

Authenticated + onboarding complete
→ /discover
```

Route protection itself is outside the current UI scope.

---

# 5. Routes

Expected routes:

```text
/login
/register
/forgot-password
/reset-password
```

Recommended App Router location:

```text
src/app/(auth)/
  login/
  register/
  forgot-password/
  reset-password/
```

---

# 6. Scope

## In scope

- Auth UI exploration.
- Login page.
- Register page.
- Forgot password page.
- Reset password page.
- Shared Zod contracts.
- Form validation.
- Error mapping expectations.
- Loading states.
- Success states.
- Password visibility UX.
- Password requirement UX.
- Reusable component discovery.
- Missing UI-foundation component discovery.
- Auth-specific component composition.
- Responsive behavior.
- Accessibility.
- Mock/stub auth integration if needed before backend integration.

## Out of scope

- Supabase Auth backend implementation.
- Session cookie implementation.
- Route guards / middleware.
- Database profile persistence.
- Production Resend configuration.
- DNS configuration.
- Email templates.
- Social login.
- Magic links.
- MFA.
- Passkeys.
- Email confirmation.
- Account deletion.
- Change email.
- Change password from settings/profile.
- Auth analytics.
- New design system unrelated to the existing UI foundation.

---

# 7. Exploration Outcome

The authentication screens are new, but their visual language extends the existing UI foundation. The local `/ui-foundation` route is the available visual reference; the existing product prototype contains no authentication screens.

The exploration confirmed that auth should use a dedicated route-group layout instead of `AppShell`, because `MainSurface` always renders the authenticated product navigation. Auth will reuse the existing semantic tokens, typography, focus treatment, `Button`, and `Input` primitives while adding only the reusable controls and compositions required by the four flows.

The final component inventory, state matrix, responsive behavior, accessibility behavior, implementation order, and backend reconciliation boundary are defined below. No isolated auth design system is introduced.

---

# 8. UI Foundation Audit

## Existing reusable primitives

- `Button` (`src/components/ui/button.tsx`) with `primary`, `outline`, `ghost`, and `icon` variants; `sm`, `md`, and `lg` sizes; disabled, focus-visible, and active states.
- `Input` (`src/components/ui/input.tsx`) with labels, invalid styling, field-level error text, `aria-describedby`, `aria-invalid`, and disabled state.
- `Avatar` (`src/components/ui/avatar.tsx`) for the existing product identity treatment; it is not required by the initial auth forms.
- Semantic layout and color tokens from `src/app/globals.css`, including `background`, `surface`, `surface-muted`, `foreground`, `muted`, `muted-foreground`, `primary`, `primary-hover`, `primary-foreground`, `secondary`, `border`, `input`, and `ring`.
- Existing motion tokens and utilities, including `duration-fast`, `duration-ui`, `ease-ui`, focus rings, and reduced-motion-safe transitions.

## Existing shared components usable by auth

- Root typography and metadata setup from `src/app/layout.tsx`.
- `PageHeader` (`src/components/shared/page-header.tsx`) as a reference for eyebrow, display title, and action hierarchy; auth may use a smaller auth-specific header composition instead of forcing the full product header.
- `AppShell`, `MainSurface`, and `FloatingNavigation` are not reused by auth because they reserve product navigation space and expose authenticated navigation.

## Existing tokens / visual rules reused by auth

- Dark `background` and `surface` layers with subtle `border` treatment.
- `surface-muted` for input controls and other recessed fields.
- `primary` and `primary-hover` for the primary action and high-signal status treatment.
- `foreground`, `muted`, and `muted-foreground` for text hierarchy.
- `ring` with visible focus-visible outlines and offset against the surrounding surface.
- `rounded-lg` controls and rounded product surfaces, with restrained shadows rather than decorative gradients.
- Display typography for auth titles, sans typography for labels/body copy, and mono typography only for compact metadata or eyebrow text when useful.

## Missing reusable primitives

- `PasswordInput` in `src/components/ui/`, composed from the existing input behavior with a show/hide control, accessible name, `type` switching, and preserved password-manager/autocomplete behavior.
- No new generic validation framework is required; auth consumes the existing input contract and shared Zod schemas.

## Missing shared cross-feature components

- `AuthLayout` or equivalent route-group surface composition in `src/components/shared/` for consistent auth width, spacing, background, and responsive behavior.
- `AuthHeader` for auth-specific eyebrow/title/description hierarchy.
- `FormAlert` for non-field-specific errors and success feedback with semantic live-region behavior.
- `AuthTextLink` or an equivalent shared link treatment for consistent navigation between auth routes.
- `AuthFooter` for secondary navigation and compact product/legal context where required by a screen.

---

# 9. Auth Visual Direction

Auth screens are new, but they must look like part of the same product. The direction below extends the existing foundation without introducing a parallel design system.

## Layout direction

Use a dedicated `(auth)` route-group layout with a full-viewport dark background and a responsive centered content column. Each screen renders one primary auth surface with a maximum readable width, consistent horizontal padding, and enough vertical spacing to remain usable when the keyboard is open. Auth pages must not render the product rail or mobile bottom navigation.

## Visual hierarchy

Use a small optional eyebrow or product marker, a prominent display title, a short explanatory description, the form, the primary action, and secondary route navigation. The primary action must be visually dominant; supporting copy and links remain subordinate but readable. Field errors stay with their fields, while request-level errors and success states use a form-level alert.

## Surface / container treatment

Use the existing `background`, `surface`, `surface-muted`, `border`, and radius tokens. The main auth surface is a restrained rounded card with a subtle border and shadow; inputs use the existing recessed control treatment. Do not add gradients, unrelated decorative panels, or a separate auth shell language. A text wordmark may be used because no logo asset exists, but a new brand asset is not required for this feature.

## Typography usage

Use Bricolage Grotesque for screen titles and high-level auth emphasis, Instrument Sans for labels, descriptions, buttons, and validation copy, and Space Mono only for compact metadata or an eyebrow when it improves hierarchy. Keep titles short enough to avoid awkward wrapping on mobile.

## Spacing behavior

Use the existing spacing scale with a consistent vertical rhythm: title/description, form groups, password requirements, primary action, and secondary navigation must each have explicit separation. Keep the form width stable across screens and avoid using full-viewport gaps that push validation feedback below the fold. The surface may grow naturally for registration and reset forms.

## Responsive behavior

On mobile, use a top-safe, scrollable column with `env(safe-area-inset-top)` and bottom padding so the keyboard and validation messages do not clip content. On tablet and desktop, center the auth surface within the viewport and preserve a readable maximum width. Do not reserve space for the authenticated navigation at any breakpoint. Use the existing project breakpoints rather than introducing a new breakpoint strategy.

## Motion / transition usage

Use only restrained transitions already present in the foundation: focus rings, button/input color changes, and an optional short surface/form entrance using `duration-fast` or `duration-ui` with `ease-ui`. Motion must never delay form interaction, obscure errors, or replace a state change. Respect `prefers-reduced-motion` and keep all functionality available without animation.

---

# 10. Component Ownership Rules

All auth UI must be built from reusable components.

Use:

```text
src/components/ui/
```

for low-level reusable primitives.

Use:

```text
src/components/shared/
```

for reusable cross-feature product components.

Use:

```text
src/features/auth/
```

for auth-specific composition.

Avoid one-off styled controls directly inside page files.

Preferred composition:

```text
AuthPage
   ↓
AuthLayout
   ↓
AuthForm
   ↓
Reusable primitives
```

Avoid:

```text
page.tsx
→ custom input styling
→ custom button styling
→ custom error styling
→ duplicated auth-specific controls
```

---

# 11. Final Component Inventory

## 11.1 New global UI primitives required

| Component | Why required | Variants | States | Destination |
|---|---|---|---|---|
| `PasswordInput` | Auth forms need password entry with visibility control without duplicating input markup or accessibility behavior. | `password`, `text`; optional `invalid`, `disabled` | default, focus-visible, invalid, disabled, show, hide | `src/components/ui/` |

No other new generic UI primitive is required for the initial auth scope.

---

## 11.2 New shared cross-feature components required

| Component | Why reusable | Variants / states | Destination |
|---|---|---|---|
| `AuthLayout` | Provides the shared responsive auth surface without leaking authenticated product navigation into auth routes. | centered, mobile-scrollable; default, loading-safe | `src/components/shared/` |
| `AuthHeader` | Keeps title, description, and optional eyebrow hierarchy consistent across auth screens. | title-only or title-with-description; optional wordmark | `src/components/shared/` |
| `FormAlert` | Presents request-level errors and success feedback with accessible live-region semantics. | error, success; polite or assertive based on severity | `src/components/shared/` |
| `AuthTextLink` | Provides consistent secondary navigation between auth routes. | default, muted; focus-visible | `src/components/shared/` |
| `AuthFooter` | Groups secondary navigation and optional supporting context below forms. | compact, stacked on mobile | `src/components/shared/` |

---

## 11.3 Auth-specific components

| Component | Responsibility | Reused by |
|---|---|---|
| `LoginForm` | Collects email/password, validates input, calls `AuthService.login`, maps normalized errors, and handles routing intent. | `/login` |
| `RegisterForm` | Collects username/email/password/confirmation, displays requirements, validates input, calls `AuthService.register`, and handles the onboarding intent. | `/register` |
| `ForgotPasswordForm` | Collects a normalized email, calls `AuthService.forgotPassword`, and always presents neutral recovery feedback after a valid request. | `/forgot-password` |
| `ResetPasswordForm` | Collects and validates the new password pair, handles invalid/expired links, calls `AuthService.resetPassword`, and routes to login on success. | `/reset-password` |
| `PasswordRequirements` | Presents password policy requirements and current valid/invalid state without relying on color alone. | `RegisterForm`, `ResetPasswordForm` |
| `AuthSuccessState` | Renders reusable success guidance and the next route action for recovery/reset states. | `ForgotPasswordForm`, `ResetPasswordForm`, login reset-success state |

Destination:

```text
src/features/auth/
```

---

## 11.4 Components deliberately not abstracted

Screen-specific headings, descriptions, field ordering, and route-specific success copy remain in the relevant auth composition. Do not create a generic `UniversalAuthForm`, generic page builder, or abstraction for one field arrangement used by only one screen. The route pages should remain thin and compose the shared layout with the feature-owned forms.

---

# 12. Component State Matrix

The following states are required by the final component inventory. State changes must be communicated through text, semantics, or controls as well as color.

| Component | Hover | Focus | Disabled | Loading | Error | Success | Other |
|---|---:|---:|---:|---:|---:|---:|---|
| `Button` | Yes | Yes | Yes | Yes | N/A | N/A | Primary action is disabled during submission; label or progress indicator communicates loading. |
| `Input` | Browser/control styling | Yes | Yes | N/A | Yes | N/A | `aria-invalid` and associated error text; values remain after request failures. |
| `PasswordInput` | Yes for visibility control | Yes | Yes | N/A | Yes | N/A | Show/hide control has an accessible name and preserves the field value and autocomplete behavior. |
| `FormAlert` | N/A | N/A | N/A | N/A | Yes | Yes | Uses an appropriate live region and never exposes raw provider errors. |
| `PasswordRequirements` | N/A | N/A | N/A | N/A | Yes | Yes | Each rule communicates state with text/icon semantics, not color alone. |
| `AuthTextLink` | Yes | Yes | N/A | N/A | N/A | N/A | Keyboard focus is visible and route changes preserve expected browser history. |
| `AuthLayout` | N/A | N/A | N/A | N/A | N/A | N/A | Responsive centered surface, mobile-safe scrolling, and no authenticated navigation. |

---

# 13. Register Flow

## Route

```text
/register
```

## Required fields

```text
username
email
password
confirmPassword
```

## Primary action

```text
Create account
```

## Secondary navigation

```text
Already have an account?
→ /login
```

---

# 14. Register Validation

## Username

```text
required
trimmed
3–30 characters
letters, numbers, underscore only
globally unique
case-insensitive uniqueness
```

Frontend validates format.

Backend ultimately validates uniqueness.

---

## Email

```text
required
valid email
trimmed
lowercase normalized
```

---

## Password

```text
required
minimum 8 characters
>= 1 uppercase
>= 1 lowercase
>= 1 number
```

---

## Confirm password

```text
required
must exactly match password
```

`confirmPassword` must never be persisted.

---

# 15. Register UX

## Form composition

`RegisterForm` renders the fields in this order: username, email, password, and confirm password. It uses the shared `Input` and `PasswordInput` primitives, a single primary `Create account` action, a form-level alert for request failures, and an `AuthFooter` link to `/login`. Field values remain intact after failed requests and the form must support Enter submission.

## Password requirements presentation

Render `PasswordRequirements` below the password field and before confirmation. Each rule updates as the user types or leaves the field: minimum length, uppercase, lowercase, and number. Use text and/or icons with accessible state labels; do not communicate validity through color alone. The same requirements remain available to assistive technology.

## Validation timing

Validate the complete request with `RegisterRequestSchema` on submit. Provide non-disruptive password requirement feedback during entry, validate a field on blur after interaction, and avoid showing errors for untouched fields. Confirm-password mismatch is associated with `confirmPassword`. Client validation never replaces server uniqueness checks.

## Error placement

Place format, policy, and confirmation errors directly below their associated fields. Map `USERNAME_TAKEN` and `EMAIL_ALREADY_REGISTERED` to the relevant field when the service identifies the field. Place `RATE_LIMITED`, `AUTH_UNAVAILABLE`, and `UNKNOWN_ERROR` in a `FormAlert` above the form. Never render raw provider errors.

## Loading state

On submission, disable all form controls and the primary action, expose a clear loading label or status, prevent duplicate requests, and preserve the entered values. Restore interaction after success or failure. Successful registration navigates to `/onboarding` only after the service returns an active session.

---

# 16. Register Error Codes

UI must support:

```text
USERNAME_TAKEN
EMAIL_ALREADY_REGISTERED
WEAK_PASSWORD
VALIDATION_ERROR
RATE_LIMITED
AUTH_UNAVAILABLE
UNKNOWN_ERROR
```

Do not render raw provider errors directly.

---

# 17. Successful Registration

```text
account created
→ active session
→ /onboarding
```

No email-verification screen is displayed.

---

# 18. Login Flow

## Route

```text
/login
```

## Fields

```text
email
password
```

## Primary action

```text
Sign in
```

## Secondary navigation

```text
Forgot password?
→ /forgot-password
```

```text
Don't have an account?
→ /register
```

---

# 19. Login Validation

Email:

```text
required
valid email
normalized
```

Password:

```text
required
```

Do not enforce registration complexity rules during login.

---

# 20. Login Error Codes

```text
INVALID_CREDENTIALS
RATE_LIMITED
AUTH_UNAVAILABLE
UNKNOWN_ERROR
```

Prefer a generic credential message:

```text
Invalid email or password.
```

---

# 21. Login UX

## Form composition

`LoginForm` renders email and password fields, one primary `Sign in` action, an `AuthTextLink` to `/forgot-password`, and an `AuthFooter` link to `/register`. Use `autocomplete="email"` and `autocomplete="current-password"`. Preserve values after request failures and support Enter submission.

## Error placement

Field validation appears below the relevant field. `INVALID_CREDENTIALS` uses the generic form-level message `Invalid email or password.` and must not identify which credential failed. `RATE_LIMITED`, `AUTH_UNAVAILABLE`, and `UNKNOWN_ERROR` use a form-level `FormAlert`. Raw provider errors are never rendered.

## Loading state

Disable the fields and primary action during submission, expose the loading state to assistive technology, prevent duplicate requests, and preserve field values if the request fails. On success, the auth/session integration determines whether navigation continues to `/onboarding` or `/discover`.

## Reset-success presentation

When reached after a successful password reset, `/login` displays a polite success `FormAlert` above the form explaining that the password was updated. The message is not shown on unrelated visits and does not automatically authenticate or continue into the application.

---

# 22. Forgot Password Flow

## Route

```text
/forgot-password
```

## Field

```text
email
```

## Primary action

```text
Send recovery link
```

## Secondary navigation

```text
Back to sign in
```

---

# 23. Forgot Password Privacy Rule

Never reveal whether the submitted email exists.

After a valid request, show neutral success feedback.

Example semantics:

```text
If an account exists for this email,
a recovery link has been sent.
```

---

# 24. Forgot Password UX

## Form composition

`ForgotPasswordForm` renders one email field, a primary `Send recovery link` action, a form-level alert region, and an `AuthFooter` link back to `/login`. Use `autocomplete="email"`, preserve the email on failure, and support Enter submission.

## Success-state presentation

After a valid request, replace or supplement the form with `AuthSuccessState` containing neutral copy such as `If an account exists for this email, a recovery link has been sent.` Do not reveal account existence, do not display provider details, and keep a clear route back to `/login`. The success state must be announced accessibly.

## Retry / back navigation behavior

The user can return to `/login` at any time. A retry action returns to the editable email form while preserving the normalized value unless the user intentionally clears it. Rate limits and unavailable services use a form-level error without changing the privacy-neutral success semantics for valid recovery requests.

---

# 25. Reset Password Flow

## Route

```text
/reset-password
```

Fields:

```text
newPassword
confirmPassword
```

The route is expected to be reached from a valid recovery link.

---

# 26. Reset Validation

Apply the same password requirements as registration.

Confirmation must match exactly.

---

# 27. Reset Error Codes

```text
INVALID_RESET_LINK
RESET_LINK_EXPIRED
AUTH_UNAVAILABLE
UNKNOWN_ERROR
```

Expired/invalid recovery links must provide:

```text
Request a new recovery link
→ /forgot-password
```

---

# 28. Reset Success

```text
password updated
→ /login
```

Login must display success feedback.

No automatic app session continuation is required.

---

# 29. Reset Password UX

## Form composition

`ResetPasswordForm` renders new password and confirm-password fields using `PasswordInput`, the shared `PasswordRequirements`, a primary `Update password` action, a form-level alert, and a route back to `/forgot-password` when appropriate. Use `autocomplete="new-password"`, preserve values after recoverable failures, and support Enter submission.

## Invalid-link state

For `INVALID_RESET_LINK` and `RESET_LINK_EXPIRED`, do not render an editable reset form. Show an accessible error state explaining that the recovery link is invalid or expired and provide `Request a new recovery link` linking to `/forgot-password`. Keep the state neutral about account details.

## Loading state

While validating the recovery context or submitting the new password, show a clear loading state, disable duplicate interaction, preserve entered values when possible, and keep the user informed through an accessible status. On success, route to `/login`, where the reset-success feedback is displayed.

---

# 30. Zod Contracts

Shared auth contracts must live in the agreed contracts layer, expected:

```text
src/contracts/auth.ts
```

Zod is the single source of truth.

Types must be inferred with:

```ts
z.infer<typeof Schema>
```

Do not manually duplicate DTO interfaces.

---

# 31. Username Schema

```ts
import { z } from "zod"

export const UsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9_]+$/)
```

Case-insensitive uniqueness remains a server-side invariant.

---

# 32. Email Schema

```ts
export const AuthEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase())
```

---

# 33. Password Schema

```ts
export const PasswordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, {
    message: "Password must contain an uppercase letter",
  })
  .regex(/[a-z]/, {
    message: "Password must contain a lowercase letter",
  })
  .regex(/[0-9]/, {
    message: "Password must contain a number",
  })
```

---

# 34. Register Contract

```ts
export const RegisterRequestSchema = z
  .object({
    username: UsernameSchema,
    email: AuthEmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      })
    }
  })

export type RegisterRequest = z.infer<
  typeof RegisterRequestSchema
>
```

Before provider/backend submission:

```text
confirmPassword
→ remove
```

---

# 35. Login Contract

```ts
export const LoginRequestSchema = z.object({
  email: AuthEmailSchema,
  password: z.string().min(1),
})

export type LoginRequest = z.infer<
  typeof LoginRequestSchema
>
```

---

# 36. Forgot Password Contract

```ts
export const ForgotPasswordRequestSchema =
  z.object({
    email: AuthEmailSchema,
  })

export type ForgotPasswordRequest =
  z.infer<typeof ForgotPasswordRequestSchema>
```

---

# 37. Reset Password Contract

```ts
export const ResetPasswordRequestSchema = z
  .object({
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.newPassword !==
      value.confirmPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      })
    }
  })

export type ResetPasswordRequest = z.infer<
  typeof ResetPasswordRequestSchema
>
```

---

# 38. Auth User Contract

The frontend must not depend on a raw Supabase User object.

Expected product-facing contract:

```ts
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  username: UsernameSchema,
  email: AuthEmailSchema,
})

export type AuthUser = z.infer<
  typeof AuthUserSchema
>
```

This mapping must be reconciled with the backend implementation before real integration.

---

# 39. Auth Error Contract

```ts
export const AuthErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INVALID_CREDENTIALS",
  "USERNAME_TAKEN",
  "EMAIL_ALREADY_REGISTERED",
  "WEAK_PASSWORD",
  "PASSWORDS_DO_NOT_MATCH",
  "INVALID_RESET_LINK",
  "RESET_LINK_EXPIRED",
  "RATE_LIMITED",
  "AUTH_UNAVAILABLE",
  "UNKNOWN_ERROR",
])
```

Provider-specific errors must be normalized before UI consumption.

---

# 40. Expected Auth Service Boundary

Until the backend implementation is confirmed, the UI should depend on a small service boundary.

Conceptual interface:

```ts
type AuthService = {
  register(
    input: RegisterRequest,
  ): Promise<AuthUser>

  login(
    input: LoginRequest,
  ): Promise<AuthUser>

  forgotPassword(
    input: ForgotPasswordRequest,
  ): Promise<void>

  resetPassword(
    input: ResetPasswordRequest,
  ): Promise<void>
}
```

The UI may use a typed development stub that exercises the same boundary and normalized error contract. The production adapter is deferred until the backend implementation is reviewed and reconciled with this PRD.

---

# 41. Form Interaction Rules

All auth forms must:

- prevent duplicate submissions;
- preserve field values during request failure;
- expose loading clearly;
- map field errors near their field;
- reserve form-level errors for non-field-specific failures;
- support Enter submission;
- preserve keyboard focus behavior;
- allow password copy/paste;
- support password managers.

---

# 42. Accessibility

Auth UI must include:

- semantic `<form>` usage;
- explicit labels;
- visible `focus-visible` states;
- accessible error association;
- accessible success feedback;
- keyboard operation;
- no color-only error communication;
- password visibility controls with accessible names.

Recommended autocomplete values:

```text
username
email
current-password
new-password
```

---

# 43. Responsive Requirements

The final auth composition must work on:

```text
mobile
tablet
desktop
```

Responsive behavior is derived from the existing UI foundation and uses the project's existing breakpoints. Do not introduce an unrelated breakpoint strategy.

---

# 44. Security Assumptions

Even though backend implementation is not part of this UI feature:

- passwords are never stored by application UI code;
- `confirmPassword` is never persisted;
- username uniqueness is enforced server-side;
- email normalization is enforced server-side;
- password policy is enforced server-side/provider-side;
- recovery must not expose account existence;
- provider errors are normalized;
- secrets never reach the browser;
- redirect destinations are controlled by the application.

---

# 45. Backend Integration Boundary

Do not implement a second independent auth backend while another team member owns backend auth.

Before real integration:

```text
inspect backend PR
→ compare contracts
→ resolve differences
→ connect UI
```

If backend implementation differs from this PRD, explicitly reconcile the difference before changing contracts.

---

# 46. Implementation Plan

## Files to create

- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/components/ui/password-input.tsx`
- `src/components/shared/auth-layout.tsx`
- `src/components/shared/auth-header.tsx`
- `src/components/shared/form-alert.tsx`
- `src/components/shared/auth-text-link.tsx`
- `src/components/shared/auth-footer.tsx`
- `src/features/auth/login-form.tsx`
- `src/features/auth/register-form.tsx`
- `src/features/auth/forgot-password-form.tsx`
- `src/features/auth/reset-password-form.tsx`
- `src/features/auth/password-requirements.tsx`
- `src/features/auth/auth-success-state.tsx`
- `src/features/auth/auth-service.ts`
- `src/features/auth/auth-service.stub.ts`
- `src/contracts/auth.ts`
- Relevant unit/component tests colocated with the new modules.

## Files to modify

- `src/contracts/index.ts` — re-export auth schemas and inferred types.
- `src/app/layout.tsx` — only if shared metadata or font behavior must expose the auth route group; do not add product navigation coupling.
- Existing test/config files only when required by the established test conventions.

## Existing components reused

- `src/components/ui/button.tsx` (`Button`).
- `src/components/ui/input.tsx` (`Input`).
- `src/app/globals.css` semantic color, radius, spacing, focus, and motion tokens.
- `src/app/layout.tsx` typography and root metadata conventions.
- `src/components/shared/page-header.tsx` as a hierarchy reference, without forcing product-page header behavior into auth.

## New UI primitives required first

- `PasswordInput`, including accessible show/hide control, `autocomplete`, focus, invalid, disabled, and value-preserving behavior.

## New shared components required first

- `AuthLayout` / auth surface composition.
- `AuthHeader`.
- `FormAlert`.
- `AuthTextLink`.
- `AuthFooter`.

## Auth implementation order

1. Add and test the shared auth contracts and normalized error codes.
2. Add `PasswordInput` and shared auth layout/presentation components.
3. Add the typed `AuthService` boundary and development stub without provider-specific behavior in UI components.
4. Implement login and its loading/error/reset-success states.
5. Implement registration and password requirements, including client/server error mapping expectations.
6. Implement forgot-password neutral success and retry behavior.
7. Implement reset-password valid, invalid/expired, loading, and success states.
8. Add route-level composition and navigation tests for all four routes.
9. Validate responsive and accessibility behavior at mobile, tablet, and desktop sizes.
10. Reconcile the service boundary with the reviewed backend adapter before production integration; do not introduce a second auth backend.

---

# 47. Exploration Completion Summary

## Existing UI reused

- Existing semantic dark tokens, typography, focus rings, motion utilities, `Button`, `Input`, and the project's contract/test conventions.
- The `/ui-foundation` route as the local visual reference.
- `PageHeader` as a hierarchy reference only; authenticated navigation components are intentionally not reused.

## New global primitives

`PasswordInput` only. No other generic primitive is required for the approved initial scope.

## New shared components

`AuthLayout`, `AuthHeader`, `FormAlert`, `AuthTextLink`, and `AuthFooter` in `src/components/shared/`.

## Auth-specific components

`LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `PasswordRequirements`, and `AuthSuccessState` in `src/features/auth/`, plus the typed `AuthService` boundary and development stub.

## Key design decisions inferred from the product

1. Auth uses a dedicated route-group layout and never renders `FloatingNavigation`.
2. Auth uses centered, token-based surfaces on larger screens and a mobile-safe scrollable column on small screens.
3. A text wordmark is sufficient; a new logo asset is not part of this feature.
4. Password requirements are visible and progressively communicated, while validation remains schema-driven.
5. Field errors stay near fields; request-level errors and success states use accessible form alerts.
6. Existing motion tokens are used only for restrained transitions and never as a requirement for comprehension.
7. A typed stub enables UI development while the production adapter remains behind the reviewed backend boundary.
8. The product-facing `AuthUser` contract remains stable; backend model differences are reconciled in an adapter rather than silently changing the shared contract.

## Open questions

None blocking the UI/contracts exploration. Before production integration, the backend owner must confirm the adapter mapping for `username`, `email`, and onboarding state against the actual auth/profile implementation.

---

# 48. Acceptance Criteria

## Exploration

- [x] Current UI foundation was inspected.
- [x] Existing product prototype was inspected; no authentication screens were present, so `/ui-foundation` is the local visual reference.
- [x] Auth visual direction was inferred from the current product language.
- [x] Existing reusable components were identified.
- [x] Missing primitives were identified.
- [x] Missing shared components were identified.
- [x] Auth-specific components were identified.
- [x] Component ownership was documented.
- [x] All discovery placeholders were replaced.
- [x] No exploration-only instructions remain in the final PRD.
- [x] Remaining open questions are explicitly documented.

## Registration

- [x] Requires username, email, password, confirm password.
- [x] Username validates 3–30 characters.
- [x] Username accepts only letters, numbers, underscore.
- [x] Username uniqueness is represented as a backend error.
- [x] Email validates and normalizes.
- [x] Password requires 8+ characters.
- [x] Password requires uppercase, lowercase, number.
- [x] Confirm password matches.
- [ ] Successful register expects active session.
- [ ] Successful register redirects to `/onboarding`.
- [x] No email-verification screen exists.

> Deferred to production auth integration: active-session creation and post-registration routing require the real authentication adapter. The UI exposes the typed `onSuccess` boundary and keeps `/onboarding` as the approved destination.

## Login

- [x] Requires email and password.
- [x] Invalid credentials use a safe generic error.
- [ ] Successful login supports `/onboarding` or `/discover`.
- [x] Forgot-password navigation exists.
- [x] Register navigation exists.

> Deferred to production auth integration: session-aware login routing requires the real authentication/session boundary. The login form exposes the typed `onSuccess` callback for that integration.

## Forgot Password

- [x] Email validation exists.
- [x] Account existence is not revealed.
- [x] Neutral success feedback exists.
- [x] Back-to-login navigation exists.

## Reset Password

- [x] New password uses the same policy.
- [x] Confirm password matches.
- [x] Invalid/expired recovery states exist.
- [x] Successful reset redirects to `/login`.
- [x] Login can show reset-success feedback.

## Reuse

- [x] Auth screens use reusable primitives.
- [x] Missing generic primitives are added to `components/ui`.
- [x] Missing cross-feature patterns are added to `components/shared`.
- [x] Auth-specific composition remains in `features/auth`.
- [x] Pages do not contain duplicated one-off styled controls.
- [x] No isolated auth design system was introduced.

## Accessibility

- [x] Forms use semantic markup.
- [x] Labels are explicit.
- [x] Focus is visible.
- [x] Password controls are accessible.
- [x] Loading blocks duplicate submits.
- [x] Errors are associated with relevant fields.
- [x] Responsive layouts work across supported sizes.

---

# 49. Definition of Done

The feature is ready for implementation when:

1. the explorer has completed the UI/component investigation;
2. all placeholders have been replaced;
3. no exploration-only instructions remain;
4. the final component inventory is explicit;
5. implementation order is explicit;
6. no blocking design questions remain.

The feature is complete when:

1. auth contracts exist and compile;
2. missing reusable UI primitives are implemented;
3. missing shared components are implemented;
4. Login UI is complete;
5. Register UI is complete;
6. Forgot Password UI is complete;
7. Reset Password UI is complete;
8. validation/loading/error/success states are complete;
9. the UI follows the existing product language;
10. no conflicting backend implementation was introduced;
11. `pnpm lint` passes;
12. `pnpm typecheck` passes;
13. relevant tests pass;
14. `pnpm build` passes.

---

# 50. Production Follow-Up

Before public launch, confirm:

```text
Supabase Auth production configuration
+
Resend SMTP
+
auth.noirnahuel.com
+
production recovery redirects
+
email templates
+
rate limits
```

These tasks are not blockers for the UI/contracts exploration.

---

# 51. Final Principle

> Authentication screens are new, but their visual language is not. Build them from the product's existing UI foundation, extend that foundation only where reusable components are genuinely missing, and keep every screen composed from reusable pieces.
