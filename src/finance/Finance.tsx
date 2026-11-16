import { StatementImport } from "./components/StatementImport";
import { Portfolio } from "./Portfolio";
import { useState } from "react";
import { MonthlyBudget } from "./MonthlyBudget";
import {
  cycleExpenses,
  monthName,
  currentFinanceCycle,
  emptyPlanning,
  starterBudgets,
  cycleError,
  validDate,
} from "./planning";
import { Card, Field, inputClass } from "../workspace/ui";
import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseHistory } from "./components/ExpenseHistory";
import { isConfigured } from "../lib/sheets-api";
import { uid, localDate, type Workspace } from "../workspace/model";
import { type Update } from "../workspace/ui";

export default function Finance({
  data,
  update,
  receiptReady,
  onSync,
  planningReady,
  initialLoading = false,
  portfolioReady = false,
  migrationReady = false,
}: {
  data: Workspace;
  update: Update;
  receiptReady: boolean;
  onSync: () => void;
  planningReady: boolean;
  initialLoading?: boolean;
  portfolioReady?: boolean;
  migrationReady?: boolean;
}) {
  const [view, setView] = useState<"expenses" | "monthly" | "portfolio">(
    "expenses",
  );
  const [portfolioSection, setPortfolioSection] = useState("overview");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<{
    id: string;
    name: string;
    action?: "Added" | "Updated";
  } | null>(null);
  const today = localDate();
  const plan = data.financePlanning ?? emptyPlanning();
  const current = currentFinanceCycle(plan, today);
  const cycles = [
    ...plan.cycles,
    ...(current && !plan.cycles.some((c) => c.id === current.id)
      ? [current]
      : []),
  ].sort((a, b) => b.start.localeCompare(a.start));
  const selectedId =
    chosenId && cycles.some((c) => c.id === chosenId)
      ? chosenId
      : (current?.id ?? "");
  const cycle = cycles.find((c) => c.id === selectedId);
  const expenses = cycle
    ? cycleExpenses(data.financeExpenses ?? [], cycle)
    : [];
  function withCycle(s: Workspace): Workspace {
    if (!cycle || s.financePlanning?.cycles.some((c) => c.id === cycle.id))
      return s;
    const p = s.financePlanning ?? emptyPlanning();
    if (cycleError(cycle, p.cycles)) return s;
    return {
      ...s,
      financePlanning: {
        ...p,
        cycles: [...p.cycles, cycle],
        rows: [...p.rows, ...starterBudgets(cycle.id)],
      },
    };
  }
  function chooseCycle(id: string) {
    setChosenId(id);
    setLastSaved(null);
  }
  if (initialLoading && data.updatedAt === 0)
    return (
      <p
        role="status"
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
      >
        Loading your current salary cycle…
      </p>
    );
  return (
    <div className="space-y-5">
      <Card
        title="Your finances"
        subtitle="Expenses, monthly budgets and your ongoing financial portfolio."
      >
        <div
          role="tablist"
          aria-label="Finance modules"
          className="mb-5 flex flex-wrap gap-2"
        >
          {(["expenses", "monthly", "portfolio"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={view === tab}
              aria-controls={`finance-${tab}`}
              id={`tab-${tab}`}
              className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium ${view === tab ? "bg-rose-600 text-white" : "bg-slate-50 text-slate-500"}`}
              onClick={() => {
                if (tab === "portfolio") setPortfolioSection("overview");
                setView(tab);
                if (
                  tab === "monthly" &&
                  cycle &&
                  !plan.cycles.some((c) => c.id === cycle.id)
                )
                  update(withCycle);
              }}
            >
              {tab === "expenses"
                ? "Expense Tracker"
                : tab === "monthly"
                  ? "Monthly Budget"
                  : "Portfolio"}
            </button>
          ))}
        </div>
        <details
          open={view !== "portfolio"}
          key={view === "portfolio" ? "portfolio" : "budget"}
          className="max-w-md"
        >
          <summary className="mb-3 cursor-pointer text-sm font-semibold text-slate-600">
            {view === "portfolio"
              ? "Optional monthly reconciliation & budget links"
              : "Salary cycle"}
          </summary>
          {view === "portfolio" && (
            <p className="mb-3 text-sm text-slate-500">
              Portfolio values and history span all dates. Select a cycle only
              for opening/closing comparisons and links to Monthly Budget.
            </p>
          )}
          <Field label="Salary cycle">
            <select
              aria-label="Salary cycle"
              className={inputClass}
              value={selectedId}
              onChange={(e) => chooseCycle(e.target.value)}
            >
              {!cycle && (
                <option value="" disabled>
                  Set up a salary cycle
                </option>
              )}
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {monthName(c.month)}
                  {c.id === current?.id ? " · Current" : ""} · {c.start} →{" "}
                  {c.end}
                </option>
              ))}
            </select>
          </Field>
          {cycle && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {cycle.start} → {cycle.end}
            </p>
          )}
          {!current && (
            <p role="status" className="mt-3 text-sm text-amber-700">
              Today is outside your saved cycle dates. Open Monthly Budget to
              configure the current cycle.
            </p>
          )}
        </details>
      </Card>
      {view === "portfolio" ? (
        <div
          role="tabpanel"
          id="finance-portfolio"
          aria-labelledby="tab-portfolio"
        >
          <Portfolio
            data={data}
            update={(change) =>
              update((s) => {
                const next = change(s);
                const p = next.financePortfolio;
                const needsCycle =
                  cycle &&
                  ([
                    ...(p?.snapshots ?? []),
                    ...(p?.debtSnapshots ?? []),
                    ...(p?.flows ?? []),
                  ].some((r) => r.cycleId === cycle.id) ||
                    next.financePlanning?.rows.some(
                      (r) => r.cycleId === cycle.id,
                    ));
                return needsCycle ? withCycle(next) : next;
              })
            }
            cycle={cycle}
            key={portfolioSection}
            initialSection={portfolioSection}
            storageReady={portfolioReady}
            migrationReady={migrationReady}
          />
        </div>
      ) : view === "monthly" ? (
        <div role="tabpanel" id="finance-monthly" aria-labelledby="tab-monthly">
          <MonthlyBudget
            data={data}
            update={update}
            selectedId={selectedId}
            onSelect={chooseCycle}
            storageReady={planningReady}
            onOpenPortfolio={() => {
              setPortfolioSection("accounts");
              setView("portfolio");
            }}
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="finance-expenses"
          aria-labelledby="tab-expenses"
          className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]"
        >
          <div className="min-w-0 space-y-5">
            {cycle && (
              <StatementImport
                key={cycle.id}
                cycle={cycle}
                existing={data.financeExpenses ?? []}
                onSave={(records) => {
                  update((s) => {
                    const next = withCycle(s);
                    return {
                      ...next,
                      financeExpenses: [
                        ...(next.financeExpenses ?? []),
                        ...records,
                      ],
                    };
                  });
                  setLastSaved({
                    id: records.at(-1)!.id,
                    name: `${records.length} imported expenses`,
                  });
                }}
              />
            )}
            {cycle ? (
              <ExpenseForm
                key={`${cycle.id}:${cycle.start}:${cycle.end}`}
                cycle={cycle}
                receiptReady={isConfigured() && receiptReady}
                onSave={(expense) => {
                  if (expense.date < cycle.start || expense.date > cycle.end)
                    throw new Error(
                      "Choose a date within the selected salary cycle, or switch cycles first.",
                    );
                  const record = {
                    ...expense,
                    receiptName: expense.receiptName ?? "",
                    receiptUrl: expense.receiptUrl ?? "",
                    id: uid(),
                    createdAt: new Date().toISOString(),
                  };
                  update((s) => {
                    const next = withCycle(s);
                    return {
                      ...next,
                      financeExpenses: [
                        ...(next.financeExpenses ?? []),
                        record,
                      ],
                    };
                  });
                  setChosenId(cycle.id);
                  setLastSaved({ id: record.id, name: record.item });
                }}
              />
            ) : (
              <p
                role="status"
                className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"
              >
                Set up your current salary cycle in Monthly Budget before adding
                an expense.
              </p>
            )}
          </div>
          <ExpenseHistory
            key={`${selectedId}:${lastSaved?.id ?? "initial"}`}
            expenses={expenses}
            onSync={onSync}
            lastSaved={lastSaved}
            onEdit={(edited) => {
              if (
                !validDate(edited.date) ||
                edited.date > today ||
                !edited.item.trim() ||
                !Number.isFinite(edited.amount) ||
                edited.amount <= 0
              )
                throw new Error(
                  "Check the transaction date, description and amount.",
                );
              if (!(data.financeExpenses ?? []).some((e) => e.id === edited.id))
                throw new Error(
                  "This transaction no longer exists. Sync expenses and try again.",
                );
              const target = currentFinanceCycle(plan, edited.date);
              if (!target)
                throw new Error(
                  "Set up a salary cycle covering this date in Monthly Budget, then try again.",
                );
              update((s) => {
                const p = s.financePlanning ?? emptyPlanning();
                const existing = p.cycles.some((c) => c.id === target.id);
                return {
                  ...s,
                  financePlanning: existing
                    ? p
                    : {
                        ...p,
                        cycles: [...p.cycles, target],
                        rows: [...p.rows, ...starterBudgets(target.id)],
                      },
                  financeExpenses: (s.financeExpenses ?? []).map((e) =>
                    e.id === edited.id
                      ? {
                          ...e,
                          date: edited.date,
                          item: edited.item.trim(),
                          amount: edited.amount,
                          category: edited.category,
                        }
                      : e,
                  ),
                };
              });
              setChosenId(target.id);
              setLastSaved({
                id: edited.id!,
                name: edited.item,
                action: "Updated",
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
