// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders native button semantics and the requested variant", () => {
    render(
      <Button type="submit" variant="outline" size="lg">
        Continue
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.className).toContain("border-border");
    expect(button.className).toContain("min-h-12");
  });

  it("defaults to button type while preserving an explicit submit type", () => {
    const { rerender } = render(<Button>Continue</Button>);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "type",
      "button",
    );

    rerender(<Button type="submit">Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("keeps icon variants square and accessible with an icon-only name", () => {
    render(
      <Button variant="icon" aria-label="Open menu">
        <span aria-hidden="true">+</span>
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button.className).toContain("size-11");
    expect(button.className).toContain("p-0");
    expect(button.className).not.toContain("px-4");
  });

  it("exposes disabled state without removing the control from the accessibility tree", () => {
    render(<Button disabled>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-50");
  });
});
