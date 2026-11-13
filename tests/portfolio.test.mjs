import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyPortfolio,
  isFinancePortfolio,
  portfolioCycleError,
  portfolioTotals,
  latestSnapshot,
  loanCurrentBalance,
  loanForecast,
  goalProgress,
  goalScenarioProgress,
  addMonths,
  cycleReconciliation,
  investmentPerformance,
  purchaseSimulation,
  syncPortfolioBalances,
  syncPortfolioCommitments,
  dueCount,
  subscriptionMonthly,
} from "../src/finance/portfolio-model.ts";
import { createWorkspace, isWorkspace } from "../src/workspace/model.ts";
import { createBackend } from "./apps-script-mock.mjs";
const cycle = {
  id: "cycle",
  month: "2020-02",
  start: "2020-01-27",
  end: "2020-02-26",
};
const account = (id, kind = "bank", extra = {}) => ({
  id,
  name: id,
  kind,
  liquid: kind === "bank",
  maskedRef: kind === "bank" ? "0123" : "",
  vaultUrl: "",
  costBasis: 0,
  planName: "",
  trackingFrom: "2000-01-01",
  ...extra,
});
const snap = (
  id,
  accountId,
  phase,
  value,
  date = phase === "opening" ? cycle.start : cycle.end,
  extra = {},
) => ({
  id,
  accountId,
  cycleId: cycle.id,
  phase,
  date,
  value,
  units: 0,
  price: 0,
  updatedAt: "2020-02-26T12:00:00Z",
  ...extra,
});
const loan = {
  id: "loan",
  name: "Loan",
  principal: 1000,
  balance: 910,
  apr: 12,
  payment: 100,
  rateType: "reducing",
  asOf: cycle.end,
  nextDue: "2020-03-31",
  planName: "",
  startDate: "2020-01-01",
};
function fixture() {
  const p = emptyPortfolio();
  p.accounts = [account("bank"), account("versa", "investment")];
  p.snapshots = [
    snap("bo", "bank", "opening", 1000),
    snap("bc", "bank", "closing", 1100),
    snap("io", "versa", "opening", 2000),
    snap("ic", "versa", "closing", 2500),
  ];
  p.flows = [
    {
      id: "transfer",
      cycleId: cycle.id,
      date: "2020-02-01",
      kind: "transfer",
      fromId: "bank",
      toId: "versa",
      amount: 600,
      budgetIncluded: false,
    },
  ];
  p.loans = [loan];
  p.debtSnapshots = [
    {
      id: "lo",
      loanId: "loan",
      cycleId: cycle.id,
      phase: "opening",
      date: cycle.start,
      balance: 1000,
      updatedAt: "2020-02-26T12:00:00Z",
    },
    {
      id: "lc",
      loanId: "loan",
      cycleId: cycle.id,
      phase: "closing",
      date: cycle.end,
      balance: 910,
      updatedAt: "2020-02-26T12:00:00Z",
    },
  ];
  return p;
}
test("net worth counts each account once and subtracts the latest dated loan balance", () => {
  const p = fixture();
  const s = portfolioTotals(p);
  assert.equal(s.assets, 3600);
  assert.equal(s.bank, 1100);
  assert.equal(s.debt, 910);
  assert.equal(s.netWorth, 2690);
  assert.equal(s.liquid, 1100);
  p.loans[0] = { ...loan, balance: 800, asOf: "2020-03-01" };
  assert.equal(loanCurrentBalance(p, p.loans[0]).balance, 800);
  assert.equal(portfolioTotals(p).netWorth, 2800);
  p.accounts.push(account("missing"));
  assert.equal(portfolioTotals(p).missing, 1);
});
test("investment deposits are excluded from returns; debt principal explains wealth versus budget surplus", () => {
  const p = fixture(),
    s = cycleReconciliation(p, cycle, 700);
  assert.equal(s.complete, true);
  assert.equal(s.investmentReturn, -100);
  assert.equal(s.debtReduction, 90);
  assert.equal(s.movement, 690);
  assert.equal(s.unreconciled, 0);
  assert.equal(investmentPerformance(p, cycle)[0].result, -100);
  assert.equal(investmentPerformance(p, cycle)[0].netDeposits, 600);
  p.snapshots = p.snapshots.filter((s) => s.id !== "ic");
  assert.equal(cycleReconciliation(p, cycle, 700).movement, null);
});
test("fees and external withdrawals reconcile without counting budgeted fees twice", () => {
  const p = emptyPortfolio();
  p.accounts = [account("fund", "investment")];
  p.snapshots = [
    snap("o", "fund", "opening", 1000),
    snap("c", "fund", "closing", 990),
  ];
  p.flows = [
    {
      id: "fee",
      cycleId: cycle.id,
      date: "2020-02-01",
      kind: "fee",
      fromId: "fund",
      toId: "",
      amount: 10,
      budgetIncluded: true,
    },
  ];
  assert.equal(cycleReconciliation(p, cycle, -10).unreconciled, 0);
  p.flows[0] = { ...p.flows[0], kind: "withdrawal", budgetIncluded: false };
  assert.equal(cycleReconciliation(p, cycle, 0).investmentReturn, 0);
  assert.equal(cycleReconciliation(p, cycle, 0).external, -10);
  assert.equal(cycleReconciliation(p, cycle, 0).unreconciled, 0);
});
test("goal allocations use real account value proportionally after a loss, never duplicate money", () => {
  const p = fixture();
  p.goals = [
    {
      id: "g1",
      name: "Emergency",
      target: 1000,
      deadline: "2020-12-31",
      monthlyContribution: 100,
    },
    {
      id: "g2",
      name: "Trip",
      target: 800,
      deadline: "2020-12-31",
      monthlyContribution: 50,
    },
  ];
  p.allocations = [
    { id: "a1", goalId: "g1", accountId: "bank", amount: 500 },
    { id: "a2", goalId: "g2", accountId: "bank", amount: 400 },
  ];
  assert.equal(goalProgress(p, p.goals[0], "2020-02-26").progress, 500);
  const first = goalProgress(p, p.goals[0], "2020-02-26", {
      accountId: "bank",
      value: 450,
    }),
    second = goalProgress(p, p.goals[1], "2020-02-26", {
      accountId: "bank",
      value: 450,
    });
  assert.equal(first.progress + second.progress, 450);
  assert.equal(goalProgress(p, p.goals[0], "2021-01-01").overdue, true);
});
test("loan estimates handle zero, reducing and flat rates, extra repayments and non-amortizing loans", () => {
  const zero = {
    ...loan,
    principal: 12000,
    balance: 12000,
    apr: 0,
    payment: 1000,
    nextDue: "2020-01-31",
  };
  assert.deepEqual(loanForecast(zero), {
    months: 12,
    interest: 0,
    total: 12000,
    completion: "2020-12-31",
    amortizes: true,
  });
  const flat = loanForecast({
    ...zero,
    apr: 12,
    payment: 1120,
    rateType: "flat",
  });
  assert.equal(flat.months, 12);
  assert.equal(flat.interest, 1440);
  const normal = loanForecast(loan),
    extra = loanForecast(loan, 50);
  assert.ok(extra.months < normal.months);
  assert.ok(extra.interest < normal.interest);
  assert.equal(loanForecast({ ...loan, payment: 1 }).amortizes, false);
});
test("renewal dates keep month-end anchors and annual charges stay in their actual cycle", () => {
  assert.equal(dueCount("2020-01-31", "monthly", cycle), 1);
  assert.equal(
    dueCount("2020-01-31", "monthly", {
      ...cycle,
      start: "2020-03-01",
      end: "2020-04-30",
    }),
    2,
  );
  assert.equal(
    dueCount("2020-01-31", "yearly", {
      ...cycle,
      start: "2020-02-27",
      end: "2020-03-26",
    }),
    0,
  );
  assert.equal(
    subscriptionMonthly({ active: true, frequency: "yearly", amount: 120 }),
    10,
  );
});
test("monthly integrations replace linked rows, preserve unrelated rows and remove inactive sources", () => {
  const p = fixture();
  p.accounts[0].planName = "Old bank";
  const plan = {
    defaultStartDay: 27,
    cycles: [cycle],
    rows: [
      {
        id: "old",
        cycleId: cycle.id,
        kind: "balance",
        name: "Old bank",
        amount: 1,
        categories: [],
        liquid: true,
      },
      {
        id: "unrelated",
        cycleId: cycle.id,
        kind: "balance",
        name: "Other",
        amount: 7,
        categories: [],
        liquid: true,
      },
    ],
  };
  const balances = syncPortfolioBalances(plan, p, cycle.id);
  assert.equal(
    balances.rows.find((r) => r.id === "old"),
    undefined,
  );
  assert.equal(balances.rows.find((r) => r.id === "unrelated").amount, 7);
  assert.equal(
    balances.rows.find((r) => r.id === `portfolio:balance:bank:${cycle.id}`)
      .amount,
    1100,
  );
  const loans = syncPortfolioCommitments(plan, p, {
    ...cycle,
    start: "2020-03-01",
    end: "2020-03-31",
  });
  assert.equal(
    loans.rows.find((r) => r.id.startsWith("portfolio:loan:")).amount,
    100,
  );
  const removed = syncPortfolioCommitments(loans, { ...p, loans: [] }, cycle);
  assert.equal(
    removed.rows.some((r) => r.id.startsWith("portfolio:loan:")),
    false,
  );
});
test("purchase scenarios calculate financing and reserve/headroom effects without mutating records", () => {
  const before = fixture(),
    copy = structuredClone(before);
  const s = purchaseSimulation(12000, 0, 0, 12, "reducing", 15000, 1500, 5000);
  assert.equal(s.payment, 1000);
  assert.equal(s.headroomAfter, 500);
  assert.equal(s.total, 12000);
  const cash = purchaseSimulation(
    12000,
    12000,
    0,
    12,
    "reducing",
    15000,
    1500,
    5000,
  );
  assert.equal(cash.cashAfter, 3000);
  assert.equal(cash.reserveGap, 2000);
  assert.deepEqual(before, copy);
});
test("validation rejects secrets, full account numbers, orphan records and invalid snapshot phases", () => {
  const p = fixture();
  assert.equal(isFinancePortfolio(p), true);
  assert.equal(
    isFinancePortfolio({
      ...p,
      accounts: [{ ...p.accounts[0], password: "secret" }],
    }),
    false,
  );
  assert.equal(
    isFinancePortfolio({
      ...p,
      accounts: [{ ...p.accounts[0], maskedRef: "1234567890" }],
    }),
    false,
  );
  assert.equal(
    isFinancePortfolio({
      ...p,
      accounts: [
        {
          ...p.accounts[0],
          vaultUrl: "https://vault.example/item?password=secret",
        },
      ],
    }),
    false,
  );
  assert.match(
    portfolioCycleError(
      { ...p, snapshots: [{ ...p.snapshots[0], date: "2020-01-28" }] },
      [cycle],
    ),
    /dates/,
  );
  const w = createWorkspace();
  w.financePlanning.cycles = [cycle];
  w.financePortfolio = p;
  assert.equal(isWorkspace(w), true);
  assert.equal(
    isWorkspace({ ...w, financePlanning: { cycles: "invalid" } }),
    false,
  );
});
test("all portfolio tables round trip, preserve masked references and survive older clients", () => {
  const w = createWorkspace();
  w.financePlanning.cycles = [cycle];
  w.financePortfolio = fixture();
  w.financePortfolio.subscriptions = [
    {
      id: "s",
      name: "Annual service",
      amount: 120,
      frequency: "yearly",
      nextDue: "2020-01-31",
      active: true,
      accountId: "bank",
      manageUrl: "https://example.com/billing",
      planName: "",
      startDate: "2020-01-01",
    },
  ];
  w.financePortfolio.goals = [
    {
      id: "g",
      name: "Goal",
      target: 1000,
      deadline: "2030-01-01",
      monthlyContribution: 100,
    },
  ];
  w.financePortfolio.allocations = [
    { id: "allocation", goalId: "g", accountId: "bank", amount: 500 },
  ];
  const b = createBackend(w),
    first = b.get();
  assert.equal(first.features.financePortfolio, true);
  assert.deepEqual(first.workspace.financePortfolio, w.financePortfolio);
  for (const name of [
    "PortfolioAccounts",
    "PortfolioSnapshots",
    "PortfolioFlows",
    "PortfolioLoans",
    "PortfolioDebtSnapshots",
    "PortfolioSubscriptions",
    "PortfolioGoals",
    "PortfolioAllocations",
  ])
    assert.ok(b.sheets.get(name).grid.length > 1, name);
  const old = structuredClone(first.workspace);
  delete old.financePortfolio;
  old.updatedAt++;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: old,
      baseRevision: first.workspaceRevision,
    }).success,
    true,
  );
  assert.deepEqual(b.get().workspace.financePortfolio, w.financePortfolio);
  const current = b.get(),
    bad = structuredClone(current.workspace);
  bad.financePortfolio = null;
  assert.equal(
    b.post({
      action: "saveWorkspace",
      data: bad,
      baseRevision: current.workspaceRevision,
    }).success,
    false,
  );
  assert.deepEqual(b.get().workspace.financePortfolio, w.financePortfolio);
});
test("request-local caching reuses reads but still sees edits on later requests", () => {
  const w = createWorkspace();
  w.financePlanning.cycles = [cycle];
  w.financePortfolio = fixture();
  const b = createBackend(w);
  b.get();
  b.metrics.bodyReads = {};
  const first = b.get();
  assert.equal(b.metrics.bodyReads.PortfolioAccounts, 1);
  b.sheets.get("PortfolioSnapshots").grid[2][5] = 1200;
  const next = b.get();
  assert.notEqual(next.workspaceRevision, first.workspaceRevision);
  assert.equal(next.workspace.financePortfolio.snapshots[1].value, 1200);
});

