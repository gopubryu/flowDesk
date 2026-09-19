export type AuthErrorKind = "unauthorized" | "forbidden" | "bad_request";

export type ClassifiedAuthError = {
  kind: AuthErrorKind;
  status: 400 | 401 | 403;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function classifyAuthError(error: unknown): ClassifiedAuthError | null {
  if (!isRecord(error)) return null;
  const name = typeof error.name === "string" ? error.name : "";
  const code = typeof error.code === "string" ? error.code : "";
  const status = typeof error.status === "number" ? error.status : undefined;

  if ((name === "UnauthorizedError" || code === "UNAUTHORIZED") && status === 401) {
    return { kind: "unauthorized", status: 401 };
  }
  if ((name === "ForbiddenError" || code === "FORBIDDEN") && status === 403) {
    return { kind: "forbidden", status: 403 };
  }
  if ((name === "BadRequestError" || code === "BAD_REQUEST") && status === 400) {
    return {
      kind: "bad_request",
      status: 400,
      message: typeof error.message === "string" ? error.message : "Bad request",
    };
  }
  return null;
}
