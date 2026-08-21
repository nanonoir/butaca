/** @vitest-environment jsdom */

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordInput } from "./password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("preserves autocomplete and toggles password visibility accessibly", () => {
    render(
      <PasswordInput label="Contraseña" autoComplete="new-password" />,
    );

    const input = screen.getByLabelText("Contraseña");
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });

    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(toggle).toHaveClass("z-10");
    expect(toggle).toHaveClass("size-11");
    expect(toggle).not.toHaveClass("bg-primary");

    fireEvent.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-label", "Ocultar contraseña");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("prevents pointer down from stealing focus from the password field", () => {
    render(<PasswordInput label="Contraseña" />);

    const input = screen.getByLabelText("Contraseña");
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    input.focus();

    const pointerDown = createEvent.pointerDown(toggle);
    const preventDefault = vi.spyOn(pointerDown, "preventDefault");
    fireEvent(toggle, pointerDown);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
  });

  it("associates errors and disables both the field and visibility control", () => {
    render(
      <PasswordInput
        label="Contraseña"
        invalid
        error="Elige una contraseña que cumpla con todos los requisitos."
        disabled
      />,
    );

    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
    expect(input).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mostrar contraseña" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Elige una contraseña que cumpla con todos los requisitos.",
    );
  });
});
