import { describe, expect, it } from "vitest";
import { AppError, ErrorCode, ValidationError } from "./app-error";
import { toActionFailure, toProblem } from "./results";

describe("toActionFailure", () => {
  it("returns code, message and field errors for exposed errors", () => {
    const failure = toActionFailure(new ValidationError("Invalid site", { url: ["Required"] }));

    expect(failure).toEqual({
      ok: false,
      code: ErrorCode.VALIDATION,
      message: "Invalid site",
      fieldErrors: { url: ["Required"] },
    });
  });

  it("hides the message of unexpected errors", () => {
    const failure = toActionFailure(new Error("password=hunter2"));

    expect(failure.code).toBe(ErrorCode.INTERNAL);
    expect(failure.message).not.toContain("hunter2");
  });
});

describe("toProblem", () => {
  it("builds RFC 9457 problem details", () => {
    expect(toProblem(new AppError(ErrorCode.RATE_LIMITED, "Too many runs"))).toEqual({
      type: "about:blank",
      title: "Too many runs",
      status: 429,
      code: ErrorCode.RATE_LIMITED,
    });
  });
});

describe("toProblem with field errors", () => {
  it("includes field errors and hides internal messages", () => {
    expect(toProblem(new ValidationError("Invalid", { name: ["Too long"] }))).toMatchObject({
      status: 400,
      errors: { name: ["Too long"] },
    });
    expect(toProblem(new Error("secret")).title).not.toContain("secret");
  });
});
