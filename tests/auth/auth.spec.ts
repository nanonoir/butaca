import { expect, test } from "@playwright/test";

import { AuthPage } from "./auth-page";

test.describe("Authentication routes", () => {
  test("renders every auth route without authenticated product navigation", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    for (const route of [
      { path: "/login", heading: "Iniciar sesión" },
      { path: "/register", heading: "Crear tu cuenta" },
      { path: "/forgot-password", heading: "Recuperar tu contraseña" },
      { path: "/reset-password", heading: "Establecer una nueva contraseña" },
    ]) {
      await authPage.goto(route.path);
      await expect(
        page.getByRole("heading", { name: route.heading }),
      ).toBeVisible();
      await authPage.expectProductShellAbsent();
    }
  });

  test("keeps login navigation and reset-success feedback explicit", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    await authPage.goto("/login");
    await expect(
      page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }),
    ).toHaveAttribute("href", "/forgot-password");
    await expect(
      page.getByRole("link", { name: "Crear una" }),
    ).toHaveAttribute("href", "/register");

    await authPage.goto("/login?reset=success");
    await expect(page.getByRole("status")).toContainText(
      "Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.",
    );
  });

  test("shows privacy-neutral recovery success and preserves retry access", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    await authPage.goto("/forgot-password");
    await page.getByLabel("Correo electrónico").fill("unknown@example.com");
    await page
      .getByRole("button", { name: "Enviar enlace de recuperación" })
      .click();

    await expect(page.getByRole("status")).toContainText(
      "Si existe una cuenta con este correo, se envió un enlace de recuperación.",
    );
    await expect(
      page.getByRole("button", { name: "Probar con otro correo" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).not.toContainText("provider");

    await page.getByRole("button", { name: "Probar con otro correo" }).click();
    await expect(page.getByLabel("Correo electrónico")).toHaveValue(
      "unknown@example.com",
    );
  });

  test("keeps invalid reset links non-editable and offers recovery", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    await authPage.goto("/reset-password?status=expired");
    await expect(
      page.getByRole("heading", {
        name: "Enlace de recuperación no disponible",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Nueva contraseña")).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: "Solicitar un nuevo enlace de recuperación",
      }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  test("routes a successful reset to login with reset feedback", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    await authPage.goto("/reset-password");
    await page
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("StrongPass1");
    await page
      .getByLabel("Confirmar nueva contraseña", { exact: true })
      .fill("StrongPass1");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();

    await expect(page).toHaveURL(/\/login\?reset=success$/);
    await expect(page.getByRole("status")).toContainText(
      "Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.",
    );
  });

  test("keeps auth layouts usable at mobile, tablet, and desktop widths", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await authPage.goto("/register");

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth,
      );
      await expect(page.getByLabel("Nombre de usuario")).toBeVisible();
    }
  });

  test("exposes validation, focus, live-region, and password-toggle semantics", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    await authPage.goto("/login");
    const passwordToggle = page.getByRole("button", {
      name: "Mostrar contraseña",
    });
    await expect(passwordToggle).toHaveAttribute(
      "aria-label",
      "Mostrar contraseña",
    );
    await expect(passwordToggle).toHaveClass(/focus-visible:ring-2/);

    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByRole("alert").filter({
          hasText: "Corrige los campos marcados antes de continuar.",
      }),
    ).toContainText("Corrige los campos marcados antes de continuar.");
  });
});
