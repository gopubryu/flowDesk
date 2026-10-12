import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForURL(/\/sign-in\?reason=session-expired&next=%2Fdashboard$/, { timeout: 10_000 });
    assert.match(page.url(), /\/sign-in\?reason=session-expired&next=%2Fdashboard$/);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
