import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  toAppError,
} from "./app-error";

describe("AppError", () => {
  it.each([
    [new ValidationError("bad"), 400],
    [new ForbiddenError(), 403],
    [new NotFoundError("Site", "42"), 404],
    [new ConflictError("taken"), 409],
    [new AppError(ErrorCode.EXTERNAL_FAILURE, "figma down"), 502],
  ])("maps %o to HTTP %i", (error, status) => {
    expect(error.httpStatus).toBe(status);
  });

  it("exposes 4xx messages and hides 5xx messages by default", () => {
    expect(new NotFoundError("Site").expose).toBe(true);
    expect(new AppError(ErrorCode.INTERNAL, "db exploded").expose).toBe(false);
  });

  it("marks only retryable codes as transient", () => {
    expect(new AppError(ErrorCode.RATE_LIMITED, "slow down").transient).toBe(true);
    expect(new NotFoundError("Site").transient).toBe(false);
  });

  it("keeps subclass identity and a readable name", () => {
    const error = new NotFoundError("Site", "42");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("NotFoundError");
    expect(error.message).toBe("Site 42 not found");
  });
});

describe("toAppError", () => {
  it("passes AppErrors through", () => {
    const error = new ConflictError("taken");

    expect(toAppError(error)).toBe(error);
  });

  it("wraps unknown errors as a hidden INTERNAL error with the cause", () => {
    const cause = new TypeError("boom");
    const error = toAppError(cause);

    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.expose).toBe(false);
    expect(error.cause).toBe(cause);
  });
});
