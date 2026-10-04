import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const editableItemCodeForms = [
  "components/purchases/purchase-form.tsx",
  "components/purchase-requests/purchase-request-form.tsx",
  "components/sales-plans/sales-plan-form.tsx",
] as const;

const itemCodeForms = [
  ...editableItemCodeForms,
  "components/quotations/quotation-form.tsx",
] as const;

test("item-code entry points expose keyboard and visible search discovery paths", () => {
  for (const file of itemCodeForms) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.match(source, /aria-label="품목 검색"/, `${file}: missing visible item-search button`);
    assert.match(source, /placeholder="코드 입력 또는 검색"/, `${file}: missing discoverable item-code placeholder`);
    assert.match(source, /onKeyDown=\{\(event\)[\s\S]*event\.key === "Enter"/, `${file}: Enter must open item search`);
    assert.match(source, /onDoubleClick=/, `${file}: preserve double-click compatibility`);
  }
});

test("item-code search controls preserve existing read-only gating", () => {
  for (const file of editableItemCodeForms) {
    const source = readFileSync(resolve(root, file), "utf8");
    assert.match(source, /placeholder="코드 입력 또는 검색"[\s\S]*readOnly=\{readOnly \|\| !allowWrite\}/, `${file}: item-code input must remain read-only`);
    assert.match(source, /disabled=\{readOnly \|\| !allowWrite\}/, `${file}: item-search button must be disabled when read-only`);
    assert.match(source, /function openItemSearch\(lineId[\s\S]*if \(readOnly \|\| !allowWrite\) return;/, `${file}: a single gated item-search opener is required`);
    assert.match(source, /onKeyDown=\{\(event\)[\s\S]*openItemSearch\(line\.id, readOnly\)/, `${file}: Enter must use the gated opener`);
    assert.match(source, /onDoubleClick=\{\(\) => openItemSearch\(line\.id, readOnly\)\}/, `${file}: double-click must use the gated opener`);
    assert.match(source, /onClick=\{\(\) => openItemSearch\(line\.id, readOnly\)\}/, `${file}: click must use the gated opener`);
  }
});
