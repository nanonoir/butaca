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

import {
  AUTH_REQUEST_TIMEOUT_MS,
  AuthServiceError,
} from "./auth-service";
import {
  setAuthErrorReporter,
  type AuthErrorReporter,
} from "./auth-error-reporting";
import { ForgotPasswordForm } from "./forgot-password-form";
import { RESET_LINK_STATUS, ResetPasswordForm } from "./reset-password-form";
import {
  createAuthService,
  invokeFormSubmitHandler,
} from "./auth-test-utils";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next/link", async () => {
  const { AuthLinkMock } = await import("./auth-test-utils");
  return { default: AuthLinkMock };
});

afterEach(() => {
  cleanup();
  routerPush.mockReset();
  vi.useRealTimers();
});

function submitForm(buttonName: string): void {
  const form = screen.getByRole("button", { name: buttonName }).closest("form");

  if (!form) {
    throw new Error("Expected form was not rendered");
  }

  fireEvent.submit(form);
}

describe("ForgotPasswordForm", () => {
  it("revalidates the email immediately after it has been blurred", () => {
    render(<ForgotPasswordForm service={createAuthService()} />);

    const email = screen.getByLabelText("Correo electrónico");
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.change(email, { target: { value: "invalid" } });
    fireEvent.blur(email);

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ingresa una dirección de correo válida",
    );

    fireEvent.change(email, { target: { value: "still-invalid" } });

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ingresa una dirección de correo válida",
    );

    fireEvent.change(email, { target: { value: "user@example.com" } });

    expect(email).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows neutral success, normalizes the request, and supports retry", async () => {
    let receivedEmail = "";
    const service = createAuthService({
      forgotPassword: async ({ email }) => {
        receivedEmail = email;
      },
    });

    render(<ForgotPasswordForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: " USER@EXAMPLE.COM " },
    });
    submitForm("Enviar enlace de recuperación");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Si existe una cuenta con este correo, se envió un enlace de recuperación.",
      ),
    );
    expect(receivedEmail).toBe("user@example.com");
    expect(screen.queryByLabelText("Correo electrónico")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Probar con otro correo" }),
    );

    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "user@example.com",
    );
  });

  it("keeps the email and maps recoverable service failures to a form alert", async () => {
    const service = createAuthService({
      forgotPassword: async () => {
        throw new AuthServiceError({ code: "RATE_LIMITED" });
      },
    });

    render(<ForgotPasswordForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    submitForm("Enviar enlace de recuperación");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Demasiados intentos. Espera un momento e intenta de nuevo.",
      ),
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "user@example.com",
    );
  });

  it("reports unexpected recovery errors without exposing the submitted email", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const service = createAuthService({
      forgotPassword: async () => {
        throw new Error(
          "provider rejected email=user@example.com password=SecretPass1",
        );
      },
    });

    try {
      render(<ForgotPasswordForm service={service} />);
      fireEvent.change(screen.getByLabelText("Correo electrónico"), {
        target: { value: "user@example.com" },
      });
      submitForm("Enviar enlace de recuperación");

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos iniciar la recuperación de contraseña. Intenta de nuevo.",
        ),
      );

      const report = reporter.mock.calls[0]?.[0];
      expect(report).toMatchObject({
        operation: "forgotPassword",
        metadata: { kind: "error", name: "Error" },
      });
      expect(JSON.stringify(report)).not.toContain("user@example.com");
      expect(JSON.stringify(report)).not.toContain("SecretPass1");
    } finally {
      restoreReporter();
    }
  });

  it("times out unavailable recovery requests and restores interaction", async () => {
    vi.useFakeTimers();
    const service = createAuthService({
      forgotPassword: async () => new Promise<void>(() => undefined),
    });

    render(<ForgotPasswordForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    submitForm("Enviar enlace de recuperación");

    expect(
      screen.getByRole("button", { name: "Enviando enlace de recuperación…" }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "La recuperación de contraseña no está disponible temporalmente. Intenta de nuevo más tarde.",
    );
    expect(
      screen.getByRole("button", { name: "Enviar enlace de recuperación" }),
    ).toBeEnabled();
  });

  it("ignores a late recovery failure after the form unmounts", async () => {
    let rejectForgotPassword: ((error: unknown) => void) | undefined;
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const service = createAuthService({
      forgotPassword: async () =>
        new Promise<void>((_, reject) => {
          rejectForgotPassword = reject;
        }),
    });

    try {
      const { unmount } = render(<ForgotPasswordForm service={service} />);
      fireEvent.change(screen.getByLabelText("Correo electrónico"), {
        target: { value: "user@example.com" },
      });
      submitForm("Enviar enlace de recuperación");

      await waitFor(() => expect(rejectForgotPassword).toBeDefined());
      unmount();

      await act(async () => {
        rejectForgotPassword?.(new Error("late provider failure"));
      });

      expect(reporter).not.toHaveBeenCalled();
    } finally {
      restoreReporter();
    }
  });
});

