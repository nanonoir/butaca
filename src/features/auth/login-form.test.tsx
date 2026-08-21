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

import type { AuthUser } from "@/contracts";

import {
  AUTH_REQUEST_TIMEOUT_MS,
  AuthServiceError,
} from "./auth-service";
import {
  setAuthErrorReporter,
  type AuthErrorReporter,
} from "./auth-error-reporting";
import {
  AUTH_TEST_USER,
  createAuthService,
  invokeFormSubmitHandler,
} from "./auth-test-utils";
import { LoginForm } from "./login-form";

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
  vi.useRealTimers();
});

function submitLoginForm(): void {
  const form = screen
    .getByRole("button", { name: /Iniciando sesión|Iniciar sesión/ })
    .closest("form");
  if (!form) {
    throw new Error("Login form was not rendered");
  }

  fireEvent.submit(form);
}

describe("LoginForm", () => {
  it("normalizes valid input before calling the service and supports reset feedback", async () => {
    let receivedEmail = "";
    const onSuccess = vi.fn();
    const service = createAuthService({
      login: async (input) => {
        receivedEmail = input.email;
        return AUTH_TEST_USER;
      },
    });

    render(<LoginForm service={service} onSuccess={onSuccess} resetSuccess />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: " USER@EXAMPLE.COM " },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.",
    );

    submitLoginForm();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(AUTH_TEST_USER));
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    expect(receivedEmail).toBe("user@example.com");
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("keeps submission locked when onSuccess throws a Next redirect", async () => {
    let calls = 0;
    const redirectError = Object.assign(new Error("redirect"), {
      digest: "NEXT_REDIRECT;push;/discover;307;",
    });
    const onSuccess = vi.fn((): void => {
      throw redirectError;
    });
    const service = createAuthService({
      login: async () => {
        calls += 1;
        return AUTH_TEST_USER;
      },
    });

    render(<LoginForm service={service} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });

    const form = screen
      .getByRole("button", { name: "Iniciar sesión" })
      .closest("form");
    if (!form) {
      throw new Error("Login form was not rendered");
    }

    await act(async () => {
      await expect(invokeFormSubmitHandler(form)).rejects.toBe(redirectError);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Iniciando sesión…" }),
    ).toBeDisabled();

    submitLoginForm();

    expect(calls).toBe(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("navigates to discover when no success callback is provided", async () => {
    let calls = 0;
    const service = createAuthService({
      login: async () => {
        calls += 1;
        return AUTH_TEST_USER;
      },
    });

    render(<LoginForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });

    submitLoginForm();

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Iniciando sesión…" }),
    ).toBeDisabled();

    submitLoginForm();

    expect(calls).toBe(1);
    expect(routerPush).toHaveBeenCalledTimes(1);
  });

  it("does not invoke callbacks or navigate when the form unmounts during login", async () => {
    let resolveLogin: ((user: AuthUser) => void) | undefined;
    const onSuccess = vi.fn();
    const service = createAuthService({
      login: async () =>
        new Promise<AuthUser>((resolve) => {
          resolveLogin = resolve;
        }),
    });

    const { unmount } = render(
      <LoginForm service={service} onSuccess={onSuccess} />,
    );
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });
    submitLoginForm();

    await waitFor(() => expect(resolveLogin).toBeDefined());
    unmount();

    await act(async () => {
      resolveLogin?.(AUTH_TEST_USER);
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("maps invalid credentials to a generic form alert and preserves values", async () => {
    const service = createAuthService({
      login: async () => {
        throw new AuthServiceError({ code: "INVALID_CREDENTIALS" });
      },
    });

    render(<LoginForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });

    submitLoginForm();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Correo o contraseña incorrectos.",
      ),
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "user@example.com",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("short");
    expect(screen.getByRole("alert")).not.toHaveTextContent("provider");
  });

  it("focuses the affected field when the service returns a field error", async () => {
    const service = createAuthService({
      login: async () => {
        throw new AuthServiceError({
          code: "VALIDATION_ERROR",
          field: "password",
        });
      },
    });

    render(<LoginForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });

    const password = screen.getByLabelText("Contraseña");
    const scrollIntoView = vi.fn();
    password.scrollIntoView = scrollIntoView;

    submitLoginForm();

    await waitFor(() =>
      expect(password).toHaveAttribute("aria-invalid", "true"),
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(password).toHaveFocus();
  });

  it("prevents duplicate submissions while the request is pending", async () => {
    let resolveLogin: ((user: AuthUser) => void) | undefined;
    let calls = 0;
    const service = createAuthService({
      login: async () => {
        calls += 1;
        return new Promise<AuthUser>((resolve) => {
          resolveLogin = resolve;
        });
      },
    });

    render(<LoginForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });

    submitLoginForm();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Iniciando sesión…" }),
      ).toBeDisabled(),
    );
    submitLoginForm();

    expect(calls).toBe(1);
    resolveLogin?.(AUTH_TEST_USER);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Iniciando sesión…" }),
      ).toBeDisabled(),
    );
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("lets a caller override the default form spacing", () => {
    render(<LoginForm className="gap-8" />);

    const form = screen
      .getByRole("button", { name: "Iniciar sesión" })
      .closest("form");

    expect(form).toHaveClass("gap-8");
    expect(form).not.toHaveClass("gap-5");
  });

  it("reports unexpected errors without exposing credentials and keeps copy generic", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const service = createAuthService({
      login: async () => {
        throw new Error(
          "provider rejected email=user@example.com password=SecretPass1",
        );
      },
    });

    try {
      render(<LoginForm service={service} />);
      fireEvent.change(screen.getByLabelText("Correo electrónico"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Contraseña"), {
        target: { value: "SecretPass1" },
      });
      submitLoginForm();

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos iniciar sesión. Intenta de nuevo.",
        ),
      );

      const report = reporter.mock.calls[0]?.[0];
      expect(report).toMatchObject({
        operation: "login",
        metadata: { kind: "error", name: "Error" },
      });
      expect(JSON.stringify(report)).not.toContain("user@example.com");
      expect(JSON.stringify(report)).not.toContain("SecretPass1");
    } finally {
      restoreReporter();
    }
  });

  it("does not map caller onSuccess errors as AuthService errors", async () => {
    const reporter = vi.fn<AuthErrorReporter>();
    const restoreReporter = setAuthErrorReporter(reporter);
    const onSuccess = vi.fn(async () => {
      throw new AuthServiceError({ code: "INVALID_CREDENTIALS" });
    });

    try {
      render(<LoginForm service={createAuthService()} onSuccess={onSuccess} />);
      fireEvent.change(screen.getByLabelText("Correo electrónico"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Contraseña"), {
        target: { value: "short" },
      });
      submitLoginForm();

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No pudimos iniciar sesión. Intenta de nuevo.",
        ),
      );
      expect(screen.getByRole("alert")).not.toHaveTextContent(
        "Correo o contraseña incorrectos.",
      );
      expect(reporter).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "login" }),
      );
    } finally {
      restoreReporter();
    }
  });

  it("times out unavailable requests and restores form interaction", async () => {
    vi.useFakeTimers();
    const service = createAuthService({
      login: async () => new Promise<AuthUser>(() => undefined),
    });

    render(<LoginForm service={service} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });
    submitLoginForm();

    expect(
      screen.getByRole("button", { name: "Iniciando sesión…" }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El inicio de sesión no está disponible temporalmente. Intenta de nuevo más tarde.",
    );
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeEnabled();
  });
});
