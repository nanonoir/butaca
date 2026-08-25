import { expect, type Locator, type Page } from "@playwright/test";

export interface OnboardingTestUser {
  username: string;
  email: string;
  password: string;
}

export class OnboardingPage {
  readonly genres: Locator;
  readonly movieSearch: Locator;

  constructor(private readonly page: Page) {
    this.genres = page.getByRole("group", { name: "Géneros disponibles" });
    this.movieSearch = page.getByRole("search", {
      name: "Búsqueda de películas para onboarding",
    });
  }

  async register(user: OnboardingTestUser): Promise<void> {
    await this.page.goto("/register");
    await this.page.getByLabel("Nombre de usuario").fill(user.username);
    await this.page.getByLabel("Correo electrónico").fill(user.email);
    await this.page
      .getByLabel("Contraseña", { exact: true })
      .fill(user.password);
    await this.page.getByLabel("Confirmar contraseña").fill(user.password);
    await this.page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(this.page).toHaveURL(/\/onboarding$/);
  }

  async selectMinimumGenres(): Promise<void> {
    await expect(this.genres).toBeVisible();
    await this.genres.getByRole("button").nth(0).click();
    await this.genres.getByRole("button").nth(1).click();
    await this.page
      .getByRole("button", { name: "Continuar con películas" })
      .click();
    await expect(
      this.page.getByRole("heading", {
        name: "Películas que ya viste y te gustaron",
      }),
    ).toBeVisible();
  }

  async searchAndSelectMinimumMovies(query: string): Promise<void> {
    await this.page
      .getByRole("button", { name: "Abrir buscador de películas" })
      .click();
    await this.movieSearch
      .getByRole("textbox", { name: "Buscar películas" })
      .fill(query);
    await this.movieSearch
      .getByRole("button", { name: "Buscar películas" })
      .click();

    const movieButtons = this.page.getByRole("button", {
      name: /^Seleccionar /,
    });

    await expect.poll(() => movieButtons.count()).toBeGreaterThanOrEqual(3);

    for (let index = 0; index < 3; index += 1) {
      await movieButtons.nth(index).click();
    }

    await expect(
      this.page.getByRole("button", { name: "Completar perfil" }),
    ).toBeEnabled();
  }

  async complete(): Promise<void> {
    await this.page.getByRole("button", { name: "Completar perfil" }).click();
    await expect(this.page).toHaveURL(/\/$/);
  }
}
