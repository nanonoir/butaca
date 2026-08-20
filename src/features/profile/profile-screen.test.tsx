/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { ProfileScreen } from "./profile-screen";

afterEach(cleanup);

const PROFILE = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
  preferredGenres: ["Ciencia ficción", "Drama", "Thriller"],
  activity: [
    { label: "Me gusta", value: 10, tone: "primary" as const },
    { label: "Vistas", value: 6, tone: "default" as const },
    { label: "Reseñas", value: 1, tone: "default" as const },
  ],
};

describe("ProfileScreen", () => {
  it("renders the profile identity and preferred genres", () => {
    render(<ProfileScreen profile={PROFILE} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sofía Ramírez" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Sofía Ramírez" }),
    ).toHaveTextContent("SR");
    expect(screen.getByText("sofia.ramirez@correo.com")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Géneros preferidos" }).children,
    ).toHaveLength(3);
  });

  it("renders the complete activity summary", () => {
    render(<ProfileScreen profile={PROFILE} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Mi actividad" }),
    ).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Me gusta")).toBeTruthy();
    expect(screen.getByText("Vistas")).toBeTruthy();
    expect(screen.getByText("Reseñas")).toBeTruthy();
  });

  it("keeps unavailable account actions disabled without fading them", () => {
    render(<ProfileScreen profile={PROFILE} />);

    const editButton = screen.getByRole("button", { name: "Editar gustos" });
    const logoutButton = screen.getByRole("button", { name: "Cerrar sesión" });

    expect(editButton).toBeDisabled();
    expect(logoutButton).toBeDisabled();
    expect(editButton.className).toContain("disabled:opacity-100");
    expect(logoutButton.className).toContain("disabled:opacity-100");
  });

  it("uses the compact vertical rhythm from the profile reference", () => {
    render(<ProfileScreen profile={PROFILE} />);

    const tastesSection = screen
      .getByRole("heading", { level: 2, name: "Mis gustos" })
      .closest("section");
    const sectionsContainer = tastesSection?.parentElement;
    const firstActivityStat = screen.getByLabelText(
      "Resumen de actividad",
    ).firstElementChild;

    expect(sectionsContainer?.classList).toContain("mt-8");
    expect(sectionsContainer?.classList).toContain("space-y-10");
    expect(firstActivityStat?.classList).toContain("sm:py-7");
  });
});
