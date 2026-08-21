### E2E Tests: Authentication Flow

**Suite ID:** `AUTH-E2E`
**Feature:** Auth route composition, recovery privacy, reset-link handling, responsive layout, and accessibility semantics.

---

## Test Cases

### `AUTH-E2E-001` — Auth routes stay outside the product shell

**Priority:** `critical`

**Description/Objective:** Confirm the four auth routes render their expected headings without authenticated navigation.

### `AUTH-E2E-002` — Recovery response is privacy-neutral

**Priority:** `high`

**Description/Objective:** Confirm a valid recovery request shows neutral copy and retains a retry path.

### `AUTH-E2E-003` — Invalid reset links remain non-editable

**Priority:** `high`

**Description/Objective:** Confirm an expired recovery state hides password fields and links to a new recovery request.

### `AUTH-E2E-004` — Successful reset returns to login

**Priority:** `critical`

**Description/Objective:** Confirm the development stub reset flow routes to login with reset-success feedback.

### `AUTH-E2E-005` — Responsive and accessible auth behavior

**Priority:** `high`

**Description/Objective:** Confirm mobile, tablet, and desktop layouts remain horizontally usable and form semantics expose labels, invalid states, live regions, and named password toggles.

### Notes

- The auth service is intentionally a development stub; these tests cannot prove provider delivery, account existence, session cookies, or production redirect validation.
- Browser coverage therefore proves the strongest available route, component, and stub-boundary behavior without fabricating backend state.
