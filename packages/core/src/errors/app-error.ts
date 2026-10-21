/**
 * Error codes shared by every layer. Boundaries map them to HTTP statuses, action results
 * and job retry decisions. Add a code here before using it.
 */
export const ErrorCode = {
  VALIDATION: "VALIDATION",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  EXTERNAL_FAILURE: "EXTERNAL_FAILURE",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const httpStatusByCode: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EXTERNAL_FAILURE: 502,
  INTERNAL: 500,
};

/** Codes whose failures are worth retrying (in jobs) because a later attempt may succeed. */
const transientCodes: ReadonlySet<ErrorCode> = new Set(["RATE_LIMITED", "EXTERNAL_FAILURE"]);

export type AppErrorOptions = {
  /** Safe to show to the end user. Defaults to true for 4xx codes, false otherwise. */
  expose?: boolean;
  /** Field-level messages for `VALIDATION` errors. */
  fieldErrors?: Record<string, string[]>;
  cause?: unknown;
};

/**
 * Base class for every expected failure in domain and application code. Throw a subclass
 * (or `AppError` with a code); boundaries translate it with `toProblem()` / `toActionResult`.
 */
export class AppError extends Error {
  override readonly name: string = "AppError";
  readonly code: ErrorCode;
  readonly expose: boolean;
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.code = code;
    this.expose = options.expose ?? httpStatusByCode[code] < 500;
    this.fieldErrors = options.fieldErrors;
  }

  get httpStatus(): number {
    return httpStatusByCode[this.code];
  }

  get transient(): boolean {
    return transientCodes.has(this.code);
  }
}

export class ValidationError extends AppError {
  override readonly name = "ValidationError";

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(ErrorCode.VALIDATION, message, fieldErrors ? { fieldErrors } : {});
  }
}

export class NotFoundError extends AppError {
  override readonly name = "NotFoundError";

  constructor(resource: string, id?: string) {
    super(ErrorCode.NOT_FOUND, id ? `${resource} ${id} not found` : `${resource} not found`);
  }
}

export class ForbiddenError extends AppError {
  override readonly name = "ForbiddenError";

  constructor(message = "You don't have permission to do that") {
    super(ErrorCode.FORBIDDEN, message);
  }
}

export class ConflictError extends AppError {
  override readonly name = "ConflictError";

  constructor(message: string) {
    super(ErrorCode.CONFLICT, message);
  }
}

/** Wraps anything thrown into an `AppError`; unknown errors become a non-exposed `INTERNAL`. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(ErrorCode.INTERNAL, "Internal error", { expose: false, cause: error });
}
