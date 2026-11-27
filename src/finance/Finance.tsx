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
  const portfolioCycleDisclosure = (
    <details
      open={false}
      key="portfolio-cycle-disclosure"
      className="rounded-2xl border border-[#E7DDD0] bg-white/80 px-4 py-3"
    >
      <summary className="cursor-pointer text-xs font-semibold text-[#5C5248] hover:text-[#24201D]">
        Optional monthly reconciliation &amp; budget links
      </summary>
      <p className="mt-2 mb-2.5 text-xs leading-relaxed text-[#5C5248]">
        Portfolio values and history span all dates. Select a cycle only for
        opening/closing comparisons and links to Monthly Budget.
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
              {c.id === current?.id ? " · Current" : ""} · {c.start} → {c.end}
            </option>
          ))}
        </select>
      </Field>
    </details>
  );

  return (
    <div className="space-y-4">
      {/* Flush Top 3-Tab Underline Navigation Bar */}
      <div className="border-b border-[#E7DDD0]">
        <div
          role="tablist"
          aria-label="Finance modules"
          className="grid grid-cols-3 sm:inline-flex sm:gap-1"
        >
          {(["expenses", "monthly", "portfolio"] as const).map((tab) => {
            const active = view === tab;
            return (
              <button
                type="button"
                key={tab}
                role="tab"
                aria-selected={active}
                aria-controls={`finance-${tab}`}
                id={`tab-${tab}`}
                className={`relative flex min-h-11 items-center justify-center whitespace-nowrap px-1.5 py-2.5 text-xs font-semibold transition-colors min-[375px]:text-[13px] sm:px-5 sm:text-sm ${
                  active
                    ? "text-[#D95D39]"
                    : "text-[#6E6358] hover:text-[#24201D]"
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
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[#D95D39]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slim Single-Row Salary Cycle Selector (Expenses & Monthly Budget only) */}
      {view !== "portfolio" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              aria-label="Salary cycle"
              className="min-h-10 w-full rounded-xl border border-[#DFD5C6] bg-white px-3 py-2 text-xs font-semibold text-[#24201D] shadow-xs outline-none transition-colors focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7] sm:max-w-md sm:text-sm"
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
            {cycle && (
              <span className="hidden rounded-full border border-[#EFE8DC] bg-white px-3 py-1 text-xs font-semibold tabular-nums text-[#5C5248] sm:inline-flex">
                {expenses.length}{" "}
                {expenses.length === 1 ? "expense" : "expenses"} in cycle
              </span>
            )}
          </div>
          {!current && (
            <p
              role="status"
              className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            >
              Today is outside your saved cycle dates. Open Monthly Budget to
              configure the current cycle.
            </p>
          )}
        </div>
      )}

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
            cycleDisclosure={portfolioCycleDisclosure}
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
