/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FloatingNavigation } from "./floating-navigation";

afterEach(cleanup);

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({ usePathname }));
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

describe("FloatingNavigation", () => {
  it("exposes exactly the four destinations with the approved routes", () => {
    render(<FloatingNavigation />);

    expect(screen.getAllByRole("link")).toHaveLength(8);

    for (const [label, href] of [
      ["Descubrir", "/"],
      ["Me gusta", "/liked"],
      ["IA", "/ai"],
      ["Perfil", "/profile"],
    ]) {
      const matchingLinks = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === href);
      expect(matchingLinks).toHaveLength(2);
      expect(matchingLinks[0].textContent).toContain(label);
      expect(matchingLinks[0].querySelectorAll(".sr-only")).toHaveLength(0);
    }
  });

  it("marks the current route and preserves a fixed desktop rail structure", () => {
    usePathname.mockReturnValue("/liked");
    render(<FloatingNavigation />);

    const likedLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/liked");
    const discoverLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/");
    expect(likedLinks[0].getAttribute("aria-current")).toBe("page");
    expect(discoverLinks[0].getAttribute("aria-current")).toBeNull();
    expect(likedLinks[0].getAttribute("data-active")).toBe("true");
    expect(likedLinks[1].getAttribute("data-active")).toBe("true");
    expect(likedLinks[0].classList).toContain("bg-primary");
    expect(likedLinks[1].classList).toContain("ring-2");

    const navigation = screen.getByRole("navigation");
    expect(navigation.textContent).toContain("Descubrir");
    expect(navigation.firstElementChild?.classList).toContain("fixed");
    expect(navigation.firstElementChild?.classList).toContain("hidden");
    expect(navigation.firstElementChild?.classList).toContain("md:block");
    expect(
      navigation.firstElementChild?.getAttribute("data-motion-transform"),
    ).toBeNull();
    expect(
      navigation.firstElementChild?.firstElementChild?.classList,
    ).toContain("rounded-full");
    expect(
      navigation.firstElementChild?.firstElementChild?.classList,
    ).toContain("w-14");

    const desktopItem = likedLinks[0];
    expect(desktopItem.classList).toContain("desktop-navigation-item");
    expect(desktopItem.querySelector(".desktop-navigation-label")).toBeTruthy();
    expect(
      desktopItem.querySelector(".desktop-navigation-label")?.classList,
    ).toContain("pl-12");
    expect(
      desktopItem.querySelector(".desktop-navigation-label")?.classList,
    ).toContain("bg-primary");
    expect(desktopItem.querySelector("svg")?.classList).toContain("z-10");

    expect(discoverLinks[0].classList).toContain("hover:bg-primary");
    expect(discoverLinks[0].classList).toContain(
      "hover:text-primary-foreground",
    );
  });

  it("keeps mobile labels visible and gives each presentation keyboard focus", () => {
    render(<FloatingNavigation />);

    const mobileBar = screen.getByRole("navigation").lastElementChild;
    expect(mobileBar?.classList).toContain("fixed");
    expect(mobileBar?.classList).toContain("md:hidden");
    expect(mobileBar?.textContent).toContain("DescubrirMe gustaIAPerfil");

    for (const link of screen.getAllByRole("link")) {
      expect(link.classList).toContain("focus-visible:ring-2");
      expect(link.getAttribute("href")).toBeTruthy();
    }
  });
});