test("historical commitments are not recalculated from current loan or subscription settings", () => {
  const p = fixture();
  const plan = {
    defaultStartDay: 27,
    cycles: [cycle],
    rows: [
      {
        id: "portfolio:loan:loan:cycle",
        cycleId: "cycle",
        kind: "commitment",
        name: "Old payment",
        amount: 99,
        categories: [],
        liquid: false,
      },
    ],
  };
  assert.deepEqual(
    syncPortfolioCommitments(plan, p, cycle, "2026-11-12"),
    plan,
  );
});

test("loans paid off before a cycle do not require perpetual zero snapshots", () => {
  const p = fixture();
  p.debtSnapshots = [];
  p.loans = [{ ...loan, balance: 0, asOf: "2020-01-01" }];
  assert.equal(cycleReconciliation(p, cycle, 700).complete, true);
  assert.equal(cycleReconciliation(p, cycle, 700).debtReduction, 0);
});

test("simulated goal contributions resume after the loan finishes", () => {
  const p = fixture();
  const goal = {
    id: "g",
    name: "Goal",
    target: 1000,
    deadline: "2030-01-01",
    monthlyContribution: 100,
  };
  p.goals = [goal];
  p.allocations = [{ id: "a", goalId: "g", accountId: "bank", amount: 500 }];
  const scenario = goalScenarioProgress(
    p,
    goal,
    "2020-02-26",
    { accountId: "bank", value: 1100 },
    100,
    12,
  );
  assert.equal(scenario.months, 17);
  assert.equal(scenario.completion, addMonths("2020-02-26", 17));
  assert.equal(
    goalScenarioProgress(
      p,
      goal,
      "2020-02-26",
      { accountId: "bank", value: 1100 },
      50,
      2,
    ).months,
    6,
  );
});

test("one remaining cent cannot be counted by two goals after a market loss", () => {
  const p = fixture();
  p.goals = [
    {
      id: "g1",
      name: "One",
      target: 10,
      deadline: "2030-01-01",
      monthlyContribution: 1,
    },
    {
      id: "g2",
      name: "Two",
      target: 10,
      deadline: "2030-01-01",
      monthlyContribution: 1,
    },
  ];
  p.allocations = [
    { id: "a1", goalId: "g1", accountId: "bank", amount: 1 },
    { id: "a2", goalId: "g2", accountId: "bank", amount: 1 },
  ];
  const values = p.goals.map(
    (g) =>
      goalProgress(p, g, "2020-01-01", { accountId: "bank", value: 0.01 })
        .progress,
  );
  assert.equal(
    values.reduce((a, b) => a + b, 0),
    0.01,
  );
});
