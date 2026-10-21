import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins conditional classes and lets later Tailwind classes win", () => {
    expect(cn("px-2 py-1", ["hidden", { block: true, flex: false }], null, "px-4")).toBe(
      "py-1 block px-4",
    );
  });
});
