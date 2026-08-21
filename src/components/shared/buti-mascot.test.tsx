/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { BUTI_ACTIVITY, BUTI_MATCH, ButiMascot } from "./buti-mascot";

afterEach(cleanup);

describe("ButiMascot", () => {
  it("renders on a transparent canvas with volumetric lighting", () => {
    render(<ButiMascot match={BUTI_MATCH.HIGH} />);

    const buti = screen.getByRole("img", {
      name: "Buti feliz, match alto",
    });

    expect(buti).not.toHaveClass("bg-primary");
    expect(screen.getByTestId("buti-body")).toHaveAttribute(
      "fill",
      expect.stringContaining("url("),
    );
    expect(screen.getByTestId("buti-body")).toHaveAttribute(
      "filter",
      expect.stringContaining("url("),
    );
    expect(screen.getByTestId("buti-body-light")).toBeInTheDocument();
  });

  it("isolates its SVG lighting definitions between mascot instances", () => {
    const { container } = render(
      <>
        <ButiMascot match={BUTI_MATCH.HIGH} />
        <ButiMascot match={BUTI_MATCH.MEDIUM} />
      </>,
    );

    const definitionIds = Array.from(
      container.querySelectorAll(
        "linearGradient, radialGradient, clipPath, filter",
      ),
      (definition) => definition.id,
    );

    expect(new Set(definitionIds).size).toBe(definitionIds.length);
  });

  it("shows the high-match face and celebratory jump particles", () => {
    render(
      <ButiMascot activity={BUTI_ACTIVITY.JUMPING} match={BUTI_MATCH.HIGH} />,
    );

    const buti = screen.getByRole("img", {
      name: "Buti feliz, match alto",
    });

    expect(buti).toHaveAttribute("data-activity", "jumping");
    expect(buti).toHaveAttribute("data-match", "high");
    expect(screen.getByTestId("buti-mouth-open")).toBeInTheDocument();
    expect(screen.getByTestId("buti-cheeks")).toBeInTheDocument();
    expect(screen.getAllByTestId("buti-grain")).toHaveLength(3);
  });

  it("changes its expression for medium and low matches", () => {
    const { rerender } = render(<ButiMascot match={BUTI_MATCH.MEDIUM} />);

    expect(
      screen.getByRole("img", { name: "Buti atento, match medio" }),
    ).toHaveAttribute("data-activity", "idle");
    expect(screen.getByTestId("buti-mouth-neutral")).toBeInTheDocument();
    expect(screen.queryByTestId("buti-cheeks")).not.toBeInTheDocument();

    rerender(<ButiMascot match={BUTI_MATCH.LOW} />);

    expect(
      screen.getByRole("img", { name: "Buti dudoso, match bajo" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("buti-raised-eyebrow")).toBeInTheDocument();
    expect(screen.getByTestId("buti-mouth-crooked")).toBeInTheDocument();
  });

  it("uses the talking face while the assistant is writing", () => {
    render(
      <ButiMascot activity={BUTI_ACTIVITY.TALKING} match={BUTI_MATCH.HIGH} />,
    );

    expect(screen.getByRole("img", { name: "Buti hablando" })).toHaveAttribute(
      "data-activity",
      "talking",
    );
    expect(screen.getByTestId("buti-mouth-talking")).toBeInTheDocument();
  });
});
