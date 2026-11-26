import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createBackend } from "../tests/apps-script-mock.mjs";
import { createWorkspace } from "../src/workspace/model.ts";
const port = 5183,
  base = `http://127.0.0.1:${port}/daily-journal-habit-tracker/`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      VITE_GOOGLE_SCRIPT_URL: "https://new-pages.test/exec",
    },
    stdio: "ignore",
  },
);
let browser;
const checks = [];
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : "/usr/bin/google-chrome"),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
      timezoneId: "Asia/Kuala_Lumpur",
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  page.setDefaultTimeout(15000);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  const state = createWorkspace();
  state.updatedAt = 1;
  const backend = createBackend(state);
  let writes = 0;
  const sourceTabs = [
    {
      name: "Nov 26",
      sheetId: 123,
      values: [
        ["INCOME"],
        [
          "Salary",
          4000,
          null,
          null,
          null,
          "TIMESTAMP",
          "ITEM",
          "VALUE",
          "CATEGORY",
        ],
        [
          "TOTAL",
          4000,
          null,
          null,
          null,
          today,
          "Source groceries",
          15,
          "Groceries",
        ],
        ["FIXED MONTHLY COMMITMENT"],
        ["Loan instalment", 100],
        ["TOTAL", 100],
        ["MONTHLY BUDGET"],
        ["Groceries", 300],
        [
          "TOTAL",
          300,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "SAVINGS BREAKDOWN",
        ],
        [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "Legacy Bank",
          5000,
        ],
      ],
    },
  ];
  await page.route("https://new-pages.test/**", async (route) => {
    const req = route.request();
    const result = req.url().includes("previewBudgetImport")
      ? { tabs: sourceTabs }
      : req.method() === "POST"
        ? (writes++, backend.post(req.postDataJSON()))
        : backend.get();
    if (result.success === false) throw Error(result.error);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  async function settle() {
    await page.waitForTimeout(1600);
    assert.equal(backend.get().workspace.name, "My Space");
  }
  async function fit(label) {
    console.log("Checking", label);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow",
    );
    checks.push(label);
  }
  await page.goto(base + "#calendar");
  await page.getByRole("heading", { name: "Add to your calendar" }).waitFor();
  await page.getByLabel("Title", { exact: true }).fill("QA appointment");
  await page.getByLabel("Date", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await settle();
  assert.equal(backend.get().workspace.events[0].title, "QA appointment");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fit("calendar " + width);
  }
  await page.goto(base + "#vehicles");
  await page.getByRole("button", { name: "Add vehicle", exact: true }).click();
  await page.getByLabel("Vehicle name", { exact: true }).fill("My motorcycle");
  await page.getByLabel("Registration plate", { exact: true }).fill("ABC123");
  await page.getByLabel("Road tax expiry", { exact: true }).fill(today);
  await page.getByLabel("Current odometer (km)", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await page.getByRole("button", { name: "Log service", exact: true }).click();
  await page.getByLabel("Cost (RM)", { exact: true }).fill("120.50");
  await page
    .getByLabel("Work completed", { exact: true })
    .fill("Oil and filters");
  await page
    .getByLabel("Next service mileage (km)", { exact: true })
    .fill("15000");
  await page.getByRole("button", { name: "Save service", exact: true }).click();
  await settle();
  assert.equal(backend.get().workspace.vehicleServices[0].cost, 120.5);
  assert.equal(backend.get().workspace.vehicles[0].serviceAtKm, 15000);
  await page.reload();
  await page
    .getByRole("heading", { name: "My motorcycle", exact: true })
    .waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fit("vehicles " + width);
  }
  await page.goto(base + "#calendar");
  await page
    .getByText("My motorcycle · Road tax renewal", { exact: true })
    .first()
    .waitFor();
  assert.equal(backend.get().workspace.events.length, 1);
  await page.goto(base + "#finance");
  await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
  assert.equal(
    await page.getByLabel("Salary cycle", { exact: true }).isVisible(),
    false,
  );
  await page
    .getByRole("tablist", { name: "Portfolio sections" })
    .getByRole("tab", { name: "accounts", exact: true })
    .click();
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("QA Bank");
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await page
    .getByRole("button", { name: "Record account balance", exact: true })
    .click();
  await page.getByLabel("Account value (RM)", { exact: true }).fill("2000");
  await page
    .getByRole("button", { name: "Save account balance", exact: true })
    .click();
  await settle();
  const snapshot = backend.get().workspace.financePortfolio.snapshots[0];
  assert.equal(snapshot.cycleId, "");
  assert.equal(snapshot.phase, "current");
  assert.equal(snapshot.date, today);
  assert.equal(backend.get().workspace.financePlanning.cycles.length, 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fit("portfolio " + width);
  }
  await page
    .getByRole("button", { name: "Preview Sheet migration", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByLabel("Actual balance date (optional) · Nov 26", { exact: true })
    .fill(today);
  await page.getByLabel("Type · Legacy Bank").selectOption("bank");
  await page
    .getByRole("button", { name: "Import reviewed records", exact: true })
    .click();
  await settle();
  assert.equal(backend.get().workspace.financePortfolio.accounts.length, 2);
  assert.equal(backend.get().workspace.financeExpenses.length, 1);
  await page.getByRole("tab", { name: "Expense Tracker", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Import screenshot / pasted text",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Extracted text (or paste transaction text)", { exact: true })
    .fill(`${today} Coffee Shop -RM 12.50\n${today} Salary +RM 4,000.00`);
  await page
    .getByRole("button", { name: "Build review rows", exact: true })
    .click();
  assert.equal(await page.getByRole("checkbox").count(), 2);
  await page.getByLabel("Import row 1", { exact: true }).check();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fit("OCR review " + width);
  }
  await page
    .getByRole("button", { name: "Import 1 reviewed expenses", exact: true })
    .click();
  await settle();
  assert.equal(backend.get().workspace.financeExpenses.length, 2);
  assert.equal(
    backend.get().workspace.financeExpenses.at(-1).receiptName,
    "Bulk screenshot import · reviewed",
  );
  await page.getByText("Coffee Shop", { exact: true }).waitFor();
  // Feed an actual rendered screenshot into the real browser OCR worker.
  const imagePage = await context.newPage();
  await imagePage.setContent(
    `<html><body style="font:30px Arial;background:white;color:black;padding:35px;line-height:2"><b>TRANSACTIONS</b><div>${today} Coffee RM 12.50</div><div>${today} Groceries RM 44.20</div></body></html>`,
  );
  await imagePage.setViewportSize({ width: 1100, height: 340 });
  fs.mkdirSync("work", { recursive: true });
  await imagePage.screenshot({ path: "work/ocr-statement-fixture.png" });
  await imagePage.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", {
      name: "Import screenshot / pasted text",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Transaction screenshot", { exact: true })
    .setInputFiles("work/ocr-statement-fixture.png");
  await page
    .getByLabel("Description · row 1", { exact: true })
    .waitFor({ timeout: 120000 });
  assert.match(
    await page.getByLabel("Description · row 1", { exact: true }).inputValue(),
    /Coffee/i,
  );
  assert.equal(
    await page.getByLabel("Amount (RM) · row 1", { exact: true }).inputValue(),
    "12.50",
  );
  await page.screenshot({ path: "work/ocr-review-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        checks,
        ocr: "real screenshot extracted",
        writes,
        calendarAndVehiclesReload: true,
        migration: true,
        standalonePortfolio: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
