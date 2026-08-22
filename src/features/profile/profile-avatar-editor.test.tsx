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

import {
  PROFILE_AVATAR_FILE_ERROR,
  PROFILE_AVATAR_MAX_FILE_BYTES,
} from "./profile-avatar-choice";
import { PROFILE_AVATAR_SESSION_KEY } from "./profile-avatar-session";
import { ProfileAvatarEditor } from "./profile-avatar-editor";

const PROPS = {
  displayName: "Sofía Ramírez",
  email: "sofia.ramirez@correo.com",
  initials: "SR",
};

function renderEditor() {
  return render(<ProfileAvatarEditor {...PROPS} />);
}

describe("ProfileAvatarEditor", () => {
  beforeEach(() => window.sessionStorage.clear());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens from the avatar and closes with Listo", () => {
    renderEditor();

    const avatarButton = screen.getByRole("button", {
      name: "Cambiar avatar",
    });
    expect(avatarButton).toHaveAttribute("aria-expanded", "false");
    expect(avatarButton.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeEnabled();
    expect(
      screen.queryByRole("group", { name: "Opciones de avatar" }),
    ).toBeNull();

    fireEvent.click(avatarButton);

    expect(avatarButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("group", { name: "Opciones de avatar" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /^Usar color / }),
    ).toHaveLength(6);
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    const uploadButton = screen.getByRole("button", { name: "Subir foto" });
    expect(uploadButton).toBeEnabled();
    expect(uploadButton.querySelector("svg")).toBeTruthy();
    expect(screen.getByLabelText("Seleccionar foto de perfil")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );

    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(
      screen.queryByRole("group", { name: "Opciones de avatar" }),
    ).toBeNull();
  });

  it("keeps Cambiar geometry while transitioning to a violet outline", () => {
    renderEditor();

    const changeButton = screen.getByRole("button", { name: "Cambiar" });

    expect(changeButton).toHaveClass(
      "min-h-11",
      "rounded-sm",
      "px-3",
      "ring-1",
      "ring-inset",
      "ring-transparent",
      "hover:border-transparent!",
      "hover:bg-transparent!",
      "hover:text-primary!",
      "hover:ring-primary",
      "transition-[background-color,border-color,box-shadow,color,transform]!",
    );
    expect(changeButton.className).not.toMatch(/hover:(?:scale|translate)/);
  });

  it("applies and persists a color in the same interaction", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Usar color Verde salvia" }),
    );

    expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
      "bg-[#6faaa1]!",
    );
    expect(
      screen.getByRole("button", { name: "Usar color Verde salvia" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Avatar actualizado");
    expect(window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY)).toBe(
      JSON.stringify({ kind: "color", colorId: "sage" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(
      screen.queryByRole("group", { name: "Opciones de avatar" }),
    ).toBeNull();
    expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
      "bg-[#6faaa1]!",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hydrates a valid saved color", async () => {
    window.sessionStorage.setItem(
      PROFILE_AVATAR_SESSION_KEY,
      JSON.stringify({ kind: "color", colorId: "terracotta" }),
    );

    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
        "bg-[#b8746a]!",
      );
      expect(
        screen.getByRole("button", { name: "Usar color Terracota" }),
      ).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("opens the native picker from Subir foto", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));
    const fileInput = screen.getByLabelText("Seleccionar foto de perfil");
    const clickSpy = vi.spyOn(fileInput, "click");

    fireEvent.click(screen.getByRole("button", { name: "Subir foto" }));

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("uploads a valid photo and confirms the update", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));
    const fileInput = screen.getByLabelText("Seleccionar foto de perfil");
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Sofía Ramírez" }),
      ).toHaveAttribute("src", "data:image/png;base64,AQID");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Avatar actualizado",
      );
    });
    expect(fileInput).toHaveValue("");
    expect(
      JSON.parse(
        window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY) ?? "null",
      ),
    ).toEqual({ kind: "photo", dataUrl: "data:image/png;base64,AQID" });
  });

  it.each([
    new File([new Uint8Array([1])], "avatar.gif", { type: "image/gif" }),
    new File(
      [new Uint8Array(PROFILE_AVATAR_MAX_FILE_BYTES + 1)],
      "avatar.png",
      { type: "image/png" },
    ),
  ])("rejects an invalid photo without changing the avatar", async (file) => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));

    fireEvent.change(screen.getByLabelText("Seleccionar foto de perfil"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      PROFILE_AVATAR_FILE_ERROR,
    );
    expect(
      screen.getByRole("img", { name: "Sofía Ramírez" }),
    ).toHaveTextContent("SR");
    expect(
      window.sessionStorage.getItem(PROFILE_AVATAR_SESSION_KEY),
    ).toBeNull();
  });

  it("reports a FileReader failure without changing the avatar", async () => {
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(
      function failRead(this: FileReader) {
        this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      },
    );
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));

    fireEvent.change(screen.getByLabelText("Seleccionar foto de perfil"), {
      target: {
        files: [
          new File([new Uint8Array([1])], "avatar.png", {
            type: "image/png",
          }),
        ],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos leer esa imagen. Intentá de nuevo.",
    );
    expect(
      screen.getByRole("img", { name: "Sofía Ramírez" }),
    ).toHaveTextContent("SR");
  });

  it("keeps the mounted update visible when storage fails", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    fireEvent.click(screen.getByRole("button", { name: "Usar color Grafito" }));

    expect(screen.getByRole("img", { name: "Sofía Ramírez" })).toHaveClass(
      "bg-[#232532]!",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos conservar el avatar en esta sesión.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
