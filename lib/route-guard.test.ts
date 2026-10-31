import assert from "node:assert/strict";
import test from "node:test";
import { signInRedirectFor } from "./route-guard";

test("protected pages without a session cookie redirect before render and keep the route", () => {
  assert.equal(signInRedirectFor("/sales-plans", "", false), "/sign-in?next=%2Fsales-plans");
  assert.equal(signInRedirectFor("/purchases/new", "?copy=1", false), "/sign-in?next=%2Fpurchases%2Fnew%3Fcopy%3D1");
});

test("protected pages with a session cookie are rendered", () => {
  assert.equal(signInRedirectFor("/sales-plans", "", true), null);
});

test("public auth pages and invitation acceptance stay reachable without a session", () => {
  for (const pathname of ["/sign-in", "/sign-up", "/invitations/accept"]) {
    assert.equal(signInRedirectFor(pathname, "", false), null);
  }
});
