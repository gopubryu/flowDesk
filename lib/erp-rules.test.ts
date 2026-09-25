import test from "node:test";
import assert from "node:assert/strict";
import { adjustmentDelta, aggregateQtyByItem, canDeletePurchase, canTransitionPurchase, canTransitionPurchaseRequest, groupRelatedLines, validDateOnly, validateImportAmounts, validateLinkedQuantities, validatePurchaseInput } from "./erp-rules";

test("adjustment uses server balance and treats book quantity as OCC only", () => {
  assert.deepEqual(adjustmentDelta(10, 7, 10), { delta: -3 });
  assert.equal(adjustmentDelta(11, 7, 10).conflict, true);
  assert.ok(adjustmentDelta(10, -1).error);
});
test("date validation and duplicate item aggregation are strict", () => {
  assert.equal(validDateOnly("2026-02-29"), false);
  assert.equal(validDateOnly("2028-02-29"), true);
  assert.equal(aggregateQtyByItem([{ itemCode: "A", qty: 2 }, { itemCode: "A", qty: 3 }]).get("A"), 5);
});
test("purchase request lifecycle does not allow reversal from completed", () => {
  assert.equal(canTransitionPurchaseRequest("unconfirmed", "confirmed"), true);
  assert.equal(canTransitionPurchaseRequest("completed", "confirmed"), false);
});
test("purchase validation rejects missing vendor, invalid items, quantities, and money", () => {
  const line = { itemCode: "I1", itemName: "Item", qty: 1, unitPrice: 0, supply: 0, vat: 0, total: 0 };
  assert.equal(validatePurchaseInput("Vendor", [line]), null);
  assert.ok(validatePurchaseInput("", [line]));
  assert.ok(validatePurchaseInput("Vendor", [{ ...line, qty: 0 }]));
  assert.ok(validatePurchaseInput("Vendor", [{ ...line, total: Number.NaN }]));
});

test("import amounts enforce currency, precision, positive rate and non-negative won values", () => {
  assert.equal(validateImportAmounts({ currency: "JPY", foreignAmount: "100", customsExchangeRate: "9.1234", baseAmount: "912", importVatBaseAmount: "1000", importVat: "100" }), null);
  assert.match(validateImportAmounts({ currency: "JPY", foreignAmount: "100.01", customsExchangeRate: "9.1234", baseAmount: "9", importVatBaseAmount: "10", importVat: "1" }) ?? "", /JPY/);
  assert.match(validateImportAmounts({ currency: "USD", foreignAmount: "1.234", customsExchangeRate: "1300", baseAmount: "1300", importVatBaseAmount: "1300", importVat: "130" }) ?? "", /foreignAmount/);
  assert.match(validateImportAmounts({ currency: "USD", foreignAmount: "1", customsExchangeRate: "0", baseAmount: "0", importVatBaseAmount: "0", importVat: "0" }) ?? "", /customsExchangeRate/);
  assert.match(validateImportAmounts({ currency: "USD", foreignAmount: "1", customsExchangeRate: "1300", baseAmount: "-1", importVatBaseAmount: "0", importVat: "0" }) ?? "", /baseAmount/);
});

test("linked quantities reject unknown items, over-quantity, and repeated processing", () => {
  const planned = new Map([["A", 5], ["B", 2]]);
  assert.equal(validateLinkedQuantities(planned, new Map(), new Map([["A", 2]])), null);
  assert.match(validateLinkedQuantities(planned, new Map(), new Map([["C", 1]])) ?? "", /unknown item/i);
  assert.match(validateLinkedQuantities(planned, new Map([["A", 4]]), new Map([["A", 2]])) ?? "", /remaining/i);
  assert.match(validateLinkedQuantities(planned, new Map([["A", 5]]), new Map([["A", 1]])) ?? "", /remaining/i);
});

test("linked quantity validation rejects malformed, negative, and non-finite quantities", () => {
  assert.match(validateLinkedQuantities(new Map([["A", 5]]), new Map(), new Map([["A", Number.NaN]])) ?? "", /finite/i);
  assert.match(validateLinkedQuantities(new Map([["A", 5]]), new Map(), new Map([["A", -1]])) ?? "", /non-negative/i);
});

test("purchase bulk operations allow only legal lifecycle changes and unreceived deletes", () => {
  assert.equal(canTransitionPurchase("approval", "unconfirmed"), true);
  assert.equal(canTransitionPurchase("confirmed", "approval"), false);
  assert.equal(canTransitionPurchase("confirmed", "confirmed"), true);
  assert.equal(canDeletePurchase("approval", "none"), true);
  assert.equal(canDeletePurchase("confirmed", "none"), true);
  assert.equal(canDeletePurchase("confirmed", "partial"), false);
  assert.equal(canDeletePurchase("approval", "partial"), false);
  assert.equal(canDeletePurchase("unconfirmed", "complete"), false);
});

test("related line groups retain each line's related id and aggregate duplicate item quantities", () => {
  const groups = groupRelatedLines([
    { relatedType: "purchase", relatedId: "p1", itemCode: "A", qty: 2 },
    { relatedType: "purchase", relatedId: "p1", itemCode: "A", qty: 3 },
    { relatedType: "purchase", relatedId: "p2", itemCode: "A", qty: 1 },
  ]);
  assert.equal(groups.get("purchase:p1")?.get("A"), 5);
  assert.equal(groups.get("purchase:p2")?.get("A"), 1);
});
