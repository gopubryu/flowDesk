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
  {
    name: "purchase-requests",
    delegate: "purchaseRequest" as const,
    basePath: "/api/purchase-requests",
    importList: () => import("../app/api/purchase-requests/route"),
    importDetail: () => import("../app/api/purchase-requests/[id]/route"),
    seed: (label: string) => ({ requestDate: new Date("2026-01-01T00:00:00.000Z"), vendorName: label, item: label, quantity: 1, amount: 10, status: "unconfirmed" }),
    payload: (label: string) => ({ vendorName: label, item: label, quantity: 1, amount: 10 }),
    labelOf: (row: Record<string, unknown>) => row.item as string,
  },
  {
    name: "sales-plans",
    delegate: "salesPlan" as const,
    basePath: "/api/sales-plans",
    importList: () => import("../app/api/sales-plans/route"),
    importDetail: () => import("../app/api/sales-plans/[id]/route"),
    seed: (label: string) => ({ planDate: new Date("2026-01-01T00:00:00.000Z"), vendorName: label, item: label, quantity: 1, unitPrice: 10, amount: 10, vat: 0, total: 10, status: "confirmed", outboundStatus: "none", closed: false }),
    payload: (label: string) => ({ vendorName: label, item: label, quantity: 1, unitPrice: 10, amount: 10, vat: 0, total: 10 }),
    labelOf: (row: Record<string, unknown>) => row.item as string,
  },
  {
    name: "quotations",
    delegate: "quotation" as const,
    basePath: "/api/quotations",
    importList: () => import("../app/api/quotations/route"),
    importDetail: () => import("../app/api/quotations/[id]/route"),
    seed: (label: string) => ({ quoteDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: label, vendorName: label, item: label, quantity: 1, amount: 10, vat: 0, total: 10, status: "draft" }),
    payload: (label: string) => ({ quoteDate: "2026-01-01", slipNo: label, vendorName: label, status: "draft", lines: [{ itemName: label, qty: 1, unitPrice: 10, supply: 10, vat: 0, total: 10 }] }),
    labelOf: (row: Record<string, unknown>) => row.item as string,
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

/** Finance has no detail GET route, so exercise its list + id PATCH/DELETE handlers explicitly. */
test("finances runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const listRoute = await import("../app/api/finances/route");
  const detailRoute = await import("../app/api/finances/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
    const rowA = await prisma.financeRecord.create({ data: { workspaceId: workspaceA.id, client: `client-a-${suffix}`, description: `finance-a-${suffix}`, amount: 10, date: new Date("2026-01-01T00:00:00.000Z"), category: "sales" } });
    const rowB = await prisma.financeRecord.create({ data: { workspaceId: workspaceB.id, client: `client-b-${suffix}`, description: `finance-b-${suffix}`, amount: 20, date: new Date("2026-01-01T00:00:00.000Z"), category: "sales" } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const beforeB = await prisma.financeRecord.findUnique({ where: { id: rowB.id } });
      assert.equal((await listRoute.GET(integrationRequest(`/api/finances?workspaceId=${workspaceB.id}`))).status, 403);
      assert.equal((await detailRoute.PATCH(integrationRequest(`/api/finances/${rowB.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceB.id, description: "tampered" }) }), { params: Promise.resolve({ id: rowB.id }) })).status, 403);
      assert.equal((await detailRoute.DELETE(integrationRequest(`/api/finances/${rowB.id}?workspaceId=${workspaceB.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: rowB.id }) })).status, 403);
      assert.equal((await detailRoute.PATCH(integrationRequest(`/api/finances/${rowB.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, description: "tampered-own" }) }), { params: Promise.resolve({ id: rowB.id }) })).status, 404);
      assert.equal((await detailRoute.DELETE(integrationRequest(`/api/finances/${rowB.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: rowB.id }) })).status, 404);
      assert.deepEqual(await prisma.financeRecord.findUnique({ where: { id: rowB.id } }), beforeB);

      setIntegrationTestSession(integrationSession(viewer));
      assert.equal((await listRoute.GET(integrationRequest(`/api/finances?workspaceId=${workspaceA.id}`))).status, 200);
      assert.equal((await listRoute.POST(integrationRequest("/api/finances", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, client: "viewer", description: "blocked", amount: 1, category: "sales" }) }))).status, 403);

      setIntegrationTestSession(integrationSession(operator));
      assert.equal((await listRoute.POST(integrationRequest("/api/finances", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, client: "operator", description: "allowed", amount: 1, category: "sales" }) }))).status, 201);
      assert.equal((await detailRoute.DELETE(integrationRequest(`/api/finances/${rowA.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: rowA.id }) })).status, 403);

      setIntegrationTestSession(integrationSession(admin));
      assert.equal((await detailRoute.DELETE(integrationRequest(`/api/finances/${rowA.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: rowA.id }) })).status, 200);
      assert.equal(await prisma.financeRecord.findUnique({ where: { id: rowA.id } }), null);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory balances runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const balancesRoute = await import("../app/api/inventory/balances/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
    const balanceA = await prisma.stockBalance.create({ data: { workspaceId: workspaceA.id, warehouseCode: `WHA${suffix.slice(-6).toUpperCase()}`, warehouseName: "A warehouse", itemCode: `IA${suffix.slice(-8).toUpperCase()}`, itemName: "A item", qty: 7 } });
    const balanceB = await prisma.stockBalance.create({ data: { workspaceId: workspaceB.id, warehouseCode: `WHB${suffix.slice(-6).toUpperCase()}`, warehouseName: "B warehouse", itemCode: `IB${suffix.slice(-8).toUpperCase()}`, itemName: "B item", qty: 11 } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      assert.equal((await balancesRoute.GET(integrationRequest(`/api/inventory/balances?workspaceId=${workspaceB.id}`))).status, 403);
      const own = await balancesRoute.GET(integrationRequest(`/api/inventory/balances?workspaceId=${workspaceA.id}`));
      assert.equal(own.status, 200);
      const ownRows = (await own.json()) as Array<{ itemCode: string }>;
      assert.ok(ownRows.some((row) => row.itemCode === balanceA.itemCode));
      assert.ok(!ownRows.some((row) => row.itemCode === balanceB.itemCode));

      setIntegrationTestSession(integrationSession(viewer));
      assert.equal((await balancesRoute.GET(integrationRequest(`/api/inventory/balances?workspaceId=${workspaceA.id}`))).status, 200);
      setIntegrationTestSession(integrationSession(operator));
      assert.equal((await balancesRoute.GET(integrationRequest(`/api/inventory/balances?workspaceId=${workspaceA.id}`))).status, 200);
      assert.deepEqual(await prisma.stockBalance.findUnique({ where: { id: balanceB.id } }), balanceB);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory adjustments runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const adjustmentsRoute = await import("../app/api/inventory/adjustments/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
    const warehouseA = `WHA${suffix.slice(-6).toUpperCase()}`;
    const itemA = `IAA${suffix.slice(-8).toUpperCase()}`;
    const warehouseB = `WHB${suffix.slice(-6).toUpperCase()}`;
    const itemB = `IAB${suffix.slice(-8).toUpperCase()}`;
    await prisma.stockBalance.create({ data: { workspaceId: workspaceA.id, warehouseCode: warehouseA, itemCode: itemA, qty: 7 } });
    await prisma.stockBalance.create({ data: { workspaceId: workspaceB.id, warehouseCode: warehouseB, itemCode: itemB, qty: 11 } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      assert.equal((await adjustmentsRoute.GET(integrationRequest(`/api/inventory/adjustments?workspaceId=${workspaceB.id}`))).status, 403);
      assert.equal((await adjustmentsRoute.GET(integrationRequest(`/api/inventory/adjustments?workspaceId=${workspaceA.id}`))).status, 200);
      const beforeB = await prisma.stockBalance.findUnique({ where: { workspaceId_warehouseCode_itemCode: { workspaceId: workspaceB.id, warehouseCode: warehouseB, itemCode: itemB } } });

      setIntegrationTestSession(integrationSession(viewer));
      assert.equal((await adjustmentsRoute.POST(integrationRequest("/api/inventory/adjustments", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode: warehouseA, itemCode: itemA, reason: "blocked", date: "2026-01-01", bookQty: 7, actualQty: 9 }) }))).status, 403);

      setIntegrationTestSession(integrationSession(operator));
      assert.equal((await adjustmentsRoute.POST(integrationRequest("/api/inventory/adjustments", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode: warehouseA, itemCode: itemA, reason: "cycle count", date: "2026-01-01", bookQty: 7, actualQty: 9, warehouseName: "A warehouse", itemName: "A item" }) }))).status, 201);
      assert.equal((await prisma.stockBalance.findUnique({ where: { workspaceId_warehouseCode_itemCode: { workspaceId: workspaceA.id, warehouseCode: warehouseA, itemCode: itemA } } }))?.qty, 9);
      assert.deepEqual(await prisma.stockBalance.findUnique({ where: { workspaceId_warehouseCode_itemCode: { workspaceId: workspaceB.id, warehouseCode: warehouseB, itemCode: itemB } } }), beforeB);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory receipts runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const receiptsRoute = await import("../app/api/inventory/receipts/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
    const itemA = await prisma.item.create({ data: { workspaceId: workspaceA.id, code: `IRA${suffix.slice(-8).toUpperCase()}`, name: "Receipt item A", inboundPrice: 10, outboundPrice: 0, inboundVatIncluded: false, outboundVatIncluded: false } });
    await prisma.item.create({ data: { workspaceId: workspaceB.id, code: `IRB${suffix.slice(-8).toUpperCase()}`, name: "Receipt item B", inboundPrice: 10, outboundPrice: 0, inboundVatIncluded: false, outboundVatIncluded: false } });
    const warehouseCode = `WRA${suffix.slice(-6).toUpperCase()}`;
    try {
      setIntegrationTestSession(integrationSession(admin));
      assert.equal((await receiptsRoute.GET(integrationRequest(`/api/inventory/receipts?workspaceId=${workspaceB.id}`))).status, 403);
      assert.equal((await receiptsRoute.GET(integrationRequest(`/api/inventory/receipts?workspaceId=${workspaceA.id}`))).status, 200);
      setIntegrationTestSession(integrationSession(viewer));
      assert.equal((await receiptsRoute.POST(integrationRequest("/api/inventory/receipts", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode, date: "2026-01-01", lines: [{ itemCode: itemA.code, itemName: itemA.name, qty: 3 }] }) }))).status, 403);
      setIntegrationTestSession(integrationSession(operator));
      assert.equal((await receiptsRoute.POST(integrationRequest("/api/inventory/receipts", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode, date: "2026-01-01", lines: [{ itemCode: itemA.code, itemName: itemA.name, qty: 3 }] }) }))).status, 201);
      const balance = await prisma.stockBalance.findUnique({ where: { workspaceId_warehouseCode_itemCode: { workspaceId: workspaceA.id, warehouseCode, itemCode: itemA.code } } });
      assert.equal(balance?.qty, 3);
      assert.equal(await prisma.stockMovement.count({ where: { workspaceId: workspaceA.id, type: "receipt", itemCode: itemA.code } }), 1);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory shipments runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const shipmentsRoute = await import("../app/api/inventory/shipments/route");
  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
    const itemA = await prisma.item.create({ data: { workspaceId: workspaceA.id, code: `ISA${suffix.slice(-8).toUpperCase()}`, name: "Shipment item A", inboundPrice: 10, outboundPrice: 20, inboundVatIncluded: false, outboundVatIncluded: false } });
    const itemB = await prisma.item.create({ data: { workspaceId: workspaceB.id, code: `ISB${suffix.slice(-8).toUpperCase()}`, name: "Shipment item B", inboundPrice: 10, outboundPrice: 20, inboundVatIncluded: false, outboundVatIncluded: false } });
    const warehouseA = `WSA${suffix.slice(-6).toUpperCase()}`;
    const warehouseB = `WSB${suffix.slice(-6).toUpperCase()}`;
    const balanceA = await prisma.stockBalance.create({ data: { workspaceId: workspaceA.id, warehouseCode: warehouseA, itemCode: itemA.code, itemName: itemA.name, qty: 7 } });
    const balanceB = await prisma.stockBalance.create({ data: { workspaceId: workspaceB.id, warehouseCode: warehouseB, itemCode: itemB.code, itemName: itemB.name, qty: 11 } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      assert.equal((await shipmentsRoute.GET(integrationRequest(`/api/inventory/shipments?workspaceId=${workspaceB.id}`))).status, 403);
      setIntegrationTestSession(integrationSession(viewer));
      const viewerPost = await shipmentsRoute.POST(integrationRequest("/api/inventory/shipments", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode: warehouseA, date: "2026-01-01", lines: [] }) }));
      assert.equal(viewerPost.status, 403, await viewerPost.text());
      setIntegrationTestSession(integrationSession(operator));
      const operatorPost = await shipmentsRoute.POST(integrationRequest("/api/inventory/shipments", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, warehouseCode: warehouseA, warehouseName: "A warehouse", date: "2026-01-01", lines: [{ itemCode: itemA.code, itemName: itemA.name, qty: 2 }] }) }));
      assert.equal(operatorPost.status, 201, await operatorPost.text());
      assert.equal((await prisma.stockBalance.findUnique({ where: { id: balanceA.id } }))?.qty, 5);
      assert.deepEqual(await prisma.stockBalance.findUnique({ where: { id: balanceB.id } }), balanceB);
      assert.equal(await prisma.stockMovement.count({ where: { workspaceId: workspaceA.id, type: "shipment", itemCode: itemA.code } }), 1);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("purchase orders runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const listRoute = await import("../app/api/purchases/route");
  const detailRoute = await import("../app/api/purchases/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, admin, operator, viewer }) => {
    const codeA = `PIA${suffix.slice(-8).toUpperCase()}`;
    const codeB = `PIB${suffix.slice(-8).toUpperCase()}`;
    await prisma.item.create({ data: { workspaceId: workspaceA.id, code: codeA, name: "Purchase item A", inboundPrice: 10, outboundPrice: 20, inboundVatIncluded: false, outboundVatIncluded: false } });
    await prisma.item.create({ data: { workspaceId: workspaceB.id, code: codeB, name: "Purchase item B", inboundPrice: 10, outboundPrice: 20, inboundVatIncluded: false, outboundVatIncluded: false } });
    const purchaseB = await prisma.purchase.create({ data: { workspaceId: workspaceB.id, purchaseDate: new Date("2026-01-01"), vendorName: "Vendor B", item: "Purchase item B", itemCode: codeB, quantity: 3, amount: 30, lines: { create: [{ itemCode: codeB, itemName: "Purchase item B", qty: 3, unitPrice: 10, supply: 30, vat: 3, total: 33, sortOrder: 0 }] } }, include: { lines: true } });
    const payload = (itemCode: string, itemName: string) => ({ purchaseDate: "2026-01-02", vendorName: "Vendor A", item: itemName, itemCode, quantity: 2, amount: 20, lines: [{ itemCode, itemName, qty: 2, unitPrice: 10, supply: 20, vat: 2, total: 22, sortOrder: 0 }] });
    try {
      setIntegrationTestSession(integrationSession(admin));
      assert.equal((await listRoute.GET(integrationRequest(`/api/purchases?workspaceId=${workspaceB.id}`))).status, 403);
      assert.equal((await detailRoute.GET(integrationRequest(`/api/purchases/${purchaseB.id}?workspaceId=${workspaceA.id}`), { params: Promise.resolve({ id: purchaseB.id }) })).status, 404);
      assert.equal((await detailRoute.DELETE(integrationRequest(`/api/purchases/${purchaseB.id}?workspaceId=${workspaceB.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: purchaseB.id }) })).status, 403);

      setIntegrationTestSession(integrationSession(viewer));
      assert.equal((await listRoute.POST(integrationRequest("/api/purchases", { method: "POST", body: JSON.stringify({ ...payload(codeA, "Purchase item A"), workspaceId: workspaceA.id }) }))).status, 403);

      setIntegrationTestSession(integrationSession(operator));
      const created = await listRoute.POST(integrationRequest("/api/purchases", { method: "POST", body: JSON.stringify({ ...payload(codeA, "Purchase item A"), workspaceId: workspaceA.id }) }));
      assert.equal(created.status, 201, await created.clone().text());
      const createdId = ((await created.json()) as { id: string }).id;
      assert.equal((await detailRoute.DELETE(integrationRequest(`/api/purchases/${createdId}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: createdId }) })).status, 403);

      setIntegrationTestSession(integrationSession(admin));
      const deleted = await detailRoute.DELETE(integrationRequest(`/api/purchases/${createdId}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: createdId }) });
      assert.equal(deleted.status, 200, await deleted.clone().text());
      assert.equal(await prisma.purchase.count({ where: { id: createdId } }), 0);
      assert.equal((await prisma.purchase.findUnique({ where: { id: purchaseB.id }, include: { lines: true } }))?.lines.length, 1);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("purchase import base amount runtime guards reject spoofed values", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const listRoute = await import("../app/api/purchases/route");
  const detailRoute = await import("../app/api/purchases/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, operator }) => {
    const runtimeItemCode = `RIG${suffix.slice(-8).toUpperCase()}`;
    await prisma.item.create({ data: { workspaceId: workspaceA.id, code: runtimeItemCode, name: "Import item", inboundPrice: 1, outboundPrice: 1, inboundVatIncluded: false, outboundVatIncluded: false } });
    const basePayload = { workspaceId: workspaceA.id, vendorName: "Runtime import guard", purchaseDate: "2026-01-02", item: "Import item", itemCode: runtimeItemCode, quantity: 1, amount: 1, lines: [{ itemCode: runtimeItemCode, itemName: "Import item", qty: 1, unitPrice: 1, supply: 1, vat: 0, total: 1, sortOrder: 0 }] };
    try {
      setIntegrationTestSession(integrationSession(operator));

      const beforePostCount = await prisma.purchase.count({ where: { workspaceId: workspaceA.id } });
      const postOnlyBase = await listRoute.POST(integrationRequest("/api/purchases", { method: "POST", body: JSON.stringify({ ...basePayload, baseAmount: "999999" }) }));
      assert.equal(postOnlyBase.status, 400, "POST baseAmount-only must be rejected");
      assert.equal(await prisma.purchase.count({ where: { workspaceId: workspaceA.id } }), beforePostCount, "rejected POST must not create a purchase");

      const { calculateImportBaseAmount } = await import("./erp-rules");
      assert.equal(calculateImportBaseAmount("USD", "1", "1300"), "1300");
      assert.equal(calculateImportBaseAmount("JPY", "1000", "950"), "9500");
      assert.equal(calculateImportBaseAmount("JPY", "1", "950"), "10", "half-up 9.5 must round to 10");

      const imported = await listRoute.POST(integrationRequest("/api/purchases", { method: "POST", body: JSON.stringify({ ...basePayload, currency: "USD", foreignAmount: "1", customsDate: "2026-01-02", customsExchangeRate: "1300", baseAmount: "1300", importVatBaseAmount: "1300", importVat: "130" }) }));
      assert.equal(imported.status, 201, await imported.clone().text());
      const importedId = ((await imported.json()) as { id: string }).id;

      const patchOnlyBase = await detailRoute.PATCH(integrationRequest(`/api/purchases/${importedId}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, baseAmount: "999999" }) }), { params: Promise.resolve({ id: importedId }) });
      assert.equal(patchOnlyBase.status, 200, await patchOnlyBase.clone().text());
      assert.equal((await prisma.purchase.findUniqueOrThrow({ where: { id: importedId } })).baseAmount?.toString(), "1300", "stored foreign/rate must override spoofed baseAmount");

      const patchMismatch = await detailRoute.PATCH(integrationRequest(`/api/purchases/${importedId}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, foreignAmount: "2", customsExchangeRate: "1300", baseAmount: "1" }) }), { params: Promise.resolve({ id: importedId }) });
      assert.equal(patchMismatch.status, 200, await patchMismatch.clone().text());
      assert.equal((await prisma.purchase.findUniqueOrThrow({ where: { id: importedId } })).baseAmount?.toString(), "2600", "calculated baseAmount must win over client value");

      const domestic = await listRoute.POST(integrationRequest("/api/purchases", { method: "POST", body: JSON.stringify(basePayload) }));
      assert.equal(domestic.status, 201, await domestic.clone().text());
      const domesticId = ((await domestic.json()) as { id: string }).id;
      const domesticOnlyBase = await detailRoute.PATCH(integrationRequest(`/api/purchases/${domesticId}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, baseAmount: "999999" }) }), { params: Promise.resolve({ id: domesticId }) });
      assert.equal(domesticOnlyBase.status, 400, "domestic baseAmount-only must be rejected");
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("purchase bulk runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const bulkRoute = await import("../app/api/purchases/bulk/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, workspaceB, admin, operator, viewer }) => {
    const seed = (workspaceId: string, vendor: string) => prisma.purchase.create({ data: { workspaceId, purchaseDate: new Date("2026-01-01"), vendorName: vendor, item: "Bulk item", quantity: 1, amount: 10, status: "unconfirmed" } });
    const rowA = await seed(workspaceA.id, "Vendor A");
    const rowB = await seed(workspaceB.id, "Vendor B");
    try {
      setIntegrationTestSession(integrationSession(admin));
      const crossPatch = await bulkRoute.PATCH(integrationRequest("/api/purchases/bulk", { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceB.id, ids: [rowB.id], status: "confirmed" }) }));
      assert.equal(crossPatch.status, 403, await crossPatch.clone().text());
      const foreignPatch = await bulkRoute.PATCH(integrationRequest("/api/purchases/bulk", { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, ids: [rowB.id], status: "confirmed" }) }));
      assert.equal(foreignPatch.status, 409, await foreignPatch.clone().text());

      setIntegrationTestSession(integrationSession(viewer));
      const viewerPatch = await bulkRoute.PATCH(integrationRequest("/api/purchases/bulk", { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, ids: [rowA.id], status: "confirmed" }) }));
      assert.equal(viewerPatch.status, 403, await viewerPatch.clone().text());

      setIntegrationTestSession(integrationSession(operator));
      const operatorPatch = await bulkRoute.PATCH(integrationRequest("/api/purchases/bulk", { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, ids: [rowA.id], status: "confirmed" }) }));
      assert.equal(operatorPatch.status, 200, await operatorPatch.clone().text());
      assert.equal((await prisma.purchase.findUnique({ where: { id: rowA.id } }))?.status, "confirmed");
      const operatorDelete = await bulkRoute.DELETE(integrationRequest("/api/purchases/bulk", { method: "DELETE", body: JSON.stringify({ workspaceId: workspaceA.id, ids: [rowA.id] }) }));
      assert.equal(operatorDelete.status, 403, await operatorDelete.clone().text());

      setIntegrationTestSession(integrationSession(admin));
      const adminDelete = await bulkRoute.DELETE(integrationRequest("/api/purchases/bulk", { method: "DELETE", body: JSON.stringify({ workspaceId: workspaceA.id, ids: [rowA.id] }) }));
      assert.equal(adminDelete.status, 200, await adminDelete.clone().text());
      assert.equal(await prisma.purchase.count({ where: { id: rowA.id } }), 0);
      assert.equal((await prisma.purchase.findUnique({ where: { id: rowB.id } }))?.status, "unconfirmed");
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory movements runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const movementRoute = await import("../app/api/inventory/movements/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, viewer, admin }) => {
    const itemA = uniqueCode("IMA", suffix);
    const itemB = uniqueCode("IMB", suffix);
    const movementA = await prisma.stockMovement.create({
      data: { workspaceId: workspaceA.id, date: new Date("2026-01-02T00:00:00.000Z"), type: "receipt", slipNo: `SM-A-${suffix}`, warehouseCode: `WA-${suffix}`, warehouseName: "Warehouse A", itemCode: itemA, itemName: "Item A", qty: 3, relatedType: "purchase", relatedId: `purchase-a-${suffix}` },
    });
    const movementB = await prisma.stockMovement.create({
      data: { workspaceId: workspaceB.id, date: new Date("2026-01-02T00:00:00.000Z"), type: "shipment", slipNo: `SM-B-${suffix}`, warehouseCode: `WB-${suffix}`, warehouseName: "Warehouse B", itemCode: itemB, itemName: "Item B", qty: -2, relatedType: "salesPlan", relatedId: `sales-b-${suffix}` },
    });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const cross = await movementRoute.GET(integrationRequest(`/api/inventory/movements?workspaceId=${workspaceB.id}`));
      assert.equal(cross.status, 403, await cross.clone().text());

      const own = await movementRoute.GET(integrationRequest(`/api/inventory/movements?workspaceId=${workspaceA.id}&itemCode=${encodeURIComponent(itemA)}`));
      assert.equal(own.status, 200, await own.clone().text());
      const ownRows = (await own.json()) as Array<{ id: string; workspaceId?: string; itemCode: string }>;
      assert.ok(ownRows.some((row) => row.id === movementA.id && row.itemCode === itemA));
      assert.ok(!ownRows.some((row) => row.id === movementB.id));

      setIntegrationTestSession(integrationSession(viewer));
      const viewerRead = await movementRoute.GET(integrationRequest(`/api/inventory/movements?workspaceId=${workspaceA.id}`));
      assert.equal(viewerRead.status, 200, await viewerRead.clone().text());
      assert.ok((await viewerRead.json()).every((row: { id: string }) => row.id !== movementB.id));
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory related quantities runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const relatedQtyRoute = await import("../app/api/inventory/related-qty/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, viewer, admin }) => {
    const relatedA = `purchase-a-${suffix}`;
    const relatedB = `purchase-b-${suffix}`;
    await prisma.stockMovement.create({ data: { workspaceId: workspaceA.id, date: new Date("2026-01-02T00:00:00.000Z"), type: "receipt", slipNo: `RQ-A-${suffix}`, warehouseCode: `WA-${suffix}`, itemCode: `IMA-${suffix}`, itemName: "Item A", qty: 4, relatedType: "purchase", relatedId: relatedA } });
    await prisma.stockMovement.create({ data: { workspaceId: workspaceB.id, date: new Date("2026-01-02T00:00:00.000Z"), type: "receipt", slipNo: `RQ-B-${suffix}`, warehouseCode: `WB-${suffix}`, itemCode: `IMB-${suffix}`, itemName: "Item B", qty: 9, relatedType: "purchase", relatedId: relatedB } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const cross = await relatedQtyRoute.GET(integrationRequest(`/api/inventory/related-qty?workspaceId=${workspaceB.id}&relatedType=purchase&relatedIds=${relatedB}`));
      assert.equal(cross.status, 403, await cross.clone().text());

      const own = await relatedQtyRoute.GET(integrationRequest(`/api/inventory/related-qty?workspaceId=${workspaceA.id}&relatedType=purchase&relatedIds=${relatedA},${relatedB}`));
      assert.equal(own.status, 200, await own.clone().text());
      assert.deepEqual(await own.json(), { [relatedA]: 4, [relatedB]: 0 });

      setIntegrationTestSession(integrationSession(viewer));
      const viewerRead = await relatedQtyRoute.GET(integrationRequest(`/api/inventory/related-qty?workspaceId=${workspaceA.id}&relatedType=purchase&relatedIds=${relatedA}`));
      assert.equal(viewerRead.status, 200, await viewerRead.clone().text());
      assert.deepEqual(await viewerRead.json(), { [relatedA]: 4 });
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory status runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const statusRoute = await import("../app/api/inventory/status/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, viewer, admin }) => {
    const itemA = uniqueCode("ISA", suffix);
    const itemB = uniqueCode("ISB", suffix);
    const balanceA = await prisma.stockBalance.create({ data: { workspaceId: workspaceA.id, warehouseCode: `WA-${suffix}`, warehouseName: "Warehouse A", itemCode: itemA, itemName: "Item A", qty: 7 } });
    const balanceB = await prisma.stockBalance.create({ data: { workspaceId: workspaceB.id, warehouseCode: `WB-${suffix}`, warehouseName: "Warehouse B", itemCode: itemB, itemName: "Item B", qty: 11 } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const cross = await statusRoute.GET(integrationRequest(`/api/inventory/status?workspaceId=${workspaceB.id}`));
      assert.equal(cross.status, 403, await cross.clone().text());

      const own = await statusRoute.GET(integrationRequest(`/api/inventory/status?workspaceId=${workspaceA.id}`));
      assert.equal(own.status, 200, await own.clone().text());
      const ownBody = await own.json() as { balances: Array<{ itemCode: string; qty: number }> };
      assert.deepEqual(ownBody.balances.filter((row) => row.itemCode === itemA), [{ warehouseCode: balanceA.warehouseCode, warehouseName: balanceA.warehouseName, itemCode: itemA, itemName: "Item A", qty: 7 }]);
      assert.ok(!ownBody.balances.some((row) => row.itemCode === itemB), "workspace B balance must not leak");
      assert.ok(await prisma.stockBalance.findUnique({ where: { id: balanceB.id } }), "foreign fixture remains intact");

      setIntegrationTestSession(integrationSession(viewer));
      const viewerRead = await statusRoute.GET(integrationRequest(`/api/inventory/status?workspaceId=${workspaceA.id}`));
      assert.equal(viewerRead.status, 200, await viewerRead.clone().text());
      assert.ok((await viewerRead.json() as { balances: Array<{ itemCode: string }> }).balances.every((row) => row.itemCode !== itemB));
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("inventory next-slip runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const nextSlipRoute = await import("../app/api/inventory/next-slip/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, viewer, admin }) => {
    await prisma.stockMovement.create({ data: { workspaceId: workspaceA.id, date: new Date("2026-01-01T00:00:00.000Z"), type: "receipt", slipNo: "RCV-260101-03", warehouseCode: `WA-${suffix}`, itemCode: `INA-${suffix}`, qty: 1 } });
    await prisma.stockMovement.create({ data: { workspaceId: workspaceB.id, date: new Date("2026-01-01T00:00:00.000Z"), type: "receipt", slipNo: "RCV-260101-09", warehouseCode: `WB-${suffix}`, itemCode: `INB-${suffix}`, qty: 1 } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const cross = await nextSlipRoute.GET(integrationRequest(`/api/inventory/next-slip?workspaceId=${workspaceB.id}&type=receipt&date=2026-01-01`));
      assert.equal(cross.status, 403, await cross.clone().text());

      const own = await nextSlipRoute.GET(integrationRequest(`/api/inventory/next-slip?workspaceId=${workspaceA.id}&type=receipt&date=2026-01-01`));
      assert.equal(own.status, 200, await own.clone().text());
      assert.deepEqual(await own.json(), { slipNo: "RCV-260101-04" });

      setIntegrationTestSession(integrationSession(viewer));
      const viewerRead = await nextSlipRoute.GET(integrationRequest(`/api/inventory/next-slip?workspaceId=${workspaceA.id}&type=receipt&date=2026-01-01`));
      assert.equal(viewerRead.status, 200, await viewerRead.clone().text());
      assert.deepEqual(await viewerRead.json(), { slipNo: "RCV-260101-04" });
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("quotation conversion runtime authorization isolates workspaces and roles", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const conversionRoute = await import("../app/api/quotations/[id]/convert-to-sales-plan/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceA, workspaceB, viewer, operator, admin }) => {
    const createQuotation = (workspaceId: string, slipNo: string, item: string) => prisma.quotation.create({
      data: {
        workspaceId, quoteDate: new Date("2026-01-01T00:00:00.000Z"), slipNo, vendorName: `Vendor-${item}`, item, itemCode: `ITEM-${item}`, quantity: 2, amount: 20, vat: 0, total: 20, status: "accepted",
        lines: { create: [{ itemCode: `ITEM-${item}`, itemName: item, qty: 2, unitPrice: 10, supply: 20, vat: 0, total: 20, sortOrder: 0 }] },
      },
    });
    const quoteA = await createQuotation(workspaceA.id, `QT-A-${suffix}`, `Item-A-${suffix}`);
    const quoteB = await createQuotation(workspaceB.id, `QT-B-${suffix}`, `Item-B-${suffix}`);
    const beforeB = await prisma.quotation.findUnique({ where: { id: quoteB.id }, include: { lines: true } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const cross = await conversionRoute.POST(integrationRequest(`/api/quotations/${quoteB.id}/convert-to-sales-plan?workspaceId=${workspaceB.id}`, { method: "POST" }), { params: Promise.resolve({ id: quoteB.id }) });
      assert.equal(cross.status, 403, await cross.clone().text());
      const foreignOwn = await conversionRoute.POST(integrationRequest(`/api/quotations/${quoteB.id}/convert-to-sales-plan?workspaceId=${workspaceA.id}`, { method: "POST" }), { params: Promise.resolve({ id: quoteB.id }) });
      assert.equal(foreignOwn.status, 404, await foreignOwn.clone().text());

      setIntegrationTestSession(integrationSession(viewer));
      const viewerConvert = await conversionRoute.POST(integrationRequest(`/api/quotations/${quoteA.id}/convert-to-sales-plan?workspaceId=${workspaceA.id}`, { method: "POST" }), { params: Promise.resolve({ id: quoteA.id }) });
      assert.equal(viewerConvert.status, 403, await viewerConvert.clone().text());

      setIntegrationTestSession(integrationSession(operator));
      const converted = await conversionRoute.POST(integrationRequest(`/api/quotations/${quoteA.id}/convert-to-sales-plan?workspaceId=${workspaceA.id}`, { method: "POST" }), { params: Promise.resolve({ id: quoteA.id }) });
      assert.equal(converted.status, 201, await converted.clone().text());
      const convertedBody = await converted.json() as { id: string; sourceQuotationId: string };
      assert.equal(convertedBody.sourceQuotationId, quoteA.id);
      const salesPlan = await prisma.salesPlan.findUnique({ where: { id: convertedBody.id }, include: { lines: true } });
      assert.equal(salesPlan?.workspaceId, workspaceA.id);
      assert.equal(salesPlan?.sourceQuotationId, quoteA.id);
      assert.equal(salesPlan?.lines.length, 1);

      const duplicate = await conversionRoute.POST(integrationRequest(`/api/quotations/${quoteA.id}/convert-to-sales-plan?workspaceId=${workspaceA.id}`, { method: "POST" }), { params: Promise.resolve({ id: quoteA.id }) });
      assert.equal(duplicate.status, 409, await duplicate.clone().text());
      assert.deepEqual(await prisma.quotation.findUnique({ where: { id: quoteB.id }, include: { lines: true } }), beforeB);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("workspace session runtime authorization lists memberships and blocks repeat onboarding", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const workspacesRoute = await import("../app/api/auth/workspaces/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, admin, viewer }) => {
    try {
      setIntegrationTestSession(integrationSession(admin));
      const adminList = await workspacesRoute.GET();
      assert.equal(adminList.status, 200, await adminList.clone().text());
      const adminBody = await adminList.json() as { memberships: Array<{ workspace: { id: string; name: string }; role: string }> };
      assert.equal(adminBody.memberships.length, 1);
      assert.equal(adminBody.memberships[0]?.workspace.id, workspaceA.id);
      assert.equal(adminBody.memberships[0]?.role, "ADMIN");
      const repeat = await workspacesRoute.POST(integrationRequest("/api/auth/workspaces", { method: "POST", body: JSON.stringify({ name: "repeat" }) }));
      assert.equal(repeat.status, 409, await repeat.clone().text());

      setIntegrationTestSession(integrationSession(viewer));
      const viewerList = await workspacesRoute.GET();
      assert.equal(viewerList.status, 200, await viewerList.clone().text());
      const viewerBody = await viewerList.json() as { memberships: Array<{ workspace: { id: string; name: string }; role: string }> };
      assert.equal(viewerBody.memberships.length, 1);
      assert.equal(viewerBody.memberships[0]?.workspace.id, workspaceA.id);
      assert.equal(viewerBody.memberships[0]?.role, "VIEWER");

      setIntegrationTestSession(null);
      const unauthorized = await workspacesRoute.GET();
      assert.equal(unauthorized.status, 401, await unauthorized.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("multi-workspace membership runtime requires explicit workspace selection", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const workspacesRoute = await import("../app/api/auth/workspaces/route");
  const itemsRoute = await import("../app/api/items/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, workspaceB, admin }) => {
    await prisma.workspaceMember.create({ data: { workspaceId: workspaceB.id, userId: admin.id, role: WorkspaceRole.OPERATOR } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const memberships = await workspacesRoute.GET();
      assert.equal(memberships.status, 200, await memberships.clone().text());
      const body = await memberships.json() as { memberships: Array<{ workspace: { id: string }; role: string }> };
      assert.equal(body.memberships.length, 2);
      assert.deepEqual(body.memberships.map((entry) => entry.workspace.id), [workspaceA.id, workspaceB.id]);
      assert.deepEqual(body.memberships.map((entry) => entry.role), ["ADMIN", "OPERATOR"]);

      const ambiguous = await itemsRoute.GET(integrationRequest("/api/items"));
      assert.equal(ambiguous.status, 400, await ambiguous.clone().text());
      const explicit = await itemsRoute.GET(integrationRequest(`/api/items?workspaceId=${workspaceB.id}`));
      assert.equal(explicit.status, 200, await explicit.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("auth session probe runtime maps authenticated and anonymous sessions", { skip: !enabled }, async () => {
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const meRoute = await import("../app/api/auth/me/route");

  await withWorkspaceFixture((await import("./prisma")).prisma, WorkspaceRole, async ({ admin }) => {
    try {
      setIntegrationTestSession(integrationSession(admin));
      const authenticated = await meRoute.GET();
      assert.equal(authenticated.status, 200, await authenticated.clone().text());
      const session = await authenticated.json() as { user: { id: string; email: string } };
      assert.equal(session.user.id, admin.id);
      assert.match(session.user.email, /@test\.invalid$/);

      setIntegrationTestSession(null);
      const anonymous = await meRoute.GET();
      assert.equal(anonymous.status, 401, await anonymous.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("workspace onboarding runtime creates the first workspace for a new user", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const workspacesRoute = await import("../app/api/auth/workspaces/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix }) => {
    const user = await prisma.user.create({ data: { id: `it-onboard-${suffix}`, name: "Onboarding User", email: `onboard-${suffix}@test.invalid`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
    let createdWorkspaceId: string | undefined;
    try {
      setIntegrationTestSession(integrationSession(user));
      const created = await workspacesRoute.POST(integrationRequest("/api/auth/workspaces", { method: "POST", body: JSON.stringify({ name: `first-${suffix}` }) }));
      assert.equal(created.status, 201, await created.clone().text());
      const body = await created.json() as { workspace: { id: string; name: string } };
      createdWorkspaceId = body.workspace.id;
      assert.equal(body.workspace.name, `first-${suffix}`);
      const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: body.workspace.id, userId: user.id } } });
      assert.equal(membership?.role, "ADMIN");
      assert.equal(membership?.isActive, true);
    } finally {
      setIntegrationTestSession(null);
      if (createdWorkspaceId) await prisma.workspace.delete({ where: { id: createdWorkspaceId } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

test("workspace invitation listing runtime enforces admin workspace scope", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const { hashInvitationToken } = await import("./invitation");
  const invitationsRoute = await import("../app/api/auth/invitations/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceB, admin, viewer }) => {
    await prisma.workspaceMember.create({ data: { workspaceId: workspaceB.id, userId: admin.id, role: WorkspaceRole.ADMIN } });
    const invitation = await prisma.invitation.create({ data: { workspaceId: workspaceB.id, inviterId: admin.id, email: viewer.email, role: WorkspaceRole.OPERATOR, tokenHash: hashInvitationToken("test-token-unused"), expiresAt: new Date(Date.now() + 60_000) } });
    try {
      setIntegrationTestSession(integrationSession(admin));
      const list = await invitationsRoute.GET(integrationRequest(`/api/auth/invitations?workspaceId=${workspaceB.id}`));
      assert.equal(list.status, 200, await list.clone().text());
      const body = await list.json() as { invitations: Array<{ id: string; workspaceId: string; email: string; role: string }> };
      assert.equal(body.invitations.length, 1);
      assert.equal(body.invitations[0]?.id, invitation.id);
      assert.equal(body.invitations[0]?.workspaceId, workspaceB.id);
      assert.equal(body.invitations[0]?.email, viewer.email);
      assert.equal(body.invitations[0]?.role, "OPERATOR");

      setIntegrationTestSession(integrationSession(viewer));
      const viewerList = await invitationsRoute.GET(integrationRequest(`/api/auth/invitations?workspaceId=${workspaceB.id}`));
      assert.equal(viewerList.status, 403, await viewerList.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("workspace invitation acceptance runtime enforces matching email and one-time use", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const { createInvitationToken, hashInvitationToken } = await import("./invitation");
  const acceptRoute = await import("../app/api/auth/invitations/accept/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceB, admin, viewer }) => {
    await prisma.workspaceMember.create({ data: { workspaceId: workspaceB.id, userId: admin.id, role: WorkspaceRole.ADMIN } });
    const token = createInvitationToken();
    const invitation = await prisma.invitation.create({ data: { workspaceId: workspaceB.id, inviterId: admin.id, email: viewer.email, role: WorkspaceRole.OPERATOR, tokenHash: hashInvitationToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    try {
      setIntegrationTestSession(integrationSession(viewer));
      const accepted = await acceptRoute.POST(integrationRequest("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }));
      assert.equal(accepted.status, 200, await accepted.clone().text());
      const body = await accepted.json() as { workspace: { id: string }; role: string };
      assert.equal(body.workspace.id, workspaceB.id);
      assert.equal(body.role, "OPERATOR");
      const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: workspaceB.id, userId: viewer.id } } });
      assert.equal(membership?.role, "OPERATOR");
      assert.equal(membership?.isActive, true);
      assert.ok((await prisma.invitation.findUnique({ where: { id: invitation.id } }))?.acceptedAt);

      const duplicate = await acceptRoute.POST(integrationRequest("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }));
      assert.equal(duplicate.status, 404, await duplicate.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("workspace invitation acceptance rejects email mismatch and expired tokens", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const { createInvitationToken, hashInvitationToken } = await import("./invitation");
  const acceptRoute = await import("../app/api/auth/invitations/accept/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceB, admin, viewer }) => {
    await prisma.workspaceMember.create({ data: { workspaceId: workspaceB.id, userId: admin.id, role: WorkspaceRole.ADMIN } });
    const mismatchToken = createInvitationToken();
    const expiredToken = createInvitationToken();
    await prisma.invitation.createMany({ data: [
      { workspaceId: workspaceB.id, inviterId: admin.id, email: `other-${viewer.id}@test.invalid`, role: WorkspaceRole.OPERATOR, tokenHash: hashInvitationToken(mismatchToken), expiresAt: new Date(Date.now() + 60_000) },
      { workspaceId: workspaceB.id, inviterId: admin.id, email: viewer.email, role: WorkspaceRole.OPERATOR, tokenHash: hashInvitationToken(expiredToken), expiresAt: new Date(Date.now() - 60_000) },
    ] });
    try {
      setIntegrationTestSession(integrationSession(viewer));
      const mismatch = await acceptRoute.POST(integrationRequest("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: mismatchToken }) }));
      assert.equal(mismatch.status, 403, await mismatch.clone().text());
      const expired = await acceptRoute.POST(integrationRequest("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: expiredToken }) }));
      assert.equal(expired.status, 404, await expired.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("workspace invitation creation runtime enforces admin role and duplicate protection", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const invitationsRoute = await import("../app/api/auth/invitations/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ suffix, workspaceB, admin, viewer }) => {
    await prisma.workspaceMember.create({ data: { workspaceId: workspaceB.id, userId: admin.id, role: WorkspaceRole.ADMIN } });
    const email = `new-invite-${suffix}@test.invalid`;
    try {
      setIntegrationTestSession(integrationSession(admin));
      const created = await invitationsRoute.POST(integrationRequest("/api/auth/invitations", { method: "POST", body: JSON.stringify({ workspaceId: workspaceB.id, email, role: "OPERATOR" }) }));
      assert.equal(created.status, 201, await created.clone().text());
      const body = await created.json() as { invitation: { workspaceId: string; email: string; role: string }; delivery: string; token?: string };
      assert.equal(body.invitation.workspaceId, workspaceB.id);
      assert.equal(body.invitation.email, email);
      assert.equal(body.invitation.role, "OPERATOR");
      assert.ok(["not_configured", "sent"].includes(body.delivery));
      assert.equal("token" in body, false, "raw invitation token must never be returned");
      const stored = await prisma.invitation.findFirst({ where: { workspaceId: workspaceB.id, email, acceptedAt: null } });
      assert.ok(stored?.tokenHash);

      const duplicate = await invitationsRoute.POST(integrationRequest("/api/auth/invitations", { method: "POST", body: JSON.stringify({ workspaceId: workspaceB.id, email, role: "OPERATOR" }) }));
      assert.equal(duplicate.status, 409, await duplicate.clone().text());

      setIntegrationTestSession(integrationSession(viewer));
      const forbidden = await invitationsRoute.POST(integrationRequest("/api/auth/invitations", { method: "POST", body: JSON.stringify({ workspaceId: workspaceB.id, email: `blocked-${suffix}@test.invalid`, role: "VIEWER" }) }));
      assert.equal(forbidden.status, 403, await forbidden.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("workspace invitation acceptance rejects anonymous and malformed requests", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const acceptRoute = await import("../app/api/auth/invitations/accept/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ viewer }) => {
    try {
      setIntegrationTestSession(null);
      const anonymous = await acceptRoute.POST(integrationRequest("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: "" }) }));
      assert.equal(anonymous.status, 401, await anonymous.clone().text());

      setIntegrationTestSession(integrationSession(viewer));
      const malformed = await acceptRoute.POST(integrationRequest("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token: "" }) }));
      assert.equal(malformed.status, 400, await malformed.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("sales plans line lifecycle runtime preserves workspace isolation", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const listRoute = await import("../app/api/sales-plans/route");
  const detailRoute = await import("../app/api/sales-plans/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, workspaceB, admin, operator, viewer, suffix }) => {
    const foreign = await prisma.salesPlan.create({ data: { workspaceId: workspaceB.id, planDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: `SP-B-${suffix}`, vendorName: "B", item: "B", quantity: 1, unitPrice: 10, amount: 10, vat: 0, total: 10, status: "confirmed", closed: false } });
    try {
      setIntegrationTestSession(integrationSession(operator));
      const created = await listRoute.POST(integrationRequest("/api/sales-plans", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, planDate: "2026-01-02", vendorName: "A", lines: [{ itemName: "Line A", itemCode: `ITEM-${suffix}`, qty: 2, unitPrice: 15, supply: 30, vat: 3, total: 33 }] }) }));
      assert.equal(created.status, 201, await created.clone().text());
      const createdBody = await created.json() as { id: string; lines?: Array<{ itemName: string; qty: number }> };
      assert.equal(createdBody.lines?.length, 1);
      assert.equal(createdBody.lines?.[0]?.itemName, "Line A");
      const readBack = await prisma.salesPlan.findUnique({ where: { id: createdBody.id }, include: { lines: true } });
      assert.equal(readBack?.workspaceId, workspaceA.id);
      assert.equal(readBack?.lines.length, 1);
      assert.equal(readBack?.lines[0]?.qty, 2);

      setIntegrationTestSession(integrationSession(viewer));
      const viewerWrite = await listRoute.POST(integrationRequest("/api/sales-plans", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, item: "blocked" }) }));
      assert.equal(viewerWrite.status, 403, await viewerWrite.clone().text());

      setIntegrationTestSession(integrationSession(admin));
      const cross = await detailRoute.GET(integrationRequest(`/api/sales-plans/${foreign.id}?workspaceId=${workspaceB.id}`), { params: Promise.resolve({ id: foreign.id }) });
      assert.equal(cross.status, 403, await cross.clone().text());
      const foreignOwn = await detailRoute.GET(integrationRequest(`/api/sales-plans/${foreign.id}?workspaceId=${workspaceA.id}`), { params: Promise.resolve({ id: foreign.id }) });
      assert.equal(foreignOwn.status, 404, await foreignOwn.clone().text());
      assert.equal((await prisma.salesPlan.findUnique({ where: { id: foreign.id } }))?.workspaceId, workspaceB.id);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("purchase request attachment limits preserve authorization boundaries", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const route = await import("../app/api/purchase-requests/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, operator, viewer }) => {
    try {
      const payload = { workspaceId: workspaceA.id, item: "oversized", attachments: [{ fileName: "too-large.pdf", mimeType: "application/pdf", size: 5 * 1024 * 1024 + 1, dataUrl: "data:application/pdf;base64,AA==" }] };
      setIntegrationTestSession(integrationSession(operator));
      const oversized = await route.POST(integrationRequest("/api/purchase-requests", { method: "POST", body: JSON.stringify(payload) }));
      assert.equal(oversized.status, 400, await oversized.clone().text());
      assert.equal(await prisma.purchaseRequest.count({ where: { workspaceId: workspaceA.id } }), 0);

      setIntegrationTestSession(integrationSession(viewer));
      const viewerWrite = await route.POST(integrationRequest("/api/purchase-requests", { method: "POST", body: JSON.stringify({ workspaceId: workspaceA.id, item: "blocked" }) }));
      assert.equal(viewerWrite.status, 403, await viewerWrite.clone().text());
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("purchase request attachment update remains workspace scoped", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const detailRoute = await import("../app/api/purchase-requests/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, workspaceB, admin, operator, viewer, suffix }) => {
    const rowA = await prisma.purchaseRequest.create({ data: { workspaceId: workspaceA.id, requestDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: `PR-A-${suffix}`, vendorName: "A", item: "A", quantity: 1, amount: 10, status: "unconfirmed" } });
    const rowB = await prisma.purchaseRequest.create({ data: { workspaceId: workspaceB.id, requestDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: `PR-B-${suffix}`, vendorName: "B", item: "B", quantity: 1, amount: 10, status: "unconfirmed" } });
    try {
      const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
      setIntegrationTestSession(integrationSession(operator));
      const updated = await detailRoute.PATCH(integrationRequest(`/api/purchase-requests/${rowA.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, item: "A updated", attachments: [{ fileName: "quote.pdf", mimeType: "application/pdf", size: 2, dataUrl: "data:application/pdf;base64,AA==" }] }) }), ctx(rowA.id));
      assert.equal(updated.status, 200, await updated.clone().text());
      const body = await updated.json() as { item: string; attachments?: Array<{ fileName: string }> };
      assert.equal(body.item, "A updated");
      assert.equal(body.attachments?.[0]?.fileName, "quote.pdf");
      assert.equal((await prisma.purchaseRequest.findUnique({ where: { id: rowA.id } }))?.workspaceId, workspaceA.id);

      setIntegrationTestSession(integrationSession(viewer));
      const viewerPatch = await detailRoute.PATCH(integrationRequest(`/api/purchase-requests/${rowA.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, item: "blocked" }) }), ctx(rowA.id));
      assert.equal(viewerPatch.status, 403, await viewerPatch.clone().text());

      setIntegrationTestSession(integrationSession(admin));
      const cross = await detailRoute.PATCH(integrationRequest(`/api/purchase-requests/${rowB.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceB.id, item: "tampered" }) }), ctx(rowB.id));
      assert.equal(cross.status, 403, await cross.clone().text());
      const foreignOwn = await detailRoute.PATCH(integrationRequest(`/api/purchase-requests/${rowB.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, item: "tampered" }) }), ctx(rowB.id));
      assert.equal(foreignOwn.status, 404, await foreignOwn.clone().text());
      assert.equal((await prisma.purchaseRequest.findUnique({ where: { id: rowB.id } }))?.item, "B");
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("sales plan status update and delete roles remain isolated", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const detailRoute = await import("../app/api/sales-plans/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, operator, admin, suffix }) => {
    const row = await prisma.salesPlan.create({ data: { workspaceId: workspaceA.id, planDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: `SP-U-${suffix}`, vendorName: "A", item: "A", quantity: 1, unitPrice: 10, amount: 10, vat: 0, total: 10, status: "confirmed", closed: false } });
    const ctx = { params: Promise.resolve({ id: row.id }) };
    try {
      setIntegrationTestSession(integrationSession(operator));
      const updated = await detailRoute.PATCH(integrationRequest(`/api/sales-plans/${row.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, status: "completed", closed: true }) }), ctx);
      assert.equal(updated.status, 200, await updated.clone().text());
      const body = await updated.json() as { status: string; closed: boolean };
      assert.equal(body.status, "completed");
      assert.equal(body.closed, true);
      const readBack = await prisma.salesPlan.findUnique({ where: { id: row.id } });
      assert.equal(readBack?.status, "completed");
      assert.equal(readBack?.closed, true);

      const operatorDelete = await detailRoute.DELETE(integrationRequest(`/api/sales-plans/${row.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), ctx);
      assert.equal(operatorDelete.status, 403, await operatorDelete.clone().text());
      setIntegrationTestSession(integrationSession(admin));
      const adminDelete = await detailRoute.DELETE(integrationRequest(`/api/sales-plans/${row.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), ctx);
      assert.equal(adminDelete.status, 200, await adminDelete.clone().text());
      assert.equal(await prisma.salesPlan.findUnique({ where: { id: row.id } }), null);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("purchase request status update and delete roles remain isolated", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const detailRoute = await import("../app/api/purchase-requests/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, operator, admin, suffix }) => {
    const row = await prisma.purchaseRequest.create({ data: { workspaceId: workspaceA.id, requestDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: `PR-U-${suffix}`, vendorName: "A", item: "A", quantity: 1, amount: 10, status: "unconfirmed" } });
    const ctx = { params: Promise.resolve({ id: row.id }) };
    try {
      setIntegrationTestSession(integrationSession(operator));
      const updated = await detailRoute.PATCH(integrationRequest(`/api/purchase-requests/${row.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, status: "confirmed" }) }), ctx);
      assert.equal(updated.status, 200, await updated.clone().text());
      const body = await updated.json() as { status: string };
      assert.equal(body.status, "confirmed");
      assert.equal((await prisma.purchaseRequest.findUnique({ where: { id: row.id } }))?.status, "confirmed");

      const operatorDelete = await detailRoute.DELETE(integrationRequest(`/api/purchase-requests/${row.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), ctx);
      assert.equal(operatorDelete.status, 403, await operatorDelete.clone().text());
      setIntegrationTestSession(integrationSession(admin));
      const adminDelete = await detailRoute.DELETE(integrationRequest(`/api/purchase-requests/${row.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), ctx);
      assert.equal(adminDelete.status, 200, await adminDelete.clone().text());
      assert.equal(await prisma.purchaseRequest.findUnique({ where: { id: row.id } }), null);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("quotation status update and delete roles remain isolated", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const detailRoute = await import("../app/api/quotations/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, operator, admin, suffix }) => {
    const row = await prisma.quotation.create({ data: { workspaceId: workspaceA.id, quoteDate: new Date("2026-01-01T00:00:00.000Z"), slipNo: `QT-U-${suffix}`, vendorName: "A", item: "A", quantity: 1, amount: 10, vat: 0, total: 10, status: "draft", lines: { create: [{ itemName: "A", qty: 1, unitPrice: 10, supply: 10, vat: 0, total: 10 }] } } });
    const ctx = { params: Promise.resolve({ id: row.id }) };
    try {
      setIntegrationTestSession(integrationSession(operator));
      const updated = await detailRoute.PATCH(integrationRequest(`/api/quotations/${row.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, status: "sent" }) }), ctx);
      assert.equal(updated.status, 200, await updated.clone().text());
      const body = await updated.json() as { status: string };
      assert.equal(body.status, "sent");
      assert.equal((await prisma.quotation.findUnique({ where: { id: row.id } }))?.status, "sent");

      const operatorDelete = await detailRoute.DELETE(integrationRequest(`/api/quotations/${row.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), ctx);
      assert.equal(operatorDelete.status, 403, await operatorDelete.clone().text());
      setIntegrationTestSession(integrationSession(admin));
      const adminDelete = await detailRoute.DELETE(integrationRequest(`/api/quotations/${row.id}?workspaceId=${workspaceA.id}`, { method: "DELETE" }), ctx);
      assert.equal(adminDelete.status, 200, await adminDelete.clone().text());
      assert.equal(await prisma.quotation.findUnique({ where: { id: row.id } }), null);
    } finally {
      setIntegrationTestSession(null);
    }
  });
});

test("quotation line update remains workspace scoped", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const detailRoute = await import("../app/api/quotations/[id]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, workspaceB, operator, viewer, admin, suffix }) => {
    const make = (workspaceId: string, slipNo: string, item: string) => prisma.quotation.create({ data: { workspaceId, quoteDate: new Date("2026-01-01T00:00:00.000Z"), slipNo, vendorName: item, item, quantity: 1, amount: 10, vat: 0, total: 10, status: "draft", lines: { create: [{ itemName: item, qty: 1, unitPrice: 10, supply: 10, vat: 0, total: 10 }] } } });
    const rowA = await make(workspaceA.id, `QT-LA-${suffix}`, "A");
    const rowB = await make(workspaceB.id, `QT-LB-${suffix}`, "B");
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
    try {
      setIntegrationTestSession(integrationSession(operator));
      const updated = await detailRoute.PATCH(integrationRequest(`/api/quotations/${rowA.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, lines: [{ itemName: "A updated", qty: 2, unitPrice: 12, supply: 24, vat: 0, total: 24 }] }) }), ctx(rowA.id));
      assert.equal(updated.status, 200, await updated.clone().text());
      const body = await updated.json() as { lines?: Array<{ itemName: string; qty: number }> };
      assert.equal(body.lines?.[0]?.itemName, "A updated");
      assert.equal(body.lines?.[0]?.qty, 2);
      const readBack = await prisma.quotation.findUnique({ where: { id: rowA.id }, include: { lines: true } });
      assert.equal(readBack?.lines[0]?.itemName, "A updated");
      assert.equal(readBack?.lines[0]?.qty, 2);

      setIntegrationTestSession(integrationSession(viewer));
      const viewerPatch = await detailRoute.PATCH(integrationRequest(`/api/quotations/${rowA.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, lines: [{ itemName: "blocked", qty: 1, unitPrice: 1, supply: 1, vat: 0, total: 1 }] }) }), ctx(rowA.id));
      assert.equal(viewerPatch.status, 403, await viewerPatch.clone().text());
      setIntegrationTestSession(integrationSession(admin));
      const foreignOwn = await detailRoute.PATCH(integrationRequest(`/api/quotations/${rowB.id}`, { method: "PATCH", body: JSON.stringify({ workspaceId: workspaceA.id, lines: [{ itemName: "tampered", qty: 1, unitPrice: 1, supply: 1, vat: 0, total: 1 }] }) }), ctx(rowB.id));
      assert.equal(foreignOwn.status, 404, await foreignOwn.clone().text());
      assert.equal((await prisma.quotation.findUnique({ where: { id: rowB.id } }))?.item, "B");
    } finally { setIntegrationTestSession(null); }
  });
});

test("item code rename allows unused items and rejects referenced items with workspace isolation", { skip: !enabled }, async () => {
  const { prisma } = await import("./prisma");
  const { setIntegrationTestSession } = await import("./auth-guards");
  const { WorkspaceRole } = await import("@prisma/client");
  const detailRoute = await import("../app/api/items/[code]/route");

  await withWorkspaceFixture(prisma, WorkspaceRole, async ({ workspaceA, workspaceB, operator, suffix }) => {
    const unusedCode = `IU${suffix.slice(-8).toUpperCase()}`;
    const renamedCode = `IR${suffix.slice(-8).toUpperCase()}`;
    const usedCode = `IX${suffix.slice(-8).toUpperCase()}`;
    const foreignCode = `IF${suffix.slice(-8).toUpperCase()}`;
    const unused = await prisma.item.create({ data: { workspaceId: workspaceA.id, code: unusedCode, name: "unused", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false } });
    const used = await prisma.item.create({ data: { workspaceId: workspaceA.id, code: usedCode, name: "used", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false } });
    await prisma.stockBalance.create({ data: { workspaceId: workspaceA.id, warehouseCode: `WH${suffix.slice(-6).toUpperCase()}`, warehouseName: "warehouse", itemCode: usedCode, itemName: "used", qty: 1 } });
    const foreign = await prisma.item.create({ data: { workspaceId: workspaceB.id, code: foreignCode, name: "foreign", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false } });
    const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
    try {
      setIntegrationTestSession(integrationSession(operator));
      const unusedRename = await detailRoute.PUT(integrationRequest(`/api/items/${unusedCode}`, { method: "PUT", body: JSON.stringify({ workspaceId: workspaceA.id, code: renamedCode, name: "renamed", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false }) }), ctx(unusedCode));
      assert.equal(unusedRename.status, 200, await unusedRename.clone().text());
      assert.equal((await prisma.item.findUnique({ where: { id: unused.id } }))?.code, renamedCode);
      const renameAudit = await prisma.auditLog.findFirst({ where: { workspaceId: workspaceA.id, resourceId: unused.id, action: "RENAME" }, orderBy: { createdAt: "desc" } });
      assert.equal(renameAudit?.resourceCode, renamedCode);
      assert.equal(renameAudit?.actorUserId, operator.id);

      const usedRename = await detailRoute.PUT(integrationRequest(`/api/items/${usedCode}`, { method: "PUT", body: JSON.stringify({ workspaceId: workspaceA.id, code: `IY${suffix.slice(-8).toUpperCase()}`, name: "blocked", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false }) }), ctx(usedCode));
      assert.equal(usedRename.status, 409, await usedRename.clone().text());
      const usedReadBack = await prisma.item.findUnique({ where: { id: used.id } });
      assert.equal(usedReadBack?.code, usedCode); const deniedAudit = await prisma.auditLog.findFirst({ where: { workspaceId: workspaceA.id, resourceId: used.id, action: "ACCESS_DENIED" }, orderBy: { createdAt: "desc" } }); assert.equal(deniedAudit?.resourceCode, usedCode); assert.equal(deniedAudit?.actorUserId, operator.id);

      const crossWorkspace = await detailRoute.PUT(integrationRequest(`/api/items/${foreignCode}`, { method: "PUT", body: JSON.stringify({ workspaceId: workspaceB.id, code: `IZ${suffix.slice(-8).toUpperCase()}`, name: "tampered", inboundPrice: 1, outboundPrice: 2, inboundVatIncluded: false, outboundVatIncluded: false }) }), ctx(foreignCode));
      assert.equal(crossWorkspace.status, 403, await crossWorkspace.clone().text());
      assert.equal((await prisma.item.findUnique({ where: { id: foreign.id } }))?.code, foreignCode);
    } finally { setIntegrationTestSession(null); }
  });
});

after(async () => {
  if (!enabled) return;
  const { prisma } = await import("./prisma");
  await prisma.$disconnect();
});