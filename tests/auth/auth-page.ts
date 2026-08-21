import { expect, type Locator, type Page } from "@playwright/test";

export class AuthPage {
  readonly main: Locator;

  constructor(private readonly page: Page) {
    this.main = page.getByRole("main");
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.main).toBeVisible();
  }

  async expectProductShellAbsent(): Promise<void> {
    await expect(
      this.page.getByRole("navigation", { name: "Navegación principal" }),
    ).toHaveCount(0);
  }
}
