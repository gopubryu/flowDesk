import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeIntegrationDatabase } from "./test-db-safety";

test("integration database rejects missing or Production-equivalent URLs", () => {
  assert.throws(() => assertSafeIntegrationDatabase(undefined, "postgresql://u:p@prod.example/db"), /TEST_DATABASE_URL is required/);
  assert.throws(() => assertSafeIntegrationDatabase("postgresql://u:p@prod.example/db", "postgresql://u:p@prod.example/db"), /must not equal/);
  assert.throws(() => assertSafeIntegrationDatabase("postgresql://u:p@ep-123.neon.tech/db", "postgresql://u:p@other.example/db"), /isolated non-Production/);
});

test("integration database accepts a credentialed local test URL", () => {
  const url = assertSafeIntegrationDatabase("postgresql://test:test@127.0.0.1:54329/flowdesk_test", "postgresql://u:p@prod.example/db");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/flowdesk_test");
});
