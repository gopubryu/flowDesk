import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  try {
    // 1) No session cookie: the server must redirect before any protected page HTML is rendered.
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    const response = await anonymousPage.goto(`${base}/sales-plans`, { waitUntil: "domcontentloaded" });
    const redirectedFrom = response?.request().redirectedFrom();
    assert.ok(redirectedFrom, "expected a server redirect for /sales-plans without a session cookie");
    assert.equal(new URL(redirectedFrom.url()).pathname, "/sales-plans");
    const redirectResponse = await redirectedFrom.response();
    assert.ok(redirectResponse && [302, 303, 307, 308].includes(redirectResponse.status()), "expected an HTTP redirect status");
    assert.match(anonymousPage.url(), /\/sign-in\?next=%2Fsales-plans$/);
    await anonymous.close();

    // 2) Cookie present but session invalid/expired: page loads, API returns 401, client redirects as session-expired.
    const stale = await browser.newContext();
    await stale.addCookies([{ name: "better-auth.session_token", value: "expired-e2e-token", url: base }]);
    const stalePage = await stale.newPage();
    await stalePage.goto(`${base}/dashboard`, { waitUntil: "domcontentloaded" });
    await stalePage.waitForURL(/\/sign-in\?reason=session-expired&next=%2Fdashboard$/, { timeout: 10_000 });
    await stale.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
