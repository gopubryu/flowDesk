import assert from "node:assert/strict";

const base = process.env.AUTH_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `auth-e2e-${suffix}@example.test`;
const password = "AuthE2e-Test-Password-123!";
let cookie = "";

function headerCookie(headers: Headers): string {
  const value = headers.get("set-cookie") ?? "";
  return value.split(",").map((part) => part.trim().split(";", 1)[0]).filter(Boolean).join("; ");
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const nextCookie = headerCookie(response.headers);
  if (nextCookie) cookie = nextCookie;
  return response;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

async function main() {
  const health = await fetch(`${base}/api/auth/me`);
  assert.equal(health.status, 401, `anonymous probe: ${await health.clone().text()}`);

  const signUp = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name: "Auth E2E", email, password, callbackURL: "/" }),
  });
  assert.ok(signUp.status === 200 || signUp.status === 201, `sign-up: ${await signUp.clone().text()}`);
  assert.ok(cookie, "sign-up must issue a session cookie");

  const me = await request("/api/auth/me");
  assert.equal(me.status, 200, `authenticated me: ${await me.clone().text()}`);
  const meBody = await json(me);
  assert.equal(meBody.user && typeof meBody.user === "object" ? (meBody.user as { email?: string }).email : undefined, email);

  const beforeWorkspaces = await request("/api/auth/workspaces");
  assert.equal(beforeWorkspaces.status, 200, `initial workspaces: ${await beforeWorkspaces.clone().text()}`);
  const createdWorkspace = await request("/api/auth/workspaces", { method: "POST", body: JSON.stringify({ name: `Auth E2E Workspace ${suffix}` }) });
  assert.equal(createdWorkspace.status, 201, `workspace onboarding: ${await createdWorkspace.clone().text()}`);
  const workspaceBody = await json(createdWorkspace);
  assert.ok(workspaceBody.workspace && typeof workspaceBody.workspace === "object");
  const afterWorkspaces = await request("/api/auth/workspaces");
  assert.equal(afterWorkspaces.status, 200, `workspace read-back: ${await afterWorkspaces.clone().text()}`);
  const memberships = await json(afterWorkspaces);
  assert.equal(Array.isArray(memberships.memberships), true);
  assert.equal((memberships.memberships as Array<{ role?: string }>)[0]?.role, "ADMIN");
  const duplicateWorkspace = await request("/api/auth/workspaces", { method: "POST", body: JSON.stringify({ name: `Duplicate ${suffix}` }) });
  assert.equal(duplicateWorkspace.status, 409, `duplicate onboarding: ${await duplicateWorkspace.clone().text()}`);

  const loggedOut = await request("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
  assert.ok(loggedOut.status === 200 || loggedOut.status === 204, `sign-out: ${await loggedOut.clone().text()}`);
  const afterLogout = await request("/api/auth/me");
  assert.equal(afterLogout.status, 401, `me after logout: ${await afterLogout.clone().text()}`);

  const wrongLogin = await request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password: "Wrong-Password-123!", callbackURL: "/" }),
  });
  assert.ok(wrongLogin.status >= 400 && wrongLogin.status < 500, `wrong password should fail: ${await wrongLogin.clone().text()}`);
  const wrongMe = await request("/api/auth/me");
  assert.equal(wrongMe.status, 401, `wrong password must not create session: ${await wrongMe.clone().text()}`);

  console.log(`auth cookie E2E passed for ephemeral user suffix ${suffix}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "auth cookie E2E failed");
  process.exitCode = 1;
});
