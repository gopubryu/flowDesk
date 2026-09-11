import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const forbiddenSource = {
  "components/purchase-requests/purchase-request-form.tsx": [
    "stub(",
    "보내기",
    "저장 후 인쇄",
    "LINE_TOOLBAR",
    'e.key === "F3"',
  ],
  "components/sales-plans/sales-plan-form.tsx": [
    "stub(",
    "보내기",
    "저장 후 인쇄",
    "저장/전표",
    "LINE_TOOLBAR",
  ],
  "components/purchases/purchase-form.tsx": [
    "stub(",
    "보내기",
    "저장 후 인쇄",
    "저장/전표",
    "LINE_TOOLBAR",
  ],
  "app/sales-plans/page.tsx": ["stub(", "수량조정", "다른전표생성", "onClick={() => stub(\"종결\")", "Excel"],
  "app/sales-plans/status/page.tsx": ["stub(", "설정", "인쇄", "Excel(화면)", "기본"],
  "app/api/inventory/receipts/route.ts": ["body.slipNo", "suppliedSlipNo"],
  "app/api/inventory/shipments/route.ts": ["body.slipNo", "suppliedSlipNo"],
  "app/api/inventory/adjustments/route.ts": ["allocateSlipNo("],
} as const;

test("targeted screens do not render deceptive stub controls", () => {
  for (const [file, labels] of Object.entries(forbiddenSource)) {
    const source = readFileSync(resolve(root, file), "utf8");
    for (const label of labels) {
      assert.equal(source.includes(label), false, `${file} still contains ${label}`);
    }
  }
});
