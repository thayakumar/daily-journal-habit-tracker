import {
  cycleDates,
  cycleError,
  emptyPlanning,
  validDate,
  type FinancePlanRow,
} from "./planning.ts";
import {
  emptyPortfolio,
  syncPortfolioBalances,
  type AccountKind,
} from "./portfolio-model.ts";
import { statementDate } from "./statement-import.ts";
import type { Workspace, FinanceExpense } from "../workspace/model.ts";
export interface LegacyTab {
  name: string;
  sheetId: number;
  values: unknown[][];
}
export interface LegacyMonth {
  name: string;
  sheetId: number;
  month: string;
  income: { name: string; amount: number }[];
  commitments: { name: string; amount: number }[];
  budgets: { name: string; amount: number }[];
  balances: { name: string; amount: number }[];
  expenses: {
    row: number;
    date: string;
    item: string;
    amount: number;
    category: string;
    receiptUrl: string;
  }[];
  undated: number;
}
export const LEGACY_SOURCE = "17CyWN68zCkijc1drXUbIFbHXs76I5ayEexWB6GpdKak";
const str = (v: unknown) => String(v ?? "").trim();
const equivalentName = (kind: string, a: string, b: string) => {
  const normalize = (v: string) => v.toLowerCase().trim().replace(/\s+/g, " ");
  const salary = (v: string) =>
    /^(salary(?:\s*[\/&]\s*wages)?|wages)$/.test(normalize(v));
  return (
    normalize(a) === normalize(b) ||
    (kind === "income" && salary(a) && salary(b))
  );
};
const numeric = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
export function parseLegacyTab(tab: LegacyTab): LegacyMonth | null {
  const match = tab.name.match(/^(Feb|March|APR|May|Jun|Jul|Aug|Oct|Nov) 26$/i);
  if (!match) return null;
  const m = (
    {
      feb: 2,
      march: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      oct: 10,
      nov: 11,
    } as Record<string, number>
  )[match[1].toLowerCase()];
  const result: LegacyMonth = {
    name: tab.name,
    sheetId: tab.sheetId,
    month: `2026-${String(m).padStart(2, "0")}`,
    income: [],
    commitments: [],
    budgets: [],
    balances: [],
    expenses: [],
    undated: 0,
  };
  let section = "",
    balanceSection = false,
    expenseCol = -1,
    hasDates = false;
  for (let i = 0; i < tab.values.length; i++) {
    const row = tab.values[i],
      label = str(row[0]),
      upper = label.toUpperCase();
    if (upper === "INCOME") section = "income";
    else if (upper.includes("FIXED MONTHLY COMMITMENT"))
      section = "commitments";
    else if (upper === "MONTHLY BUDGET") section = "budgets";
    else if (upper.includes("TOTAL") || upper.includes("BALANCE AFTER"))
      section = "";
    else if (section && label && numeric(row[1]))
      result[section as "income" | "commitments" | "budgets"].push({
        name: label,
        amount: Math.round(row[1] * 100) / 100,
      });
    const saved = str(row[10]).toUpperCase();
    if (saved === "SAVINGS BREAKDOWN") balanceSection = true;
    else if (/TOTAL|NET/.test(saved)) balanceSection = false;
    else if (balanceSection && str(row[10]) && numeric(row[11]))
      result.balances.push({
        name: str(row[10]),
        amount: Math.round(row[11] * 100) / 100,
      });
    const header = row.findIndex((v) => str(v).toUpperCase() === "ITEM");
    if (header >= 0) {
      expenseCol = header;
      hasDates =
        header > 0 && str(row[header - 1]).toUpperCase() === "TIMESTAMP";
      continue;
    }
    if (expenseCol < 0) continue;
    if (
      !str(row[expenseCol]) ||
      !numeric(row[expenseCol + 1]) ||
      row[expenseCol + 1] === 0
    )
      continue;
    let date = "";
    if (hasDates) {
      const v = row[expenseCol - 1];
      date =
        typeof v === "number"
          ? new Date((Math.floor(v) - 25569) * 86400000)
              .toISOString()
              .slice(0, 10)
          : statementDate(str(v), 2026);
    }
    if (!date) {
      result.undated++;
      continue;
    }
    const receipt = str(row[expenseCol + 3]);
    result.expenses.push({
      row: i + 1,
      date,
      item: str(row[expenseCol]),
      amount: Math.round(Number(row[expenseCol + 1]) * 100) / 100,
      category: str(row[expenseCol + 2]) || "Unknown",
      receiptUrl: /^https:\/\/drive.google.com\/file\/d\//.test(receipt)
        ? receipt
        : "",
    });
  }
  return result;
}
export interface LegacyChoice {
  sheetId: number;
  selected: boolean;
  start: string;
  end: string;
  balanceDate: string;
  expenseDates?: Record<string, string>;
  includeCommitments?: boolean;
}
export interface AccountChoice {
  name: string;
  accountId: string;
  kind: AccountKind;
  liquid: boolean;
}
export function migrateLegacy(
  w: Workspace,
  months: LegacyMonth[],
  choices: LegacyChoice[],
  accounts: AccountChoice[],
  today: string,
) {
  const next = structuredClone(w),
    p = next.financePlanning ?? emptyPlanning(),
    portfolio = next.financePortfolio ?? emptyPortfolio();
  next.financePlanning = p;
  next.financePortfolio = portfolio;
  next.financeExpenses ??= [];
  const report = {
    cycles: 0,
    rows: 0,
    expenses: 0,
    snapshots: 0,
    accounts: 0,
    duplicates: 0,
    undated: 0,
    undatedBalances: 0,
    excludedDates: 0,
    skippedCommitments: 0,
  };
  const prefix = `legacy:${LEGACY_SOURCE}:`;
  for (const choice of choices.filter((c) => c.selected)) {
    const source = months.find((m) => m.sheetId === choice.sheetId);
    if (!source) throw Error("Source month missing");
    let cycle = p.cycles.find((c) => c.month === source.month);
    if (cycle && (cycle.start !== choice.start || cycle.end !== choice.end))
      throw Error(
        `${source.name}: dates differ from the existing salary cycle. Reuse its dates to preserve records.`,
      );
    if (!cycle) {
      cycle = {
        id: `${prefix}${source.sheetId}:cycle`,
        month: source.month,
        start: choice.start,
        end: choice.end,
      };
      const error = cycleError(cycle, p.cycles);
      if (error) throw Error(`${source.name}: ${error}`);
      p.cycles.push(cycle);
      report.cycles++;
    }
    if (
      choice.balanceDate &&
      (!validDate(choice.balanceDate) || choice.balanceDate > today)
    )
      throw Error(
        `${source.name}: choose an actual balance date up to today, or leave it blank.`,
      );
    for (const [kind, rows] of [
      ["income", source.income],
      [
        "commitment",
        choice.includeCommitments === false ? [] : source.commitments,
      ],
      ["budget", source.budgets],
    ] as const) {
      rows.forEach((r, index) => {
        const id = `${prefix}${source.sheetId}:${kind}:${index}`;
        if (
          p.rows.some(
            (x) =>
              x.id === id ||
              (x.cycleId === cycle!.id &&
                x.kind === kind &&
                equivalentName(kind, x.name, r.name)),
          )
        ) {
          report.duplicates++;
          return;
        }
        const categories =
          kind !== "budget"
            ? []
            : /grocery/i.test(r.name)
              ? ["Groceries"]
              : /buffer|unexpected/i.test(r.name)
                ? ["Unknown"]
                : [
                    "Food",
                    "Lifestyle",
                    "Entertainment",
                    "Grab/Transport/Fuel/Parking",
                  ];
        // Never create overlapping category mappings in an existing plan.
        const mapped = categories.filter(
          (c) =>
            !p.rows.some(
              (x) =>
                x.cycleId === cycle!.id &&
                x.kind === "budget" &&
                x.categories.includes(c),
            ),
        );
        p.rows.push({
          id,
          cycleId: cycle!.id,
          kind,
          name: r.name,
          amount: r.amount,
          categories: mapped,
          liquid: false,
        } as FinancePlanRow);
        report.rows++;
      });
    }
    if (choice.includeCommitments === false)
      report.skippedCommitments += source.commitments.length;
    for (const original of source.expenses) {
      const e = {
        ...original,
        date: choice.expenseDates?.[String(original.row)] ?? original.date,
      };
      if (!validDate(e.date) || e.date > today) {
        report.excludedDates++;
        continue;
      }
      const id = `${prefix}${source.sheetId}:expense:${e.row}`;
      if (
        next.financeExpenses.some(
          (x) =>
            x.id === id ||
            (x.date === e.date &&
              x.item.trim().toLowerCase() === e.item.toLowerCase() &&
              Math.round(x.amount * 100) === Math.round(e.amount * 100)),
        )
      ) {
        report.duplicates++;
        continue;
      }
      const record: FinanceExpense = {
        id,
        date: e.date,
        item: e.item,
        amount: e.amount,
        category: e.category,
        receiptUrl: e.receiptUrl,
        receiptName: `Imported ${source.name} · row ${e.row}`,
        createdAt: new Date().toISOString(),
      };
      next.financeExpenses.push(record);
      report.expenses++;
    }
    report.undated += source.undated;
    if (!choice.balanceDate) {
      report.undatedBalances += source.balances.length;
      continue;
    }
    for (const balance of source.balances) {
      const mapping = accounts.find((a) => a.name === balance.name);
      if (!mapping)
        throw Error(`Choose an account mapping for ${balance.name}`);
      let account = portfolio.accounts.find((a) => a.id === mapping.accountId);
      if (mapping.accountId && !account)
        throw Error("Mapped account no longer exists");
      if (!account) {
        const id = `${prefix}account:${encodeURIComponent(balance.name.toLowerCase())}`;
        account = portfolio.accounts.find((a) => a.id === id);
        if (!account) {
          account = {
            id,
            name: balance.name,
            kind: mapping.kind,
            liquid: mapping.liquid,
            maskedRef: "",
            vaultUrl: "",
            costBasis: 0,
            planName: "",
            trackingFrom: choice.balanceDate,
          };
          portfolio.accounts.push(account);
          report.accounts++;
        }
      }
      if (account.trackingFrom > choice.balanceDate)
        account.trackingFrom = choice.balanceDate;
      const id = `${prefix}${source.sheetId}:balance:${encodeURIComponent(balance.name.toLowerCase())}`;
      if (
        portfolio.snapshots.some(
          (s) =>
            s.id === id ||
            (s.accountId === account!.id &&
              s.date === choice.balanceDate &&
              s.phase === "current"),
        )
      ) {
        report.duplicates++;
        continue;
      }
      portfolio.snapshots.push({
        id,
        accountId: account.id,
        cycleId: "",
        phase: "current",
        date: choice.balanceDate,
        value: balance.amount,
        units: 0,
        price: 0,
        updatedAt: new Date().toISOString(),
      });
      report.snapshots++;
    }
  }
  next.financePlanning = p.cycles.reduce(
    (planning, c) => syncPortfolioBalances(planning, portfolio, c.id),
    p,
  );
  return { workspace: next, report };
}
export function defaultLegacyChoices(
  months: LegacyMonth[],
  w: Workspace,
): LegacyChoice[] {
  return months.map((m) => {
    const c = w.financePlanning?.cycles.find((c) => c.month === m.month);
    return {
      sheetId: m.sheetId,
      selected: true,
      ...(c
        ? { start: c.start, end: c.end }
        : cycleDates(m.month, w.financePlanning?.defaultStartDay ?? 27)),
      balanceDate: "",
      expenseDates: {},
      includeCommitments: !m.expenses.some((e) =>
        /^(Loan|Subscription|Mom)$/i.test(e.category),
      ),
    };
  });
}
