import type { FinanceExpense } from "../workspace/model";
export type PlanKind = "income" | "commitment" | "budget" | "balance";
export interface FinanceCycle {
  id: string;
  month: string;
  start: string;
  end: string;
}
export interface FinancePlanRow {
  id: string;
  cycleId: string;
  kind: PlanKind;
  name: string;
  amount: number;
  categories: string[];
  liquid: boolean;
}
export interface FinancePlanning {
  defaultStartDay: number;
  cycles: FinanceCycle[];
  rows: FinancePlanRow[];
}
export const emptyPlanning = (): FinancePlanning => ({
  defaultStartDay: 27,
  cycles: [],
  rows: [],
});
export const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
const sum = (values: number[]) =>
  values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function monthName(month: string) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}
export function shiftMonth(month: string, shift: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + shift, 1));
  return d.toISOString().slice(0, 7);
}
function dayInMonth(month: string, day: number) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
}
export function cycleDates(month: string, day: number) {
  const start = dayInMonth(shiftMonth(month, -1), day);
  const next = new Date(`${dayInMonth(month, day)}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() - 1);
  return { start, end: next.toISOString().slice(0, 10) };
}
export function activeMonth(today: string, day: number) {
  return today >= dayInMonth(today.slice(0, 7), day)
    ? shiftMonth(today.slice(0, 7), 1)
    : today.slice(0, 7);
}
export function cycleError(cycle: FinanceCycle, cycles: FinanceCycle[]) {
  if (
    !/^\d{4}-\d{2}$/.test(cycle.month) ||
    !validDate(`${cycle.month}-01`) ||
    !validDate(cycle.start) ||
    !validDate(cycle.end) ||
    cycle.start > cycle.end
  )
    return "Enter a valid month and a start date on or before the end date.";
  if (cycles.some((c) => c.id !== cycle.id && c.month === cycle.month))
    return "A cycle already exists for this month.";
  if (
    cycles.some(
      (c) => c.id !== cycle.id && cycle.start <= c.end && cycle.end >= c.start,
    )
  )
    return "These dates overlap another cycle. Adjust the dates so each expense belongs to one cycle.";
  return "";
}
export function cycleExpenses(expenses: FinanceExpense[], cycle: FinanceCycle) {
  return expenses.filter((e) => e.date >= cycle.start && e.date <= cycle.end);
}
export function summarizeCycle(
  planning: FinancePlanning,
  expenses: FinanceExpense[],
  cycle: FinanceCycle,
) {
  const rows = planning.rows.filter((r) => r.cycleId === cycle.id),
    transactions = cycleExpenses(expenses, cycle);
  const income = sum(
    rows.filter((r) => r.kind === "income").map((r) => r.amount),
  );
  const commitments = sum(
    rows.filter((r) => r.kind === "commitment").map((r) => r.amount),
  );
  const spent = sum(transactions.map((e) => e.amount));
  const planned = sum(
    rows.filter((r) => r.kind === "budget").map((r) => r.amount),
  );
  const categories = [
    ...new Set(transactions.map((e) => e.category || "Unknown")),
  ]
    .sort()
    .map((name) => ({
      name,
      amount: sum(
        transactions
          .filter((e) => (e.category || "Unknown") === name)
          .map((e) => e.amount),
      ),
    }));
  const budgets = rows
    .filter((r) => r.kind === "budget")
    .map((row) => {
      const actual = sum(
        transactions
          .filter((e) => row.categories.includes(e.category || "Unknown"))
          .map((e) => e.amount),
      );
      return { ...row, spent: actual, remaining: sum([row.amount, -actual]) };
    });
  const mapped = new Set(budgets.flatMap((b) => b.categories));
  return {
    income,
    commitments,
    spent,
    planned,
    expected: sum([income, -commitments, -planned]),
    surplus: sum([income, -commitments, -spent]),
    remaining: sum([planned, -spent]),
    categories,
    budgets,
    transactions,
    unallocated: sum(
      transactions
        .filter((e) => !mapped.has(e.category || "Unknown"))
        .map((e) => e.amount),
    ),
    liquid: sum(
      rows.filter((r) => r.kind === "balance" && r.liquid).map((r) => r.amount),
    ),
    assets: sum(rows.filter((r) => r.kind === "balance").map((r) => r.amount)),
  };
}
export function isFinancePlanning(value: unknown): value is FinancePlanning {
  if (!value || typeof value !== "object") return false;
  const p = value as FinancePlanning;
  if (
    !Number.isInteger(p.defaultStartDay) ||
    p.defaultStartDay < 1 ||
    p.defaultStartDay > 31 ||
    !Array.isArray(p.cycles) ||
    !Array.isArray(p.rows)
  )
    return false;
  if (
    !p.cycles.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        !!c.id &&
        typeof c.month === "string" &&
        validDate(c.start) &&
        validDate(c.end),
    )
  )
    return false;
  if (!p.cycles.every((c) => !cycleError(c, p.cycles))) return false;
  if (
    new Set(p.cycles.map((c) => c.id)).size !== p.cycles.length ||
    new Set(p.rows.map((r) => r?.id)).size !== p.rows.length
  )
    return false;
  const validRows = p.rows.every(
    (r) =>
      r &&
      typeof r.id === "string" &&
      !!r.id &&
      p.cycles.some((c) => c.id === r.cycleId) &&
      ["income", "commitment", "budget", "balance"].includes(r.kind) &&
      typeof r.name === "string" &&
      Number.isFinite(r.amount) &&
      r.amount >= 0 &&
      typeof r.liquid === "boolean" &&
      Array.isArray(r.categories) &&
      r.categories.every((c) => typeof c === "string"),
  );
  if (!validRows) return false;
  return p.rows.every(
    (r) =>
      r.kind !== "budget" ||
      (new Set(r.categories).size === r.categories.length &&
        !p.rows.some(
          (other) =>
            other.id !== r.id &&
            other.cycleId === r.cycleId &&
            other.kind === "budget" &&
            other.categories.some((c) => r.categories.includes(c)),
        )),
  );
}

// A missing current cycle is previewed without writing on page load.
export function currentFinanceCycle(
  plan: FinancePlanning,
  today: string,
): FinanceCycle | null {
  const saved = plan.cycles.find((c) => c.start <= today && c.end >= today);
  if (saved) return saved;
  const month = activeMonth(today, plan.defaultStartDay);
  const range = cycleDates(month, plan.defaultStartDay);
  const shiftDay = (date: string, n: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  for (const c of plan.cycles) {
    if (c.end < today && c.end >= range.start) range.start = shiftDay(c.end, 1);
    if (c.start > today && c.start <= range.end)
      range.end = shiftDay(c.start, -1);
  }
  const cycle = { id: `auto-${month}-${range.start}`, month, ...range };
  return cycleError(cycle, plan.cycles) ? null : cycle;
}
export function starterBudgets(cycleId: string): FinancePlanRow[] {
  return [
    { name: "Groceries", categories: ["Groceries"] },
    {
      name: "General expenses",
      categories: [
        "Grab/Transport/Fuel/Parking",
        "Lifestyle",
        "Entertainment",
        "Food",
      ],
    },
    { name: "Unexpected / buffer", categories: ["Unknown"] },
  ].map((r, i) => ({
    ...r,
    id: `${cycleId}-budget-${i}`,
    cycleId,
    kind: "budget",
    amount: 300,
    liquid: false,
  }));
}
