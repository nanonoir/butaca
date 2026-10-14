/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthServiceError } from "./auth-service";
import {
  setAuthErrorReporter,
  type AuthErrorReporter,
} from "./auth-error-reporting";
import {
  AUTH_TEST_USER,
  createAuthService,
  invokeFormSubmitHandler,
} from "./auth-test-utils";
import { RegisterForm } from "./register-form";
import { PASSWORD_POLICY } from "@/contracts/password-policy";

vi.mock("next/link", async () => {
  const { AuthLinkMock } = await import("./auth-test-utils");
  return { default: AuthLinkMock };
});

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  cleanup();
  routerPush.mockReset();
});

function fillValidRegistration(): void {
  fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
    target: { value: "Movie_Fan" },
  });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: " USER@EXAMPLE.COM " },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "StrongPass1" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
    target: { value: "StrongPass1" },
  });
}

function submitRegisterForm(): void {
  const form = screen
    .getByRole("button", { name: /Crear cuenta|Creando cuenta…/ })
    .closest("form");
  if (!form) {
    throw new Error("Register form was not rendered");
  }

  fireEvent.submit(form);
}

describe("RegisterForm", () => {
  it("hides requirements initially and validates on submit without sending invalid data", () => {
    let submitted = false;
    const service = createAuthService({
      register: async () => {
        submitted = true;
        return AUTH_TEST_USER;
      },
    });

    render(<RegisterForm service={service} />);
    expect(
      screen.queryByRole("list", { name: "Requisitos de la contraseña" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    submitRegisterForm();

    expect(submitted).toBe(false);
    expect(
      screen.getByRole("list", { name: "Requisitos de la contraseña" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveFocus();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Nombre de usuario")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("places email before nickname and gives autocomplete the correct semantics", () => {
    const { container } = render(
      <RegisterForm service={createAuthService()} />,
    );
    const fields = [...container.querySelectorAll("input")];

    expect(fields.map((field) => field.name)).toEqual([
      "email",
      "nickname",
      "password",
      "confirmPassword",
    ]);
    expect(fields[0]).toHaveAttribute("type", "email");
    expect(fields[0]).toHaveAttribute("autocomplete", "email");
    expect(fields[1]).toHaveAttribute("autocomplete", "nickname");
    expect(fields[1]).toHaveAttribute("id", "register-nickname");
    expect(fields[2]).toHaveAttribute("autocomplete", "new-password");
    expect(fields[3]).toHaveAttribute("autocomplete", "new-password");
  });

  it("waits for password blur, shows only unmet rules and removes them as they are met", () => {
    render(<RegisterForm service={createAuthService()} />);
    const password = screen.getByLabelText("Contraseña");

    fireEvent.change(password, { target: { value: "short" } });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(password).not.toHaveAttribute("aria-describedby");
    expect(password).not.toHaveAttribute("aria-invalid");

    fireEvent.blur(password);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getAllByText("La contraseña debe tener al menos 8 caracteres"),
    ).toHaveLength(1);
    expect(
      screen.getByText("La contraseña debe contener una letra mayúscula"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("La contraseña debe contener una letra minúscula"),
    ).not.toBeInTheDocument();
    expect(password).toHaveAttribute(
      "aria-describedby",
      "register-password-requirements",
    );
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");

    fireEvent.change(password, { target: { value: "abcdefgh" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.queryByText("La contraseña debe tener al menos 8 caracteres"),
    ).not.toBeInTheDocument();

    fireEvent.change(password, { target: { value: "StrongPass1" } });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(password).not.toHaveAttribute("aria-describedby");
    expect(password).not.toHaveAttribute("aria-invalid");
  });

  it("shows no checklist after a valid first blur and covers the existing maximum length", () => {
    render(<RegisterForm service={createAuthService()} />);
    const password = screen.getByLabelText("Contraseña");

    fireEvent.change(password, { target: { value: "StrongPass1" } });
    fireEvent.blur(password);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    fireEvent.change(password, {
      target: { value: `Aa1${"x".repeat(PASSWORD_POLICY.MAX_LENGTH)}` },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getByText("La contraseña debe tener como máximo 1024 caracteres"),
    ).toBeInTheDocument();
  });

  it("submits nickname as username without changing the public payload", async () => {
    const register = vi.fn(async () => AUTH_TEST_USER);
    render(
      <RegisterForm
        service={createAuthService({ register })}
        onSuccess={vi.fn()}
      />,
    );
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        username: "Movie_Fan",
        email: "user@example.com",
        password: "StrongPass1",
        confirmPassword: "StrongPass1",
      }),
    );
  });

  it("retains provider password errors when the local requirements are satisfied", async () => {
    const service = createAuthService({
      register: async () => {
        throw new AuthServiceError({ code: "WEAK_PASSWORD" });
      },
    });

    render(<RegisterForm service={service} />);
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() =>
      expect(
        screen.getByText(
          "Elige una contraseña que cumpla con todos los requisitos.",
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("anchors mismatched registration passwords to confirmation with Spanish copy", () => {
    const register = vi.fn(async () => AUTH_TEST_USER);
    const service = createAuthService({ register });

    render(<RegisterForm service={service} />);
    fillValidRegistration();
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "DifferentPass1" },
    });
    submitRegisterForm();

    const confirmation = screen.getByLabelText("Confirmar contraseña");
    expect(confirmation).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Las contraseñas no coinciden"),
    ).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("calls a provided success callback without using the default navigation", async () => {
    const onSuccess = vi.fn();
    const service = createAuthService();

    render(<RegisterForm service={service} onSuccess={onSuccess} />);
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(AUTH_TEST_USER));
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("keeps submission locked when onSuccess throws a Next redirect", async () => {
    let calls = 0;
    const redirectError = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;push;/onboarding;307;",
    });
    const onSuccess = vi.fn((): void => {
      throw redirectError;
    });
    const service = createAuthService({
      register: async () => {
        calls += 1;
        return AUTH_TEST_USER;
      },
    });

    render(<RegisterForm service={service} onSuccess={onSuccess} />);
    fillValidRegistration();
    const form = screen
      .getByRole("button", { name: "Crear cuenta" })
      .closest("form");
    if (!form) {
      throw new Error("Register form was not rendered");
    }

    await act(async () => {
      await expect(invokeFormSubmitHandler(form)).rejects.toBe(redirectError);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Creando cuenta…" }),
    ).toBeDisabled();

    submitRegisterForm();

    expect(calls).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("navigates to onboarding when no success callback is provided", async () => {
    let calls = 0;
    const service = createAuthService({
      register: async () => {
        calls += 1;
        return AUTH_TEST_USER;
      },
    });

    render(<RegisterForm service={service} />);
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/onboarding"));
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Creando cuenta…" }),
    ).toBeDisabled();

    submitRegisterForm();

    expect(calls).toBe(1);
    expect(routerPush).toHaveBeenCalledTimes(1);
  });

  it("does not invoke callbacks or navigate when the form unmounts during registration", async () => {
    let resolveRegister: ((user: typeof AUTH_TEST_USER) => void) | undefined;
    const onSuccess = vi.fn();
    const service = createAuthService({
      register: async () =>
        new Promise<typeof AUTH_TEST_USER>((resolve) => {
          resolveRegister = resolve;
        }),
    });

    const { unmount } = render(
      <RegisterForm service={service} onSuccess={onSuccess} />,
    );
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() => expect(resolveRegister).toBeDefined());
    unmount();

    await act(async () => {
      resolveRegister?.(AUTH_TEST_USER);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("maps username uniqueness failures to the username field and preserves values", async () => {
    const service = createAuthService({
      register: async () => {
        throw new AuthServiceError({
          code: "USERNAME_TAKEN",
          field: "username",
        });
      },
    });

    render(<RegisterForm service={service} />);
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() =>
      expect(
        screen.getByText("Este nombre de usuario ya está en uso."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Nombre de usuario")).toHaveValue("Movie_Fan");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "USER@EXAMPLE.COM",
    );
    expect(screen.getByLabelText("Nombre de usuario")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("maps email uniqueness failures to the email field", async () => {
    const service = createAuthService({
      register: async () => {
        throw new AuthServiceError({ code: "EMAIL_ALREADY_REGISTERED" });
      },
    });

    render(<RegisterForm service={service} />);
    fillValidRegistration();
    submitRegisterForm();

    await waitFor(() =>
      expect(
        screen.getByText("Ya existe una cuenta con este correo."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("reports unexpected registration errors without exposing credentials", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const service = createAuthService({
      register: async () => {
        throw new Error(
          "provider rejected email=user@example.com password=SecretPass1",
        );
      },
    });

    try {
      render(<RegisterForm service={service} />);
      fillValidRegistration();
      submitRegisterForm();

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos crear tu cuenta. Intenta de nuevo.",
        ),
      );

      const report = reporter.mock.calls[0]?.[0];
      expect(report).toMatchObject({
        operation: "register",
        metadata: { kind: "error", name: "Error" },
      });
      expect(JSON.stringify(report)).not.toContain("user@example.com");
      expect(JSON.stringify(report)).not.toContain("SecretPass1");
    } finally {
      restoreReporter();
    }
  });

  it("keeps caller onSuccess errors separate from registration service errors", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const onSuccess = vi.fn(async () => {
      throw new AuthServiceError({ code: "EMAIL_ALREADY_REGISTERED" });
    });

    try {
      render(
        <RegisterForm service={createAuthService()} onSuccess={onSuccess} />,
      );
      fillValidRegistration();
      submitRegisterForm();

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos crear tu cuenta. Intenta de nuevo.",
        ),
      );
      expect(screen.getByRole("alert")).not.toHaveTextContent(
        "Ya existe una cuenta con este correo.",
      );
      expect(reporter).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "register" }),
      );
    } finally {
      restoreReporter();
    }
  });
});
