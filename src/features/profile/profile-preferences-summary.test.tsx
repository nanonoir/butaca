/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Genre } from "@/contracts/movies";

import { PROFILE_PREFERENCES_SESSION_KEY } from "./profile-preferences-session";
import { ProfilePreferencesSummary } from "./profile-preferences-summary";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const GENRES: Genre[] = [
  { id: 878, name: "Ciencia ficción" },
  { id: 18, name: "Drama" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Terror" },
];

describe("ProfilePreferencesSummary", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    pushMock.mockClear();
  });

  afterEach(cleanup);

  it("renders the initial preferred genres and opens the editor", () => {
    render(
      <ProfilePreferencesSummary
        genreOptions={GENRES}
        initialPreferredGenreIds={[878, 18, 53]}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Géneros preferidos" }).children,
    ).toHaveLength(3);
    expect(screen.getByText("Ciencia ficción")).toBeTruthy();
    expect(screen.getByText("Drama")).toBeTruthy();
    expect(screen.getByText("Thriller")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Editar gustos" }));

    expect(pushMock).toHaveBeenCalledWith("/profile/preferences");
  });

  it("keeps Editar gustos geometry while transitioning to a violet outline", () => {
    render(
      <ProfilePreferencesSummary
        genreOptions={GENRES}
        initialPreferredGenreIds={[878, 18, 53]}
      />,
    );

    const editButton = screen.getByRole("button", { name: "Editar gustos" });

    expect(editButton).toHaveClass(
      "min-h-12",
      "rounded-lg",
      "px-5",
      "ring-1",
      "ring-inset",
      "ring-transparent",
      "hover:border-transparent!",
      "hover:bg-transparent!",
      "hover:text-primary!",
      "hover:ring-primary",
      "transition-[background-color,border-color,box-shadow,color,transform]!",
    );
    expect(editButton.className).not.toMatch(/hover:(?:scale|translate)/);
  });

  it("hydrates a valid selection from the current browser session", async () => {
    window.sessionStorage.setItem(
      PROFILE_PREFERENCES_SESSION_KEY,
      JSON.stringify([878, 27]),
    );

    render(
      <ProfilePreferencesSummary
        genreOptions={GENRES}
        initialPreferredGenreIds={[878, 18, 53]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Terror")).toBeTruthy();
      expect(screen.queryByText("Drama")).toBeNull();
      expect(screen.queryByText("Thriller")).toBeNull();
    });
  });
});
