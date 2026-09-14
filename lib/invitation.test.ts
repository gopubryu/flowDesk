import assert from "node:assert/strict";
import { test } from "node:test";
import { WorkspaceRole } from "@prisma/client";
import {
  canInviteRole,
  hashInvitationToken,
  isInvitationExpired,
  isValidInvitationRole,
  normalizeInvitationEmail,
  validateInvitationExpiry,
} from "./invitation";

test("normalizes valid invitation email and rejects malformed input", () => {
  assert.equal(normalizeInvitationEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(normalizeInvitationEmail("not-an-email"), null);
  assert.equal(normalizeInvitationEmail(42), null);
});

test("invitation roles are limited to workspace roles and admin authorization is explicit", () => {
  assert.equal(isValidInvitationRole(WorkspaceRole.VIEWER), true);
  assert.equal(isValidInvitationRole("OWNER"), false);
  assert.equal(canInviteRole(WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR), true);
  assert.equal(canInviteRole(WorkspaceRole.OPERATOR, WorkspaceRole.ADMIN), false);
});

test("expiry accepts only future dates within the configured maximum", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(validateInvitationExpiry("2026-01-02T00:00:00.000Z", now)?.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(validateInvitationExpiry("2025-12-31T23:59:59.000Z", now), null);
  assert.equal(validateInvitationExpiry("2026-02-01T00:00:00.000Z", now), null);
  assert.equal(isInvitationExpired(new Date("2026-01-01T00:00:00.000Z"), now), true);
});

test("token hashing is deterministic, one-way output and never the raw token", () => {
  const token = "test-secret-token";
  const hash = hashInvitationToken(token);
  assert.equal(hash, hashInvitationToken(token));
  assert.notEqual(hash, token);
  assert.match(hash, /^[a-f0-9]{64}$/);
});
