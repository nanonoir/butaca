/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import UIFoundationPage from "./page";

afterEach(cleanup);

describe("UIFoundationPage", () => {
  it("presents every semantic color role for visual inspection", () => {
    render(<UIFoundationPage />);
    const semanticRoles = screen
      .getByRole("heading", { name: "Semantic roles" })
      .closest("section");

    expect(semanticRoles).not.toBeNull();

    for (const label of [
      "Background",
      "Foreground",
      "Surface",
      "Surface muted",
      "Surface elevated",
      "Primary",
      "Primary hover",
      "Primary foreground",
      "Secondary",
      "Muted",
      "Muted foreground",
      "Border",
      "Input",
      "Ring",
      "Overlay",
    ]) {
      expect(within(semanticRoles!).getByText(label)).toBeTruthy();
    }
  });

  it("shows both avatar contracts and keeps the header action non-interactive", () => {
    render(<UIFoundationPage />);

    expect(
      screen.getByRole("img", { name: "Butaca team, small" }).textContent,
    ).toContain("BT");
    expect(
      screen
        .getByRole("img", { name: "Local image rendering example" })
        .getAttribute("src"),
    ).toBe("/window.svg");
    expect(screen.queryByRole("button", { name: "Focus order" })).toBeNull();
    expect(screen.getByText("Static contract")).toBeTruthy();
  });
});
