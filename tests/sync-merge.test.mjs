import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspace,
  blankRow,
  repairWorkspace,
  isWorkspace,
} from "../src/workspace/model.ts";
import { mergeWorkspaces, mergeJournal } from "../src/workspace/merge.ts";
import { activeMonth, cycleDates } from "../src/finance/planning.ts";
import {
  emptyPortfolio,
  loanForecast,
  syncPortfolioCommitments,
} from "../src/finance/portfolio-model.ts";
import { createBackend } from "./apps-script-mock.mjs";

test("3-way mergeWorkspaces preserves concurrent Desktop and Phone edits across collections and meals", () => {
  const base = createWorkspace();
  base.updatedAt = 100;
  base.items = [
    {
      id: "t-shared",
      kind: "personal",
      text: "Shared task",
      done: false,
      created: "2026-08-01",
      due: "",
    },
    {
      id: "t-delete-phone",
      kind: "personal",
      text: "Phone will delete",
      done: false,
      created: "2026-08-01",
      due: "",
    },
  ];
  base.meals = {
    "2026-08-02": {
      breakfast: "Oats",
      lunch: "",
      dinner: "",
      snack: "",
    },
  };

  // Desktop adds a task and edits dinner
  const remote = structuredClone(base);
  remote.updatedAt = 200;
  remote.items.push({
    id: "t-desktop",
    kind: "personal",
    text: "Added on Desktop",
    done: false,
    created: "2026-08-02",
    due: "",
  });
  remote.meals["2026-08-02"].dinner = "Grilled fish";

  // Phone adds a different task, deletes t-delete-phone, and edits lunch
  const local = structuredClone(base);
  local.updatedAt = 210;
  local.items = local.items.filter((t) => t.id !== "t-delete-phone");
  local.items.push({
    id: "t-phone",
    kind: "personal",
    text: "Added on Phone",
    done: false,
    created: "2026-08-02",
    due: "",
  });
  local.meals["2026-08-02"].lunch = "Chicken rice";

  const merged = mergeWorkspaces(base, local, remote);
  assert.equal(isWorkspace(merged), true);
  assert.deepEqual(
    merged.items.map((t) => t.id).sort(),
    ["t-desktop", "t-phone", "t-shared"],
  );
  const meal = merged.meals["2026-08-02"];
  assert.equal(meal?.breakfast, "Oats");
  assert.equal(meal?.lunch, "Chicken rice");
  assert.equal(meal?.dinner, "Grilled fish");
});

test("3-way mergeWorkspaces maintains vehicle referential integrity when one device deletes a vehicle", () => {
  const base = createWorkspace();
  base.vehicles = [
    {
      id: "v1",
      name: "Myvi",
      plate: "ABC1234",
      insurer: "Allianz",
      policy: "POL-1",
      roadTaxDue: "",
      insuranceDue: "",
      serviceDue: "",
      odometer: 45000,
      serviceAtKm: 50000,
      notes: "",
    },
  ];
  base.vehicleServices = [];

  // Desktop deletes vehicle v1
  const remote = structuredClone(base);
  remote.vehicles = [];

  // Phone logs a brand-new service against v1 concurrently
  const local = structuredClone(base);
  local.vehicleServices = [
    {
      id: "s1",
      vehicleId: "v1",
      date: "2026-08-02",
      odometer: 50000,
      cost: 180,
      workshop: "AutoCare",
      details: "Oil change",
    },
  ];

  const merged = mergeWorkspaces(base, local, remote);
  // Resurrects v1 so the newly logged service is never silently lost AND schema stays valid
  assert.equal(isWorkspace(merged), true);
  assert.equal(merged.vehicles.length, 1);
  assert.equal(merged.vehicleServices.length, 1);
});

test("3-way mergeJournal merges independent habit checkmarks on the same day without clobbering", () => {
  const habits = [
    {
      id: "h1",
      name: "Water",
      color: "#3b82f6",
      lightBg: "#eff6ff",
      ringColor: "#93c5fd",
    },
    {
      id: "h2",
      name: "Walk",
      color: "#10b981",
      lightBg: "#ecfdf5",
      ringColor: "#6ee7b7",
    },
  ];
  const row = blankRow("2026-08-02", habits);
  const base = {
    rows: [structuredClone(row)],
    habits: structuredClone(habits),
    showTasksColumn: true,
  };

  // Desktop checks h1
  const remote = structuredClone(base);
  remote.rows[0].habits.h1 = true;

  // Phone checks h2
  const local = structuredClone(base);
  local.rows[0].habits.h2 = true;

  const merged = mergeJournal(base, local, remote);
  assert.equal(merged.rows[0].habits.h1, true);
  assert.equal(merged.rows[0].habits.h2, true);
});

test("Code.gs saveWorkspace only writes dirty tables and avoids redundant post-write reads", () => {
  const w = createWorkspace();
  w.updatedAt = 100;
  const backend = createBackend(w);

  // First getAll triggers migration & warms the workbook
  const first = backend.get();
  assert.equal(first.storageSchemaVersion, 2);
  assert.equal(first.features.atomicJournal, true);

  // Reset counters before single-task edit
  backend.metrics.reads = 0;
  backend.metrics.bodyReads = {};
  backend.metrics.writes = 0;
  backend.metrics.writesBySheet = {};

  const edited = structuredClone(first.workspace);
  edited.updatedAt = 200;
  edited.items.push({
    id: "t-one",
    kind: "personal",
    text: "Dirty table check",
    done: false,
    created: "2026-08-02",
    due: "",
  });

  const saved = backend.post({
    action: "saveWorkspace",
    baseRevision: first.workspaceRevision,
    data: edited,
  });
  assert.equal(saved.success, true);

  // Only PersonalTasks (and Settings for workspaceUpdatedAt) should be written, NOT all 35 tables!
  const writtenTabs = Object.keys(backend.metrics.writesBySheet);
  assert.ok(
    writtenTabs.includes("PersonalTasks"),
    "PersonalTasks should be written",
  );
  assert.ok(
    writtenTabs.length <= 4,
    `Expected <= 4 written tabs for a 1-task edit, got ${writtenTabs.length}: ${writtenTabs.join(", ")}`,
  );
  // Every table should be body-read at most once during saveWorkspace (no second full read for revision)
  for (const [sheetName, count] of Object.entries(backend.metrics.bodyReads)) {
    assert.ok(
      count <= 1,
      `Sheet ${sheetName} body was read ${count} times during a single saveWorkspace`,
    );
  }
});

