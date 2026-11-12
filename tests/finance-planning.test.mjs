import test from "node:test";
import assert from "node:assert/strict";
import {
  activeMonth,
  cycleDates,
  cycleError,
  emptyPlanning,
  isFinancePlanning,
  summarizeCycle,
} from "../src/finance/planning.ts";
import { createWorkspace, isWorkspace } from "../src/workspace/model.ts";
import { createBackend } from "./apps-script-mock.mjs";
const cycle = { id: "aug", month: "2026-08", ...cycleDates("2026-08", 27) };
const row = (id, kind, amount, extra = {}) => ({
  id,
  cycleId: cycle.id,
  kind,
  name: id,
  amount,
  categories: [],
  liquid: false,
  ...extra,
});
const expense = (id, date, amount, category) => ({
  id,
  date,
  amount,
  category,
  item: id,
  receiptName: "",
  receiptUrl: "",
  createdAt: "2026-08-01T00:00:00Z",
});
function populated() {
  const p = emptyPlanning();
  p.cycles = [cycle];
  p.rows = [
    row("salary", "income", 5000),
    row("loan", "commitment", 1000),
    row("groceries", "budget", 300, { categories: ["Groceries"] }),
    row("general", "budget", 300, { categories: ["Food", "Entertainment"] }),
    row("cash", "balance", 2000, { liquid: true }),
    row("gold", "balance", 500),
  ];
  return p;
}
test("configurable payday periods handle month/year/leap-day boundaries without UTC shifts", () => {
  assert.deepEqual(cycleDates("2026-08", 27), {
    start: "2026-07-27",
    end: "2026-08-26",
  });
  assert.deepEqual(cycleDates("2026-08", 26), {
    start: "2026-07-26",
    end: "2026-08-25",
  });
  assert.deepEqual(cycleDates("2027-01", 27), {
    start: "2026-12-27",
    end: "2027-01-26",
  });
  assert.deepEqual(cycleDates("2028-03", 31), {
    start: "2028-02-29",
    end: "2028-03-30",
  });
  assert.deepEqual(cycleDates("2026-03", 31), {
    start: "2026-02-28",
    end: "2026-03-30",
  });
  assert.equal(activeMonth("2026-07-26", 27), "2026-07");
  assert.equal(activeMonth("2026-07-27", 27), "2026-08");
});
test("cycle validation rejects overlap, duplicate months and impossible dates", () => {
  assert.match(
    cycleError(
      { id: "other", month: "2026-09", start: "2026-08-26", end: "2026-09-25" },
      [cycle],
    ),
    /overlap/,
  );
  assert.match(cycleError({ ...cycle, id: "other" }, [cycle]), /already/);
  assert.match(cycleError({ ...cycle, start: "2026-02-30" }, []), /valid/);
  assert.equal(cycleError({ ...cycle, start: "2026-07-26" }, [cycle]), "");
});
test("one ledger drives date-isolated totals, every chart category, budgets and asset snapshots", () => {
  const p = populated();
  const e = [
    expense("before", "2026-07-26", 999, "Food"),
    expense("food", "2026-07-27", 0.1, "Food"),
    expense("food2", "2026-08-01", 0.2, "Food"),
    expense("entertainment", "2026-08-26", 70, "Entertainment"),
    expense("custom", "2026-08-15", 20, "New category"),
    expense("after", "2026-08-27", 888, "Food"),
  ];
  const s = summarizeCycle(p, e, cycle);
  assert.equal(s.spent, 90.3);
  assert.equal(s.categories.find((c) => c.name === "Food").amount, 0.3);
  assert.equal(s.categories.find((c) => c.name === "Entertainment").amount, 70);
  assert.equal(s.unallocated, 20);
  assert.equal(s.expected, 3400);
  assert.equal(s.surplus, 3909.7);
  assert.equal(s.remaining, 509.7);
  assert.equal(s.liquid, 2000);
  assert.equal(s.assets, 2500);
  assert.equal(s.transactions.length, 4);
  const next = { id: "sep", month: "2026-09", ...cycleDates("2026-09", 27) };
  assert.equal(
    summarizeCycle({ ...p, cycles: [cycle, next] }, e, next).spent,
    888,
  );
});
test("backup validation rejects malformed planning and double-mapped budget categories", () => {
  const p = populated();
  assert.equal(isFinancePlanning(p), true);
  const w = createWorkspace();
  w.financePlanning = p;
  assert.equal(isWorkspace(w), true);
  assert.equal(isFinancePlanning({ ...p, cycles: [null] }), false);
  assert.equal(isFinancePlanning({ ...p, rows: [...p.rows, null] }), false);
  assert.equal(isFinancePlanning({ ...p, defaultStartDay: 32 }), false);
  assert.equal(
    isFinancePlanning({
      ...p,
      rows: [
        ...p.rows,
        row("duplicate", "budget", 100, { categories: ["Food"] }),
      ],
    }),
    false,
  );
});
test("planning persists in dedicated tables and old clients preserve it; bad cycles write nothing", () => {
  const w = createWorkspace();
  w.financePlanning = populated();
  const b = createBackend(w);
  const first = b.get();
  assert.equal(first.features.financePlanning, true);
  assert.deepEqual(first.workspace.financePlanning, w.financePlanning);
  for (const name of [
    "FinanceCycleSettings",
    "FinanceCycles",
    "FinanceIncome",
    "FinanceCommitments",
    "FinanceBudgets",
    "FinanceBalances",
  ])
    assert.ok(b.sheets.get(name).grid.length > 1, name);
  const old = structuredClone(first.workspace);
  delete old.financePlanning;
  old.updatedAt++;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: old,
      baseRevision: first.workspaceRevision,
    }).success,
    true,
  );
  assert.deepEqual(b.get().workspace.financePlanning, w.financePlanning);
  const current = b.get();
  const invalid = structuredClone(current.workspace);
  invalid.financePlanning.cycles.push({
    id: "overlap",
    month: "2026-09",
    start: "2026-08-26",
    end: "2026-09-26",
  });
  const response = b.post({
    action: "saveWorkspace",
    data: invalid,
    baseRevision: current.workspaceRevision,
  });
  assert.equal(response.success, false);
  assert.match(response.error, /overlap/);
  assert.deepEqual(b.get().workspace.financePlanning, w.financePlanning);
});
