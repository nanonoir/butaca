/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));

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

describe("UIFoundationPage outside development", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // unstubAllEnvs restores NODE_ENV on its own.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 404 in production so the gallery never ships", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => render(<UIFoundationPage />)).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("still renders while developing", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<UIFoundationPage />);

    expect(notFound).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Semantic roles" }),
    ).toBeTruthy();
  });
});
