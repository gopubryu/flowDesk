import assert from "node:assert/strict";
import test from "node:test";
import { combineIntegrationErrors } from "./integration-cleanup";

test("cleanup-only failure is reported as AggregateError", () => {
  const cleanup = new Error("cleanup failed");
  const result = combineIntegrationErrors(undefined, [cleanup]);
  assert.ok(result instanceof AggregateError);
  assert.deepEqual(result.errors, [cleanup]);
});

test("primary failure is preserved when cleanup also fails", () => {
  const primary = new Error("assertion failed");
  const cleanup = new Error("cleanup failed");
  const result = combineIntegrationErrors(primary, [cleanup]);
  assert.ok(result instanceof AggregateError);
  assert.deepEqual(result.errors, [primary, cleanup]);
  assert.equal(result.cause, primary);
});

test("primary-only failure is returned unchanged", () => {
  const primary = new Error("assertion failed");
  assert.equal(combineIntegrationErrors(primary, []), primary);
});
