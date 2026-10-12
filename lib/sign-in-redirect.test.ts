import assert from "node:assert/strict";
import test from "node:test";
import { signInCallbackUrl } from "./sign-in-redirect";

test("uses the preserved internal next route after sign-in", () => {
  assert.equal(signInCallbackUrl("/purchases/new?workspace=alpha"), "/purchases/new?workspace=alpha");
});

test("rejects external or authentication routes as post-login targets", () => {
  assert.equal(signInCallbackUrl("https://attacker.example"), "/");
  assert.equal(signInCallbackUrl("//attacker.example"), "/");
  assert.equal(signInCallbackUrl("/sign-in?reason=session-expired"), "/");
});
