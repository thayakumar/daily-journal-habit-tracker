import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Card,
  Delete,
  Empty,
  Field,
  inputClass,
  parseNumberInput,
  secondaryClass,
  type Update,
} from "../workspace/ui";
import { uid, localDate, type Workspace } from "../workspace/model";
import { Category } from "./types";
import {
  activeMonth,
  cycleDates,
  emptyPlanning,
  money,
  monthName,
  summarizeCycle,
  type FinanceCycle,
  type FinancePlanRow,
  type PlanKind,
} from "./planning";
import { CategoryDonutChart } from "./components/CategoryDonutChart";
import { CycleEditorDialog, PlanRowDialog } from "./components/BudgetDialogs";

const TITLES: Record<PlanKind, string> = {
  income: "Income",
  commitment: "Fixed commitments",
  budget: "Spending budgets",
  balance: "Account balances",
};

export function MonthlyBudget({
  data,
  update,
  selectedId,
  onSelect,
  storageReady,
  onOpenPortfolio,
}: {
  data: Workspace;
  update: Update;
  selectedId: string;
  onSelect: (id: string) => void;
  storageReady: boolean;
  onOpenPortfolio?: () => void;
}) {
  const plan = data.financePlanning ?? emptyPlanning();
  const cycle = plan.cycles.find((c) => c.id === selectedId);
  const [cycleDialog, setCycleDialog] = useState<FinanceCycle | null>(null);
  const [editingCycle, setEditingCycle] = useState(false);
  const [rowDialog, setRowDialog] = useState<FinancePlanRow | null>(null);
  const [cycleNotice, setCycleNotice] = useState("");
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  const categories = useMemo(
    () =>
      [
        ...new Set([
          ...Object.values(Category),
          ...(data.financeExpenses ?? []).map((e) => e.category),
          ...plan.rows.flatMap((r) => r.categories),
        ]),
      ].sort(),
    [data.financeExpenses, plan.rows],
  );
  const rows = useMemo(
    () => plan.rows.filter((r) => r.cycleId === selectedId),
    [plan.rows, selectedId],
  );
  const summary = useMemo(
    () => (cycle ? summarizeCycle(plan, data.financeExpenses ?? [], cycle) : null),
    [cycle, plan, data.financeExpenses],
  );
  const budgetById = useMemo(
    () => new Map((summary?.budgets ?? []).map((b) => [b.id, b])),
    [summary],
  );

  function openCycle(edit = false) {
    const month = activeMonth(localDate(), plan.defaultStartDay);
    setCycleDialog(
      edit && cycle
        ? { ...cycle }
        : { id: uid(), month, ...cycleDates(month, plan.defaultStartDay) },
    );
    setEditingCycle(edit);
  }

  function openRow(kind: PlanKind, row?: FinancePlanRow) {
    setRowDialog(
      row
        ? { ...row, categories: [...row.categories] }
        : {
            id: uid(),
            cycleId: selectedId,
            kind,
            name: "",
            amount: 0,
            categories: [],
            liquid: kind === "balance",
          },
    );
  }

  function removeRow(row: FinancePlanRow) {
    if (confirm(`Remove ${row.name} from this cycle?`))
      update((s) => ({
        ...s,
        financePlanning: {
          ...(s.financePlanning ?? emptyPlanning()),
          rows: (s.financePlanning?.rows ?? []).filter((r) => r.id !== row.id),
        },
      }));
  }

  return (
    <div className="min-w-0 space-y-4 [contain:paint]">
      {/* Compact Cycle Action & Settings Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[#24201D] sm:text-lg">
              {cycle ? monthName(cycle.month) : "Your salary cycles"}
            </h2>
            {cycle && (
              <p className="text-[11px] tabular-nums text-[#6E6358]">
                {cycle.start} → {cycle.end}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cycle && (
              <button
                type="button"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#3B342E] shadow-xs transition-colors hover:bg-[#FAF7F2]"
                onClick={() => openCycle(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit cycle dates
              </button>
            )}
            <button
              type="button"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#D95D39] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#C04C2B]"
              onClick={() => openCycle()}
            >
              <Plus className="h-3.5 w-3.5" />
              New cycle
            </button>
          </div>
        </div>

        <details className="rounded-xl border border-[#E7DDD0] bg-white">
          <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-semibold text-[#5C5248] hover:text-[#24201D]">
            Salary cycle settings
          </summary>
          <div className="flex flex-wrap items-end gap-3 border-t border-[#EFE8DC] p-3.5">
            <div className="w-full sm:w-44">
              <Field label="Default salary day">
                <select
                  aria-label="Default salary day"
                  className={inputClass}
                  value={plan.defaultStartDay}
                  onChange={(e) => {
                    const day = parseNumberInput(
                      e.target.value,
                      plan.defaultStartDay,
                    );
                    update((s) => ({
                      ...s,
                      financePlanning: {
                        ...(s.financePlanning ?? emptyPlanning()),
                        defaultStartDay: day,
                      },
                    }));
                  }}
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="max-w-lg text-xs leading-relaxed text-[#62584E]">
              Used for new cycles only. You can adjust each cycle’s exact dates.
              Short months use the last available day.
            </p>
          </div>
        </details>

        {!storageReady && (
          <p
            role="status"
            className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-900"
          >
            Monthly plans save on this device. Your connection needs an update
            to sync them to Sheets.
          </p>
        )}
        {cycleNotice && (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900"
          >
            {cycleNotice}
          </p>
        )}
        {!cycle && (
          <Empty compact>
            {plan.cycles.length
              ? "Select a cycle above to see its monthly picture."
              : "Create your first salary cycle to start your monthly plan."}
          </Empty>
        )}
      </div>

      {cycle && summary && (
        <>
          {/* Joined 2x3 Cashflow & Savings Bento Strips */}
          <div className="grid gap-3 xl:grid-cols-2">
            {(
              [
                [
                  {
                    label: "Income",
                    value: summary.income,
                    hint: "Cycle income",
                    semantic: false,
                  },
                  {
                    label: "Commitments",
                    value: summary.commitments,
                    hint: "Fixed bills",
                    semantic: false,
                  },
                  {
                    label: "Expenses",
                    value: summary.spent,
                    hint: `${summary.transactions.length} txns`,
                    semantic: false,
                  },
                ],
                [
                  {
                    label: "Expected",
                    value: summary.expected,
                    hint: "Planned savings",
                    semantic: true,
                  },
                  {
                    label: "Surplus",
                    value: summary.surplus,
                    hint: "Actual surplus",
                    semantic: true,
                  },
                  {
                    label: "Remaining",
                    value: summary.remaining,
                    hint: "Budget left",
                    semantic: true,
                  },
                ],
              ] as const
            ).map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="clay-card grid grid-cols-3 divide-x divide-[#EFE8DC] overflow-hidden rounded-2xl"
              >
                {group.map(({ label, value, hint, semantic }) => {
                  const negative = value < 0;
                  return (
                    <div
                      key={label}
                      className={`min-w-0 px-3 py-3 sm:px-4 sm:py-3.5 ${
                        negative ? "bg-[#FBECE7]/60" : ""
                      }`}
                    >
                      <p className="truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
                        {label}
                      </p>
                      <p
                        className={`mt-1 truncate font-display text-sm font-bold tabular-nums min-[375px]:text-base sm:text-xl ${
                          negative
                            ? "text-[#B84727]"
                            : semantic && value > 0
                              ? "text-[#356651]"
                              : "text-[#24201D]"
                        }`}
                      >
                        {money(value)}
                      </p>
                      <p className="mt-0.5 hidden truncate text-[11px] text-[#6E6358] sm:block">
                        {hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <CategoryDonutChart
            month={cycle.month}
            spent={summary.spent}
            categories={summary.categories}
          />
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
            {(["income", "commitment", "budget", "balance"] as const).map(
              (kind) => (
                <Card
                  key={kind}
                  className="min-w-0"
                  title={TITLES[kind]}
                  subtitle={
                    kind === "balance"
                      ? "Enter balances for this cycle. These are snapshots, separate from your monthly surplus."
                      : kind === "budget"
                        ? "Choose which expense categories count towards each budget."
                        : undefined
                  }
                  action={
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() =>
                        kind === "balance" &&
                        data.financePortfolio?.accounts.length &&
                        onOpenPortfolio
                          ? onOpenPortfolio()
                          : openRow(kind)
                      }
                    >
                      <Plus className="h-4 w-4" />
                      {kind === "balance" &&
                      data.financePortfolio?.accounts.length
                        ? "Opening / closing balances"
                        : `Add ${kind}`}
                    </button>
                  }
                >
                  {!rows.some((r) => r.kind === kind) ? (
                    <Empty>
                      No {TITLES[kind].toLowerCase()} recorded for this cycle.
                    </Empty>
                  ) : (
                    <div
                      data-horizontal-scroll
                      className="max-w-full overflow-x-auto"
                    >
                      <table
                        aria-label={TITLES[kind]}
                        className={`w-full text-sm ${kind === "budget" ? "min-w-[560px]" : "min-w-[270px]"}`}
                      >
                        <thead>
                          <tr className="text-left text-xs text-[#8C8073]">
                            <th className="pb-3">Name</th>
                            <th className="pb-3 text-right">
                              {kind === "budget" ? "Planned" : "Amount"}
                            </th>
                            {kind === "budget" && (
                              <>
                                <th className="pb-3 text-right">Spent</th>
                                <th className="pb-3 text-right">Remaining</th>
                              </>
                            )}
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows
                            .filter((r) => r.kind === kind)
                            .map((row) => {
                              const budget = budgetById.get(row.id);
                              return (
                                <tr
                                  key={row.id}
                                  className="border-t border-[#EFE8DC]"
                                >
                                  <th
                                    scope="row"
                                    className="max-w-48 break-words py-3 pr-3 text-left font-medium text-[#3B342E]"
                                  >
                                    {row.name}
                                    {kind === "balance" && (
                                      <span className="block text-xs font-normal text-[#8C8073]">
                                        {row.liquid
                                          ? "Liquid account"
                                          : "Other asset"}
                                      </span>
                                    )}
                                    {kind === "budget" && (
                                      <span className="block text-xs font-normal text-[#8C8073]">
                                        {row.categories.join(", ") ||
                                          "No categories selected"}
                                      </span>
                                    )}
                                  </th>
                                  <td className="whitespace-nowrap px-2 text-right">
                                    {money(row.amount)}
                                  </td>
                                  {budget && (
                                    <>
                                      <td className="whitespace-nowrap px-2 text-right">
                                        {money(budget.spent)}
                                      </td>
                                      <td
                                        className={`whitespace-nowrap px-2 text-right ${budget.remaining < 0 ? "text-[#D95D39]" : "text-emerald-600"}`}
                                      >
                                        {money(budget.remaining)}
                                      </td>
                                    </>
                                  )}
                                  <td>
                                    <div className="flex justify-end">
                                      {row.id.startsWith("portfolio:") &&
                                      kind === "balance" &&
                                      onOpenPortfolio ? (
                                        <button
                                          type="button"
                                          aria-label={`Manage ${row.name} in Portfolio`}
                                          className={secondaryClass}
                                          onClick={onOpenPortfolio}
                                        >
                                          Portfolio
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            aria-label={`Edit ${row.name}`}
                                            className="flex h-11 w-11 shrink-0 items-center justify-center text-[#8C8073] hover:text-[#C04C2B]"
                                            onClick={() => openRow(kind, row)}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </button>
                                          <Delete
                                            label={`Delete ${row.name}`}
                                            onClick={() => removeRow(row)}
                                          />
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {kind === "budget" && summary.unallocated > 0 && (
                    <p
                      role="status"
                      className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      {money(summary.unallocated)} of spending has no budget
                      group yet. It is included in total expenses and actual
                      surplus.
                    </p>
                  )}
                  {kind === "balance" && (
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] p-3">
                        <p className="text-[11px] font-semibold text-[#6E6358]">
                          Liquid accounts
                        </p>
                        <p className="mt-1 break-words font-display text-base font-bold tabular-nums text-[#24201D]">
                          {money(summary.liquid)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] p-3">
                        <p className="text-[11px] font-semibold text-[#6E6358]">
                          Total assets · before debts
                        </p>
                        <p className="mt-1 break-words font-display text-base font-bold tabular-nums text-[#24201D]">
                          {money(summary.assets)}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              ),
            )}
          </div>
          <Card
            title="Expenses in this cycle"
            subtitle={`${summary.transactions.length} transactions within ${cycle.start} → ${cycle.end} (synced with Expense Tracker).`}
            action={
              summary.transactions.length > 10 && (
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => setShowAllExpenses((v) => !v)}
                >
                  {showAllExpenses
                    ? "Show fewer"
                    : `Show all ${summary.transactions.length}`}
                </button>
              )
            }
          >
            {!summary.transactions.length ? (
              <Empty>No expenses in these dates.</Empty>
            ) : (
              <div
                data-horizontal-scroll
                className="max-w-full overflow-x-auto"
              >
                <table
                  aria-label="Cycle expenses"
                  className="w-full min-w-[450px] text-sm"
                >
                  <thead>
                    <tr className="text-left text-xs text-[#8C8073]">
                      <th className="pb-3">Date</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.transactions]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, showAllExpenses ? undefined : 10)
                      .map((e) => (
                        <tr key={e.id} className="border-t border-[#EFE8DC]">
                          <td className="whitespace-nowrap py-3 pr-3">
                            {e.date}
                          </td>
                          <td className="max-w-60 break-words pr-3">
                            {e.item}
                          </td>
                          <td className="pr-3">{e.category}</td>
                          <td className="whitespace-nowrap text-right">
                            {money(e.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
      {cycleDialog && (
        <CycleEditorDialog
          key={cycleDialog.id}
          initialCycle={cycleDialog}
          editingCycle={editingCycle}
          plan={plan}
          data={data}
          update={update}
          onSelect={onSelect}
          onNotice={setCycleNotice}
          onClose={() => setCycleDialog(null)}
        />
      )}
      {rowDialog && (
        <PlanRowDialog
          key={rowDialog.id}
          initialRow={rowDialog}
          selectedId={selectedId}
          plan={plan}
          categories={categories}
          update={update}
          onClose={() => setRowDialog(null)}
        />
      )}
    </div>
  );
}
