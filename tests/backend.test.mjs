import test from "node:test";
import assert from "node:assert/strict";
import { createBackend } from "./apps-script-mock.mjs";
import {
  blankRow,
  createWorkspace,
  isWorkspace,
} from "../src/workspace/model.ts";
function populated() {
  const w = createWorkspace();
  w.updatedAt = 100;
  w.items = ["personal", "wishlist", "grocery", "watch"].map((kind, i) => ({
    id: "i" + i,
    kind,
    text: "Item " + i,
    done: i % 2 === 0,
    created: "2026-11-11",
    due: "",
  }));
  w.events = [
    {
      id: "e1",
      title: "Calendar",
      date: "2026-11-11",
      type: "event",
      note: "Notes",
    },
  ];
  w.recurring = [
    {
      id: "r1",
      name: "Plants",
      interval: 3,
      lastDone: "2026-11-11",
      reminder: "",
    },
  ];
  w.thoughts = [
    {
      id: "t1",
      text: "Thought\nwith a newline",
      created: "2026-11-11T12:00:00.000Z",
    },
  ];
  w.ideas = [
    { id: "a1", title: "Idea", url: "https://example.com", note: "A note" },
  ];
  w.meals = {
    "2026-11-11": {
      breakfast: "Oats",
      lunch: "Rice",
      dinner: "Soup",
      snack: "Apple",
    },
  };
  w.reminders = { h1: "08:30" };
  w.fitness.completed = ["2026-11-11"];
  return w;
}
test("legacy JSON migrates to every page table without deleting the original backup", () => {
  const w = populated(),
    row = blankRow("2026-11-11");
  row.habits = { h1: true, h2: false };
  const b = createBackend(w, { entries: [row], habits: [] });
  const data = b.get();
  assert.equal(data.storageSchemaVersion, 2);
  assert.equal(data.success, undefined);
  assert.equal(isWorkspace(data.workspace), true);
  assert.deepEqual(data.workspace, w);
  for (const name of Object.keys(b.context.PLANNER_TABLES))
    assert.ok(b.sheets.has(name), name);
  assert.deepEqual(b.sheets.get("HabitChecks").grid[1], [
    "2026-11-11",
    "h1",
    true,
  ]);
  assert.equal(data.settings.personalWorkspaceV1, JSON.stringify(w));
});
test("new planner saves use real tables; sheet edits are read back even without a timestamp change", () => {
  const b = createBackend(populated());
  const initial = b.get();
  const w = structuredClone(initial.workspace);
  w.updatedAt++;
  w.meals["2026-11-11"].lunch = "Changed lunch";
  const result = b.post({
    action: "saveWorkspace",
    data: w,
    baseRevision: initial.workspaceRevision,
  });
  assert.equal(result.success, true);
  assert.equal(b.sheets.get("Meals").grid[1][2], "Changed lunch");
  b.sheets.get("Meals").grid[1][2] = "Edited directly in Sheets";
  assert.equal(
    b.get().workspace.meals["2026-11-11"].lunch,
    "Edited directly in Sheets",
  );
  const before = b.sheets.get("Meals").grid[1][2];
  const conflict = b.post({
    action: "saveWorkspace",
    data: w,
    baseRevision: result.workspaceRevision,
  });
  assert.equal(conflict.code, "CONFLICT");
  assert.equal(b.sheets.get("Meals").grid[1][2], before);
});
test("journal entries and normalized habit checks remain synchronized", () => {
  const b = createBackend(populated());
  b.get();
  const row = blankRow("2026-11-11");
  row.habits = { h1: true };
  assert.equal(b.post({ action: "saveEntries", data: [row] }).success, true);
  assert.equal(b.sheets.get("Entries").grid[1][0], row.id);
  assert.deepEqual(b.sheets.get("HabitChecks").grid[1], [
    "2026-11-11",
    "h1",
    true,
  ]);
  b.sheets.get("HabitChecks").grid[1][2] = false;
  assert.equal(b.get().entries[0].habits.h1, false);
});
test("large planners are not limited by a single JSON cell and formula-like text stays literal", () => {
  const b = createBackend(populated());
  const initial = b.get(),
    w = initial.workspace;
  w.updatedAt++;
  w.thoughts = [
    { id: "large", text: "x".repeat(25000), created: "2026-11-11T12:00:00Z" },
    { id: "large2", text: "x".repeat(25000), created: "2026-11-11T12:00:00Z" },
    { id: "large3", text: "=SUM(1,2)", created: "2026-11-11T12:00:00Z" },
  ];
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: w,
      baseRevision: initial.workspaceRevision,
    }).success,
    true,
  );
  assert.equal(b.get().workspace.thoughts[2].text, "=SUM(1,2)");
});
test("invalid planner and unknown headers do not wipe existing records", () => {
  const b = createBackend(populated());
  const initial = b.get();
  const bad = structuredClone(initial.workspace);
  bad.fitness.schedule = [];
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: bad,
      baseRevision: initial.workspaceRevision,
    }).success,
    false,
  );
  assert.equal(b.sheets.get("Meals").grid[1][1], "Oats");
  b.sheets.get("Ideas").grid[0][0] = "Renamed ID";
  const w = structuredClone(initial.workspace);
  w.updatedAt++;
  const tables = b.context.plannerToTables(w);
  assert.throws(() => b.context.writePlanner(b.ss, w), /Unexpected headers/);
  assert.ok(tables.Meals);
  assert.equal(b.sheets.get("Meals").grid[1][1], "Oats");
});

