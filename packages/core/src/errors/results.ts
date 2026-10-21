import { toAppError, type ErrorCode } from "./app-error";

/** What a server action returns. Never throw from an action for expected failures. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };

const internalMessage = "Something went wrong. Please try again.";

/** Converts a thrown value into a failed `ActionResult`, hiding non-exposed messages. */
export function toActionFailure(error: unknown): Extract<ActionResult<never>, { ok: false }> {
  const appError = toAppError(error);
  return {
    ok: false,
    code: appError.code,
    message: appError.expose ? appError.message : internalMessage,
    ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
  };
}

/** RFC 9457 problem details, returned by route handlers as `application/problem+json`. */
export type Problem = {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  errors?: Record<string, string[]>;
};

/** Converts a thrown value into problem details, hiding non-exposed messages. */
export function toProblem(error: unknown): Problem {
  const appError = toAppError(error);
  return {
    type: "about:blank",
    title: appError.expose ? appError.message : internalMessage,
    status: appError.httpStatus,
    code: appError.code,
    ...(appError.fieldErrors ? { errors: appError.fieldErrors } : {}),
  };
}
