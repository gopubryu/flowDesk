import { prisma } from "@/lib/prisma";
import { MasterDataValidationError } from "@/lib/master-data";

type MasterKind = "employee" | "department" | "warehouse" | "vendor" | "item";

type Usage = { label: string; count: () => Promise<number> };

function usage(kind: MasterKind, workspaceId: string, code: string): Usage[] {
  switch (kind) {
    case "employee":
      return [{ label: "발주서 담당자", count: () => prisma.purchaseRequest.count({ where: { workspaceId, managerCode: code } }) }];
    case "department":
      return [{ label: "소속 사원", count: () => prisma.employee.count({ where: { workspaceId, department: { code } } }) }];
    case "warehouse":
      return [
        { label: "발주서", count: () => prisma.purchaseRequest.count({ where: { workspaceId, warehouseCode: code } }) },
        { label: "구매전표", count: () => prisma.purchase.count({ where: { workspaceId, warehouseCode: code } }) },
        { label: "재고수불", count: () => prisma.stockMovement.count({ where: { workspaceId, warehouseCode: code } }) },
        { label: "재고잔고", count: () => prisma.stockBalance.count({ where: { workspaceId, warehouseCode: code } }) },
      ];
    case "vendor":
      return [
        { label: "발주서", count: () => prisma.purchaseRequest.count({ where: { workspaceId, vendorCode: code } }) },
        { label: "구매전표", count: () => prisma.purchase.count({ where: { workspaceId, vendorCode: code } }) },
        { label: "판매계획", count: () => prisma.salesPlan.count({ where: { workspaceId, vendorCode: code } }) },
        { label: "재고수불", count: () => prisma.stockMovement.count({ where: { workspaceId, vendorCode: code } }) },
      ];
    case "item":
      return [
        { label: "발주 품목", count: () => prisma.purchaseRequestLine.count({ where: { request: { workspaceId }, itemCode: code } }) },
        { label: "구매 품목", count: () => prisma.purchaseLine.count({ where: { purchase: { workspaceId }, itemCode: code } }) },
        { label: "판매 품목", count: () => prisma.salesPlanLine.count({ where: { plan: { workspaceId }, itemCode: code } }) },
        { label: "재고수불", count: () => prisma.stockMovement.count({ where: { workspaceId, itemCode: code } }) },
        { label: "재고잔고", count: () => prisma.stockBalance.count({ where: { workspaceId, itemCode: code } }) },
      ];
  }
}

async function references(kind: MasterKind, workspaceId: string, code: string) {
  const counts = await Promise.all(usage(kind, workspaceId, code).map(async ({ label, count }) => ({ label, count: await count() })));
  return counts.filter(({ count }) => count > 0);
}

export async function assertMasterCanDelete(kind: MasterKind, workspaceId: string, code: string) {
  const found = await references(kind, workspaceId, code);
  if (found.length) throw new MasterDataValidationError(`사용 중인 기준정보은 삭제할 수 없습니다. ${found.map(({ label, count }) => `${label} ${count}건`).join(", ")}`);
}

export async function assertMasterCanRename(kind: MasterKind, workspaceId: string, oldCode: string, newCode: string) {
  if (oldCode !== newCode) await assertMasterCanDelete(kind, workspaceId, oldCode);
}
