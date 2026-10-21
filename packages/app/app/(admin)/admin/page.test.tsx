import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminDashboardPage from "./page";

describe("admin dashboard page", () => {
  it("has a page heading and links back to the site and the health check", () => {
    render(<AdminDashboardPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to site" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Health check" })).toHaveAttribute(
      "href",
      "/api/health",
    );
  });
});
