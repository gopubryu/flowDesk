import assert from "node:assert/strict";
import test, { after } from "node:test";
import { assertSafeIntegrationDatabase } from "./test-db-safety";
import { integrationRequest, integrationSession, uniqueCode, withWorkspaceFixture } from "./integration-fixture";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) {
  assertSafeIntegrationDatabase(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
  process.env.INTEGRATION_TEST = "1";
}

/**
 * Guard against a silently skipped suite: when CI declares an integration run,
 * the scenarios below must actually execute rather than report a green skip.
 */
test("integration suite runs whenever CI declares an integration environment", () => {
  if (process.env.CI_EXPECT_INTEGRATION === "1") {
    assert.equal(enabled, true, "CI declared an integration run but TEST_DATABASE_URL was missing");
  }
});

/** Each entry drives the same workspace/role matrix against one master-data resource. */
const MODULES = [
  {
    name: "items",
    delegate: "item" as const,
    listPath: "/api/items",
    detailPath: "/api/items",
    importList: () => import("../app/api/items/route"),
    importDetail: () => import("../app/api/items/[code]/route"),
    seed: (code: string) => ({ code, name: "seed", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false }),
    payload: (code: string) => ({ code, name: "payload", inboundPrice: 1, outboundPrice: 2 }),
  },
  {
    name: "vendors",
    delegate: "vendor" as const,
    listPath: "/api/vendors",
    detailPath: "/api/vendors",
    importList: () => import("../app/api/vendors/route"),
    importDetail: () => import("../app/api/vendors/[code]/route"),
    seed: (code: string) => ({ code, name: "seed", codeType: "비사업자(내국인)" }),
    payload: (code: string) => ({ code, name: "payload", codeType: "비사업자(내국인)" }),
  },
  {
    name: "warehouses",
    delegate: "warehouse" as const,
    listPath: "/api/warehouses",
    detailPath: "/api/warehouses",
    importList: () => import("../app/api/warehouses/route"),
    importDetail: () => import("../app/api/warehouses/[code]/route"),
    seed: (code: string) => ({ code, name: "seed" }),
    payload: (code: string) => ({ code, name: "payload" }),
  },
  {
    name: "departments",
    delegate: "department" as const,
    listPath: "/api/departments",
    detailPath: "/api/departments",
    importList: () => import("../app/api/departments/route"),
    importDetail: () => import("../app/api/departments/[code]/route"),
    seed: (code: string) => ({ code, name: "seed" }),
    payload: (code: string) => ({ code, name: "payload" }),
  },
  {
    name: "employees",
    delegate: "employee" as const,
    listPath: "/api/employees",
    detailPath: "/api/employees",
    importList: () => import("../app/api/employees/route"),
    importDetail: () => import("../app/api/employees/[code]/route"),
    seed: (code: string) => ({ code, name: "seed", phone: "010-0000-0000", email: "seed@test.invalid" }),
    payload: (code: string) => ({ code, name: "payload", phone: "010-1111-1111", email: "payload@test.invalid" }),
  },
] as const;

for (const mod of MODULES) {
  test(`${mod.name} runtime authorization isolates workspaces and roles`, { skip: !enabled }, async () => {
    const { prisma } = await import("./prisma");
    const { setIntegrationTestSession } = await import("./auth-guards");
    const { WorkspaceRole } = await import("@prisma/client");
    const listRoute = await mod.importList();
    const detailRoute = await mod.importDetail();

    await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (prisma as any)[mod.delegate];
      const codeA = uniqueCode("XA", suffix);
      const codeB = uniqueCode("XB", suffix);
      const rowA = await table.create({ data: { ...mod.seed(codeA), workspaceId: workspaceA.id } });
      const rowB = await table.create({ data: { ...mod.seed(codeB), workspaceId: workspaceB.id } });

      try {
        // --- cross-workspace access is refused and leaves the other tenant untouched
        setIntegrationTestSession(integrationSession(admin));
        const beforeB = await table.findUnique({ where: { id: rowB.id } });

        const crossRead = await listRoute.GET(integrationRequest(`${mod.listPath}?workspaceId=${workspaceB.id}`));
        assert.equal(crossRead.status, 403, "cross-workspace GET must be refused");

        const crossUpdate = await detailRoute.PUT(
          integrationRequest(`${mod.detailPath}/${codeB}`, { method: "PUT", body: JSON.stringify({ ...mod.payload(codeB), workspaceId: workspaceB.id, name: "tampered" }) }),
          { params: Promise.resolve({ code: codeB }) },
        );
        assert.equal(crossUpdate.status, 403, "cross-workspace PUT must be refused");

        const crossDelete = await detailRoute.DELETE(
          integrationRequest(`${mod.detailPath}/${codeB}?workspaceId=${workspaceB.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ code: codeB }) },
        );
        assert.equal(crossDelete.status, 403, "cross-workspace DELETE must be refused");
        assert.deepEqual(await table.findUnique({ where: { id: rowB.id } }), beforeB, "refused requests must not mutate the other workspace");

        // --- own-workspace reads never leak the other tenant's rows
        const ownRead = await listRoute.GET(integrationRequest(`${mod.listPath}?workspaceId=${workspaceA.id}`));
        assert.equal(ownRead.status, 200);
        const listed = (await ownRead.json()) as Array<{ code: string }>;
        assert.ok(listed.some((row) => row.code === codeA), "own workspace row must be listed");
        assert.ok(!listed.some((row) => row.code === codeB), "other workspace row must not leak into the list");

        // --- VIEWER is read-only
        setIntegrationTestSession(integrationSession(viewer));
        const viewerRead = await listRoute.GET(integrationRequest(`${mod.listPath}?workspaceId=${workspaceA.id}`));
        assert.equal(viewerRead.status, 200, "VIEWER may read");
        const viewerWrite = await listRoute.POST(
          integrationRequest(mod.listPath, { method: "POST", body: JSON.stringify({ ...mod.payload(uniqueCode("XV", suffix)), workspaceId: workspaceA.id }) }),
        );
        assert.equal(viewerWrite.status, 403, "VIEWER must not create");

        // --- OPERATOR may write but not delete
        setIntegrationTestSession(integrationSession(operator));
        const operatorWrite = await listRoute.POST(
          integrationRequest(mod.listPath, { method: "POST", body: JSON.stringify({ ...mod.payload(uniqueCode("XO", suffix)), workspaceId: workspaceA.id }) }),
        );
        assert.equal(operatorWrite.status, 201, "OPERATOR may create");
        const operatorDelete = await detailRoute.DELETE(
          integrationRequest(`${mod.detailPath}/${codeA}?workspaceId=${workspaceA.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ code: codeA }) },
        );
        assert.equal(operatorDelete.status, 403, "OPERATOR must not delete");

        // --- ADMIN may delete
        setIntegrationTestSession(integrationSession(admin));
        const adminDelete = await detailRoute.DELETE(
          integrationRequest(`${mod.detailPath}/${codeA}?workspaceId=${workspaceA.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ code: codeA }) },
        );
        assert.equal(adminDelete.status, 200, "ADMIN may delete");
        assert.equal(await table.findUnique({ where: { id: rowA.id } }), null, "ADMIN delete must remove the row");
      } finally {
        setIntegrationTestSession(null);
      }
    });
  });
}

/**
 * Id-addressed transactional resources. Unlike the code-addressed master data above,
 * these expose a detail GET, use PATCH for updates, and carry the workspace id in the
 * PATCH body rather than the query string.
 */
const ID_MODULES = [
  {
    name: "tasks",
    delegate: "task" as const,
    basePath: "/api/tasks",
    importList: () => import("../app/api/tasks/route"),
    importDetail: () => import("../app/api/tasks/[id]/route"),
    seed: (label: string) => ({ title: label, status: "todo", priority: "medium", createdAt: new Date(), updatedAt: new Date() }),
    payload: (label: string) => ({ title: label }),
    labelOf: (row: Record<string, unknown>) => row.title as string,
  },
  {
    name: "events",
    delegate: "calendarEvent" as const,
    basePath: "/api/events",
    importList: () => import("../app/api/events/route"),
    importDetail: () => import("../app/api/events/[id]/route"),
    seed: (label: string) => ({ title: label, date: new Date(), allDay: true, type: "other", attendees: [] }),
    payload: (label: string) => ({ title: label, date: new Date().toISOString().slice(0, 10) }),
    labelOf: (row: Record<string, unknown>) => row.title as string,
  },
  {
    name: "mails",
    delegate: "mailMessage" as const,
    basePath: "/api/mails",
    importList: () => import("../app/api/mails/route"),
    importDetail: () => import("../app/api/mails/[id]/route"),
    seed: (label: string) => ({ folder: "inbox", from: "a@test.invalid", to: "b@test.invalid", subject: label, body: label, snippet: label, starred: false, read: false }),
    payload: (label: string) => ({ subject: label, from: "a@test.invalid", to: "b@test.invalid", body: label }),
    labelOf: (row: Record<string, unknown>) => row.subject as string,
  },
] as const;

for (const mod of ID_MODULES) {
  test(`${mod.name} runtime authorization isolates workspaces and roles`, { skip: !enabled }, async () => {
    const { prisma } = await import("./prisma");
    const { setIntegrationTestSession } = await import("./auth-guards");
    const { WorkspaceRole } = await import("@prisma/client");
    const listRoute = await mod.importList();
    const detailRoute = await mod.importDetail();

    await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (prisma as any)[mod.delegate];
      const labelA = uniqueCode("TA", suffix);
      const labelB = uniqueCode("TB", suffix);
      const rowA = await table.create({ data: { ...mod.seed(labelA), workspaceId: workspaceA.id } });
      const rowB = await table.create({ data: { ...mod.seed(labelB), workspaceId: workspaceB.id } });

      try {
        // --- cross-workspace access is refused and leaves the other tenant untouched
        setIntegrationTestSession(integrationSession(admin));
        const beforeB = await table.findUnique({ where: { id: rowB.id } });

        const crossList = await listRoute.GET(integrationRequest(`${mod.basePath}?workspaceId=${workspaceB.id}`));
        assert.equal(crossList.status, 403, "cross-workspace list GET must be refused");

        const crossDetail = await detailRoute.GET(
          integrationRequest(`${mod.basePath}/${rowB.id}?workspaceId=${workspaceB.id}`),
          { params: Promise.resolve({ id: rowB.id }) },
        );
        assert.equal(crossDetail.status, 403, "cross-workspace detail GET must be refused");

        const crossPatch = await detailRoute.PATCH(
          integrationRequest(`${mod.basePath}/${rowB.id}`, { method: "PATCH", body: JSON.stringify({ ...mod.payload("tampered"), workspaceId: workspaceB.id }) }),
          { params: Promise.resolve({ id: rowB.id }) },
        );
        assert.equal(crossPatch.status, 403, "cross-workspace PATCH must be refused");

        const crossDelete = await detailRoute.DELETE(
          integrationRequest(`${mod.basePath}/${rowB.id}?workspaceId=${workspaceB.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: rowB.id }) },
        );
        assert.equal(crossDelete.status, 403, "cross-workspace DELETE must be refused");
        assert.deepEqual(await table.findUnique({ where: { id: rowB.id } }), beforeB, "refused requests must not mutate the other workspace");

        // --- a foreign id presented under the caller's own workspace must not resolve
        const foreignIdOwnWorkspace = await detailRoute.GET(
          integrationRequest(`${mod.basePath}/${rowB.id}?workspaceId=${workspaceA.id}`),
          { params: Promise.resolve({ id: rowB.id }) },
        );
        assert.equal(foreignIdOwnWorkspace.status, 404, "another workspace's id must not resolve under the caller's workspace");

        const foreignPatchOwnWorkspace = await detailRoute.PATCH(
          integrationRequest(`${mod.basePath}/${rowB.id}`, {
            method: "PATCH",
            body: JSON.stringify({ ...mod.payload("tampered-own"), workspaceId: workspaceA.id }),
          }),
          { params: Promise.resolve({ id: rowB.id }) },
        );
        assert.equal(foreignPatchOwnWorkspace.status, 404, "PATCH with a foreign id and own workspace must not resolve");

        const foreignDeleteOwnWorkspace = await detailRoute.DELETE(
          integrationRequest(`${mod.basePath}/${rowB.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: rowB.id }) },
        );
        assert.equal(foreignDeleteOwnWorkspace.status, 404, "DELETE with a foreign id and own workspace must not resolve");
        assert.deepEqual(await table.findUnique({ where: { id: rowB.id } }), beforeB, "foreign id write attempts must not mutate the other workspace");

        // --- own-workspace reads never leak the other tenant's rows
        const ownList = await listRoute.GET(integrationRequest(`${mod.basePath}?workspaceId=${workspaceA.id}`));
        assert.equal(ownList.status, 200);
        const listed = (await ownList.json()) as Array<Record<string, unknown>>;
        assert.ok(listed.some((row) => mod.labelOf(row) === labelA), "own workspace row must be listed");
        assert.ok(!listed.some((row) => mod.labelOf(row) === labelB), "other workspace row must not leak into the list");

        // --- VIEWER is read-only
        setIntegrationTestSession(integrationSession(viewer));
        const viewerRead = await listRoute.GET(integrationRequest(`${mod.basePath}?workspaceId=${workspaceA.id}`));
        assert.equal(viewerRead.status, 200, "VIEWER may read");
        const viewerWrite = await listRoute.POST(
          integrationRequest(mod.basePath, { method: "POST", body: JSON.stringify({ ...mod.payload(uniqueCode("TV", suffix)), workspaceId: workspaceA.id }) }),
        );
        assert.equal(viewerWrite.status, 403, "VIEWER must not create");

        // --- OPERATOR may write but not delete
        setIntegrationTestSession(integrationSession(operator));
        const operatorWrite = await listRoute.POST(
          integrationRequest(mod.basePath, { method: "POST", body: JSON.stringify({ ...mod.payload(uniqueCode("TO", suffix)), workspaceId: workspaceA.id }) }),
        );
        assert.equal(operatorWrite.status, 201, "OPERATOR may create");
        const operatorDelete = await detailRoute.DELETE(
          integrationRequest(`${mod.basePath}/${rowA.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: rowA.id }) },
        );
        assert.equal(operatorDelete.status, 403, "OPERATOR must not delete");

        // --- ADMIN may delete
        setIntegrationTestSession(integrationSession(admin));
        const adminDelete = await detailRoute.DELETE(
          integrationRequest(`${mod.basePath}/${rowA.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }),
          { params: Promise.resolve({ id: rowA.id }) },
        );
        assert.equal(adminDelete.status, 200, "ADMIN may delete");
        assert.equal(await table.findUnique({ where: { id: rowA.id } }), null, "ADMIN delete must remove the row");
      } finally {
        setIntegrationTestSession(null);
      }
    });
  });
}

after(async () => {
  if (!enabled) return;
  const { prisma } = await import("./prisma");
  await prisma.$disconnect();
});