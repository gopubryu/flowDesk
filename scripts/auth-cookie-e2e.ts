import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";

const base = process.env.AUTH_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `auth-e2e-${suffix}@example.test`;
const password = "AuthE2e-Test-Password-123!";
const inviteeEmail = `invitee-${suffix}@example.test`;
let cookie = "";

function invitationToken() {
  return randomBytes(32).toString("base64url");
}
function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

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
  const authUser = meBody.user as { id?: string; email?: string };
  assert.equal(authUser.email, email);
  assert.ok(authUser.id);

  const beforeWorkspaces = await request("/api/auth/workspaces");
  assert.equal(beforeWorkspaces.status, 200, `initial workspaces: ${await beforeWorkspaces.clone().text()}`);
  const createdWorkspace = await request("/api/auth/workspaces", { method: "POST", body: JSON.stringify({ name: `Auth E2E Workspace ${suffix}` }) });
  assert.equal(createdWorkspace.status, 201, `workspace onboarding: ${await createdWorkspace.clone().text()}`);
  const workspaceBody = await json(createdWorkspace);
  assert.ok(workspaceBody.workspace && typeof workspaceBody.workspace === "object");
  const createdWorkspaceData = workspaceBody.workspace as { id?: string; name?: string };
  assert.equal(createdWorkspaceData.name, `Auth E2E Workspace ${suffix}`);
  const afterWorkspaces = await request("/api/auth/workspaces");
  assert.equal(afterWorkspaces.status, 200, `workspace read-back: ${await afterWorkspaces.clone().text()}`);
  const memberships = await json(afterWorkspaces);
  assert.equal(Array.isArray(memberships.memberships), true);
  const membership = (memberships.memberships as Array<{ role?: string; workspace?: { id?: string; name?: string } }>)[0];
  assert.equal(membership?.role, "ADMIN");
  assert.equal(membership?.workspace?.id, createdWorkspaceData.id);
  assert.equal(membership?.workspace?.name, `Auth E2E Workspace ${suffix}`);

  const validToken = invitationToken();
  await prisma.invitation.create({ data: { workspaceId: createdWorkspaceData.id!, inviterId: authUser.id!, email: inviteeEmail, role: "OPERATOR", tokenHash: tokenHash(validToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const mismatchToken = invitationToken();
  await prisma.invitation.create({ data: { workspaceId: createdWorkspaceData.id!, inviterId: authUser.id!, email: `other-${suffix}@example.test`, role: "VIEWER", tokenHash: tokenHash(mismatchToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const expiredToken = invitationToken();
  await prisma.invitation.create({ data: { workspaceId: createdWorkspaceData.id!, inviterId: authUser.id!, email: inviteeEmail, role: "VIEWER", tokenHash: tokenHash(expiredToken), expiresAt: new Date(Date.now() - 60 * 1000) } });

  const loggedOutAdmin = await request("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
  assert.ok(loggedOutAdmin.status === 200 || loggedOutAdmin.status === 204, `admin sign-out: ${await loggedOutAdmin.clone().text()}`);
  cookie = "";
  const inviteeSignUp = await request("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify({ name: "Invitee E2E", email: inviteeEmail, password, callbackURL: "/" }) });
  assert.ok(inviteeSignUp.status === 200 || inviteeSignUp.status === 201, `invitee sign-up: ${await inviteeSignUp.clone().text()}`);
  const accepted = await request("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: validToken }) });
  assert.equal(accepted.status, 200, `invitation accept: ${await accepted.clone().text()}`);
  const acceptedBody = await json(accepted);
  assert.equal((acceptedBody.workspace as { id?: string }).id, createdWorkspaceData.id);
  assert.equal(acceptedBody.role, "OPERATOR");
  const inviteeMe = await request("/api/auth/me");
  const inviteeUser = (await json(inviteeMe)).user as { id?: string };
  assert.ok(inviteeUser.id);
  const workspaceB = await prisma.workspace.create({ data: { name: `Auth E2E Workspace B ${suffix}`, members: { create: { userId: inviteeUser.id!, role: "OPERATOR", isActive: true } }, items: { create: { code: `AUTH-${suffix}`, name: "Cookie Item" } } } });
  const allMemberships = await request("/api/auth/workspaces");
  assert.equal(allMemberships.status, 200, `multi-workspace read: ${await allMemberships.clone().text()}`);
  const allMembershipBody = await json(allMemberships);
  const allMembershipRows = allMembershipBody.memberships as Array<{ role?: string; workspace?: { id?: string; name?: string } }>;
  assert.equal(allMembershipRows.length, 2);
  const membershipIds = allMembershipRows.map((entry) => entry.workspace?.id);
  assert.ok(membershipIds.includes(createdWorkspaceData.id));
  assert.ok(membershipIds.includes(workspaceB.id));
  assert.ok(allMembershipRows.every((entry) => entry.role === "OPERATOR"));
  const ambiguousItems = await request("/api/items");
  assert.equal(ambiguousItems.status, 400, `ambiguous workspace: ${await ambiguousItems.clone().text()}`);
  const selectedItems = await request(`/api/items?workspaceId=${workspaceB.id}`);
  assert.equal(selectedItems.status, 200, `selected workspace: ${await selectedItems.clone().text()}`);

  const mismatch = await request("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: mismatchToken }) });
  assert.equal(mismatch.status, 403, `email mismatch: ${await mismatch.clone().text()}`);
  const expired = await request("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: expiredToken }) });
  assert.equal(expired.status, 404, `expired invitation: ${await expired.clone().text()}`);

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
