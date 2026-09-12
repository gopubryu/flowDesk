import test from "node:test";
import assert from "node:assert/strict";
import {
  QuotationValidationError,
  assertQuotationConvertible,
  assertQuotationMutable,
  calculateQuotationTotals,
  normalizeQuotationInput,
  nextQuotationSlipNo,
} from "./quotation-domain";
import { quotationToSalesPlanData } from "./quotation-conversion";

const validInput = {
  quoteDate: "2026-09-12",
  vendorCode: " v001 ",
  vendorName: " 한빛상사 ",
  managerCode: " e001 ",
  managerName: " 김민수 ",
  taxType: "과세",
  lines: [
    { itemCode: " i001 ", itemName: " 스테인리스 볼트 M8 ", spec: " M8×20 ", unit: " EA ", qty: "2", unitPrice: "1000", supply: 1, vat: 1, total: 2 },
  ],
};

test("quotation input is normalized and server totals replace client totals", () => {
  const normalized = normalizeQuotationInput(validInput);
  assert.equal(normalized.vendorCode, "V001");
  assert.equal(normalized.managerCode, "E001");
  assert.equal(normalized.lines[0].itemCode, "I001");
  assert.deepEqual(calculateQuotationTotals(normalized.lines, normalized.taxType), {
    quantity: 2,
    amount: 2000,
    vat: 200,
    total: 2200,
    lines: [{ ...normalized.lines[0], supply: 2000, vat: 200, total: 2200, sortOrder: 0 }],
  });
});

test("quotation validation rejects missing vendor, invalid status, duplicate lines, quantity, and price", () => {
  assert.throws(() => normalizeQuotationInput({ ...validInput, vendorName: " " }), QuotationValidationError);
  assert.throws(() => normalizeQuotationInput({ ...validInput, status: "unknown" }), QuotationValidationError);
  assert.throws(() => normalizeQuotationInput({ ...validInput, lines: [...validInput.lines, { ...validInput.lines[0], itemName: "다른 이름" }] }), QuotationValidationError);
  assert.throws(() => normalizeQuotationInput({ ...validInput, lines: [{ ...validInput.lines[0], qty: 0 }] }), QuotationValidationError);
  assert.throws(() => normalizeQuotationInput({ ...validInput, lines: [{ ...validInput.lines[0], unitPrice: -1 }] }), QuotationValidationError);
});

test("quotation lifecycle only permits legal edits, conversion, and generated numbers", () => {
  assert.doesNotThrow(() => assertQuotationMutable("draft", { linesChanged: true, slipNoChanged: true }));
  assert.doesNotThrow(() => assertQuotationMutable("sent", { linesChanged: true, slipNoChanged: true }));
  assert.throws(() => assertQuotationMutable("accepted", { linesChanged: true }), QuotationValidationError);
  assert.throws(() => assertQuotationMutable("accepted", { slipNoChanged: true }), QuotationValidationError);
  assert.throws(() => assertQuotationMutable("rejected", { linesChanged: false }), QuotationValidationError);
  assert.doesNotThrow(() => assertQuotationConvertible({ status: "accepted", validUntil: "2026-09-13", convertedSalesPlanId: null }, new Date("2026-09-12T12:00:00Z")));
  assert.throws(() => assertQuotationConvertible({ status: "sent", validUntil: null, convertedSalesPlanId: null }), QuotationValidationError);
  assert.throws(() => assertQuotationConvertible({ status: "accepted", validUntil: "2026-09-11", convertedSalesPlanId: null }, new Date("2026-09-12T12:00:00Z")), QuotationValidationError);
  assert.throws(() => assertQuotationConvertible({ status: "accepted", validUntil: null, convertedSalesPlanId: "sp1" }), QuotationValidationError);
  assert.equal(nextQuotationSlipNo("2026-09-12", ["QT-20260912-002", "QT-20260911-100"]), "QT-20260912-003");
});

test("accepted quotation conversion creates a sales-plan payload without inventory fields", () => {
  const payload = quotationToSalesPlanData({
    id: "qt1", quoteDate: new Date("2026-09-12T12:00:00Z"), slipNo: "QT-20260912-001", vendorCode: "V001", vendorName: "한빛상사", managerName: "김민수", taxType: "과세", currency: "내자", project: "P1", item: "볼트", itemCode: "I001", quantity: 2, amount: 2000, vat: 200, total: 2200,
    lines: [{ itemCode: "I001", itemName: "볼트", spec: "M8", unit: "EA", qty: 2, unitPrice: 1000, supply: 2000, vat: 200, total: 2200, extra: null, sortOrder: 0 }],
  });
  assert.equal(payload.sourceQuotationId, "qt1");
  assert.equal(payload.status, "confirmed");
  assert.equal(payload.outboundStatus, "none");
  assert.equal(payload.lines.create[0].itemName, "볼트");
  assert.equal("stockMovements" in payload, false);
  assert.equal("stockBalances" in payload, false);
});
