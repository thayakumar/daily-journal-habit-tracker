import {
  validDate,
  shiftMonth,
  type FinanceCycle,
  type FinancePlanning,
} from "./planning.ts";
export type AccountKind =
  | "bank"
  | "cash"
  | "wallet"
  | "gold"
  | "investment"
  | "other";
export type Phase = "opening" | "current" | "closing";
export interface PortfolioAccount {
  id: string;
  name: string;
  kind: AccountKind;
  liquid: boolean;
  maskedRef: string;
  vaultUrl: string;
  costBasis: number;
  planName: string;
  trackingFrom: string;
}
export interface PortfolioSnapshot {
  id: string;
  accountId: string;
  cycleId: string;
  phase: Phase;
  date: string;
  value: number;
  units: number;
  price: number;
  updatedAt: string;
}
export interface PortfolioFlow {
  id: string;
  cycleId: string;
  date: string;
  kind: "transfer" | "contribution" | "withdrawal" | "fee";
  fromId: string;
  toId: string;
  amount: number;
  budgetIncluded: boolean;
}
export interface PortfolioLoan {
  id: string;
  name: string;
  principal: number;
  balance: number;
  apr: number;
  payment: number;
  rateType: "reducing" | "flat";
  asOf: string;
  nextDue: string;
  planName: string;
  startDate: string;
}
export interface DebtSnapshot {
  id: string;
  loanId: string;
  cycleId: string;
  phase: Phase;
  date: string;
  balance: number;
  updatedAt: string;
}
export interface PortfolioSubscription {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly" | "weekly";
  nextDue: string;
  active: boolean;
  accountId: string;
  manageUrl: string;
  planName: string;
  startDate: string;
}
export interface PortfolioGoal {
  id: string;
  name: string;
  target: number;
  deadline: string;
  monthlyContribution: number;
}
export interface PortfolioAllocation {
  id: string;
  goalId: string;
  accountId: string;
  amount: number;
}
export interface FinancePortfolio {
  accounts: PortfolioAccount[];
  snapshots: PortfolioSnapshot[];
  flows: PortfolioFlow[];
  loans: PortfolioLoan[];
  debtSnapshots: DebtSnapshot[];
  subscriptions: PortfolioSubscription[];
  goals: PortfolioGoal[];
  allocations: PortfolioAllocation[];
}
export const emptyPortfolio = (): FinancePortfolio => ({
  accounts: [],
  snapshots: [],
  flows: [],
  loans: [],
  debtSnapshots: [],
  subscriptions: [],
  goals: [],
  allocations: [],
});
export const roundMoney = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const total = (ns: number[]) => roundMoney(ns.reduce((s, n) => s + n, 0));
export function safeVaultLink(value: string) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ![...u.searchParams.keys()].some((k) =>
        /^(password|passcode|pin|otp|secret|token|access_token)$/i.test(k),
      )
    );
  } catch {
    return false;
  }
}
const fields = {
  accounts: [
    "id",
    "name",
    "kind",
    "liquid",
    "maskedRef",
    "vaultUrl",
    "costBasis",
    "planName",
    "trackingFrom",
  ],
  snapshots: [
    "id",
    "accountId",
    "cycleId",
    "phase",
    "date",
    "value",
    "units",
    "price",
    "updatedAt",
  ],
  flows: [
    "id",
    "cycleId",
    "date",
    "kind",
    "fromId",
    "toId",
    "amount",
    "budgetIncluded",
  ],
  loans: [
    "id",
    "name",
    "principal",
    "balance",
    "apr",
    "payment",
    "rateType",
    "asOf",
    "nextDue",
    "planName",
    "startDate",
  ],
  debtSnapshots: [
    "id",
    "loanId",
    "cycleId",
    "phase",
    "date",
    "balance",
    "updatedAt",
  ],
  subscriptions: [
    "id",
    "name",
    "amount",
    "frequency",
    "nextDue",
    "active",
    "accountId",
    "manageUrl",
    "planName",
    "startDate",
  ],
  goals: ["id", "name", "target", "deadline", "monthlyContribution"],
  allocations: ["id", "goalId", "accountId", "amount"],
} as const;
export function isFinancePortfolio(value: unknown): value is FinancePortfolio {
  if (!value || typeof value !== "object") return false;
  const p = value as FinancePortfolio;
  if (Object.keys(p).some((k) => !(k in fields))) return false;
  for (const key of Object.keys(fields) as (keyof FinancePortfolio)[]) {
    const rows = p[key];
    if (
      !Array.isArray(rows) ||
      new Set(rows.map((r) => r?.id)).size !== rows.length
    )
      return false;
    for (const r of rows) {
      if (
        !r ||
        typeof r !== "object" ||
        typeof r.id !== "string" ||
        !r.id ||
        Object.keys(r).some(
          (k) => !(fields[key] as readonly string[]).includes(k),
        ) ||
        fields[key].some((k) => !(k in r))
      )
        return false;
    }
  }
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  const text = (v: unknown) => typeof v === "string";
  const named = (r: { name: string }) => text(r.name) && !!r.name.trim();
  if (
    !p.accounts.every(
      (a) =>
        named(a) &&
        ["bank", "cash", "wallet", "gold", "investment", "other"].includes(
          a.kind,
        ) &&
        typeof a.liquid === "boolean" &&
        text(a.maskedRef) &&
        /^(\d{4})?$/.test(a.maskedRef) &&
        text(a.vaultUrl) &&
        safeVaultLink(a.vaultUrl) &&
        num(a.costBasis) &&
        text(a.planName) &&
        validDate(a.trackingFrom),
    )
  )
    return false;
  const account = (id: string) => p.accounts.some((a) => a.id === id),
    loan = (id: string) => p.loans.some((l) => l.id === id);
  const phase = (v: unknown) =>
    ["opening", "current", "closing"].includes(String(v));
  const stamp = (v: unknown) =>
    text(v) && Number.isFinite(Date.parse(String(v)));
  if (
    !p.snapshots.every(
      (s) =>
        account(s.accountId) &&
        text(s.cycleId) &&
        phase(s.phase) &&
        validDate(s.date) &&
        num(s.value) &&
        num(s.units) &&
        num(s.price) &&
        stamp(s.updatedAt),
    )
  )
    return false;
  if (
    !p.loans.every(
      (l) =>
        named(l) &&
        num(l.principal) &&
        num(l.balance) &&
        num(l.apr) &&
        l.apr <= 1000 &&
        num(l.payment) &&
        ["flat", "reducing"].includes(l.rateType) &&
        (l.rateType !== "flat" || l.principal >= l.balance) &&
        validDate(l.asOf) &&
        validDate(l.nextDue) &&
        text(l.planName) &&
        validDate(l.startDate) &&
        l.startDate <= l.asOf,
    )
  )
    return false;
  if (
    !p.debtSnapshots.every(
      (s) =>
        loan(s.loanId) &&
        text(s.cycleId) &&
        phase(s.phase) &&
        validDate(s.date) &&
        num(s.balance) &&
        stamp(s.updatedAt),
    )
  )
    return false;
  if (
    !p.flows.every(
      (f) =>
        text(f.cycleId) &&
        validDate(f.date) &&
        num(f.amount) &&
        f.amount > 0 &&
        typeof f.budgetIncluded === "boolean" &&
        ((f.kind === "transfer" &&
          account(f.fromId) &&
          account(f.toId) &&
          f.fromId !== f.toId) ||
          (f.kind === "contribution" && !f.fromId && account(f.toId)) ||
          (["withdrawal", "fee"].includes(f.kind) &&
            account(f.fromId) &&
            !f.toId)),
    )
  )
    return false;
  if (
    !p.subscriptions.every(
      (s) =>
        named(s) &&
        num(s.amount) &&
        ["weekly", "monthly", "quarterly", "yearly"].includes(s.frequency) &&
        validDate(s.nextDue) &&
        typeof s.active === "boolean" &&
        text(s.accountId) &&
        (!s.accountId || account(s.accountId)) &&
        text(s.manageUrl) &&
        safeVaultLink(s.manageUrl) &&
        text(s.planName) &&
        validDate(s.startDate),
    )
  )
    return false;
  if (
    !p.goals.every(
      (g) =>
        named(g) &&
        num(g.target) &&
        g.target > 0 &&
        validDate(g.deadline) &&
        num(g.monthlyContribution),
    )
  )
    return false;
  if (
    !p.allocations.every(
      (a) =>
        account(a.accountId) &&
        p.goals.some((g) => g.id === a.goalId) &&
        num(a.amount),
    )
  )
    return false;
  if (
    new Set(p.allocations.map((a) => `${a.accountId}|${a.goalId}`)).size !==
    p.allocations.length
  )
    return false;
  for (const rows of [
    p.snapshots.map((s) => [s.accountId, s.cycleId, s.phase, s.date]),
    p.debtSnapshots.map((s) => [s.loanId, s.cycleId, s.phase, s.date]),
  ])
    if (
      new Set(
        rows.map(
          (r) =>
            r.slice(0, 3).join("|") + (r[2] === "current" ? "|" + r[3] : ""),
        ),
      ).size !== rows.length
    )
      return false;
  return true;
}
export function portfolioCycleError(
  p: FinancePortfolio,
  cycles: FinanceCycle[],
  today?: string,
): string {
  for (const s of [...p.snapshots, ...p.debtSnapshots]) {
    const c = cycles.find((c) => c.id === s.cycleId);
    if (
      !c ||
      s.date < c.start ||
      s.date > c.end ||
      (s.phase === "opening" && s.date !== c.start) ||
      (s.phase === "closing" && s.date !== c.end)
    )
      return "Balance dates must match their salary cycle and opening/closing phase.";
    if (today && s.date > today)
      return "Future balances are forecasts. Record a current balance now and close the cycle after it ends.";
  }
  for (const f of p.flows) {
    const c = cycles.find((c) => c.id === f.cycleId);
    if (!c || f.date < c.start || f.date > c.end || (today && f.date > today))
      return "Money movements need a date within the selected cycle, up to today.";
  }
  if (today && p.loans.some((l) => l.asOf > today))
    return "Loan balances must use a date up to today.";
  return "";
}
export function latestSnapshot(
  p: FinancePortfolio,
  accountId: string,
  cycleId?: string,
  phase?: Phase,
) {
  return p.snapshots
    .filter(
      (s) =>
        s.accountId === accountId &&
        (!cycleId || s.cycleId === cycleId) &&
        (!phase || s.phase === phase),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        { opening: 0, current: 1, closing: 2 }[b.phase] -
          { opening: 0, current: 1, closing: 2 }[a.phase] ||
        b.updatedAt.localeCompare(a.updatedAt),
    )[0];
}
export function latestDebt(
  p: FinancePortfolio,
  loanId: string,
  cycleId?: string,
  phase?: Phase,
) {
  return p.debtSnapshots
    .filter(
      (s) =>
        s.loanId === loanId &&
        (!cycleId || s.cycleId === cycleId) &&
        (!phase || s.phase === phase),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        { opening: 0, current: 1, closing: 2 }[b.phase] -
          { opening: 0, current: 1, closing: 2 }[a.phase] ||
        b.updatedAt.localeCompare(a.updatedAt),
    )[0];
}
export function loanCurrentBalance(p: FinancePortfolio, l: PortfolioLoan) {
  const s = latestDebt(p, l.id);
  return s && s.date >= l.asOf
    ? { balance: s.balance, date: s.date }
    : { balance: l.balance, date: l.asOf };
}
export function portfolioTotals(p: FinancePortfolio) {
  const values = p.accounts.map((a) => ({
    account: a,
    snapshot: latestSnapshot(p, a.id),
  }));
  const debt = total(p.loans.map((l) => loanCurrentBalance(p, l).balance));
  const assets = total(values.map((v) => v.snapshot?.value ?? 0));
  return {
    values,
    assets,
    debt,
    netWorth: roundMoney(assets - debt),
    bank: total(
      values
        .filter((v) => v.account.kind === "bank")
        .map((v) => v.snapshot?.value ?? 0),
    ),
    liquid: total(
      values.filter((v) => v.account.liquid).map((v) => v.snapshot?.value ?? 0),
    ),
    gold: total(
      values
        .filter((v) => v.account.kind === "gold")
        .map((v) => v.snapshot?.value ?? 0),
    ),
    investments: total(
      values
        .filter((v) => v.account.kind === "investment")
        .map((v) => v.snapshot?.value ?? 0),
    ),
    missing: values.filter((v) => !v.snapshot).length,
  };
}
export function addMonths(date: string, months: number) {
  const month = shiftMonth(date.slice(0, 7), months);
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(Number(date.slice(8)), new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
}
export function loanForecast(
  loan: PortfolioLoan,
  extra = 0,
  balance = loan.balance,
) {
  let remaining = roundMoney(balance),
    interest = 0;
  const payment = roundMoney(loan.payment + extra);
  if (!remaining)
    return {
      months: 0,
      interest: 0,
      total: 0,
      completion: loan.asOf,
      amortizes: true,
    };
  if (payment <= 0)
    return {
      months: 0,
      interest: 0,
      total: 0,
      completion: "",
      amortizes: false,
    };
  let months = 0;
  while (remaining > 0 && months < 1200) {
    const charge = roundMoney(
      ((loan.rateType === "flat" ? loan.principal : remaining) * loan.apr) /
        1200,
    );
    if (payment <= charge)
      return {
        months: 0,
        interest: 0,
        total: 0,
        completion: "",
        amortizes: false,
      };
    remaining = roundMoney(
      Math.max(0, remaining - Math.min(remaining, payment - charge)),
    );
    interest = roundMoney(interest + charge);
    months++;
  }
  return {
    months,
    interest,
    total: roundMoney(balance + interest),
    completion: remaining > 0 ? "" : addMonths(loan.nextDue, months - 1),
    amortizes: remaining === 0,
  };
}
export function subscriptionMonthly(s: PortfolioSubscription) {
  return s.active
    ? roundMoney(
        s.amount *
          { monthly: 1, quarterly: 1 / 3, yearly: 1 / 12, weekly: 52 / 12 }[
            s.frequency
          ],
      )
    : 0;
}
export function dueCount(
  anchor: string,
  frequency: PortfolioSubscription["frequency"],
  cycle: FinanceCycle,
) {
  if (frequency === "weekly") {
    const step = 7 * 86400000,
      start = Date.parse(cycle.start),
      end = Date.parse(cycle.end),
      base = Date.parse(anchor);
    const n = Math.ceil((start - base) / step);
    return Math.max(0, Math.floor((end - (base + n * step)) / step) + 1);
  }
  const step = { monthly: 1, quarterly: 3, yearly: 12 }[frequency];
  const diff =
    (Number(cycle.start.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 +
    Number(cycle.start.slice(5, 7)) -
    Number(anchor.slice(5, 7));
  const first = Math.floor(diff / step) - 1;
  let count = 0;
  for (let i = first; i < first + 1200; i++) {
    const date = addMonths(anchor, i * step);
    if (date > cycle.end) break;
    if (date >= cycle.start) count++;
  }
  return count;
}
export function goalProgress(
  p: FinancePortfolio,
  goal: PortfolioGoal,
  today: string,
  override?: { accountId: string; value: number },
  monthly = goal.monthlyContribution,
) {
  let progressCents = 0;
  for (const account of p.accounts) {
    const allocations = p.allocations
      .filter((a) => a.accountId === account.id && a.amount > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const assigned = allocations.reduce(
      (sum, a) => sum + Math.round(a.amount * 100),
      0,
    );
    if (!assigned) continue;
    const value =
      override?.accountId === account.id
        ? override.value
        : (latestSnapshot(p, account.id)?.value ?? 0);
    const available = Math.min(assigned, Math.max(0, Math.round(value * 100)));
    const shares = allocations.map((a) =>
      Math.floor((Math.round(a.amount * 100) * available) / assigned),
    );
    let remainder = available - shares.reduce((sum, n) => sum + n, 0);
    allocations.forEach((allocation, i) => {
      const share = shares[i] + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      if (allocation.goalId === goal.id) progressCents += share;
    });
  }
  const progress = progressCents / 100;
  const remaining = Math.max(0, roundMoney(goal.target - progress)),
    days = Math.ceil(
      (Date.parse(goal.deadline) - Date.parse(today)) / 86400000,
    ),
    months = Math.max(1, Math.ceil(days / 30.4375));
  const required =
    remaining === 0 ? 0 : days < 0 ? null : roundMoney(remaining / months);
  const completion =
    remaining === 0
      ? today
      : monthly > 0
        ? addMonths(today, Math.ceil(remaining / monthly))
        : "";
  return {
    progress,
    remaining,
    required,
    overdue: days < 0 && remaining > 0,
    completion,
    onTrack: remaining === 0 || (!!completion && completion <= goal.deadline),
  };
}
export function cycleReconciliation(
  p: FinancePortfolio,
  cycle: FinanceCycle,
  loggedSurplus: number,
) {
  const missing: string[] = [];
  let opening = 0,
    closing = 0,
    investmentReturn = 0,
    debtReduction = 0,
    external = 0,
    feesAlreadyLogged = 0;
  const trackedAccounts = p.accounts.filter(
    (a) =>
      a.trackingFrom <= cycle.end ||
      p.snapshots.some((s) => s.accountId === a.id && s.cycleId === cycle.id),
  );
  for (const a of trackedAccounts) {
    const start = latestSnapshot(p, a.id, cycle.id, "opening"),
      end = latestSnapshot(p, a.id, cycle.id, "closing");
    if (!start || !end) {
      missing.push(a.name);
      continue;
    }
    opening += start.value;
    closing += end.value;
    if (a.kind === "investment" || a.kind === "gold") {
      const flows = p.flows.filter((f) => f.cycleId === cycle.id);
      const incoming = total(
        flows.filter((f) => f.toId === a.id).map((f) => f.amount),
      );
      const outgoing = total(
        flows
          .filter((f) => f.fromId === a.id && f.kind !== "fee")
          .map((f) => f.amount),
      );
      investmentReturn += end.value - start.value - incoming + outgoing;
      feesAlreadyLogged += total(
        flows
          .filter(
            (f) => f.fromId === a.id && f.kind === "fee" && f.budgetIncluded,
          )
          .map((f) => f.amount),
      );
    }
  }
  for (const l of p.loans.filter(
    (l) =>
      (l.startDate <= cycle.end &&
        (loanCurrentBalance(p, l).balance > 0 ||
          loanCurrentBalance(p, l).date >= cycle.start)) ||
      p.debtSnapshots.some((s) => s.loanId === l.id && s.cycleId === cycle.id),
  )) {
    const start = latestDebt(p, l.id, cycle.id, "opening"),
      end = latestDebt(p, l.id, cycle.id, "closing");
    if (!start || !end) {
      missing.push(l.name + " (loan)");
      continue;
    }
    opening -= start.balance;
    closing -= end.balance;
    debtReduction += start.balance - end.balance;
  }
  for (const f of p.flows.filter(
    (f) => f.cycleId === cycle.id && !f.budgetIncluded,
  )) {
    if (f.kind === "contribution") external += f.amount;
    if (f.kind === "withdrawal") external -= f.amount;
    if (
      f.kind === "fee" &&
      !p.accounts.some(
        (a) => a.id === f.fromId && ["gold", "investment"].includes(a.kind),
      )
    )
      external -= f.amount;
  }
  const complete = trackedAccounts.length > 0 && !missing.length;
  const movement = roundMoney(closing - opening),
    explained = total([
      loggedSurplus,
      investmentReturn,
      debtReduction,
      external,
      feesAlreadyLogged,
    ]);
  return {
    complete,
    missing,
    opening: roundMoney(opening),
    closing: roundMoney(closing),
    movement: complete ? movement : null,
    investmentReturn: roundMoney(investmentReturn),
    debtReduction: roundMoney(debtReduction),
    external: roundMoney(external),
    unreconciled: complete ? roundMoney(movement - explained) : null,
  };
}
export function syncPortfolioBalances(
  planning: FinancePlanning,
  p: FinancePortfolio,
  cycleId: string,
): FinancePlanning {
  let rows = planning.rows.filter(
    (r) =>
      !(
        r.cycleId === cycleId &&
        r.kind === "balance" &&
        r.id.startsWith("portfolio:balance:")
      ),
  );
  for (const a of p.accounts) {
    const s = latestSnapshot(p, a.id, cycleId);
    if (!s) continue;
    const id = `portfolio:balance:${a.id}:${cycleId}`;
    rows = rows.filter(
      (r) =>
        !(
          r.cycleId === cycleId &&
          r.kind === "balance" &&
          (r.id === id || (a.planName && r.name === a.planName))
        ),
    );
    rows.push({
      id,
      cycleId,
      kind: "balance",
      name: a.name,
      amount: s.value,
      categories: [],
      liquid: a.liquid,
    });
  }
  return { ...planning, rows };
}
export function syncPortfolioCommitments(
  planning: FinancePlanning,
  p: FinancePortfolio,
  cycle: FinanceCycle,
  asOf?: string,
): FinancePlanning {
  if (asOf && cycle.end < asOf) return planning;
  let rows = planning.rows.filter(
    (r) =>
      !(
        r.cycleId === cycle.id &&
        r.kind === "commitment" &&
        /^portfolio:(loan|subscription):/.test(r.id)
      ),
  );
  for (const item of [
    ...p.loans.map((l) => ({
      id: l.id,
      name: l.name,
      planName: l.planName,
      kind: "loan",
      amount:
        loanCurrentBalance(p, l).balance > 0
          ? l.payment *
            (l.startDate > cycle.end
              ? 0
              : dueCount(l.nextDue, "monthly", {
                  ...cycle,
                  start: l.startDate > cycle.start ? l.startDate : cycle.start,
                }))
          : 0,
    })),
    ...p.subscriptions.map((s) => ({
      id: s.id,
      name: s.name,
      planName: s.planName,
      kind: "subscription",
      amount: s.active
        ? s.amount *
          (s.startDate > cycle.end
            ? 0
            : dueCount(s.nextDue, s.frequency, {
                ...cycle,
                start: s.startDate > cycle.start ? s.startDate : cycle.start,
              }))
        : 0,
    })),
  ]) {
    const id = `portfolio:${item.kind}:${item.id}:${cycle.id}`;
    rows = rows.filter(
      (r) =>
        !(
          r.cycleId === cycle.id &&
          r.kind === "commitment" &&
          (r.id === id || (item.planName && r.name === item.planName))
        ),
    );
    if (item.amount > 0)
      rows.push({
        id,
        cycleId: cycle.id,
        kind: "commitment",
        name: item.name,
        amount: roundMoney(item.amount),
        categories: [],
        liquid: false,
      });
  }
  return { ...planning, rows };
}
export function purchaseSimulation(
  amount: number,
  deposit: number,
  apr: number,
  months: number,
  rateType: "flat" | "reducing",
  cash: number,
  headroom: number,
  reserve: number,
) {
  const principal = Math.max(0, amount - deposit),
    r = apr / 1200,
    payment =
      principal === 0
        ? 0
        : rateType === "flat"
          ? principal / months + principal * r
          : r === 0
            ? principal / months
            : (principal * r) / (1 - Math.pow(1 + r, -months));
  return {
    principal: roundMoney(principal),
    payment: roundMoney(payment),
    interest: roundMoney(payment * months - principal),
    total: roundMoney(payment * months + deposit),
    cashAfter: roundMoney(cash - deposit),
    headroomAfter: roundMoney(headroom - payment),
    reserveGap: roundMoney(Math.max(0, reserve - (cash - deposit))),
  };
}

export function investmentPerformance(
  p: FinancePortfolio,
  cycle: FinanceCycle,
) {
  return p.accounts
    .filter((a) => a.kind === "gold" || a.kind === "investment")
    .map((account) => {
      const opening = latestSnapshot(p, account.id, cycle.id, "opening"),
        closing = latestSnapshot(p, account.id, cycle.id, "closing");
      const flows = p.flows.filter((f) => f.cycleId === cycle.id);
      const netDeposits =
        total(flows.filter((f) => f.toId === account.id).map((f) => f.amount)) -
        total(
          flows
            .filter((f) => f.fromId === account.id && f.kind !== "fee")
            .map((f) => f.amount),
        );
      return {
        account,
        opening: opening?.value ?? null,
        closing: closing?.value ?? null,
        netDeposits: roundMoney(netDeposits),
        result:
          opening && closing
            ? roundMoney(closing.value - opening.value - netDeposits)
            : null,
      };
    });
}

export function goalScenarioProgress(
  p: FinancePortfolio,
  goal: PortfolioGoal,
  today: string,
  override: { accountId: string; value: number },
  payment: number,
  loanMonths: number,
) {
  const base = goalProgress(p, goal, today, override);
  let remaining = base.remaining,
    months = 0;
  while (remaining > 0 && months < 1200) {
    months++;
    const contribution = Math.max(
      0,
      goal.monthlyContribution - (months <= loanMonths ? payment : 0),
    );
    remaining = roundMoney(Math.max(0, remaining - contribution));
    if (months > loanMonths && contribution === 0) break;
  }
  return {
    ...base,
    completion: remaining === 0 ? addMonths(today, months) : "",
    months: remaining === 0 ? months : null,
  };
}
