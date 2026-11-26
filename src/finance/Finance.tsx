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
import { Field, RoomSkeleton, inputClass, type Update } from "../workspace/ui";
import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseHistory } from "./components/ExpenseHistory";
import { isConfigured } from "../lib/sheets-api";
import { uid, localDate, type Workspace } from "../workspace/model";

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
    return <RoomSkeleton label="Loading your current salary cycle…" />;
  return (
    <div className="space-y-5">
      <div className="clay-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div
            role="tablist"
            aria-label="Finance modules"
            className="clay-segmented inline-flex flex-wrap gap-1 rounded-2xl p-1"
          >
            {(["expenses", "monthly", "portfolio"] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                role="tab"
                aria-selected={view === tab}
                aria-controls={`finance-${tab}`}
                id={`tab-${tab}`}
                className={`min-h-10 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-150 sm:px-4 sm:text-sm ${
                  view === tab
                    ? "bg-[#D95D39] text-white shadow-xs"
                    : "text-[#5C5248] hover:bg-white/70 hover:text-[#24201D]"
                }`}
                onClick={() => {
                  if (tab === "portfolio") setPortfolioSection("overview");
                  setView(tab);
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

          {view !== "portfolio" ? (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:gap-3">
              <div className="min-w-0 flex-1 sm:min-w-72">
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
              </div>
              {cycle && (
                <span className="inline-flex min-h-10 w-fit items-center rounded-xl border border-[#F2C9BC] bg-[#FBECE7] px-3 py-2 text-xs font-semibold tabular-nums text-[#A83E20] sm:min-h-11">
                  {cycle.start} → {cycle.end}
                </span>
              )}
            </div>
          ) : (
            <details
              open={false}
              key="portfolio-cycle-disclosure"
              className="w-full max-w-md rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] px-3.5 py-2.5"
            >
              <summary className="cursor-pointer text-xs font-semibold text-[#5C5248]">
                Optional monthly reconciliation &amp; budget links
              </summary>
              <p className="mt-2.5 mb-2.5 text-xs leading-relaxed text-[#5C5248]">
                Portfolio values and history span all dates. Select a cycle only
                for opening/closing comparisons and links to Monthly Budget.
              </p>
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
            </details>
          )}
        </div>
        {!current && view !== "portfolio" && (
          <p
            role="status"
            className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
          >
            Today is outside your saved cycle dates. Open Monthly Budget to
            configure the current cycle.
          </p>
        )}
      </div>
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
                  if (record.receiptUrl) onSync();
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
          </div>
          <ExpenseHistory
            key={`${selectedId}:${lastSaved?.id ?? "initial"}`}
            expenses={expenses}
            maxDate={cycle && cycle.end > today ? cycle.end : today}
            onSync={onSync}
            lastSaved={lastSaved}
            onDelete={(id) => {
              update((s) => ({
                ...s,
                financeExpenses: (s.financeExpenses ?? []).filter(
                  (e) => e.id !== id,
                ),
              }));
              setLastSaved(null);
            }}
            onEdit={(edited) => {
              const target = currentFinanceCycle(plan, edited.date);
              const maxAllowed =
                cycle && cycle.end > today ? cycle.end : today;
              const ceiling =
                target && target.end > maxAllowed ? target.end : maxAllowed;
              if (
                !validDate(edited.date) ||
                edited.date > ceiling ||
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
                id: edited.id ?? "",
                name: edited.item.trim(),
                action: "Updated",
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
