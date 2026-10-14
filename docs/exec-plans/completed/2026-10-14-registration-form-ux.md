# Registration autocomplete and password feedback

## Objective and scope

Implement the approved registration-only UX: email first, then nickname, password and confirmation. Give the browser nickname/email autocomplete semantics while keeping the public `username` payload unchanged. Hide password requirements until password blur or submit, show only unmet rules, remove satisfied rules while correcting, and hide the list when valid. Preserve validation policy, provider errors, accessibility and other forms.

References: `src/features/auth/register-form.tsx`, `password-requirements.tsx`, `src/contracts/auth.ts`, `docs/product-specs/auth-flow.md`.

## Execution

- [x] Adjust field order/autocomplete and first-error focus order.
- [x] Add opt-in unmet-only feedback using the canonical password schema; avoid duplicate errors and dangling accessibility references.
- [x] Validate focused form/shared-component tests, TypeScript and lint; document manual browser-autofill limitation.
- [x] Reconcile the auth specification and archive this plan.

## Decisions and safety

- First feedback is on blur (not a typing debounce), or submit if the field has not been blurred.
- Later corrections remove satisfied requirements immediately.
- No auth API, backend, password-policy, database, production, Git-delivery or unrelated migration changes. Preserve existing working-tree changes.
- Autocomplete hints cannot force browsers/password managers to discard previously saved associations; tests verify semantics and form behavior, not a guarantee about all password managers.

## Implementation Outcome

### Implemented

- **Field Order & Layout**: Reordered registration form fields to present `email` first, followed by `nickname` (labeled "Nombre de usuario"), `password`, and `confirmPassword`.
- **DOM & Autocomplete Semantics**: Set `name="nickname"`, `id="register-nickname"`, and `autocomplete="nickname"` on the username input to prevent browser/password-manager email-username conflation, while preserving the wire payload as `username`.
- **First-Error Focus**: Updated `REGISTER_FIELDS` order to focus `email` first when multiple validation errors occur.
- **Opt-in Progressive Password Feedback**: Added `unmetOnly` prop to `PasswordRequirements` using canonical `PasswordSchema` rules without changing underlying validations. Preserved default behavior for recovery and reset forms.
- **Interaction State in Registration**: Password requirements remain hidden initially and on first keystrokes; display only on password blur or form submit; dynamically remove satisfied rules as corrected; hide entirely when valid; avoid duplicating the first checklist rule as a separate field error.
- **Accessibility & Error Integrity**: Linked `aria-describedby` strictly to rendered requirement IDs, and preserved server/provider password error display.

### Deviations from Design

None.

### Validation

- Unit and component tests: `node node_modules/vitest/vitest.mjs run src/features/auth/register-form.test.tsx src/features/auth/password-requirements.test.tsx src/features/auth/recovery-forms.test.tsx --maxWorkers=2` (3 files / 32 passed).
- Auth test suite: `node node_modules/vitest/vitest.mjs run src/features/auth --maxWorkers=2` (12 files / 134 passed).
- Static analysis: ESLint passed across all 4 touched source and test files (`register-form.tsx`, `register-form.test.tsx`, `password-requirements.tsx`, `password-requirements.test.tsx`).
- Typecheck: Full pass on `next typegen && tsc --noEmit`.
- Verified behaviors: DOM ordering, autocomplete attributes, focus order on first error, pre-blur hidden state, unmet-only list without duplication, dynamic item removal on correction, valid/max-length handling, untouched wire payload (`username`), and preserved provider errors.
- External/integration scope: Live browser password-manager autofill profiles were not tested (advisory HTML semantics tested via DOM). No DB migrations, private environment changes, production deployments, or Git delivery operations were performed.

### Follow-up

- **Browser Autofill Semantics (Advisory)**: As documented in `docs/product-specs/auth-flow.md`, HTML `autocomplete` and `name` attributes serve as advisory hints to user agents; browsers or credential managers with existing saved associations cannot be forced to discard them.
- **Git Delivery**: Staging, commit, push, PR, and merge are deliberately excluded from this session per repository instructions, preserving existing worktree state.
