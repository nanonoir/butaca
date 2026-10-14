/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthServiceError } from "@/features/auth/auth-service";

const resendVerificationRequest = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/http-auth-service", () => ({
  resendVerificationRequest,
}));

import { ProfileEmailVerification } from "./profile-email-verification";

afterEach(() => {
  cleanup();
  resendVerificationRequest.mockReset();
});

describe("ProfileEmailVerification", () => {
  it("shows the verified state without a button", () => {
    render(<ProfileEmailVerification emailVerified />);

    expect(screen.getByText("Correo verificado.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports an accepted request without claiming delivery", async () => {
    resendVerificationRequest.mockResolvedValue(undefined);
    render(<ProfileEmailVerification emailVerified={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificación" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Solicitamos el envío del correo de verificación.",
      ),
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(/enviamos|entregado/i);
  });

  it("offers a safe retry after a failure", async () => {
    resendVerificationRequest.mockRejectedValue(
      new AuthServiceError({ code: "AUTH_UNAVAILABLE" }),
    );
    render(<ProfileEmailVerification emailVerified={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificación" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No pudimos solicitar el correo. Intenta de nuevo más tarde.",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Reenviar verificación" }),
    ).toBeEnabled();
  });

  it("explains rate limiting", async () => {
    resendVerificationRequest.mockRejectedValue(
      new AuthServiceError({ code: "RATE_LIMITED" }),
    );
    render(<ProfileEmailVerification emailVerified={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificación" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("muchos intentos"),
    );
  });
});
