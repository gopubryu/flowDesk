import assert from "node:assert/strict";
import test from "node:test";
import { createAuditEvent, diffAuditValues, sanitizeAuditValue } from "./audit-events";

test("audit values redact secrets and personal fields", () => {
  const value = sanitizeAuditValue({ email: "user@example.com", password: "hidden", nested: { apiKey: "key", phone: "010" }, safe: "ok" });
  assert.deepEqual(value, { email: "[REDACTED]", password: "[REDACTED]", nested: { apiKey: "[REDACTED]", phone: "[REDACTED]" }, safe: "ok" });
});

test("audit values cap long strings and arrays", () => {
  const value = sanitizeAuditValue({ text: "x".repeat(1100), rows: Array.from({ length: 60 }, (_, index) => index) }) as { text: string; rows: unknown[] };
  assert.equal(value.text.length, 1001);
  assert.equal(value.rows.length, 50);
});

test("audit diff omits unchanged values and preserves changed values", () => {
  assert.equal(diffAuditValues({ code: "A" }, { code: "A" }), undefined);
  assert.deepEqual(diffAuditValues({ code: "A" }, { code: "B" }), { before: { code: "A" }, after: { code: "B" } });
});

test("audit event keeps workspace and actor context and records reason", () => {
  const event = createAuditEvent({
    workspaceId: "workspace-a",
    actorUserId: "user-a",
    action: "RENAME",
    resourceType: "item",
    resourceId: "item-a",
    resourceCode: "A001",
    reason: "거래 이력이 있어 변경 거부",
    requestId: "request-a",
  }, { code: "A001" }, { code: "A002" });
  assert.equal(event.workspaceId, "workspace-a");
  assert.equal(event.actorUserId, "user-a");
  assert.equal(event.action, "RENAME");
  assert.equal(event.reason, "거래 이력이 있어 변경 거부");
  assert.deepEqual(event.before, { code: "A001" });
  assert.deepEqual(event.after, { code: "A002" });
});
