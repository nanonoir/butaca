/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordRequirements } from "./password-requirements";

afterEach(cleanup);

describe("PasswordRequirements", () => {
  it("communicates every password rule with text and state semantics", () => {
    render(<PasswordRequirements password="Abc1" />);

    expect(
      screen.getByRole("list", { name: "Requisitos de la contraseña" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Al menos 8 caracteres: no cumplido"),
    ).toBeInTheDocument();
    expect(screen.getByText("Una letra mayúscula: cumplido")).toBeInTheDocument();
    expect(screen.getByText("Una letra minúscula: cumplido")).toBeInTheDocument();
    expect(screen.getByText("Un número: cumplido")).toBeInTheDocument();
  });

  it("marks all rules as met for a compliant password", () => {
    render(<PasswordRequirements password="StrongPass1" />);

    expect(screen.getAllByText(/: cumplido$/)).toHaveLength(4);
    expect(screen.getAllByRole("listitem")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataset: expect.objectContaining({ valid: "true" }),
        }),
      ]),
    );
  });
});
