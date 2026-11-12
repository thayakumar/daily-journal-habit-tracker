import { useState } from "react";
import { MonthlyBudget } from "./MonthlyBudget";
import { cycleExpenses, monthName } from "./planning";
import { Card, Field, inputClass } from "../workspace/ui";
import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseHistory } from "./components/ExpenseHistory";
import { isConfigured } from "../lib/sheets-api";
import { uid, type Workspace } from "../workspace/model";
import { type Update } from "../workspace/ui";

export default function Finance({
  data,
  update,
  receiptReady,
  onSync,
  planningReady,
}: {
  data: Workspace;
  update: Update;
  receiptReady: boolean;
  onSync: () => void;
  planningReady: boolean;
}) {
  const [view, setView] = useState<"expenses" | "monthly">("expenses");
  const [selectedId, setSelectedId] = useState("");
  const cycles = [...(data.financePlanning?.cycles ?? [])].sort((a, b) =>
    b.month.localeCompare(a.month),
  );
  const cycle = cycles.find((c) => c.id === selectedId);
  const expenses = cycle
    ? cycleExpenses(data.financeExpenses ?? [], cycle)
    : (data.financeExpenses ?? []);
  return (
    <div className="space-y-5">
      <Card
        title="Your finances"
        subtitle="Daily expenses and your salary-cycle plan, connected."
      >
        <div
          role="tablist"
          aria-label="Finance modules"
          className="mb-5 flex flex-wrap gap-2"
        >
          {(["expenses", "monthly"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={view === tab}
              aria-controls={`finance-${tab}`}
              id={`tab-${tab}`}
              className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium ${view === tab ? "bg-rose-600 text-white" : "bg-slate-50 text-slate-500"}`}
              onClick={() => {
                setView(tab);
                if (tab === "monthly" && !selectedId && cycles[0])
                  setSelectedId(cycles[0].id);
              }}
            >
              {tab === "expenses" ? "Expense Tracker" : "Monthly Budget"}
            </button>
          ))}
        </div>
        <div className="max-w-md">
          <Field label="Salary cycle">
            <select
              aria-label="Salary cycle"
              className={inputClass}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">
                {view === "expenses" ? "All expenses" : "Select a cycle"}
              </option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {monthName(c.month)} · {c.start} → {c.end}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
      {view === "monthly" ? (
        <div role="tabpanel" id="finance-monthly" aria-labelledby="tab-monthly">
          <MonthlyBudget
            data={data}
            update={update}
            selectedId={selectedId}
            onSelect={setSelectedId}
            storageReady={planningReady}
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="finance-expenses"
          aria-labelledby="tab-expenses"
          className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]"
        >
          <ExpenseForm
            receiptReady={isConfigured() && receiptReady}
            onSave={(expense) =>
              update((s) => ({
                ...s,
                financeExpenses: [
                  ...(s.financeExpenses ?? []),
                  {
                    ...expense,
                    receiptName: expense.receiptName ?? "",
                    receiptUrl: expense.receiptUrl ?? "",
                    id: uid(),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }))
            }
          />
          <ExpenseHistory expenses={expenses} onSync={onSync} />
        </div>
      )}
    </div>
  );
}
