import assert from "node:assert/strict";
import test from "node:test";
import { integrationRequest, integrationSession, withWorkspaceFixture } from "./integration-fixture";

process.env.INTEGRATION_TEST = "1";
const { prisma } = await import("./prisma");
const { getServerSession, setIntegrationTestSession } = await import("./auth-guards");
const { WorkspaceRole } = await import("@prisma/client");
const shipmentsRoute = await import("../app/api/inventory/shipments/route");

test("single-purpose shipment viewer auth diagnostic", async () => {
  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, viewer }) => {
    const payload = { workspaceId: workspaceA.id, warehouseCode: "PROBE", date: "2026-01-01", lines: [] };
    const session = integrationSession(viewer);
    setIntegrationTestSession(session);
    try {
      const before = await getServerSession();
      const response = await shipmentsRoute.POST(integrationRequest("/api/inventory/shipments", { method: "POST", body: JSON.stringify(payload) }));
      const body = await response.clone().text();
      const after = await getServerSession();
      console.log(JSON.stringify({ userIdBefore: before?.user.id, userIdExpected: viewer.id, userIdAfter: after?.user.id, payload, status: response.status, body }));
      assert.equal(before?.user.id, viewer.id);
      assert.equal(after?.user.id, viewer.id);
      assert.equal(response.status, 403, body);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test.after(async () => { await prisma.$disconnect(); });
