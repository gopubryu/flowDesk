import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteRecordByCode,
  filterRecords,
  updateRecordByCode,
} from "./master-data-utils";

type Row = { code: string; name: string; memo?: string };

const rows: Row[] = [
  { code: "E001", name: "김민수", memo: "구매팀" },
  { code: "E002", name: "이서연", memo: "영업팀" },
];

test("filterRecords searches all configured fields case-insensitively", () => {
  assert.deepEqual(filterRecords(rows, " e001 ", ["code", "name", "memo"]), [rows[0]]);
  assert.deepEqual(filterRecords(rows, "영업", ["code", "name", "memo"]), [rows[1]]);
  assert.deepEqual(filterRecords(rows, "", ["code", "name"]), rows);
});

test("deleteRecordByCode removes only a case-insensitive code match", () => {
  assert.deepEqual(deleteRecordByCode(rows, "e001"), [rows[1]]);
  assert.deepEqual(deleteRecordByCode(rows, "missing"), rows);
});

test("updateRecordByCode replaces in place and supports changing the code", () => {
  const updated = { code: "E010", name: "김민수 수정", memo: "관리팀" };
  assert.deepEqual(updateRecordByCode(rows, "e001", updated), [updated, rows[1]]);
  assert.deepEqual(updateRecordByCode(rows, "missing", updated), rows);
});
