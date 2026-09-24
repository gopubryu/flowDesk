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
  { route: "app/api/items/[code]/route.ts", reads: true, writes: true, deletes: true },
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

function methodBlocks(source: string) {
  const matches = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)];
  return matches.map((match, index) => ({
    method: match[1],
    body: source.slice(match.index ?? 0, matches[index + 1]?.index ?? source.length),
  }));
}

function authorizationScope(source: string, body: string) {
  if (!body.includes("requestedWorkspace")) return body;
  const helper = source.match(/async function requestedWorkspace\([\s\S]*?return requireResolvedWorkspace\([\s\S]*?\);?\s*}/);
  return `${body} ${helper?.[0] ?? ""}`;
}

function hasRoles(source: string, roles: string[]) {
  const normalized = source.replace(/\s+/g, " ");
  return normalized.includes(`[${roles.join(", ")}]`);
}

function validateHandler(source: string, contract: RouteContract) {
  const errors: string[] = [];
  if (!source.includes("requireResolvedWorkspace(")) errors.push("shared workspace guard missing");
  for (const { method, body } of methodBlocks(source)) {
    const scope = authorizationScope(source, body);
    if (!body.includes("workspaceId")) errors.push(`${method} workspace scope missing`);

    if (method === "GET") {
      if (!contract.reads || !hasRoles(scope, ["WorkspaceRole.ADMIN", "WorkspaceRole.OPERATOR", "WorkspaceRole.VIEWER"])) errors.push(`${method} read role policy invalid`);
    } else if (method === "DELETE") {
      if (!contract.deletes || !hasRoles(scope, ["WorkspaceRole.ADMIN"])) errors.push(`${method} delete role policy invalid`);
    } else if (!contract.writes || !hasRoles(scope, ["WorkspaceRole.ADMIN", "WorkspaceRole.OPERATOR"]) || /body\??\.(?:role|userId)/.test(body)) {
      errors.push(`${method} write role policy invalid`);
    }
  }
  return errors;
}

for (const contract of contracts) {
  test(`${contract.route} enforces shared workspace authorization`, () => {
    const source = readRoute(contract.route);
    assert.deepEqual(validateHandler(source, contract), [], contract.route);
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

test("items route is connected to the scoped orchestration helpers", () => {
  const source = readRoute("app/api/items/route.ts");
  assert.match(source, /listItemsForWorkspace\(prisma, workspaceId\)/);
  assert.match(source, /createItemForWorkspace\(prisma, data, workspace\.workspaceId\)/);
  assert.doesNotMatch(source, /prisma\.item\.create\(\{\s*data:/);
  assert.doesNotMatch(source, /prisma\.item\.findMany\(\{\s*where:\s*\{\}/);
});

test("authorization contracts detect six representative RBAC/workspace mutants", () => {
  const contract: RouteContract = { route: "mutation-fixture", reads: true, writes: true, deletes: true };
  const valid = `export async function GET() { await requireResolvedWorkspace(id, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]); return prisma.item.findMany({ where: { workspaceId } }); } export async function POST() { await requireResolvedWorkspace(id, [WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]); return prisma.item.create({ data: { workspaceId } }); } export async function DELETE() { await requireResolvedWorkspace(id, [WorkspaceRole.ADMIN]); return prisma.item.deleteMany({ where: { workspaceId } }); }`;
  const mutants = [
    valid.replace("WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER", "WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR"),
    valid.replace("WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]); return prisma.item.create", "WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR, WorkspaceRole.VIEWER]); return prisma.item.create"),
    valid.replace("await requireResolvedWorkspace(id, [WorkspaceRole.ADMIN]); return prisma.item.deleteMany", "return prisma.item.deleteMany"),
    valid.replace("where: { workspaceId }", "where: { code: id }"),
    valid.replace("[WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]); return prisma.item.create", "[WorkspaceRole.ADMIN]); return prisma.item.create"),
    valid.replace("[WorkspaceRole.ADMIN]); return prisma.item.deleteMany", "[WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]); return prisma.item.deleteMany"),
  ];
  for (const mutant of mutants) assert.notDeepEqual(validateHandler(mutant, contract), [], mutant);
  assert.deepEqual(validateHandler(valid, contract), []);
});
