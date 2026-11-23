import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createBackend } from "../tests/apps-script-mock.mjs";
import { createWorkspace } from "../src/workspace/model.ts";
import { emptyPortfolio } from "../src/finance/portfolio-model.ts";
const port = 5189,
  base = `http://127.0.0.1:${port}/daily-journal-habit-tracker/`,
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: { ...process.env, VITE_GOOGLE_SCRIPT_URL: "https://skin.test/exec" },
      stdio: "ignore",
    },
  );
let browser;
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date()),
    w = createWorkspace();
  w.updatedAt = 1;
  const p = emptyPortfolio();
  p.accounts = [
    {
      id: "bank",
      name: "QA Bank",
      kind: "bank",
      liquid: true,
      maskedRef: "0123",
      vaultUrl: "",
      costBasis: 0,
      planName: "",
      trackingFrom: today,
    },
  ];
  p.snapshots = [
    {
      id: "balance",
      accountId: "bank",
      cycleId: "",
      phase: "current",
      date: today,
      value: 1000,
      units: 0,
      price: 0,
      updatedAt: new Date().toISOString(),
    },
  ];
  w.financePortfolio = p;
  const backend = createBackend(w),
    checks = [],
    errors = [];
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  page.setDefaultTimeout(15000);
  await page.route("https://skin.test/**", async (route) => {
    const req = route.request(),
      result =
        req.method() === "POST"
          ? backend.post(req.postDataJSON())
          : backend.get();
    assert.notEqual(result.success, false, result.error);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "skincare.photo-access.v1",
      "synthetic-skin-photo-test-key-123456",
    ),
  );
  const imagePage = await context.newPage();
  await imagePage.setViewportSize({ width: 600, height: 800 });
  await imagePage.setContent(
    '<html><body style="background:#ffe4e6;font:32px Arial;text-align:center;padding:50px">Synthetic skincare test photo<br>Front / Left / Right</body></html>',
  );
  fs.mkdirSync("work", { recursive: true });
  await imagePage.screenshot({ path: "work/skincare-fixture.png" });
  await imagePage.close();
  async function fit(label) {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow",
    );
    checks.push(label);
  }
  async function module(name) {
    await page
      .getByRole("tablist", { name: "Skincare modules" })
      .getByRole("tab", { name, exact: true })
      .click();
  }
  async function synced(fn) {
    for (let n = 0; n < 60; n++) {
      if (fn(backend.get().workspace)) return;
      await page.waitForTimeout(100);
    }
    throw Error("Planner save did not complete");
  }
  await page.goto(base + "#skincare");
  await page
    .getByRole("heading", { name: "Daily face journal", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Journal date", { exact: true }).inputValue(),
    today,
  );
  await page
    .getByLabel("What I applied / daily notes", { exact: true })
    .fill("Cleanser and moisturiser after shower.");
  await page
    .getByLabel("How my skin reacted", { exact: true })
    .fill("Comfortable, a little dryness on the left.");
  await page
    .getByRole("button", { name: "Use starter routine", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Cleanser", exact: true })
    .first()
    .check();
  await page
    .getByRole("button", { name: "Add skincare habit", exact: true })
    .click();
  await page.getByLabel("Skincare habit name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Enter a skincare habit name" })
    .waitFor();
  await page
    .getByLabel("Skincare habit name", { exact: true })
    .fill("Evening treatment");
  await page.getByLabel("Routine time", { exact: true }).selectOption("PM");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Evening treatment", exact: true })
    .check();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("QA Moisturiser");
  await page.getByLabel("Brand", { exact: true }).fill("QA Brand");
  await page.getByLabel("Product type", { exact: true }).fill("Moisturiser");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "QA Moisturiser · QA Brand", exact: true })
    .check();
  for (const side of ["front", "left", "right"]) {
    await page
      .getByLabel(`Upload ${side} skincare photo`, { exact: true })
      .setInputFiles("work/skincare-fixture.png");
    await page
      .getByRole("button", {
        name: `View ${side} photo for ${today}`,
        exact: true,
      })
      .waitFor();
  }
  await synced(
    (s) =>
      s.skincare.photos.length === 3 &&
      s.skincare.entries[0].productIds.length === 1,
  );
  assert.equal(backend.receipts.length, 3);
  assert.ok(backend.receipts.every((f) => f.folderId === "skin-folder"));
  assert.equal(
    backend.get().workspace.skincare.checks.filter((c) => c.done).length,
    2,
  );
  const sizes = [320, 375, 390, 768, 1440];
  for (const name of ["Daily tracker", "My products", "Photo overview"]) {
    await module(name);
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 900 });
      await fit(name + " " + width);
    }
    if (name === "Photo overview") {
      await page
        .getByLabel("Photo angle", { exact: true })
        .selectOption("left");
      assert.equal(
        await page
          .getByRole("button", {
            name: `View left photo for ${today}`,
            exact: true,
          })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("button", {
            name: `View front photo for ${today}`,
            exact: true,
          })
          .count(),
        0,
      );
      await page
        .getByRole("button", {
          name: `View left photo for ${today}`,
          exact: true,
        })
        .click();
      await page.getByRole("dialog").waitFor();
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByRole("heading", { name: "Daily face journal", exact: true })
    .waitFor();
  assert.match(
    await page
      .getByLabel("What I applied / daily notes", { exact: true })
      .inputValue(),
    /Cleanser/,
  );
  await page
    .getByLabel("Upload front skincare photo", { exact: true })
    .scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: `View front photo for ${today}`, exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Previous skincare day", exact: true })
    .click();
  await page
    .getByLabel("What I applied / daily notes", { exact: true })
    .fill("Previous day note");
  await synced((s) => s.skincare.entries.length === 2);
  await module("Photo overview");
  assert.equal(
    await page.getByRole("button", { name: "Open day", exact: true }).count(),
    2,
  );
  await page
    .getByRole("button", { name: "Open day", exact: true })
    .first()
    .click();
  assert.equal(
    await page.getByLabel("Journal date", { exact: true }).inputValue(),
    today,
  );
  await module("My products");
  await page
    .getByRole("button", { name: "Archive product", exact: true })
    .click();
  await page.getByLabel("Show archived products", { exact: true }).check();
  await page
    .getByRole("heading", { name: "QA Moisturiser", exact: true })
    .waitFor();
  await module("Daily tracker");
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "QA Moisturiser · QA Brand · archived",
        exact: true,
      })
      .isChecked(),
    true,
  );
  await page.screenshot({
    path: "work/skincare-tracker-390.png",
    fullPage: true,
  });
  await module("Photo overview");
  await page.screenshot({
    path: "work/skincare-overview-390.png",
    fullPage: true,
  });
  await module("Daily tracker");
  await page
    .getByRole("button", { name: "Forget key on this device", exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel("Upload front skincare photo", { exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Connect photos", exact: true })
    .click();
  await page
    .getByLabel("Photo access key", { exact: true })
    .fill("synthetic-skin-photo-test-key-123456");
  await page
    .getByRole("button", { name: "Connect this device", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByLabel("Upload front skincare photo", { exact: true })
      .isDisabled(),
    false,
  );
  await page.goto(base + "#finance");
  await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
  for (const label of [
    "Recorded net worth",
    "Total assets",
    "Bank balances",
    "Liquid funds",
    "Physical gold",
    "Investments",
    "Outstanding debt",
    "Monthly obligations",
  ]) {
    const heading = page.getByText(label, { exact: true }).first();
    await heading.waitFor();
    const card = heading.locator("..");
    assert.ok(
      (await card.locator("p").count()) >= 3,
      label + " explanation missing",
    );
  }
  await page
    .getByText(
      "Older snapshots, purchase costs and monthly income are not added again.",
      { exact: false },
    )
    .waitFor();
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 900 });
    await fit("Portfolio info " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "work/portfolio-info-390.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      layoutChecks: checks.length,
      viewports: sizes,
      modules: 3,
      notesAndHabits: true,
      productHistory: true,
      threePhotoUploads: true,
      photosReloadThroughPlanner: true,
      overviewAndAngleFilter: true,
      perCardFinanceInfo: true,
      errors,
    }),
  );
} finally {
  await browser?.close();
  server.kill();
}
