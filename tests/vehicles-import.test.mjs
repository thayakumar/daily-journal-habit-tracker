import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace, isWorkspace } from "../src/workspace/model.ts";
import { validVehicles, vehicleDue } from "../src/workspace/vehicle-model.ts";
import {
  emptyPortfolio,
  portfolioCycleError,
  portfolioTotals,
} from "../src/finance/portfolio-model.ts";
import {
  parseStatement,
  duplicateExpense,
} from "../src/finance/statement-import.ts";
import {
  parseLegacyTab,
  migrateLegacy,
  defaultLegacyChoices,
} from "../src/finance/legacy-import.ts";
import { createBackend } from "./apps-script-mock.mjs";
const today = "2026-11-16";
const vehicle = {
  id: "car",
  name: "Car",
  plate: "ABC123",
  insurer: "Insurer",
  policy: "ref",
  roadTaxDue: "2026-11-01",
  insuranceDue: "2026-12-01",
  serviceDue: "2026-12-05",
  odometer: 50000,
  serviceAtKm: 55000,
  notes: "Remember oil",
};
const service = {
  id: "oil",
  vehicleId: "car",
  date: "2026-11-01",
  odometer: 49000,
  cost: 120.5,
  workshop: "Garage",
  details: "Oil change",
};
const account = {
  id: "bank",
  name: "Bank",
  kind: "bank",
  liquid: true,
  maskedRef: "0123",
  vaultUrl: "",
  costBasis: 0,
  planName: "",
  trackingFrom: "2026-01-01",
};
test("vehicles and service history round-trip in separate tables and survive older clients", () => {
  const w = createWorkspace();
  w.vehicles = [vehicle];
  w.vehicleServices = [service];
  w.updatedAt = 1;
  assert.ok(isWorkspace(w));
  const b = createBackend(w),
    read = b.get();
  assert.equal(read.features.vehicles, true);
  assert.deepEqual(read.workspace.vehicles, w.vehicles);
  assert.deepEqual(read.workspace.vehicleServices, w.vehicleServices);
  assert.equal(b.sheets.get("Vehicles").grid[1][2], "ABC123");
  assert.equal(b.sheets.get("VehicleServices").grid[1][4], 120.5);
  const old = structuredClone(read.workspace);
  delete old.vehicles;
  delete old.vehicleServices;
  old.updatedAt = 2;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: old,
      baseRevision: read.workspaceRevision,
    }).success,
    true,
  );
  assert.deepEqual(b.get().workspace.vehicles, w.vehicles);
  const fresh = b.get(),
    bad = structuredClone(fresh.workspace);
  bad.vehicleServices[0].vehicleId = "missing";
  bad.updatedAt = 3;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: bad,
      baseRevision: fresh.workspaceRevision,
    }).success,
    false,
  );
  assert.deepEqual(b.get().workspace.vehicleServices, w.vehicleServices);
});
test("vehicle dates, amounts and relationships are validated without throwing", () => {
  assert.equal(validVehicles([vehicle], [service]), true);
  assert.equal(
    validVehicles([{ ...vehicle, serviceDue: "2026-99-99" }], []),
    false,
  );
  assert.equal(validVehicles([vehicle], [{ ...service, cost: -1 }]), false);
  assert.equal(validVehicles([], [service]), false);
  assert.equal(vehicleDue("2026-11-15", today), "1 days overdue");
  assert.equal(vehicleDue(today, today), "Due today");
});
test("ongoing Portfolio balances, loan balances and movements need no salary cycle", () => {
  const w = createWorkspace(),
    p = emptyPortfolio();
  p.accounts = [
    account,
    { ...account, id: "invest", name: "Investment", kind: "investment" },
  ];
  p.snapshots = [
    {
      id: "b",
      accountId: "bank",
      cycleId: "",
      phase: "current",
      date: today,
      value: 500,
      units: 0,
      price: 0,
      updatedAt: today + "T12:00Z",
    },
  ];
  p.flows = [
    {
      id: "flow",
      cycleId: "",
      date: today,
      kind: "transfer",
      fromId: "bank",
      toId: "invest",
      amount: 50,
      budgetIncluded: false,
    },
  ];
  w.financePortfolio = p;
  w.updatedAt = 1;
  assert.equal(portfolioCycleError(p, [], today), "");
  assert.ok(isWorkspace(w));
  assert.equal(portfolioTotals(p).assets, 500);
  const b = createBackend(w);
  assert.deepEqual(b.get().workspace.financePortfolio.snapshots, p.snapshots);
  assert.deepEqual(b.get().workspace.financePortfolio.flows, p.flows);
  const future = structuredClone(p);
  future.snapshots[0].date = "2099-01-01";
  assert.match(portfolioCycleError(future, [], today), /Future/);
  const bad = structuredClone(p);
  bad.snapshots[0].phase = "opening";
  assert.match(portfolioCycleError(bad, [], today), /cycle/);
});
test("OCR candidates preserve dates, flag credits/running balances and require explicit selection", () => {
  const text =
    "15 Nov 2026\nCoffee Shop -RM 12.50\n16/11/2026 Salary +RM 4,100.00\n16/11/2026 Groceries RM 44.20 RM 5,000.00\nClosing balance RM 5,000.00";
  const rows = parseStatement(text, 2026);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].date, "2026-11-15");
  assert.equal(rows[0].amount, "12.50");
  assert.match(rows[1].warning, /incoming/);
  assert.match(rows[2].warning, /Multiple amounts/);
  assert.ok(rows.every((r) => !r.selected && r.category === "Unknown"));
  assert.equal(rows[2].date, "2026-11-16");
  assert.equal(parseStatement("Coffee RM 12.50", 2026)[0].date, "");
  assert.equal(
    duplicateExpense(rows[0], [
      { date: "2026-11-15", item: " coffee shop ", amount: 12.5 },
    ]),
    true,
  );
});
const tab = {
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
    ["TOTAL", 4000, null, null, null, "2026-11-02", "Coffee", 10, "Food"],
    ["FIXED MONTHLY COMMITMENT"],
    ["LOAN", 100],
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
    [null, null, null, null, null, null, null, null, null, null, "Bank", 5000],
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
      "GOLD BAR",
      2000,
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
      "TOTAL NET WORTH",
      7000,
    ],
  ],
};
test("legacy migration reads real sections, excludes aggregate assets and requires actual balance dates", () => {
  const m = parseLegacyTab(tab);
  assert.equal(m.income.length, 1);
  assert.equal(m.commitments[0].amount, 100);
  assert.equal(m.expenses[0].date, "2026-11-02");
  assert.equal(m.balances.length, 2);
  const w = createWorkspace(),
    choices = defaultLegacyChoices([m], w),
    mapping = m.balances.map((b) => ({
      name: b.name,
      accountId: "",
      kind: "other",
      liquid: false,
    }));
  const noDates = migrateLegacy(w, [m], choices, mapping, today);
  assert.equal(noDates.report.snapshots, 0);
  assert.equal(noDates.report.undatedBalances, 2);
  assert.equal(noDates.report.expenses, 1);
  assert.equal(w.financePlanning.cycles.length, 0);
  choices[0].balanceDate = "2026-11-10";
  const result = migrateLegacy(w, [m], choices, mapping, today);
  assert.ok(isWorkspace(result.workspace));
  assert.equal(result.report.snapshots, 2);
  assert.equal(result.workspace.financePortfolio.loans.length, 0);
  assert.equal(result.workspace.financePortfolio.accounts.length, 2);
  assert.equal(portfolioTotals(result.workspace.financePortfolio).assets, 7000);
  const again = migrateLegacy(result.workspace, [m], choices, mapping, today);
  assert.equal(again.report.snapshots, 0);
  assert.equal(again.report.expenses, 0);
  assert.equal(again.report.rows, 0);
  assert.equal(again.report.accounts, 0);
  const b = createBackend(result.workspace);
  assert.equal(b.get().workspace.financePortfolio.snapshots.length, 2);
});
test("legacy undated transactions never acquire invented dates; conflicts do not overwrite a plan", () => {
  const m = parseLegacyTab({
    name: "Feb 26",
    sheetId: 1,
    values: [
      ["INCOME"],
      ["Salary", 4000, null, "ITEM", "VALUE", "CATEGORY"],
      [null, null, null, "Mom", 1000, "Family"],
    ],
  });
  assert.equal(m.expenses.length, 0);
  assert.equal(m.undated, 1);
  const w = createWorkspace();
  w.financePlanning.cycles = [
    { id: "custom", month: "2026-02", start: "2026-01-26", end: "2026-02-25" },
  ];
  const choices = defaultLegacyChoices([m], w);
  assert.equal(choices[0].start, "2026-01-26");
  choices[0].start = "2026-01-27";
  assert.throws(
    () => migrateLegacy(w, [m], choices, [], today),
    /dates differ/,
  );
});

