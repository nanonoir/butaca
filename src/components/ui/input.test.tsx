// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "./input";

afterEach(cleanup);

describe("Input", () => {
  it("associates its visible label with the native input", () => {
    render(<Input label="Email address" name="email" />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "name",
      "email",
    );
  });

  it("exposes invalid and disabled states with an associated error", () => {
    render(
      <Input
        label="Email address"
        invalid
        error="Enter a valid email address."
        disabled
      />,
    );

    const input = screen.getByLabelText("Email address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
    expect(input).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
  });
});
