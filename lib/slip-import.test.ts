import test from "node:test";
import assert from "node:assert/strict";
import {
  copyPurchaseRequestToDraft,
  copyPurchaseToDraft,
  hasNonEmptyBusinessFormData,
  copySalesPlanToDraft,
  matchesSlipImport,
} from "./slip-import";

const lines = [{ itemCode: "I-1", itemName: "Bolt", qty: 2, unitPrice: 100, supply: 200, vat: 20, total: 220, sortOrder: 0 }];

test("slip import matching searches date, slip, vendor, and item", () => {
  const row = { date: "2026-09-10", slipNo: "PR-001", vendorName: "Acme", item: "Bolt", lines };
  assert.equal(matchesSlipImport(row, "2026-09"), true);
  assert.equal(matchesSlipImport(row, "pr-001"), true);
  assert.equal(matchesSlipImport(row, "acme"), true);
  assert.equal(matchesSlipImport(row, "bolt"), true);
  assert.equal(matchesSlipImport(row, "washer"), false);
});

test("request and sales-plan imports retain today's date and draft status while copying header and lines", () => {
  const request = copyPurchaseRequestToDraft({ requestDate: "2026-01-01", slipNo: "RQ-1", vendorName: "Acme", status: "completed", warehouseCode: "W1", lines });
  assert.equal(request.requestDate, "2026-09-11");
  assert.equal(request.status, "unconfirmed");
  assert.equal(request.slipNo, undefined);
  assert.deepEqual(request.lines, lines);
  const plan = copySalesPlanToDraft({ planDate: "2026-01-01", slipNo: "SP-1", vendorName: "Acme", status: "completed", outboundStatus: "complete", lines });
  assert.equal(plan.planDate, "2026-09-11");
  assert.equal(plan.status, "confirmed");
  assert.equal(plan.outboundStatus, "none");
  assert.equal(plan.slipNo, undefined);
});

test("purchase import identifies the source and never carries lifecycle or receipt status", () => {
  const draft = copyPurchaseToDraft({ purchaseDate: "2026-01-01", slipNo: "PO-1", vendorName: "Acme", status: "confirmed", inboundStatus: "partial", lines }, "purchase");
  assert.equal(draft.purchaseDate, "2026-09-11");
  assert.equal(draft.status, "unconfirmed");
  assert.equal(draft.inboundStatus, "none");
  assert.equal(draft.importedSlip, "구매: PO-1");
  assert.deepEqual(draft.lines, lines);
});

test("import replacement warning includes populated business headers even without lines", () => {
  assert.equal(hasNonEmptyBusinessFormData({ vendorName: "Acme", warehouseCode: "" }, []), true);
  assert.equal(hasNonEmptyBusinessFormData({ vendorName: "  ", warehouseCode: "" }, []), false);
  assert.equal(hasNonEmptyBusinessFormData({}, [{ itemCode: "I-1", itemName: "", qty: "" }]), true);
  assert.equal(hasNonEmptyBusinessFormData({}, [{ id: "client-only", checked: false, itemCode: "", itemName: "", qty: "" }]), false);
});
