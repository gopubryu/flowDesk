import assert from "node:assert/strict";
import test from "node:test";
import { classifyAuthError } from "./auth-error-classifier";

test("classifies auth errors without relying on module identity", () => {
  assert.deepEqual(classifyAuthError({ name: "ForbiddenError", status: 403 }), { kind: "forbidden", status: 403 });
  assert.deepEqual(classifyAuthError({ name: "UnauthorizedError", status: 401 }), { kind: "unauthorized", status: 401 });
  assert.deepEqual(classifyAuthError({ name: "BadRequestError", status: 400, message: "workspaceId is required" }), { kind: "bad_request", status: 400, message: "workspaceId is required" });
  assert.equal(classifyAuthError(new Error("Forbidden")), null);
  assert.equal(classifyAuthError({ status: 403 }), null);
  assert.equal(classifyAuthError({ name: "ForbiddenError", status: 500 }), null);
});