test("Code.gs saveJournal performs atomic single-POST update of Entries, HabitChecks, Habits, and Settings", () => {
  const habit = {
    id: "h1",
    name: "Water",
    color: "#3b82f6",
    lightBg: "#eff6ff",
    ringColor: "#93c5fd",
  };
  const row = blankRow("2026-08-02", [habit]);
  const backend = createBackend(createWorkspace(), {
    entries: [row],
    habits: [habit],
  });
  backend.get();

  const updatedRow = structuredClone(row);
  updatedRow.habits.h1 = true;

  const res = backend.post({
    action: "saveJournal",
    entries: [updatedRow],
    habits: [habit],
    showTasksColumn: true,
  });
  assert.equal(res.success, true);

  const after = backend.get();
  const entry = after.entries.find((e) => e.dateStr === "2026-08-02");
  assert.equal(entry?.habits.h1, true);
});

test("Code.gs allows +1 day timezone tolerance for Portfolio and Skincare dates", () => {
  const backend = createBackend(createWorkspace());
  const initial = backend.get();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(tomorrow);

  const next = structuredClone(initial.workspace);
  next.updatedAt = Date.now();
  next.skincare.entries = [
    {
      id: `skin:${tomorrowIso}`,
      date: tomorrowIso,
      notes: "UTC+14 timezone test",
      reaction: "",
      productIds: [],
      updatedAt: new Date().toISOString(),
    },
  ];

  const saved = backend.post({
    action: "saveWorkspace",
    baseRevision: initial.workspaceRevision,
    data: next,
  });
  assert.equal(saved.success, true, saved.error);
});

test("cycleDates and activeMonth label calendar months accurately when defaultStartDay === 1", () => {
  assert.deepEqual(cycleDates("2026-08", 1), {
    start: "2026-08-01",
    end: "2026-08-31",
  });
  assert.equal(activeMonth("2026-08-15", 1), "2026-08");
  assert.equal(activeMonth("2026-08-01", 1), "2026-08");
  assert.equal(activeMonth("2026-08-31", 1), "2026-08");
});

test("loanForecast advances stale nextDue using snapshot asOfDate and syncPortfolioCommitments stops after payoff", () => {
  const loan = {
    id: "loan-1",
    name: "Short Loan",
    principal: 1000,
    balance: 1000,
    apr: 0,
    payment: 500,
    rateType: "reducing",
    asOf: "2026-01-01",
    nextDue: "2026-01-15",
    planName: "Short Loan",
    startDate: "2026-01-01",
  };

  // With snapshot dated 2026-05-01 and remaining balance 500, payoff should be 2026-05-15 (not stale 2026-01-15!)
  const f = loanForecast(loan, 0, 500, "2026-05-01");
  assert.equal(f.months, 1);
  assert.equal(f.completion, "2026-05-15");

  // syncPortfolioCommitments should schedule in May 2026 cycle, NOT in Sept 2026 cycle after payoff
  const p = emptyPortfolio();
  p.loans = [loan];
  p.debtSnapshots = [
    {
      id: "ds-1",
      loanId: "loan-1",
      cycleId: "",
      phase: "current",
      date: "2026-05-01",
      balance: 500,
      updatedAt: "2026-05-01T00:00:00Z",
    },
  ];
  const mayCycle = {
    id: "c-may",
    month: "2026-05",
    start: "2026-05-01",
    end: "2026-05-31",
  };
  const sepCycle = {
    id: "c-sep",
    month: "2026-09",
    start: "2026-09-01",
    end: "2026-09-30",
  };
  const planning = {
    defaultStartDay: 1,
    cycles: [mayCycle, sepCycle],
    rows: [],
  };
  const syncedMay = syncPortfolioCommitments(planning, p, mayCycle);
  const syncedBoth = syncPortfolioCommitments(syncedMay, p, sepCycle);
  assert.equal(
    syncedBoth.rows.filter(
      (r) => r.cycleId === "c-may" && r.id === "portfolio:loan:loan-1:c-may",
    ).length,
    1,
  );
  assert.equal(
    syncedBoth.rows.filter(
      (r) => r.cycleId === "c-sep" && r.id.startsWith("portfolio:loan:loan-1:"),
    ).length,
    0,
  );
});

test("repairWorkspace salvages valid collections when a single row is malformed", () => {
  const w = createWorkspace();
  w.items = [
    {
      id: "good",
      kind: "personal",
      text: "Keep me",
      done: false,
      created: "2026-08-01",
      due: "",
    },
    // Corrupt row (missing text/kind)
    { id: 123, text: null },
  ];
  assert.equal(isWorkspace(w), false);
  const repaired = repairWorkspace(w);
  assert.ok(repaired, "repairWorkspace should recover valid data");
  assert.equal(isWorkspace(repaired.workspace), true);
  assert.deepEqual(
    repaired.workspace.items.map((t) => t.id),
    ["good"],
  );
});
