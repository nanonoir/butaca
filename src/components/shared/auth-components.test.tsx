/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthFooter } from "./auth-footer";
import { AuthHeader } from "./auth-header";
import { AuthLayout } from "./auth-layout";
import { AuthTextLink } from "./auth-text-link";
import { FormAlert } from "./form-alert";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("auth shared components", () => {
  it("renders a centered auth surface without product navigation", () => {
    render(
      <AuthLayout>
        <h1>Iniciar sesión</h1>
      </AuthLayout>,
    );

    expect(screen.getByRole("main").classList).toContain("min-h-dvh");
    expect(screen.getByRole("main").classList).toContain("sm:justify-center");
    expect(
      screen.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("lets caller layout classes override default spacing", () => {
    render(
      <AuthLayout className="px-8">
        <h1>Iniciar sesión</h1>
      </AuthLayout>,
    );

    expect(screen.getByRole("main")).toHaveClass("px-8");
    expect(screen.getByRole("main")).not.toHaveClass("px-4");
  });

  it("keeps auth heading hierarchy and optional regions explicit", () => {
    render(
      <AuthHeader
        eyebrow="Bienvenido de nuevo"
        title="Iniciar sesión"
        description="Usa tu cuenta para continuar."
      />,
    );

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByText("Bienvenido de nuevo")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
    ).toBeTruthy();
    expect(screen.getByText("Usa tu cuenta para continuar.")).toBeTruthy();
  });

  it("merges caller classes over auth component defaults", () => {
    render(
      <AuthHeader className="gap-8" title="Iniciar sesión" />,
    );

    expect(screen.getByRole("banner")).toHaveClass("gap-8");
    expect(screen.getByRole("banner")).not.toHaveClass("gap-3");
  });

  it("announces error and success alerts with distinct semantics", () => {
    const { rerender } = render(
      <FormAlert variant="error">Correo o contraseña incorrectos.</FormAlert>,
    );

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert")).toHaveAttribute("data-variant", "error");

    rerender(<FormAlert variant="success">Contraseña actualizada.</FormAlert>);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-variant",
      "success",
    );
  });

  it("provides consistent route links and a secondary navigation group", () => {
    render(
      <AuthFooter>
        <span>¿Necesitas una cuenta?</span>
        <AuthTextLink href="/register">Crear una</AuthTextLink>
      </AuthFooter>,
    );

    const link = screen.getByRole("link", { name: "Crear una" });
    expect(link).toHaveAttribute("href", "/register");
    expect(link.className).toContain("focus-visible:ring-2");
    expect(
      screen.getByRole("navigation", { name: "Navegación de autenticación" }),
    ).toBeTruthy();
  });
});
