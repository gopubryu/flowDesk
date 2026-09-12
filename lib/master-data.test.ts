import test from "node:test";
import assert from "node:assert/strict";
import {
  MasterDataValidationError,
  normalizeEmployee,
  normalizeWarehouse,
  normalizeVendor,
  normalizeDepartment,
  normalizeItem,
  nextCode,
} from "./master-data";

test("employee input trims fields and rejects missing required values", () => {
  assert.deepEqual(normalizeEmployee({ code: " e006 ", name: " 홍길동 ", phone: " ", departmentCode: " d001 " }), {
    code: "E006",
    name: "홍길동",
    phone: null,
    email: null,
    memo: null,
    departmentCode: "D001",
  });
  assert.throws(() => normalizeEmployee({ code: " ", name: "홍길동" }), MasterDataValidationError);
});

test("warehouse input normalizes codes and optional values", () => {
  assert.deepEqual(normalizeWarehouse({ code: " w007 ", name: " 신규창고 ", memo: " 수도권 " }), {
    code: "W007",
    name: "신규창고",
    memo: "수도권",
  });
});

test("vendor input validates code type and preserves all supported fields", () => {
  assert.deepEqual(normalizeVendor({
    code: " v006 ", name: " 새 거래처 ", codeType: "사업자등록번호", bizRegNo: " 123 ", email: " ",
  }), {
    code: "V006", name: "새 거래처", codeType: "사업자등록번호", bizRegNo: "123",
    ceo: null, businessType: null, businessItem: null, phone: null, fax: null, mobile: null,
    address: null, homepage: null, contactPerson: null, email: null,
  });
  assert.throws(
    () => normalizeVendor({ code: "V006", name: "새 거래처", codeType: "invalid" }),
    MasterDataValidationError
  );
});

test("department input normalizes code/name and rejects missing values", () => {
  assert.deepEqual(normalizeDepartment({ code: " d001 ", name: " 구매부 ", memo: "  발주 담당  " }), {
    code: "D001", name: "구매부", memo: "발주 담당",
  });
  assert.throws(() => normalizeDepartment({ code: "D001", name: " " }), MasterDataValidationError);
});

test("item input rejects negative stock policies and normalizes numeric defaults", () => {
  assert.deepEqual(normalizeItem({ code: " i008 ", name: " 신규품목 ", unit: " EA ", minStock: "5", inboundPrice: "1000", outboundPrice: 1500 }), {
    code: "I008", name: "신규품목", spec: null, unit: "EA", minStock: 5,
    inboundPrice: 1000, inboundVatIncluded: false, outboundPrice: 1500, outboundVatIncluded: false,
  });
  assert.throws(() => normalizeItem({ code: "I008", name: "신규품목", minStock: -1 }), MasterDataValidationError);
});
test("nextCode ignores unrelated codes and pads the next numeric suffix", () => {
  assert.equal(nextCode([{ code: "E001" }, { code: "e009" }, { code: "OTHER" }], "E"), "E010");
  assert.equal(nextCode([], "W"), "W001");
});
