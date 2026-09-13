import test from "node:test";
import assert from "node:assert/strict";
import {
  copyPurchaseRequestToDraft,
  copyPurchaseToDraft,
  hasNonEmptyBusinessFormData,
  copySalesPlanToDraft,
  matchesSlipImport,
  normalizeImportableSlip,
  resolveInitialSlipSourceType,
  todayDateOnly,
  type ImportableSlip,
  calculateRemainingQuantity,
  calculateRemainingLineQuantities,
  mapImportedPurchaseLines,
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
  assert.equal(request.requestDate, todayDateOnly());
  assert.equal(request.status, "unconfirmed");
  assert.equal(request.slipNo, undefined);
  assert.deepEqual(request.lines, lines);
  const plan = copySalesPlanToDraft({ planDate: "2026-01-01", slipNo: "SP-1", vendorName: "Acme", status: "completed", outboundStatus: "complete", lines });
  assert.equal(plan.planDate, todayDateOnly());
  assert.equal(plan.status, "confirmed");
  assert.equal(plan.outboundStatus, "none");
  assert.equal(plan.slipNo, undefined);
});

test("purchase import identifies the source and never carries lifecycle or receipt status", () => {
  const draft = copyPurchaseToDraft({ purchaseDate: "2026-01-01", slipNo: "PO-1", vendorName: "Acme", status: "confirmed", inboundStatus: "partial", lines }, "purchase");
  assert.equal(draft.purchaseDate, todayDateOnly());
  assert.equal(draft.status, "unconfirmed");
  assert.equal(draft.inboundStatus, "none");
  assert.equal(draft.importedSlip, "구매: PO-1");
  assert.deepEqual(draft.lines, lines);
});

test("prefers a configured initial source type when available", () => {
  assert.equal(resolveInitialSlipSourceType([{ sourceType: "purchaseRequest" }, { sourceType: "purchase" }], "purchase"), "purchase");
  assert.equal(resolveInitialSlipSourceType([{ sourceType: "purchaseRequest" }], "purchase"), "purchaseRequest");
});

test("normalizes adapter records with stable source metadata and selectable lines", () => {
  const normalized = normalizeImportableSlip(
    { id: "p1", purchaseDate: "2026-09-10", slipNo: "PO-1", vendor: "Acme", item: "Bolt", lines },
    { sourceType: "purchase", sourceLabel: "구매", date: "purchaseDate", slipNo: "slipNo", vendor: "vendor", lines: "lines" },
  );
  assert.equal(normalized.sourceType, "purchase");
  assert.equal(normalized.sourceSlipNo, "PO-1");
  assert.equal(normalized.vendorName, "Acme");
  assert.deepEqual(normalized.lines, lines);
  assert.deepEqual(normalized.value.lines, lines);
});

test("normalization does not mutate the source record or its lines", () => {
  const source = { id: "p1", purchaseDate: "2026-09-10", slipNo: "PO-1", vendor: "Acme", item: "Bolt", lines };
  const before = JSON.stringify(source);
  normalizeImportableSlip(source, { sourceType: "purchase", sourceLabel: "구매", date: "purchaseDate", slipNo: "slipNo", vendor: "vendor", lines: "lines" });
  assert.equal(JSON.stringify(source), before);
});
test("purchase import maps source document and source line provenance onto selected lines", () => {
  const mapped = mapImportedPurchaseLines(
    { id: "purchase-1", sourceType: "purchaseRequest", lines: [{ id: "request-line-1", itemName: "Bolt", qty: 3 }, { id: "request-line-2", itemName: "Nut", qty: 4 }] },
    [1],
  );
  assert.deepEqual(mapped, [{ id: "request-line-2", itemName: "Nut", qty: 4, sourceType: "purchaseRequest", sourceId: "purchase-1", sourceLineId: "request-line-2" }]);
});

test("purchase import leaves provenance absent for legacy unlinked lines", () => {
  const mapped = mapImportedPurchaseLines({ id: "legacy-1", lines: [{ itemName: "Bolt", qty: 1 }] });
  assert.deepEqual(mapped, [{ itemName: "Bolt", qty: 1 }]);
});


test("remaining quantity never goes below zero and treats missing processed quantity as zero", () => {
  assert.equal(calculateRemainingQuantity(10, 3), 7);
  assert.equal(calculateRemainingQuantity(10, 12), 0);
  assert.equal(calculateRemainingQuantity(10, undefined), 10);
  assert.equal(calculateRemainingQuantity(undefined, 3), 0);
});

test("remaining line quantities match processed quantities by item code without mutating source lines", () => {
  const source = [{ itemCode: "A", qty: 10 }, { itemCode: "B", qty: 4 }, { itemCode: "A", qty: 2 }];
  const result = calculateRemainingLineQuantities(source, { A: 5, B: 9 });
  assert.deepEqual(result.map((line) => line.remainingQty), [5, 0, 2]);
  assert.deepEqual(source, [{ itemCode: "A", qty: 10 }, { itemCode: "B", qty: 4 }, { itemCode: "A", qty: 2 }]);
});

test("import replacement warning includes populated business headers even without lines", () => {
  assert.equal(hasNonEmptyBusinessFormData({ vendorName: "Acme", warehouseCode: "" }, []), true);
  assert.equal(hasNonEmptyBusinessFormData({ vendorName: "  ", warehouseCode: "" }, []), false);
  assert.equal(hasNonEmptyBusinessFormData({}, [{ itemCode: "I-1", itemName: "", qty: "" }]), true);
  assert.equal(hasNonEmptyBusinessFormData({}, [{ id: "client-only", checked: false, itemCode: "", itemName: "", qty: "" }]), false);
});