describe("ResetPasswordForm", () => {
  it("renders a non-editable expired-link state with recovery navigation", () => {
    render(
      <ResetPasswordForm
        service={createAuthService()}
        linkStatus={RESET_LINK_STATUS.EXPIRED}
      />,
    );

    expect(screen.queryByLabelText("Nueva contraseña")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este enlace de recuperación ha expirado. Solicita un nuevo enlace para continuar.",
    );
    expect(
      screen.getByRole("link", {
        name: "Solicitar un nuevo enlace de recuperación",
      }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("redirects the normal reset flow without rendering an in-place success state", async () => {
    let resolveReset: (() => void) | undefined;
    const resetPassword = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReset = resolve;
        }),
    );
    const service = createAuthService({ resetPassword });

    render(<ResetPasswordForm service={service} />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    submitForm("Actualizar contraseña");

    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("heading", { name: "Contraseña actualizada" }),
    ).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();

    resolveReset?.();

    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith("/login?reset=success"),
    );
    expect(
      screen.getByRole("button", { name: "Actualizando contraseña…" }),
    ).toBeDisabled();

    submitForm("Actualizando contraseña…");

    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: "Contraseña actualizada" }),
    ).toBeNull();
  });

  it("validates, submits, and shows reusable reset success guidance", async () => {
    const onSuccess = vi.fn();
    const service = createAuthService();

    render(<ResetPasswordForm service={service} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "DifferentPass1" },
    });
    submitForm("Actualizar contraseña");

    expect(screen.getByLabelText("Confirmar nueva contraseña")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    submitForm("Actualizar contraseña");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tu contraseña fue actualizada. Ahora puedes iniciar sesión con la nueva contraseña.",
    );
  });

  it("keeps reset submission locked when onSuccess throws a Next redirect", async () => {
    const redirectError = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;push;/login?reset=success;307;",
    });
    const onSuccess = vi.fn((): void => {
      throw redirectError;
    });
    const resetPassword = vi.fn(async () => undefined);
    const service = createAuthService({ resetPassword });

    render(<ResetPasswordForm service={service} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    const form = screen
      .getByRole("button", { name: "Actualizar contraseña" })
      .closest("form");
    if (!form) {
      throw new Error("Reset form was not rendered");
    }

    await act(async () => {
      await expect(invokeFormSubmitHandler(form)).rejects.toBe(redirectError);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Actualizando contraseña…" }),
    ).toBeDisabled();

    submitForm("Actualizando contraseña…");

    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps reset callback failures generic and separate from service mappings", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const onSuccess = vi.fn(async () => {
      throw new AuthServiceError({ code: "INVALID_RESET_LINK" });
    });

    try {
      render(<ResetPasswordForm service={createAuthService()} onSuccess={onSuccess} />);
      fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
        target: { value: "StrongPass1" },
      });
      fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
        target: { value: "StrongPass1" },
      });
      submitForm("Actualizar contraseña");

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos actualizar tu contraseña. Intenta de nuevo.",
        ),
      );
      expect(screen.queryByRole("heading", { name: "Contraseña actualizada" })).toBeNull();
      expect(reporter).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "resetPassword" }),
      );
      expect(routerPush).not.toHaveBeenCalled();
    } finally {
      restoreReporter();
    }
  });

  it("does not invoke a reset callback after the form unmounts", async () => {
    let resolveReset: (() => void) | undefined;
    const onSuccess = vi.fn();
    const service = createAuthService({
      resetPassword: async () =>
        new Promise<void>((resolve) => {
          resolveReset = resolve;
        }),
    });

    const { unmount } = render(
      <ResetPasswordForm service={service} onSuccess={onSuccess} />,
    );
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    submitForm("Actualizar contraseña");

    await waitFor(() => expect(resolveReset).toBeDefined());
    unmount();

    await act(async () => {
      resolveReset?.();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("moves to an invalid-link state when the service rejects the recovery context", async () => {
    const service = createAuthService({
      resetPassword: async () => {
        throw new AuthServiceError({ code: "INVALID_RESET_LINK" });
      },
    });

    render(<ResetPasswordForm service={service} />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
      target: { value: "StrongPass1" },
    });
    submitForm("Actualizar contraseña");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Enlace de recuperación no disponible",
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Nueva contraseña")).toBeNull();
  });

  it("reports unexpected reset errors without exposing password data", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const service = createAuthService({
      resetPassword: async () => {
        throw new Error(
          "provider rejected email=user@example.com password=SecretPass1",
        );
      },
    });

    try {
      render(<ResetPasswordForm service={service} />);
      fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
        target: { value: "SecretPass1" },
      });
      fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), {
        target: { value: "SecretPass1" },
      });
      submitForm("Actualizar contraseña");

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos actualizar tu contraseña. Intenta de nuevo.",
        ),
      );

      const report = reporter.mock.calls[0]?.[0];
      expect(report).toMatchObject({
        operation: "resetPassword",
        metadata: { kind: "error", name: "Error" },
      });
      expect(JSON.stringify(report)).not.toContain("user@example.com");
      expect(JSON.stringify(report)).not.toContain("SecretPass1");
    } finally {
      restoreReporter();
    }
  });
});
