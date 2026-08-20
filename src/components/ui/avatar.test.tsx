// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("provides an accessible initials fallback", () => {
    render(<Avatar initials="NS" alt="Nadia Silva" size="sm" />);

    const avatar = screen.getByRole("img", { name: "Nadia Silva" });
    expect(avatar).toHaveTextContent("NS");
    expect(avatar.className).toContain("size-8");
  });

  it("renders an image with meaningful alternative text", () => {
    render(<Avatar src="/avatars/nadia.png" initials="NS" alt="Nadia Silva" />);

    expect(screen.getByRole("img", { name: "Nadia Silva" })).toHaveAttribute(
      "src",
      "/avatars/nadia.png",
    );
  });

  it("renders the approved large profile size", () => {
    render(<Avatar initials="SR" alt="Sofía Ramírez" size="lg" />);

    const avatar = screen.getByRole("img", { name: "Sofía Ramírez" });
    expect(avatar).toHaveTextContent("SR");
    expect(avatar.className).toContain("size-[5.5rem]");
  });
});
