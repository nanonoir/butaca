import { expect, test } from "@playwright/test";

import { OnboardingPage, type OnboardingTestUser } from "./onboarding-page";
import {
  cleanupOnboardingTestUser,
  createOnboardingTestUser,
} from "./onboarding-test-support";

let createdUser: OnboardingTestUser | undefined;

test.afterEach(async () => {
  if (createdUser) {
    await cleanupOnboardingTestUser(createdUser.email);
    createdUser = undefined;
  }
});

test.describe("Onboarding", () => {
  test("sends registration to onboarding and gates incomplete users", async ({
    page,
  }) => {
    createdUser = createOnboardingTestUser();
    const onboarding = new OnboardingPage(page);

    await onboarding.register(createdUser);
    await page.goto("/");

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { name: "Elegí tus géneros favoritos" }),
    ).toBeVisible();
  });

  test("preserves selections after a recoverable failure and redirects completed users", async ({
    page,
  }) => {
    createdUser = createOnboardingTestUser();
    const onboarding = new OnboardingPage(page);

    await onboarding.register(createdUser);
    await onboarding.selectMinimumGenres();
    await onboarding.searchAndSelectMinimumMovies("matrix");

    let transientFailuresRemaining = 2;
    await page.route("**/api/onboarding", async (route) => {
      if (transientFailuresRemaining === 0) {
        await route.continue();
        return;
      }

      transientFailuresRemaining -= 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "The request could not be completed",
          },
        }),
      });
    });

    await page.getByRole("button", { name: "Completar perfil" }).click();

    await expect(
      page.getByText(
        "No pudimos completar tu perfil. Conservamos tus selecciones para que reintentes.",
      ),
    ).toBeVisible();
    await expect
      .poll(() => page.getByRole("button", { name: /^Quitar / }).count())
      .toBeGreaterThanOrEqual(3);

    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(transientFailuresRemaining).toBe(0);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/$/);
  });
});
