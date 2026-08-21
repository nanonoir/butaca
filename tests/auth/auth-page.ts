import { expect, type Locator, type Page } from "@playwright/test";

export class AuthPage {
  readonly main: Locator;

  constructor(private readonly page: Page) {
    this.main = page.getByRole("main");
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.main).toBeVisible();
    await this.waitForHydration();
  }

  /** `main` is visible from the server-rendered HTML, so waiting for it is not
   * enough: clicking before React attaches its handlers triggers a native form
   * submission that reloads the page with every field reset. Waiting for the
   * client runtime keeps that race out of the suite. */
  private async waitForHydration(): Promise<void> {
    await this.page.waitForFunction(() => {
      const runtime = (window as { next?: { router?: unknown } }).next;

      return document.readyState === "complete" && Boolean(runtime?.router);
    });
  }

  async expectProductShellAbsent(): Promise<void> {
    await expect(
      this.page.getByRole("navigation", { name: "Navegación principal" }),
    ).toHaveCount(0);
  }
}
