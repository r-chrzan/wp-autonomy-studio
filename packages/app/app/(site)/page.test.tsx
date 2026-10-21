import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("public home page", () => {
  it("links to the admin and the health check", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("WP Autonomy Studio");
    expect(screen.getByRole("link", { name: "Open admin" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Health check" })).toHaveAttribute(
      "href",
      "/api/health",
    );
  });
});
