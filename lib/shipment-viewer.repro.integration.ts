import assert from "node:assert/strict";
import test from "node:test";
import { integrationRequest, integrationSession, withWorkspaceFixture } from "./integration-fixture";

process.env.INTEGRATION_TEST = "1";
const { prisma } = await import("./prisma");
const { setIntegrationTestSession } = await import("./auth-guards");
const { WorkspaceRole } = await import("@prisma/client");
const shipmentsRoute = await import("../app/api/inventory/shipments/route");

for (const [name, role] of [["viewer", "viewer"], ["operator", "operator"]] as const) {
  test(`shipment ${name} session probe`, async () => {
    await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, viewer, operator }) => {
      try {
        const actor = role === "viewer" ? viewer : operator;
        setIntegrationTestSession(integrationSession(actor));
        const response = await shipmentsRoute.POST(integrationRequest("/api/inventory/shipments", {
          method: "POST",
          body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode: "PROBE", date: "2026-01-01", lines: [] }),
        }));
        const body = await response.clone().text();
        console.log(`${name} status=${response.status} body=${body}`);
        assert.equal(response.status, role === "viewer" ? 403 : 400);
      } finally {
        setIntegrationTestSession(null);
      }
    });
  });
}

test.after(async () => { await prisma.$disconnect(); });