test("native checkbox defaults do not become phantom records or expand the meaningful write area", () => {
  const b = createBackend(populated());
  b.get();
  const sheet = b.sheets.get("PersonalTasks");
  sheet.grid[999] = ["", "", false, "", ""];
  assert.equal(
    b.get().workspace.items.filter((i) => i.kind === "personal").length,
    1,
  );
  const current = b.get();
  current.workspace.items = current.workspace.items.filter(
    (i) => i.kind !== "personal",
  );
  current.workspace.updatedAt++;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: current.workspace,
      baseRevision: current.workspaceRevision,
    }).success,
    true,
  );
  assert.equal(
    b.get().workspace.items.filter((i) => i.kind === "personal").length,
    0,
  );
  assert.equal(sheet.grid[999][2], false);
});

test("adding or deleting another journal day preserves direct Sheet habit-check edits", () => {
  const original = blankRow("2026-11-11");
  original.habits = { h1: true };
  const b = createBackend(populated(), { entries: [original], habits: [] });
  b.get();
  b.sheets.get("HabitChecks").grid[1][2] = false;
  const qa = blankRow("2026-11-12");
  qa.habits = { h1: true };
  assert.equal(b.post({ action: "addEntry", data: qa }).success, true);
  assert.equal(b.post({ action: "deleteEntry", id: qa.id }).success, true);
  assert.equal(b.get().entries[0].habits.h1, false);
});

test("dated workout sets and recurring completions persist in independent row tables", () => {
  const w = populated();
  w.workoutSets = [
    {
      id: "set1",
      exerciseId: "ex1",
      date: "2026-11-12",
      exercise: "Dumbbell lifts",
      type: "strength",
      setNumber: 1,
      weight: "10",
      unit: "kg",
      reps: "12",
      durationMinutes: "",
      distanceKm: "",
      notes: "",
    },
    {
      id: "set2",
      exerciseId: "ex1",
      date: "2026-11-12",
      exercise: "Dumbbell lifts",
      type: "strength",
      setNumber: 2,
      weight: "12.5",
      unit: "kg",
      reps: "10",
      durationMinutes: "",
      distanceKm: "",
      notes: "",
    },
  ];
  w.recurringChecks = [
    {
      id: "check1",
      habitId: "r1",
      date: "2026-11-12",
      previousLastDone: "2026-11-05",
    },
  ];
  const b = createBackend(w),
    remote = b.get();
  assert.deepEqual(remote.workspace.workoutSets, w.workoutSets);
  assert.deepEqual(remote.workspace.recurringChecks, w.recurringChecks);
  assert.equal(remote.features.workoutSets, true);
  assert.equal(b.sheets.get("WorkoutSets").grid[2][6], 12.5);
  assert.equal(b.sheets.get("RecurringChecks").grid[1][2], "2026-11-12");
});

test("vocabulary entries round-trip through their own table and survive older clients", () => {
  const w = populated();
  w.vocabulary = [
    {
      id: "v1",
      word: "Serendipity",
      definition: "Finding something good by chance.",
      example: "It was pure serendipity.",
      createdAt: "2026-11-12T01:00:00Z",
      updatedAt: "2026-11-12T01:00:00Z",
    },
  ];
  const b = createBackend(w),
    remote = b.get();
  assert.equal(remote.features.vocabulary, true);
  assert.deepEqual(remote.workspace.vocabulary, w.vocabulary);
  assert.equal(b.sheets.get("Vocabulary").grid[1][1], "Serendipity");
  const old = structuredClone(remote.workspace);
  delete old.vocabulary;
  old.updatedAt++;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: old,
      baseRevision: remote.workspaceRevision,
    }).success,
    true,
  );
  assert.equal(
    b.get().workspace.vocabulary[0].definition,
    w.vocabulary[0].definition,
  );
});

test("finance expenses use their own table and older clients preserve them", () => {
  const w = createWorkspace();
  w.financeExpenses = [
    {
      id: "expense-1",
      date: "2026-11-12",
      item: "=Lunch",
      amount: 12.5,
      category: "Food",
      receiptName: "receipt.pdf",
      receiptUrl: "https://drive.google.com/file/d/receipt-1/view",
      createdAt: "2026-11-12T01:00:00Z",
    },
  ];
  const b = createBackend(w);
  const remote = b.get();
  assert.equal(remote.features.finance, true);
  assert.deepEqual(remote.workspace.financeExpenses, w.financeExpenses);
  assert.equal(b.sheets.get("FinanceExpenses").grid[1][2], "=Lunch");
  const oldClient = JSON.parse(JSON.stringify(remote.workspace));
  delete oldClient.financeExpenses;
  oldClient.updatedAt++;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: oldClient,
      baseRevision: remote.workspaceRevision,
    }).success,
    true,
  );
  assert.deepEqual(b.get().workspace.financeExpenses, w.financeExpenses);
});

test("receipt upload uses the original Drive folder and rejects invalid files before creating them", () => {
  const b = createBackend(createWorkspace());
  const response = b.post({
    action: "uploadFinanceReceipt",
    fileName: "receipt.pdf",
    fileMimeType: "application/pdf",
    fileBase64: Buffer.from("receipt bytes").toString("base64"),
  });
  assert.equal(response.success, true);
  assert.equal(response.receiptName, "receipt.pdf");
  assert.equal(b.receipts[0].folderId, "1_fo4Fn8Oq-ttn1vhZAAZFUH49jIyJrXd");
  assert.equal(b.get().workspace.financeExpenses.length, 0);
  assert.equal(
    b.post({
      action: "uploadFinanceReceipt",
      fileName: "bad.txt",
      fileMimeType: "text/plain",
      fileBase64: "YQ==",
    }).success,
    false,
  );
  assert.equal(
    b.post({
      action: "uploadFinanceReceipt",
      fileName: "bad.pdf",
      fileMimeType: "application/pdf",
      fileBase64: "not base64",
    }).success,
    false,
  );
  assert.equal(b.receipts.length, 1);
});
