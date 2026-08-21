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
import { EditProfilePreferencesScreen } from "./edit-profile-preferences-screen";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const GENRES: Genre[] = [
  { id: 878, name: "Ciencia ficción" },
  { id: 18, name: "Drama" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Terror" },
  { id: 35, name: "Comedia" },
  { id: 10749, name: "Romance" },
  { id: 14, name: "Fantasía" },
  { id: 28, name: "Acción" },
  { id: 16, name: "Animación" },
  { id: 9648, name: "Misterio" },
  { id: 12, name: "Aventura" },
  { id: 99, name: "Documental" },
];

function renderScreen() {
  return render(
    <EditProfilePreferencesScreen
      genreOptions={GENRES}
      initialPreferredGenreIds={[878, 18, 53]}
    />,
  );
}

describe("EditProfilePreferencesScreen", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    pushMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the reference genres with the initial three selected", () => {
    renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: "Editar gustos" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    expect(screen.getByText("3 seleccionados")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "Perfil" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("applies the lilac state without changing the chip geometry", () => {
    renderScreen();

    const selectedChip = screen.getByRole("button", {
      name: "Ciencia ficción",
    });
    const unselectedChip = screen.getByRole("button", { name: "Terror" });

    expect(selectedChip).toHaveClass(
      "rounded-full",
      "px-6",
      "text-base",
      "border-border",
      "aria-pressed:border-primary!",
      "aria-pressed:bg-primary/15",
      "aria-pressed:text-primary",
      "aria-pressed:hover:bg-primary/20",
    );
    expect(selectedChip.querySelector("svg path")).toHaveAttribute(
      "stroke",
      "currentColor",
    );

    expect(unselectedChip).toHaveClass(
      "rounded-full",
      "px-6",
      "text-base",
      "border-border",
    );
    expect(unselectedChip).not.toHaveClass(
      "border-primary",
      "bg-primary/15",
      "text-primary",
    );
    expect(unselectedChip.querySelector("svg")).toBeNull();
  });

  it("enforces the minimum and saves a valid selection for the session", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Drama" }));
    fireEvent.click(screen.getByRole("button", { name: "Thriller" }));

    expect(screen.getByText("1 seleccionado")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Terror" }));

    expect(screen.getByText("2 seleccionados")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(window.sessionStorage.getItem(PROFILE_PREFERENCES_SESSION_KEY)).toBe(
      JSON.stringify([878, 27]),
    );
    expect(pushMock).toHaveBeenCalledWith("/profile");
  });

  it("hydrates the editor from an existing session selection", async () => {
    window.sessionStorage.setItem(
      PROFILE_PREFERENCES_SESSION_KEY,
      JSON.stringify([878, 27]),
    );

    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Terror" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Drama" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
  });

  it("keeps the selection visible when session storage cannot save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      screen.getByText("No pudimos guardar tus gustos. Intentá de nuevo."),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
