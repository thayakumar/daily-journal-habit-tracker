import {
  activeMonth,
  cycleDates,
  shiftMonth,
  monthName,
} from "../src/finance/planning.ts";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createBackend } from "../tests/apps-script-mock.mjs";
import { createWorkspace, blankRow, addDays } from "../src/workspace/model.ts";
const port = 5175,
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
    env: { ...process.env, VITE_GOOGLE_SCRIPT_URL: "https://sheet.test/exec" },
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
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  const labels = {
    overview: "Overview",
    habits: "Habits",
    personal: "Personal",
    fitness: "Fitness",
    meals: "Meals",
    finance: "Finance",
    dump: "Brain dump",
    ideas: "Ideas",
    vocabulary: "Vocabulary",
    settings: "Settings & backup",
  };
  for (const width of [320, 375, 390, 768, 1440]) {
    const w = createWorkspace();
    w.updatedAt = 1;
    const cycleMonth = activeMonth(today, 27);
    w.financePlanning = {
      defaultStartDay: 27,
      cycles: [
        { id: "qa-cycle", month: cycleMonth, ...cycleDates(cycleMonth, 27) },
        {
          id: "qa-next",
          month: shiftMonth(cycleMonth, 1),
          ...cycleDates(shiftMonth(cycleMonth, 1), 27),
        },
      ],
      rows: [
        {
          id: "salary",
          cycleId: "qa-cycle",
          kind: "income",
          name: "Salary with a long reference " + "A".repeat(80),
          amount: 4000,
          categories: [],
          liquid: false,
        },
        {
          id: "rent",
          cycleId: "qa-cycle",
          kind: "commitment",
          name: "Commitment with a long reference " + "B".repeat(80),
          amount: 1000,
          categories: [],
          liquid: false,
        },
        {
          id: "food-budget",
          cycleId: "qa-cycle",
          kind: "budget",
          name: "Food budget with a long reference " + "C".repeat(80),
          amount: 300,
          categories: ["Food"],
          liquid: false,
        },
        {
          id: "cash",
          cycleId: "qa-cycle",
          kind: "balance",
          name: "Cash account with a long reference " + "D".repeat(80),
          amount: 2000,
          categories: [],
          liquid: true,
        },
      ],
    };
    w.financeExpenses = [
      {
        id: "qa-finance",
        date: today,
        item: "QA lunch",
        amount: 12.5,
        category: "Food",
        receiptName: "",
        receiptUrl: "",
        createdAt: new Date().toISOString(),
      },
    ];
    w.recurring = [
      {
        id: "routine",
        name: "Change bedsheets",
        interval: 7,
        lastDone: addDays(today, -7),
        reminder: "",
      },
    ];
    const backend = createBackend(w, {
      entries: [blankRow(today)],
      habits: [
        {
          id: "water",
          name: "Drink water",
          color: "bg-sky-500 border-sky-500",
          lightBg: "bg-sky-50 text-sky-700 border-sky-200",
          ringColor: "",
        },
        {
          id: "read",
          name: "Read a chapter and make a few notes",
          color: "bg-violet-500 border-violet-500",
          lightBg: "bg-violet-50",
          ringColor: "",
        },
      ],
    });
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      timezoneId: "Asia/Kuala_Lumpur",
      isMobile: width < 768,
      hasTouch: width < 768,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.accept());
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let failReceipt = false;
    await page.route("https://sheet.test/**", async (route) => {
      const request = route.request();
      if (
        failReceipt &&
        request.method() === "POST" &&
        request.postDataJSON().action === "uploadFinanceReceipt"
      )
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Temporary receipt failure",
          }),
        });
      const value =
        request.method() === "POST"
          ? backend.post(JSON.parse(request.postData()))
          : backend.get();
      if (value.success === false)
        console.error("Mock API error", value.code, value.error);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(value),
      });
    });
    await page.goto(base);
    await page
      .getByRole("navigation", { name: "Open a page", exact: true })
      .waitFor();
    async function navigate(id) {
      if (width < 1024)
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: labels[id], exact: true })
        .click();
      await page.waitForTimeout(50);
    }
    for (const id of Object.keys(labels)) {
      if (id !== "overview") await navigate(id);
      if (id === "overview") {
        assert.equal(await page.locator("main textarea,main input").count(), 0);
        assert.equal(
          await page
            .getByRole("navigation", { name: "Open a page" })
            .getByRole("button")
            .count(),
          9,
        );
      }
      if (id === "finance")
        await page.getByText("QA lunch", { exact: true }).waitFor();
      if (id === "meals") {
        assert.equal(
          await page
            .getByRole("table", { name: "Weekly meals" })
            .locator("textarea")
            .count(),
          28,
        );
        assert.equal(await page.locator("main details").count(), 0);
      }
      if (id === "habits") {
        assert.equal(await page.locator("details[open]").count(), 0);
        await page
          .getByRole("button", { name: "Add recurring routine", exact: true })
          .click();
        const popup = page.getByRole("dialog");
        await popup.waitFor();
        const rect = await popup.boundingBox();
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
        assert.equal(
          await popup.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
          "Routine dialog must fit its content",
        );
        await page.keyboard.press("Escape");
        await popup.waitFor({ state: "hidden" });
        assert.equal(
          await page
            .getByRole("button", { name: "Add recurring routine", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
      }
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(
        layout.document <= width + 1,
        `${width}px ${id} overflows: ${JSON.stringify(layout)}`,
      );
      const clipped = await page
        .locator("input:visible,select:visible,textarea:visible")
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => {
              const r = n.getBoundingClientRect();
              return (
                !n.closest("[data-horizontal-scroll]") &&
                r.width > 0 &&
                (r.left < -1 || r.right > innerWidth + 1)
              );
            })
            .map((n) => n.getAttribute("aria-label") || n.tagName),
        );
      assert.deepEqual(clipped, [], `${width}px ${id} has clipped controls`);
      results.push({
        width,
        page: id,
        horizontalOverflow: false,
        clippedInputs: false,
      });
      if (id === "finance") {
        await page
          .getByRole("tab", { name: "Monthly Budget", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Your salary cycles", exact: true })
          .waitFor();
        await page
          .getByLabel("Salary cycle", { exact: true })
          .selectOption("qa-cycle");
        await page
          .getByRole("table", { name: "Cycle expenses", exact: true })
          .waitFor();
        await page.waitForFunction(
          (w) =>
            document.documentElement.scrollWidth <= w + 1 &&
            innerWidth <= w + 1,
          width,
          { timeout: 2000 },
        );
        assert.equal(
          await page
            .getByRole("table", { name: "Cycle expenses", exact: true })
            .locator("tbody tr")
            .count(),
          1,
        );
        const budgetScroll = page
          .getByRole("table", { name: "Spending budgets", exact: true })
          .locator("..");
        await budgetScroll.evaluate((el) => {
          el.scrollLeft = el.scrollWidth;
        });
        const actionRect = await budgetScroll
          .getByRole("button")
          .first()
          .boundingBox();
        assert.ok(
          actionRect.x >= 0 && actionRect.x + actionRect.width <= width + 1,
          "Budget actions must remain reachable by local scrolling",
        );
        await budgetScroll.evaluate((el) => {
          el.scrollLeft = 0;
        });
        await page
          .getByRole("button", { name: "Edit cycle dates", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        assert.ok(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        if (width === 390)
          await page.screenshot({
            path: "work/monthly-budget-390.png",
            fullPage: true,
          });
        results.push({
          width,
          page: "finance-monthly",
          horizontalOverflow: false,
        });
        await page
          .getByRole("tab", { name: "Expense Tracker", exact: true })
          .click();
      }
      if (width === 390 && ["habits", "fitness", "meals"].includes(id))
        await page.screenshot({
          path: `work/responsive-${id}-390.png`,
          fullPage: true,
        });
    }
    await navigate("vocabulary");
    await page.getByRole("button", { name: "Add word", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      ),
      "Vocabulary word",
    );
    const popupRect = await page.getByRole("dialog").boundingBox();
    assert.ok(popupRect.x >= 0 && popupRect.x + popupRect.width <= width + 1);
    if (width === 390)
      await page.screenshot({ path: "work/vocabulary-popup-390.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    for (const id of ["journal", "calendar"])
      assert.equal(await page.locator(`nav a[href="#${id}"]`).count(), 0);
    if (width === 390) {
      await navigate("vocabulary");
      await page.getByRole("button", { name: "Add word", exact: true }).click();
      await page
        .getByLabel("Vocabulary word", { exact: true })
        .fill("Serendipity");
      await page
        .getByLabel("Vocabulary definition", { exact: true })
        .fill("Finding something good by chance.");
      await page
        .getByLabel("Vocabulary example usage", { exact: true })
        .fill("Meeting her there was pure serendipity.");
      await page
        .getByRole("button", { name: "Save word", exact: true })
        .click();
      await page
        .getByRole("rowheader", { name: "Serendipity", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Edit Serendipity", exact: true })
        .click();
      await page
        .getByLabel("Vocabulary example usage", { exact: true })
        .fill("The discovery was pure serendipity.");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await page.getByRole("button", { name: "Add word", exact: true }).click();
      await page
        .getByLabel("Vocabulary word", { exact: true })
        .fill("serendipity");
      await page
        .getByLabel("Vocabulary definition", { exact: true })
        .fill("Duplicate");
      await page
        .getByLabel("Vocabulary example usage", { exact: true })
        .fill("Duplicate example");
      await page
        .getByRole("button", { name: "Save word", exact: true })
        .click();
      await page.getByRole("alert").waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByLabel("Search vocabulary", { exact: true })
        .fill("discovery");
      assert.equal(
        await page
          .getByRole("rowheader", { name: "Serendipity", exact: true })
          .count(),
        1,
      );
      await page
        .getByLabel("Search vocabulary", { exact: true })
        .fill("zzzzzz");
      await page
        .getByText("No words match your search.", { exact: true })
        .waitFor();
      await page.getByLabel("Search vocabulary", { exact: true }).fill("");
      await page.getByRole("button", { name: "Add word", exact: true }).click();
      await page
        .getByLabel("Vocabulary word", { exact: true })
        .fill("Alacrity");
      await page
        .getByLabel("Vocabulary definition", { exact: true })
        .fill("Cheerful readiness.");
      await page
        .getByLabel("Vocabulary example usage", { exact: true })
        .fill("She accepted with alacrity.");
      await page
        .getByRole("button", { name: "Save word", exact: true })
        .click();
      await page
        .getByLabel("Sort vocabulary", { exact: true })
        .selectOption("az");
      assert.equal(
        await page.getByRole("rowheader").first().textContent(),
        "Alacrity",
      );
      await page
        .getByRole("button", { name: "Delete Alacrity", exact: true })
        .click();
      await page.waitForTimeout(1600);
      assert.equal(backend.get().workspace.vocabulary.length, 1);
      await page.reload();
      await page
        .getByRole("rowheader", { name: "Serendipity", exact: true })
        .waitFor();
      await page.screenshot({
        path: "work/vocabulary-list-390.png",
        fullPage: true,
      });
      assert.equal(
        backend.get().workspace.vocabulary[0].example,
        "The discovery was pure serendipity.",
      );
      await navigate("habits");
      await page
        .getByRole("button", {
          name: "Complete Change bedsheets today",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Undo Change bedsheets today",
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator("details[open]").count(), 0);
      await page
        .getByRole("button", { name: "Add daily habit", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page
        .getByLabel("New daily habit", { exact: true })
        .fill("Stretch daily");
      await page
        .getByRole("button", { name: "Add habit", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Stretch daily today", exact: true })
        .waitFor();
      await page
        .locator("summary")
        .filter({ hasText: "Customize daily habits" })
        .click();
      await page.getByLabel("Name for water", { exact: true }).fill("");
      assert.equal(
        await page.getByLabel("Name for water", { exact: true }).inputValue(),
        "",
      );
      await page
        .getByLabel("Name for water", { exact: true })
        .fill("Water custom");
      await page.getByLabel("Name for water", { exact: true }).press("Tab");
      await page
        .getByLabel("Colour for Water custom", { exact: true })
        .selectOption("4");
      await page
        .getByRole("button", { name: "Water custom today", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('button[aria-label="Water custom today"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      assert.match(
        await page
          .getByRole("button", { name: "Water custom today", exact: true })
          .getAttribute("class"),
        /bg-rose-500/,
      );
      await navigate("finance");
      await page.getByLabel("Expense description").fill("=QA coffee");
      await page.getByLabel("Expense amount").fill("8.75");
      await page.getByLabel("Expense receipt").setInputFiles({
        name: "receipt.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("QA receipt"),
      });
      await page
        .getByRole("button", { name: "Save expense", exact: true })
        .click();
      await page
        .getByText(
          "Expense saved. Sheet sync follows your planner connection.",
          { exact: true },
        )
        .waitFor();
      for (
        let n = 0;
        n < 50 && backend.get().workspace.financeExpenses.length !== 2;
        n++
      )
        await page.waitForTimeout(100);
      if (backend.get().workspace.financeExpenses.length !== 2)
        console.error(
          "Finance save status",
          await page.locator("header").innerText(),
        );
      const savedExpense = backend.get().workspace.financeExpenses.at(-1);
      assert.equal(backend.get().workspace.financeExpenses.length, 2);
      assert.equal(savedExpense.item, "=QA coffee");
      assert.equal(
        savedExpense.receiptUrl,
        "https://drive.google.com/file/d/receipt-1/view",
      );
      assert.equal(backend.receipts.length, 1);
      assert.equal(
        backend.receipts[0].folderId,
        "1_fo4Fn8Oq-ttn1vhZAAZFUH49jIyJrXd",
      );
      await page.getByLabel("Search expenses").fill("=QA coffee");
      assert.equal(await page.locator("#expense-table tbody tr").count(), 1);
      await page.getByLabel("Search expenses").fill("");
      await page
        .getByLabel("Filter expense category")
        .selectOption("Groceries");
      await page
        .getByText("No transactions recorded", { exact: true })
        .waitFor();
      await page.getByLabel("Filter expense category").selectOption("All");
      await page.getByLabel("Expense description").fill("Keep on failure");
      await page.getByLabel("Expense amount").fill("5");
      failReceipt = true;
      await page.getByLabel("Expense receipt").setInputFiles({
        name: "retry.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("QA failed upload"),
      });
      await page
        .getByRole("button", { name: "Save expense", exact: true })
        .click();
      await page.locator("#submit-error").waitFor();
      assert.equal(
        await page.getByLabel("Expense description").inputValue(),
        "Keep on failure",
      );
      failReceipt = false;
      await page
        .getByRole("button", { name: "Sync expenses", exact: true })
        .click();
      await page.getByText("=QA coffee", { exact: true }).waitFor();
      await page.reload();
      await page.getByText("=QA coffee", { exact: true }).waitFor();
      await page.screenshot({ path: "work/finance-390.png", fullPage: true });
      await page
        .getByRole("tab", { name: "Monthly Budget", exact: true })
        .click();
      await page
        .getByLabel("Salary cycle", { exact: true })
        .selectOption("qa-cycle");
      await page
        .getByRole("button", { name: "Add income", exact: true })
        .click();
      await page.getByLabel("Plan row name").fill("Tuition QA");
      await page.getByLabel("Plan row amount").fill("200");
      await page
        .getByRole("button", { name: "Save income", exact: true })
        .click();
      await page
        .getByRole("rowheader", { name: "Tuition QA", exact: true })
        .waitFor();
      await page
        .getByLabel("Salary cycle", { exact: true })
        .selectOption("qa-next");
      await page
        .getByText("No expenses in these dates.", { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("rowheader", { name: "Tuition QA", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "New cycle", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Create cycle", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "already exists" })
        .waitFor();
      await page
        .getByLabel("Cycle month", { exact: true })
        .fill(shiftMonth(cycleMonth, 2));
      await page
        .getByLabel("Starting setup", { exact: true })
        .selectOption("qa-cycle");
      await page
        .getByRole("button", { name: "Create cycle", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("rowheader", { name: "Tuition QA", exact: true })
        .waitFor();
      assert.ok(
        (
          await page
            .getByRole("table", { name: "Account balances", exact: true })
            .innerText()
        ).includes("RM"),
      );
      const copiedId = await page
        .getByLabel("Salary cycle", { exact: true })
        .inputValue();
      await page
        .getByRole("button", { name: "Edit cycle dates", exact: true })
        .click();
      await page
        .getByLabel("Cycle start", { exact: true })
        .fill(
          cycleDates(shiftMonth(cycleMonth, 2), 27).start.replace(/27$/, "28"),
        );
      await page
        .getByRole("button", { name: "Save cycle dates", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByLabel("Default salary day", { exact: true })
        .selectOption("26");
      for (
        let n = 0;
        n < 60 && backend.get().workspace.financePlanning.cycles.length !== 3;
        n++
      )
        await page.waitForTimeout(100);
      await page.waitForTimeout(1500);
      const planningSaved = backend.get().workspace.financePlanning;
      assert.equal(planningSaved.defaultStartDay, 26);
      assert.equal(
        planningSaved.rows.find(
          (r) => r.cycleId === copiedId && r.kind === "balance",
        ).amount,
        0,
      );
      assert.equal(
        planningSaved.rows.find(
          (r) => r.cycleId === "qa-cycle" && r.id === "salary",
        ).amount,
        4000,
      );
      await page.reload();
      await page
        .getByRole("tab", { name: "Monthly Budget", exact: true })
        .click();
      await page
        .getByLabel("Salary cycle", { exact: true })
        .selectOption(copiedId);
      await page
        .getByRole("rowheader", { name: "Tuition QA", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByLabel("Default salary day", { exact: true })
          .inputValue(),
        "26",
      );
      results.push({
        width,
        configurableCycles: true,
        monthIsolation: true,
        copySetup: true,
        planningReloadPersistence: true,
      });
      await navigate("fitness");
      await page
        .getByLabel("Exercise name", { exact: true })
        .fill("Dumbbell lifts");
      await page.getByLabel("Exercise weight", { exact: true }).fill("10");
      await page.getByLabel("Reps per set", { exact: true }).fill("12");
      await page
        .getByRole("button", { name: "Log exercise", exact: true })
        .click();
      await page
        .getByLabel("Weight for Dumbbell lifts set 3", { exact: true })
        .fill("12.5");
      await page
        .getByLabel("Reps for Dumbbell lifts set 3", { exact: true })
        .fill("10");
      await page.getByLabel("Exercise name", { exact: true }).fill("Treadmill");
      await page
        .getByLabel("Exercise type", { exact: true })
        .selectOption("cardio");
      await page.getByLabel("Cardio duration", { exact: true }).fill("20");
      await page.getByLabel("Cardio distance", { exact: true }).fill("2.5");
      await page
        .getByRole("button", { name: "Log exercise", exact: true })
        .click();
      await page
        .getByLabel("Exercise name", { exact: true })
        .fill("Leg extensions");
      await page
        .getByLabel("Exercise type", { exact: true })
        .selectOption("strength");
      await page.getByLabel("Number of sets", { exact: true }).fill("2");
      await page.getByLabel("Exercise weight", { exact: true }).fill("30");
      await page.getByLabel("Reps per set", { exact: true }).fill("15");
      await page
        .getByRole("button", { name: "Log exercise", exact: true })
        .click();
      await page
        .getByLabel("Workout date", { exact: true })
        .fill(addDays(today, -1));
      await page
        .getByLabel("Exercise name", { exact: true })
        .fill("Previous-day lifts");
      await page
        .getByRole("button", { name: "Log exercise", exact: true })
        .click();
      await page.waitForTimeout(1600);
      assert.equal(backend.get().workspace.workoutSets.length, 8);
      assert.equal(backend.get().workspace.recurringChecks.length, 1);
      assert.equal(
        backend.get().habits.find((h) => h.id === "water").name,
        "Water custom",
      );
      await page.reload();
      await page.getByLabel("Workout date", { exact: true }).waitFor();
      await page
        .getByLabel("Weight for Dumbbell lifts set 3", { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByLabel("Weight for Dumbbell lifts set 3", { exact: true })
          .inputValue(),
        "12.5",
      );
      assert.equal(
        await page
          .getByLabel("Minutes for Treadmill", { exact: true })
          .inputValue(),
        "20",
      );
      await page
        .getByRole("heading", { name: `Exercises · ${today}`, exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "work/responsive-workout-sets-390.png",
        fullPage: true,
      });
      results.push({
        width,
        workoutDateIsolation: true,
        multipleExercises: true,
        perSetWeightAndReps: true,
        cardioDurationAndDistance: true,
        reloadPersistence: true,
        habitCustomization: true,
        recurringDueCompletion: true,
      });
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}px`);
    await context.close();
  }
  fs.writeFileSync(
    "work/responsive-report.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({
      viewports: [320, 375, 390, 768, 1440],
      pageLayoutChecks: results.filter((r) => r.page).length,
      functionalMobileChecks: "passed",
      browserErrors: 0,
    }),
  );
} finally {
  await browser?.close();
  server.kill();
}