test("source preview only reads the configured Sheet and serializes date cells", () => {
  const b = createBackend(createWorkspace());
  let opened = "";
  b.context.SpreadsheetApp.openById = (id) => {
    opened = id;
    return {
      getSheets: () => [
        {
          getName: () => "Nov 26",
          getSheetId: () => 12,
          getLastRow: () => 2,
          getRange: () => ({
            getValues: () => [
              ["INCOME"],
              ["Salary", 123, new Date("2026-11-01T12:00Z")],
            ],
          }),
        },
        { getName: () => "DATA" },
      ],
    };
  };
  const result = JSON.parse(
    b.context.doGet({
      parameter: { action: "previewBudgetImport", spreadsheetId: "untrusted" },
    }).body,
  );
  assert.equal(opened, "17CyWN68zCkijc1drXUbIFbHXs76I5ayEexWB6GpdKak");
  assert.equal(result.tabs.length, 1);
  assert.equal(result.tabs[0].values[1][2], "2026-11-01");
});
test("migration skips future source dates, supports corrected dates and avoids duplicate commitment payments", () => {
  const m = parseLegacyTab({ ...tab, values: structuredClone(tab.values) });
  m.expenses.push({
    ...m.expenses[0],
    row: 50,
    date: "2099-05-12",
    item: "Future source typo",
    category: "Loan",
  });
  const w = createWorkspace(),
    choices = defaultLegacyChoices([m], w);
  assert.equal(choices[0].includeCommitments, false);
  let result = migrateLegacy(w, [m], choices, [], today);
  assert.equal(result.report.excludedDates, 1);
  assert.equal(result.report.skippedCommitments, 1);
  choices[0].expenseDates = { 50: "2026-11-12" };
  result = migrateLegacy(w, [m], choices, [], today);
  assert.equal(result.report.excludedDates, 0);
  assert.equal(result.workspace.financeExpenses.at(-1).date, "2026-11-12");
});

test("date-only balances link only to their dated budget period and preserve other periods", async () => {
  const { syncPortfolioBalances } =
    await import("../src/finance/portfolio-model.ts");
  const w = createWorkspace();
  w.financePortfolio.accounts = [account];
  w.financePlanning.cycles = [
    { id: "nov", month: "2026-11", start: "2026-10-27", end: "2026-11-26" },
    { id: "dec", month: "2026-12", start: "2026-11-27", end: "2026-12-26" },
  ];
  w.financePortfolio.snapshots = [
    {
      id: "b",
      accountId: "bank",
      cycleId: "",
      phase: "current",
      date: today,
      value: 500,
      units: 0,
      price: 0,
      updatedAt: today + "T12:00Z",
    },
  ];
  let p = syncPortfolioBalances(w.financePlanning, w.financePortfolio, "nov");
  assert.equal(p.rows[0].amount, 500);
  p = syncPortfolioBalances(p, w.financePortfolio, "dec");
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].cycleId, "nov");
});
