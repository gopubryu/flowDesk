import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeIntegrationDatabase } from "./test-db-safety";

const enabled = Boolean(process.env.TEST_DATABASE_URL);

test("items runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  assertSafeIntegrationDatabase(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
  process.env.INTEGRATION_TEST = "1";

  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { combineIntegrationErrors } = await import("./integration-cleanup");
  const itemsRoute = await import("../app/api/items/route");
  const itemByCodeRoute = await import("../app/api/items/[code]/route");
  const { WorkspaceRole } = await import("@prisma/client");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const workspaceA = await prisma.workspace.create({ data: { name: `integration-a-${suffix}` } });
  const workspaceB = await prisma.workspace.create({ data: { name: `integration-b-${suffix}` } });
  const admin = await prisma.user.create({ data: { id: `it-admin-${suffix}`, name: "Integration Admin", email: `admin-${suffix}@test.invalid`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  const operator = await prisma.user.create({ data: { id: `it-operator-${suffix}`, name: "Integration Operator", email: `operator-${suffix}@test.invalid`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  const viewer = await prisma.user.create({ data: { id: `it-viewer-${suffix}`, name: "Integration Viewer", email: `viewer-${suffix}@test.invalid`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.workspaceMember.createMany({ data: [
    { workspaceId: workspaceA.id, userId: admin.id, role: WorkspaceRole.ADMIN },
    { workspaceId: workspaceA.id, userId: operator.id, role: WorkspaceRole.OPERATOR },
    { workspaceId: workspaceA.id, userId: viewer.id, role: WorkspaceRole.VIEWER },
  ] });
  const itemA = await prisma.item.create({ data: { workspaceId: workspaceA.id, code: `IA${suffix.slice(-8).toUpperCase()}`, name: "A item", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false } });
  const itemB = await prisma.item.create({ data: { workspaceId: workspaceB.id, code: `IB${suffix.slice(-8).toUpperCase()}`, name: "B item", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false } });

  const session = (user: { id: string; name: string; email: string }) => ({ user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() }, session: { id: `session-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 60_000), token: `token-${user.id}`, createdAt: new Date(), updatedAt: new Date() } });
  const request = (url: string, init?: RequestInit) => new Request(`http://integration.invalid${url}`, init);
  let primaryError: unknown;
  try {
    setIntegrationTestSession(session(admin));
    const beforeB = await prisma.item.findUnique({ where: { id: itemB.id } });
    const crossRead = await itemsRoute.GET(request(`/api/items?workspaceId=${workspaceB.id}`));
    assert.equal(crossRead.status, 403);
    const crossPatch = await itemByCodeRoute.PUT(request(`/api/items/${itemB.code}?workspaceId=${workspaceB.id}`, { method: "PUT", body: JSON.stringify({ workspaceId: workspaceB.id, code: itemB.code, name: "tampered" }) }), { params: Promise.resolve({ code: itemB.code }) });
    assert.equal(crossPatch.status, 403);
    const crossDelete = await itemByCodeRoute.DELETE(request(`/api/items/${itemB.code}?workspaceId=${workspaceB.id}`, { method: "DELETE" }), { params: Promise.resolve({ code: itemB.code }) });
    assert.equal(crossDelete.status, 403);
    assert.deepEqual(await prisma.item.findUnique({ where: { id: itemB.id } }), beforeB);

    setIntegrationTestSession(session(viewer));
    const viewerWrite = await itemsRoute.POST(request(`/api/items?workspaceId=${workspaceA.id}`, { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, code: `IV${suffix.slice(-8)}`, name: "viewer", inboundPrice: 1, outboundPrice: 2 }) }));
    assert.equal(viewerWrite.status, 403);

    setIntegrationTestSession(session(operator));
    const operatorWrite = await itemsRoute.POST(request(`/api/items?workspaceId=${workspaceA.id}`, { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, code: `IO${suffix.slice(-8)}`, name: "operator", inboundPrice: 1, outboundPrice: 2 }) }));
    assert.equal(operatorWrite.status, 201);
    const operatorDelete = await itemByCodeRoute.DELETE(request(`/api/items/${itemA.code}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ code: itemA.code }) });
    assert.equal(operatorDelete.status, 403);

    setIntegrationTestSession(session(admin));
    const adminDelete = await itemByCodeRoute.DELETE(request(`/api/items/${itemA.code}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ code: itemA.code }) });
    assert.equal(adminDelete.status, 200);
  } catch (error) {
    primaryError = error;
  } finally {
    setIntegrationTestSession(null);
    const cleanupErrors: unknown[] = [];
    try {
      await prisma.workspace.deleteMany({ where: { id: { in: [workspaceA.id, workspaceB.id] } } });
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, operator.id, viewer.id] } } });
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      cleanupErrors.push(error);
    }
    const finalError = combineIntegrationErrors(primaryError, cleanupErrors);
    if (finalError) throw finalError;
  }
});
