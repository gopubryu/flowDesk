import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.env.ITEM_SEARCH_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `item-search-e2e-${suffix}@example.test`;
const password = "ItemSearch-E2E-Test-Password-123!";
const itemCode = `UI-${suffix}`;
const itemName = "UI 품목 검색 검증";
let cookie = "";

function headerCookie(headers: Headers) {
  const value = headers.get("set-cookie") ?? "";
  return value.split(",").map((part) => part.trim().split(";", 1)[0]).filter(Boolean).join("; ");
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const nextCookie = headerCookie(response.headers);
  if (nextCookie) cookie = nextCookie;
  return response;
}

async function main() {
  const signUp = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name: "Item Search E2E", email, password, callbackURL: "/" }),
  });
  assert.ok(signUp.status === 200 || signUp.status === 201, `sign-up: ${await signUp.text()}`);
  assert.ok(cookie, "sign-up must issue a session cookie");

  const workspaceResponse = await request("/api/auth/workspaces", {
    method: "POST",
    body: JSON.stringify({ name: `Item Search E2E ${suffix}` }),
  });
  assert.equal(workspaceResponse.status, 201, `workspace: ${await workspaceResponse.text()}`);
  const workspace = await workspaceResponse.json() as { workspace?: { id?: string } };
  const workspaceId = workspace.workspace?.id;
  assert.ok(workspaceId, "workspace id is required");

  const itemResponse = await request("/api/items", {
    method: "POST",
    body: JSON.stringify({ workspaceId, code: itemCode, name: itemName, spec: "E2E", unit: "EA", minStock: 0, inboundPrice: 0, outboundPrice: 0 }),
  });
  assert.equal(itemResponse.status, 201, `item: ${await itemResponse.text()}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies(cookie.split("; ").map((part) => {
      const [name, ...rest] = part.split("=");
      return { name, value: rest.join("="), url: base };
    }));
    const page = await context.newPage();
    await page.goto(`${base}/purchases/new`, { waitUntil: "networkidle" });

    const itemCodeField = page.getByLabel("품목코드").first();
    const searchButton = page.getByRole("button", { name: "품목 검색" }).first();
    await assertVisibleSearchPath(itemCodeField, searchButton);

    await searchButton.click();
    await assertDialogOpen(page);
    await page.getByPlaceholder("품목코드 · 품목명 검색").fill("no-such-item");
    await assertVisibleText(page, "검색 결과가 없습니다.");
    await page.keyboard.press("Escape");
    await assertDialogClosed(page);

    await itemCodeField.press("Enter");
    await assertDialogOpen(page);
    await page.getByText(itemCode, { exact: true }).click();
    await assertDialogClosed(page);
    await assert.equal(await itemCodeField.inputValue(), itemCode, "selected item code must populate the line");

    await itemCodeField.dblclick();
    await assertDialogOpen(page);
    await page.keyboard.press("Escape");
    await assertDialogClosed(page);
    console.log(`item search UI E2E passed for ${itemCode}`);
  } finally {
    await browser.close();
  }
}

async function assertVisibleSearchPath(itemCodeField: ReturnType<import("@playwright/test").Page["getByLabel"]>, searchButton: ReturnType<import("@playwright/test").Page["getByRole"]>) {
  await assert.doesNotReject(() => itemCodeField.waitFor({ state: "visible" }));
  await assert.doesNotReject(() => searchButton.waitFor({ state: "visible" }));
}

async function assertDialogOpen(page: import("@playwright/test").Page) {
  await assert.doesNotReject(() => page.getByRole("dialog").waitFor({ state: "visible" }));
}

async function assertDialogClosed(page: import("@playwright/test").Page) {
  await assert.doesNotReject(() => page.getByRole("dialog").waitFor({ state: "hidden" }));
}

async function assertVisibleText(page: import("@playwright/test").Page, text: string) {
  await assert.doesNotReject(() => page.getByText(text, { exact: true }).waitFor({ state: "visible" }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
