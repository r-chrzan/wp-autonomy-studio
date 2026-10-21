import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders a button with the default variant and size", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
    expect(button).toHaveClass("bg-primary");
  });

  it("applies the requested variant, size and extra classes", () => {
    render(
      <Button variant="outline" size="sm" className="w-full">
        Cancel
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveClass("border", "h-8", "w-full");
  });

  it("renders its child element instead of a button with asChild", () => {
    render(
      <Button asChild>
        <a href="/admin">Admin</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Admin" });
    expect(link).toHaveAttribute("href", "/admin");
    expect(link).toHaveAttribute("data-slot", "button");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes the variant class builder", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
  });
});
