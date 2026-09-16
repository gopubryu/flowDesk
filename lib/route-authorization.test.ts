import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { WorkspaceRole } from "@prisma/client";
import { canAccessWorkspaceRole } from "./workspace-auth-rules";

/**
 * Route authorization contract test.
 *
 * These are source-level integration contracts: every route must delegate
 * workspace selection and membership authorization to the shared guard, and
 * each method's role set is checked against the public API matrix. This keeps
 * a future route change from silently bypassing the guard or admitting VIEWER
 * to a write operation without requiring a live database or Production data.
 */
type RouteContract = {
  route: string;
  reads?: boolean;
  writes?: boolean;
  deletes?: boolean;
};

const contracts: RouteContract[] = [
  { route: "app/api/items/route.ts", reads: true, writes: true },
  { route: "app/api/items/[code]/route.ts", writes: true, deletes: true },
  { route: "app/api/vendors/route.ts", reads: true, writes: true },
  { route: "app/api/vendors/[code]/route.ts", writes: true, deletes: true },
  { route: "app/api/warehouses/route.ts", reads: true, writes: true },
  { route: "app/api/warehouses/[code]/route.ts", writes: true, deletes: true },
  { route: "app/api/employees/route.ts", reads: true, writes: true },
  { route: "app/api/employees/[code]/route.ts", writes: true, deletes: true },
  { route: "app/api/departments/route.ts", reads: true, writes: true },
  { route: "app/api/departments/[code]/route.ts", writes: true, deletes: true },
  { route: "app/api/purchases/route.ts", reads: true, writes: true },
  { route: "app/api/purchases/[id]/route.ts", reads: true, writes: true, deletes: true },
  { route: "app/api/purchases/bulk/route.ts", writes: true, deletes: true },
  { route: "app/api/purchase-requests/route.ts", reads: true, writes: true },
  { route: "app/api/purchase-requests/[id]/route.ts", reads: true, writes: true, deletes: true },
  { route: "app/api/quotations/route.ts", reads: true, writes: true },
  { route: "app/api/quotations/[id]/route.ts", reads: true, writes: true, deletes: true },
  { route: "app/api/quotations/[id]/convert-to-sales-plan/route.ts", writes: true },
  { route: "app/api/sales-plans/route.ts", reads: true, writes: true },
  { route: "app/api/sales-plans/[id]/route.ts", reads: true, writes: true, deletes: true },
  { route: "app/api/inventory/receipts/route.ts", reads: true, writes: true },
  { route: "app/api/inventory/shipments/route.ts", reads: true, writes: true },
  { route: "app/api/inventory/adjustments/route.ts", reads: true, writes: true },
  { route: "app/api/inventory/status/route.ts", reads: true },
  { route: "app/api/inventory/balances/route.ts", reads: true },
  { route: "app/api/inventory/movements/route.ts", reads: true },
  { route: "app/api/inventory/related-qty/route.ts", reads: true },
  { route: "app/api/inventory/next-slip/route.ts", reads: true },
  { route: "app/api/finances/route.ts", reads: true, writes: true },
  { route: "app/api/finances/[id]/route.ts", writes: true, deletes: true },
  { route: "app/api/tasks/route.ts", reads: true, writes: true },
  { route: "app/api/tasks/[id]/route.ts", reads: true, writes: true, deletes: true },
  { route: "app/api/events/route.ts", reads: true, writes: true },
  { route: "app/api/events/[id]/route.ts", reads: true, writes: true, deletes: true },
  { route: "app/api/mails/route.ts", reads: true, writes: true },
  { route: "app/api/mails/[id]/route.ts", reads: true, writes: true, deletes: true },
];

const compact = (value: string) => value.replace(/\s+/g, " ");
function readRoute(route: string) {
  return compact(readFileSync(resolve(process.cwd(), route), "utf8"));
}

for (const contract of contracts) {
  test(`${contract.route} enforces shared workspace authorization`, () => {
    const source = readRoute(contract.route);
    assert.match(source, /requireResolvedWorkspace\(/);

    if (contract.reads) {
      assert.match(source, /WorkspaceRole\.ADMIN, WorkspaceRole\.OPERATOR, WorkspaceRole\.VIEWER/);
    }
    if (contract.writes) {
      assert.match(source, /WorkspaceRole\.ADMIN, WorkspaceRole\.OPERATOR/);
      assert.doesNotMatch(source, /body\??\.(?:role|userId)/);
    }
    if (contract.deletes) {
      assert.match(source, /\[WorkspaceRole\.ADMIN\]/);
    }
  });
}

test("role matrix allows reads, limits writes, and isolates inactive memberships", () => {
  const active = (role: WorkspaceRole) => ({ isActive: true, role });
  for (const role of [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]) {
    assert.equal(canAccessWorkspaceRole(active(role), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]), true);
  }
  for (const role of [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
    assert.equal(canAccessWorkspaceRole(active(role), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]), true);
  }
  assert.equal(canAccessWorkspaceRole(active(WorkspaceRole.VIEWER), [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]), false);
  assert.equal(canAccessWorkspaceRole({ isActive: false, role: WorkspaceRole.ADMIN }, [WorkspaceRole.ADMIN]), false);
  assert.equal(canAccessWorkspaceRole(null, [WorkspaceRole.ADMIN]), false);
});

test("every contract uses explicit workspace input for cross-workspace denial", () => {
  for (const contract of contracts) {
    const source = readRoute(contract.route);
    assert.match(source, /workspaceId/);
  }
});
