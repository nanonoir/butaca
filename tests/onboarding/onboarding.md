### E2E Tests: Onboarding

**Suite ID:** `ONBOARDING-E2E`
**Feature:** First-time taste onboarding with authenticated navigation.

---

## Test Case: `ONBOARDING-E2E-001` - Registration and incomplete-user gate

**Priority:** `critical`

**Flow Steps:**

1. Register a generated test account.
2. Verify registration enters `/onboarding`.
3. Request `/` before completion.

**Expected Result:** The incomplete authenticated user returns to onboarding.

## Test Case: `ONBOARDING-E2E-002` - Recovery, completion, and completed-user gate

**Priority:** `critical`

**Flow Steps:**

1. Select the minimum genres and movies through the catalog UI.
2. Simulate two transient completion failures.
3. Verify selected movies remain available and manually retry.
4. Verify successful completion reaches `/` and `/onboarding` redirects home.

**Expected Result:** Recoverable failures preserve user intent, completion succeeds, and completed users cannot re-enter onboarding.
