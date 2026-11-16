import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createBackend } from "../tests/apps-script-mock.mjs";
import { createWorkspace } from "../src/workspace/model.ts";
import {
  cycleDates,
  activeMonth,
  shiftMonth,
} from "../src/finance/planning.ts";
const port = 5188,
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
      VITE_GOOGLE_SCRIPT_URL: "https://expense-edit.test/exec",
    },
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
    month = activeMonth(today, 27),
    current = { id: "current", month, ...cycleDates(month, 27) },
    pastMonth = shiftMonth(month, -1),
    past = { id: "past", month: pastMonth, ...cycleDates(pastMonth, 27) };
  const w = createWorkspace();
  w.updatedAt = 1;
  w.financePlanning.cycles = [current, past];
  w.financeExpenses = [
    {
      id: "original",
      date: today,
      item: "Original expense",
      amount: 10,
      category: "Food",
      receiptName: "original-receipt.pdf",
      receiptUrl: "https://drive.google.com/file/d/fake_receipt_id/view",
      createdAt: "2026-01-01T12:00:00Z",
    },
    {
      id: "other",
      date: today,
      item: "Other transaction",
      amount: 30,
      category: "Unknown",
      receiptName: "",
      receiptUrl: "",
      createdAt: "2026-01-02T12:00:00Z",
    },
  ];
  const backend = createBackend(w);
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let hold = true,
    release,
    waiting = false,
    writes = 0;
  await page.route("https://expense-edit.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      writes++;
      if (hold) {
        waiting = true;
        await new Promise((r) => (release = r));
      }
      const result = backend.post(req.postDataJSON());
      assert.notEqual(result.success, false, result.error);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    } else
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(backend.get()),
      });
  });
  await page.goto(base + "#finance");
  await page
    .getByRole("button", {
      name: "Edit transaction Original expense",
      exact: true,
    })
    .waitFor();
  await page.getByLabel("Search expenses", { exact: true }).fill("Original");
  await page
    .getByLabel("Filter expense category", { exact: true })
    .selectOption("Food");
  await page
    .getByRole("button", {
      name: "Edit transaction Original expense",
      exact: true,
    })
    .click();
  assert.equal(
    await page
      .getByLabel("Transaction amount (RM)", { exact: true })
      .inputValue(),
    "10",
  );
  await page.getByLabel("Transaction amount (RM)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal(await page.getByRole("dialog").isVisible(), true);
  assert.equal(writes, 0);
  await page
    .getByLabel("Transaction amount (RM)", { exact: true })
    .fill("42.25");
  await page
    .getByLabel("Transaction description", { exact: true })
    .fill("Updated groceries");
  await page
    .getByLabel("Transaction category", { exact: true })
    .selectOption("Groceries");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const r = await page.getByRole("dialog").boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= width + 1);
  }
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByText("Updated groceries", { exact: true }).waitFor();
  await page.getByText("Other transaction", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Search expenses", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await page
      .getByLabel("Filter expense category", { exact: true })
      .inputValue(),
    "All",
  );
  for (let n = 0; n < 40 && !waiting; n++) await page.waitForTimeout(100);
  assert.equal(waiting, true);
  assert.equal(backend.get().workspace.financeExpenses[0].amount, 10);
  hold = false;
  release();
  for (
    let n = 0;
    n < 40 && backend.get().workspace.financeExpenses[0].amount !== 42.25;
    n++
  )
    await page.waitForTimeout(100);
  let saved = backend.get().workspace.financeExpenses;
  assert.equal(saved.length, 2);
  assert.equal(saved[0].amount, 42.25);
  assert.equal(saved[0].receiptUrl, w.financeExpenses[0].receiptUrl);
  assert.equal(saved[0].createdAt, w.financeExpenses[0].createdAt);
  assert.equal(saved[0].id, "original");
  await page.waitForTimeout(200);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Edit transaction Updated groceries",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Transaction description", { exact: true })
    .fill("Cancelled change");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Updated groceries", { exact: true }).waitFor();
  await page
    .getByRole("button", {
      name: "Edit transaction Updated groceries",
      exact: true,
    })
    .click();
  await page.getByLabel("Transaction date", { exact: true }).fill(past.end);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("Updated groceries", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Salary cycle", { exact: true }).inputValue(),
    "past",
  );
  await page.waitForTimeout(1600);
  saved = backend.get().workspace.financeExpenses;
  assert.equal(saved[0].date, past.end);
  assert.equal(saved.length, 2);
  assert.equal(saved[1].amount, 30);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      edit: true,
      invalidAmountRejected: true,
      immediateWhileCloudPending: true,
      filtersReset: true,
      receiptAndIdentityPreserved: true,
      cancel: true,
      cycleMove: true,
      reload: true,
      viewports: [320, 390, 768, 1440],
      errors,
    }),
  );
} finally {
  await browser?.close();
  server.kill();
}
