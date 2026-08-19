/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

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

afterEach(cleanup);

describe("AppShell", () => {
  it("composes navigation and surface while keeping content inside the main surface", () => {
    render(
      <AppShell>
        <h1>Starter content remains</h1>
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeTruthy();
    expect(screen.getByRole("main").contains(screen.getByRole("heading"))).toBe(
      true,
    );
    expect(screen.getByRole("main").parentElement?.classList).toContain(
      "rounded-shell",
    );
  });

  it("reserves mobile content clearance and desktop navigation gutter", () => {
    render(
      <AppShell>
        <p>Content</p>
      </AppShell>,
    );

    const shell = screen.getByRole("main").parentElement?.parentElement;
    expect(shell?.classList).toContain("p-2");
    expect(shell?.classList).not.toContain("md:p-6");
    expect(shell?.classList).not.toContain("md:pl-28");
    expect(screen.getByRole("main").classList).toContain("md:pl-48");
  });
});
