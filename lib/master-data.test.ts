import test from "node:test";
import assert from "node:assert/strict";
import {
  MasterDataValidationError,
  normalizeEmployee,
  normalizeWarehouse,
  normalizeVendor,
  nextCode,
} from "./master-data";

test("employee input trims fields and rejects missing required values", () => {
  assert.deepEqual(normalizeEmployee({ code: " e006 ", name: " 홍길동 ", phone: " " }), {
    code: "E006",
    name: "홍길동",
    phone: null,
    email: null,
    memo: null,
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

test("nextCode ignores unrelated codes and pads the next numeric suffix", () => {
  assert.equal(nextCode([{ code: "E001" }, { code: "e009" }, { code: "OTHER" }], "E"), "E010");
  assert.equal(nextCode([], "W"), "W001");
});
