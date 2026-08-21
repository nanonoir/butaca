/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePreferencesPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("ProfilePreferencesPage", () => {
  it("connects the validated genre fixtures to the editor", () => {
    render(<ProfilePreferencesPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Editar gustos" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("group", { name: "Géneros disponibles" })
        .querySelectorAll("button"),
    ).toHaveLength(12);
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    expect(screen.getByText("3 seleccionados")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });
});
