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
    dump: "Brain dump",
    ideas: "Ideas",
    vocabulary: "Vocabulary",
    settings: "Settings & backup",
  };
  for (const width of [320, 375, 390, 768, 1440]) {
    const w = createWorkspace();
    w.updatedAt = 1;
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
    await page.route("https://sheet.test/**", async (route) => {
      const request = route.request();
      const value =
        request.method() === "POST"
          ? backend.post(JSON.parse(request.postData()))
          : backend.get();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(value),
      });
    });
    await page.goto(base);
    await page
      .getByRole("button", { name: "Drink water today", exact: true })
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
              return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
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
      await page
        .getByLabel("New daily habit", { exact: true })
        .fill("Stretch daily");
      await page
        .getByRole("button", { name: "Add habit", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Stretch daily today", exact: true })
        .waitFor();
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
