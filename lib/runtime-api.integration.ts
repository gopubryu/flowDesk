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

after(async () => {
  if (!enabled) return;
  const { prisma } = await import("./prisma");
  await prisma.$disconnect();
});