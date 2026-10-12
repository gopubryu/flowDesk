import assert from "node:assert/strict";
import test from "node:test";
import { ClientRequestError, clientJson } from "./client-request";

function installBrowserLocation() {
  const assigned: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        pathname: "/dashboard",
        search: "",
        assign(url: string) { assigned.push(url); },
      },
    },
  });
  return assigned;
}

test("401 redirects to sign-in and preserves the current route", async () => {
  const assigned = installBrowserLocation();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  try {
    await assert.rejects(
      clientJson("/api/auth/workspaces"),
      (error: unknown) => error instanceof ClientRequestError && error.status === 401
    );
    assert.deepEqual(assigned, ["/sign-in?reason=session-expired&next=%2Fdashboard"]);
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as { window?: unknown }).window;
  }
});

test("non-authentication failures stay errors and do not redirect", async () => {
  const assigned = installBrowserLocation();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Database unavailable" }), { status: 503 });
  try {
    await assert.rejects(
      clientJson("/api/tasks"),
      (error: unknown) => error instanceof ClientRequestError && error.status === 503 && error.message === "Database unavailable"
    );
    assert.deepEqual(assigned, []);
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as { window?: unknown }).window;
  }
});
