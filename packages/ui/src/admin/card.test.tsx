import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card", () => {
  it("renders every part with its slot and merges extra classes", () => {
    render(
      <Card className="max-w-sm" data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>Action</CardAction>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId("card")).toHaveAttribute("data-slot", "card");
    expect(screen.getByTestId("card")).toHaveClass("max-w-sm", "rounded-xl");
    const slots: [string, string][] = [
      ["Title", "card-title"],
      ["Description", "card-description"],
      ["Action", "card-action"],
      ["Content", "card-content"],
      ["Footer", "card-footer"],
    ];
    for (const [text, slot] of slots) {
      expect(screen.getByText(text)).toHaveAttribute("data-slot", slot);
    }
    expect(screen.getByText("Title").parentElement).toHaveAttribute("data-slot", "card-header");
  });
});
