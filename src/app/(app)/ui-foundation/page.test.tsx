/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import UIFoundationPage from "./page";

afterEach(cleanup);

describe("UIFoundationPage", () => {
  it("presents every semantic color role for visual inspection", () => {
    render(<UIFoundationPage />);

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
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("shows both avatar contracts and keeps the header action non-interactive", () => {
    render(<UIFoundationPage />);

    expect(
      screen.getByRole("img", { name: "Butaca team, small" }),
    ).toHaveTextContent("BT");
    expect(
      screen.getByRole("img", { name: "Local image rendering example" }),
    ).toHaveAttribute("src", "/window.svg");
    expect(screen.queryByRole("button", { name: "Focus order" })).toBeNull();
    expect(screen.getByText("Static contract")).toBeTruthy();
  });
});
