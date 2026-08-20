/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import ProfilePage from "./page";

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
  });
});
