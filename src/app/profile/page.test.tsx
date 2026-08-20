/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("ProfilePage", () => {
  it("connects the local profile fixture to the profile screen", () => {
    render(<ProfilePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sofía Ramírez" }),
    ).toBeTruthy();
    expect(screen.getByText("Ciencia ficción")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar gustos" })).toBeEnabled();
  });
});
