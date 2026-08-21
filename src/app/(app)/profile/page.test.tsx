/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "./page";

const { getCurrentSession, redirect, findByUserId, countInteractions } =
  vi.hoisted(() => ({
    getCurrentSession: vi.fn(),
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
    findByUserId: vi.fn(),
    countInteractions: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/auth/server-auth-factory", () => ({
  getServerAuthService: () => Promise.resolve({ getCurrentSession }),
}));

vi.mock("@/db", () => ({ getDatabase: () => ({}) }));

vi.mock("@/db/repositories", () => ({
  UserPreferencesRepository: class {
    findByUserId = findByUserId;
  },
  UserMovieInteractionRepository: class {
    countByUser = countInteractions;
  },
  ReviewRepository: class {
    countByUser = () => Promise.resolve(4);
  },
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  findByUserId.mockResolvedValue({ preferredGenreIds: [878, 18, 53] });
  countInteractions.mockResolvedValue({ liked: 10, watched: 6 });
});

afterEach(cleanup);

describe("ProfilePage", () => {
  it("renders the stored profile and its real activity totals", async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: USER_ID, displayName: "Sofía Ramírez", avatarUrl: null },
      email: "sofia.ramirez@correo.com",
    });

    render(await ProfilePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Sofía Ramírez" }),
    ).toBeTruthy();
    expect(screen.getByText("sofia.ramirez@correo.com")).toBeTruthy();
    expect(screen.getByText("Ciencia ficción")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
  });

  it("derives the avatar initials from the stored display name", async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: USER_ID, displayName: "Sofía Ramírez", avatarUrl: null },
      email: "sofia.ramirez@correo.com",
    });

    render(await ProfilePage());

    expect(screen.getByText("SR")).toBeTruthy();
  });

  it("tolerates a profile without stored preferences", async () => {
    getCurrentSession.mockResolvedValue({
      user: { id: USER_ID, displayName: "viewer", avatarUrl: null },
      email: null,
    });
    findByUserId.mockResolvedValue(null);

    render(await ProfilePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "viewer" }),
    ).toBeTruthy();
  });

  it("redirects to the sign-in page without a session", async () => {
    getCurrentSession.mockResolvedValue(null);

    await expect(ProfilePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(findByUserId).not.toHaveBeenCalled();
  });
});
