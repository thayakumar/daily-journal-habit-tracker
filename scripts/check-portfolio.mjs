import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createBackend } from "../tests/apps-script-mock.mjs";
import { createWorkspace, blankRow } from "../src/workspace/model.ts";
import {
  activeMonth,
  cycleDates,
  shiftMonth,
} from "../src/finance/planning.ts";
import { emptyPortfolio, addMonths } from "../src/finance/portfolio-model.ts";
const port = 5179,
  base = `http://127.0.0.1:${port}/daily-journal-habit-tracker/`;
fs.mkdirSync("work", { recursive: true });
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
      VITE_GOOGLE_SCRIPT_URL: "https://portfolio.test/exec",
    },
    stdio: "ignore",
  },
);
let browser;
const results = [];
try {
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
    }).format(new Date()),
    month = activeMonth(today, 27),
    current = { id: "current", month, ...cycleDates(month, 27) },
    past = {
      id: "past",
      month: shiftMonth(month, -1),
      ...cycleDates(shiftMonth(month, -1), 27),
    };
  for (const width of [320, 375, 390, 768, 1440]) {
    const w = createWorkspace();
    w.updatedAt = 1;
    w.financePlanning = {
      defaultStartDay: 27,
      cycles: [current, past],
      rows: [
        {
          id: "income",
          cycleId: "current",
          kind: "income",
          name: "Salary",
          amount: 4000,
          categories: [],
          liquid: false,
        },
        {
          id: "rent",
          cycleId: "current",
          kind: "commitment",
          name: "Rent",
          amount: 1000,
          categories: [],
          liquid: false,
        },
        {
          id: "budget",
          cycleId: "current",
          kind: "budget",
          name: "Spending",
          amount: 900,
          categories: ["Food"],
          liquid: false,
        },
        {
          id: "legacy",
          cycleId: "current",
          kind: "balance",
          name: "Legacy balance",
          amount: 150,
          categories: [],
          liquid: true,
        },
      ],
    };
    const p = emptyPortfolio();
    const bankName = "QA bank " + "A".repeat(70),
      investmentName = "Versa Gold " + "B".repeat(70);
    p.accounts = [
      {
        id: "bank",
        name: bankName,
        kind: "bank",
        liquid: true,
        maskedRef: "0123",
        vaultUrl: "",
        costBasis: 0,
        planName: "",
        trackingFrom: past.start,
      },
      {
        id: "versa",
        name: investmentName,
        kind: "investment",
        liquid: false,
        maskedRef: "",
        vaultUrl: "",
        costBasis: 1800,
        planName: "",
        trackingFrom: past.start,
      },
    ];
    p.snapshots = [
      {
        id: "bank-current",
        accountId: "bank",
        cycleId: "current",
        phase: "current",
        date: today,
        value: 5000,
        units: 0,
        price: 0,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "versa-current",
        accountId: "versa",
        cycleId: "current",
        phase: "current",
        date: today,
        value: 2000,
        units: 0,
        price: 0,
        updatedAt: new Date().toISOString(),
      },
    ];
    p.loans = [
      {
        id: "loan",
        name: "Car loan " + "C".repeat(70),
        principal: 2000,
        balance: 1000,
        apr: 6,
        payment: 100,
        rateType: "reducing",
        asOf: today,
        nextDue: today,
        planName: "",
        startDate: past.start,
      },
    ];
    p.subscriptions = [
      {
        id: "subscription",
        name: "Streaming service " + "D".repeat(70),
        amount: 10,
        frequency: "monthly",
        nextDue: today,
        active: true,
        accountId: "bank",
        manageUrl: "https://example.com/manage",
        planName: "",
        startDate: past.start,
      },
    ];
    p.goals = [
      {
        id: "goal",
        name: "Emergency fund " + "E".repeat(70),
        target: 10000,
        deadline: addMonths(today, 12),
        monthlyContribution: 300,
      },
    ];
    p.allocations = [
      { id: "allocation", goalId: "goal", accountId: "bank", amount: 1000 },
    ];
    w.financePortfolio = p;
    const backend = createBackend(w, {
      entries: [blankRow(today)],
      habits: [],
    });
    let writes = 0;
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 768,
        hasTouch: width < 768,
        timezoneId: "Asia/Kuala_Lumpur",
        serviceWorkers: "block",
      }),
      page = await context.newPage();
    page.on("dialog", (d) => d.accept());
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://portfolio.test/**", async (route) => {
      const request = route.request();
      const result =
        request.method() === "POST"
          ? (writes++, backend.post(request.postDataJSON()))
          : backend.get();
      if (result.success === false)
        console.error("Portfolio mock save error", result.error);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    });
    await page.goto(base + "#finance");
    await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
    async function section(name) {
      await page
        .getByRole("tablist", { name: "Portfolio sections" })
        .getByRole("tab", { name: new RegExp(`^${name}$`, "i") })
        .click();
      await page.waitForTimeout(50);
    }
    const headings = {
      overview: "Cycle closing and reconciliation",
      accounts: "Accounts and holdings",
      loans: "Loans and payoff estimates",
      subscriptions: "Subscriptions and renewals",
      goals: "Financial goals and deadlines",
      simulator: "Purchase and loan simulator",
    };
    for (const name of Object.keys(headings)) {
      await section(name);
      await page
        .getByRole("heading", { name: headings[name], exact: true })
        .waitFor();
      await page.waitForFunction(
        (w) =>
          document.documentElement.scrollWidth <= w + 1 && innerWidth <= w + 1,
        width,
        { timeout: 2000 },
      );
      const clipped = await page
        .locator(
          "#finance-portfolio input:visible,#finance-portfolio select:visible,#finance-portfolio button:visible",
        )
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => !n.closest("[data-horizontal-scroll]"))
            .filter((n) => {
              const r = n.getBoundingClientRect();
              return r.left < -1 || r.right > innerWidth + 1;
            })
            .map((n) => n.getAttribute("aria-label") || n.textContent),
        );
      assert.deepEqual(clipped, [], `${width}px ${name}: clipped controls`);
      results.push({ width, section: name, overflow: false });
      if (width === 390)
        await page.screenshot({
          path: `work/portfolio-${name}-390.png`,
          fullPage: true,
        });
    }
    if (width === 390) {
      const fill = (label, value) =>
        page.getByLabel(label, { exact: true }).fill(String(value));
      const save = async (name) => {
        await page
          .getByRole("button", { name: `Save ${name}`, exact: true })
          .click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      };
      await section("accounts");
      await page
        .getByRole("button", { name: "Add account", exact: true })
        .click();
      await fill("Name", "QA Cash");
      await fill("Account reference · last 4 digits only", "9999");
      await fill(
        "Password manager item link (HTTPS)",
        "https://vault.bitwarden.com/#/vault?itemId=qa",
      );
      await save("account");
      await page
        .getByRole("heading", { name: "QA Cash", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Record account balance", exact: true })
        .click();
      await page
        .getByLabel("Account", { exact: true })
        .selectOption({ label: "QA Cash" });
      await page
        .getByLabel("Balance phase", { exact: true })
        .selectOption("closing");
      await fill("Account value (RM)", 1000);
      await page
        .getByRole("button", { name: "Save account balance", exact: true })
        .click();
      if (current.end > today) {
        await page
          .getByRole("alert")
          .filter({ hasText: "Future balances" })
          .waitFor();
        await page
          .getByLabel("Balance phase", { exact: true })
          .selectOption("current");
        await save("account balance");
      } else await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Add account", exact: true })
        .click();
      await fill("Name", "QA Gold");
      await page
        .getByLabel("Account type", { exact: true })
        .selectOption("gold");
      assert.equal(
        await page
          .getByLabel("Available as liquid funds", { exact: true })
          .isChecked(),
        false,
      );
      await fill("Recorded purchase cost (RM)", 500);
      await save("account");
      await page
        .getByRole("button", { name: "Record account balance", exact: true })
        .click();
      await page
        .getByLabel("Account", { exact: true })
        .selectOption({ label: "QA Gold" });
      await fill("Gold quantity (grams)", 2);
      await fill("Value per gram (RM)", 300);
      await save("account balance");
      await page
        .getByRole("button", { name: "Add movement", exact: true })
        .click();
      await page
        .getByLabel("From account", { exact: true })
        .selectOption({ label: "QA Cash" });
      await page
        .getByLabel("To account", { exact: true })
        .selectOption({ label: investmentName });
      await fill("Amount (RM)", 100);
      await save("money movement");
      await section("loans");
      await page.getByRole("button", { name: "Add loan", exact: true }).click();
      await fill("Name", "QA Loan");
      await fill("Outstanding principal (RM)", 1000);
      await fill("Original principal (RM)", 1000);
      await fill("Annual interest rate (%)", 6);
      await fill("Monthly instalment (RM)", 100);
      await save("loan");
      await section("subscriptions");
      await page
        .getByRole("button", { name: "Add subscription", exact: true })
        .click();
      await fill("Name", "QA Annual");
      await fill("Amount (RM)", 120);
      await page
        .getByLabel("Billing frequency", { exact: true })
        .selectOption("yearly");
      await fill("Next renewal date", current.start);
      await save("subscription");
      await page
        .getByRole("button", { name: "Sync cycle commitments", exact: true })
        .click();
      await section("goals");
      await page.getByRole("button", { name: "Add goal", exact: true }).click();
      await fill("Name", "QA Goal");
      await fill("Target amount (RM)", 1000);
      await fill("Goal deadline", addMonths(today, 6));
      await fill("Planned monthly contribution (RM)", 100);
      await save("goal");
      const goalCard = page.locator("div.rounded-xl.border-slate-200").filter({
        has: page.getByRole("heading", { name: "QA Goal", exact: true }),
      });
      await goalCard
        .getByRole("button", { name: "Allocate funds", exact: true })
        .click();
      await page
        .getByLabel("Account", { exact: true })
        .selectOption({ label: "QA Cash" });
      await fill("Amount (RM)", 1100);
      await page
        .getByRole("button", { name: "Save goal allocation", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Allocations exceed" })
        .waitFor();
      await fill("Amount (RM)", 500);
      await save("goal allocation");
      for (
        let i = 0;
        i < 60 &&
        !backend
          .get()
          .workspace.financePortfolio.goals.some((g) => g.name === "QA Goal");
        i++
      )
        await page.waitForTimeout(100);
      await page.waitForTimeout(1500);
      const stored = backend.get().workspace.financePortfolio;
      const cash = stored.accounts.find((a) => a.name === "QA Cash"),
        gold = stored.accounts.find((a) => a.name === "QA Gold");
      assert.equal(cash.maskedRef, "9999");
      assert.equal(
        stored.snapshots.find((s) => s.accountId === gold.id).value,
        600,
      );
      assert.equal(
        backend
          .get()
          .workspace.financePlanning.rows.find(
            (r) => r.id === `portfolio:balance:${cash.id}:current`,
          ).amount,
        1000,
      );
      assert.ok(
        backend
          .get()
          .workspace.financePlanning.rows.some(
            (r) =>
              r.kind === "commitment" &&
              r.name === "QA Annual" &&
              r.amount === 120,
          ),
      );
      const beforeSimulation = JSON.stringify(stored),
        beforeWrites = writes;
      await section("simulator");
      await page
        .getByLabel("Simulation method", { exact: true })
        .selectOption("loan");
      await page
        .getByLabel("Simulation funding account", { exact: true })
        .selectOption(cash.id);
      await fill("Simulation price", 1200);
      await fill("Simulation deposit", 200);
      await fill("Simulation interest", 0);
      await fill("Simulation term", 10);
      await fill("Simulation reserve", 500);
      await page
        .getByLabel("Simulation goal", { exact: true })
        .selectOption({ label: "QA Goal" });
      await page.waitForTimeout(1500);
      assert.equal(
        JSON.stringify(backend.get().workspace.financePortfolio),
        beforeSimulation,
      );
      assert.equal(writes, beforeWrites);
      assert.ok(
        (await page.locator("#finance-portfolio").innerText()).includes(
          "return to their original amount after the loan term",
        ),
      );
      await page
        .getByLabel("Simulation method", { exact: true })
        .selectOption("cash");
      await fill("Simulation price", 100);
      assert.equal(
        await page.getByRole("alert").count(),
        0,
        "Cash scenarios must ignore hidden loan-only inputs",
      );
      assert.equal(writes, beforeWrites);
      await page.reload();
      await page.getByRole("tab", { name: "Portfolio", exact: true }).click();
      await section("accounts");
      await page
        .getByRole("heading", { name: "QA Cash", exact: true })
        .waitFor();
      await page
        .getByLabel("Salary cycle", { exact: true })
        .selectOption("past");
      for (const phase of ["opening", "closing"]) {
        await page
          .getByRole("button", { name: "Record account balance", exact: true })
          .click();
        await page
          .getByLabel("Account", { exact: true })
          .selectOption({ label: "QA Cash" });
        await page
          .getByLabel("Balance phase", { exact: true })
          .selectOption(phase);
        await fill("Account value (RM)", phase === "opening" ? 1000 : 1100);
        await save("account balance");
      }
      await page.waitForTimeout(1500);
      assert.equal(
        backend
          .get()
          .workspace.financePortfolio.snapshots.filter(
            (s) => s.accountId === cash.id && s.cycleId === "past",
          ).length,
        2,
      );
      await page
        .getByRole("tab", { name: "Monthly Budget", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Opening / closing balances",
          exact: true,
        })
        .click();
      await page
        .getByRole("heading", { name: "Accounts and holdings", exact: true })
        .waitFor();
      results.push({
        width,
        crud: true,
        goldValuation: true,
        allocationLimit: true,
        snapshotPhases: true,
        monthlyLinks: true,
        simulatorReadOnly: true,
        reload: true,
      });
    }
    assert.deepEqual(errors, [], `Portfolio browser errors at ${width}px`);
    await context.close();
  }
  fs.writeFileSync(
    "work/portfolio-browser-report.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({
      portfolioLayoutChecks: results.filter((r) => r.section).length,
      viewports: [320, 375, 390, 768, 1440],
      functionalChecks: "passed",
      browserErrors: 0,
    }),
  );
} finally {
  await browser?.close();
  server.kill();
}
