/** @vitest-environment jsdom */

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  focusFieldById,
  focusFirstInvalidField,
  getZodFieldMessage,
  getZodFieldMessages,
  isNextRedirectError,
} from "./auth-form.helpers";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("auth form helpers", () => {
  it("extracts the first message for each typed field", () => {
    const issues = [
      { path: ["email"], message: "Correo inválido" },
      { path: ["email"], message: "Otro mensaje" },
      { path: ["password"], message: "Contraseña obligatoria" },
      { path: ["root"], message: "No es un campo" },
    ];

    expect(getZodFieldMessage(issues, "email")).toBe("Correo inválido");
    expect(
      getZodFieldMessages(issues, ["email", "password"] as const),
    ).toEqual({
      email: "Correo inválido",
      password: "Contraseña obligatoria",
    });
  });

  it("scrolls and focuses the first invalid field by its stable id", () => {
    const email = document.createElement("input");
    email.id = "login-email";
    const scrollIntoView = vi.fn();
    email.scrollIntoView = scrollIntoView;
    document.body.append(email);

    const field = focusFirstInvalidField(
      { email: "Correo inválido", password: "Contraseña obligatoria" },
      ["email", "password"] as const,
      { email: "login-email", password: "login-password" },
    );

    expect(field).toBe("email");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(document.activeElement).toBe(email);

    focusFieldById("missing-field");
    expect(document.activeElement).toBe(email);
  });

  it("recognizes Next redirect signals without treating regular errors as navigation", () => {
    const redirectError = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;push;/discover;307;",
    });

    expect(isNextRedirectError(redirectError)).toBe(true);
    expect(isNextRedirectError(new Error("regular callback failure"))).toBe(
      false,
    );
  });
});
