import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeIntegrationDatabase } from "./test-db-safety";

test("integration database rejects missing, remote, non-test, or Production-equivalent URLs", () => {
  assert.throws(() => assertSafeIntegrationDatabase(undefined, "postgresql://u:***@prod.example/db"), /TEST_DATABASE_URL is required/);
  assert.throws(() => assertSafeIntegrationDatabase("postgresql://u:***@prod.example/db", "postgresql://u:***@prod.example/db"), /loopback host and test-only/);
  assert.throws(() => assertSafeIntegrationDatabase("postgresql://u:***@ep-123.neon.tech/flowdesk_test", "postgresql://u:***@other.example/db"), /loopback host and test-only/);
  assert.throws(() => assertSafeIntegrationDatabase("postgresql://u:***@127.0.0.1/flowdesk", "postgresql://u:***@prod.example/db"), /loopback host and test-only/);
});

test("integration database accepts a credentialed local test URL", () => {
  const url = assertSafeIntegrationDatabase("postgresql://test:***@127.0.0.1:54329/flowdesk_test", "postgresql://u:***@prod.example/db");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/flowdesk_test");
});
