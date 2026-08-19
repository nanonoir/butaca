/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MainSurface } from "./main-surface";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("MainSurface", () => {
  it("renders a structural rounded surface without changing its content contract", () => {
    render(
      <MainSurface>
        <p>Route content</p>
      </MainSurface>,
    );

    const surface = screen.getByRole("main").parentElement;

    expect(surface?.textContent).toContain("Route content");
    expect(surface?.classList).toContain("rounded-shell");
    expect(surface?.classList).toContain("border");
    expect(surface?.classList).not.toContain("shadow-floating");
    expect(surface?.querySelector("nav")).toBeTruthy();
    expect(surface?.querySelector("main")).toBeTruthy();
    expect(surface?.querySelector("main")?.parentElement).toBe(surface);
  });
});
