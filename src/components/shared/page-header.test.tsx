/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders an accessible heading with optional eyebrow and action", () => {
    render(
      <PageHeader
        eyebrow="UI Foundation"
        title="Shared components"
        action={<button type="button">Inspect</button>}
      />,
    );

    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByText("UI Foundation")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Shared components" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect" })).toBeTruthy();
  });

  it("does not render empty optional regions", () => {
    render(<PageHeader title="Only a title" />);

    expect(screen.getByRole("heading", { name: "Only a title" })).toBeTruthy();
    expect(screen.queryByText("UI Foundation")).toBeNull();
    expect(screen.getByRole("banner").querySelector("button")).toBeNull();
  });
});
