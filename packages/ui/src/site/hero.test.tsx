import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "./hero";

describe("Hero", () => {
  it("renders the title as the page heading and the description", () => {
    render(<Hero title="Welcome" description="Build WordPress sites" />);

    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Build WordPress sites")).toBeInTheDocument();
  });

  it("renders optional actions", () => {
    render(<Hero title="Welcome" description="d" actions={<button type="button">Start</button>} />);

    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});
