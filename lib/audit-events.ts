export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "RENAME" | "ACCESS_DENIED";

export type AuditResource =
  | "item"
  | "purchase"
  | "purchaseRequest"
  | "quotation"
  | "salesPlan"
  | "inventory"
  | "workspaceMember";

export type AuditValue = string | number | boolean | null | AuditValue[] | { [key: string]: AuditValue };

export type AuditContext = {
  workspaceId: string;
  actorUserId: string;
  action: AuditAction;
  resourceType: AuditResource;
  resourceId?: string;
  resourceCode?: string;
  reason?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

export type AuditEvent = AuditContext & {
  before?: AuditValue;
  after?: AuditValue;
};

const SENSITIVE_KEYS = /password|secret|token|cookie|authorization|connection|string|cvc|cvv|api.?key/i;
const PII_KEYS = /email|phone|mobile|address|ip/i;
const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_LENGTH = 50;
const REDACTED = "[REDACTED]";
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d .()-]{7,}\d)/g;
const TOKEN_PATTERN = /(?:bearer\s+|token\s*[=:]\s*)[^\s,;]+/gi;

function sanitizeText(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTED).replace(PHONE_PATTERN, REDACTED).replace(TOKEN_PATTERN, REDACTED);
}

function sanitize(value: unknown, key?: string, depth = 0): AuditValue {
  if (depth > 8) return REDACTED;
  if (key && SENSITIVE_KEYS.test(key)) return REDACTED;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "string") return sanitizeText(value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value);
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_LENGTH).map((entry) => sanitize(entry, undefined, depth + 1));
  if (typeof value === "object") {
    const output: { [key: string]: AuditValue } = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = PII_KEYS.test(childKey) ? REDACTED : sanitize(childValue, childKey, depth + 1);
    }
    return output;
  }
  return REDACTED;
}

export function sanitizeAuditValue(value: unknown): AuditValue {
  return sanitize(value);
}

export function diffAuditValues(before: unknown, after: unknown): { before: AuditValue; after: AuditValue } | undefined {
  const safeBefore = sanitizeAuditValue(before);
  const safeAfter = sanitizeAuditValue(after);
  return JSON.stringify(safeBefore) === JSON.stringify(safeAfter) ? undefined : { before: safeBefore, after: safeAfter };
}

export function createAuditEvent(context: AuditContext, before?: unknown, after?: unknown): AuditEvent {
  const diff = diffAuditValues(before, after);
  const safeReason = context.reason ? sanitizeText(context.reason).slice(0, MAX_STRING_LENGTH) : undefined;
  const safeUserAgent = context.userAgent ? sanitizeText(context.userAgent).slice(0, MAX_STRING_LENGTH) : undefined;
  return {
    ...context,
    ...(context.ip ? { ip: REDACTED } : {}),
    ...(diff ? { before: diff.before, after: diff.after } : {}),
    ...(safeReason ? { reason: safeReason } : {}),
    ...(safeUserAgent ? { userAgent: safeUserAgent } : {}),
  };
}
