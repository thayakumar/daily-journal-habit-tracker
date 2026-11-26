import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Card,
  Delete,
  Empty,
  Field,
  inputClass,
  parseNumberInput,
  primaryClass,
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
    <div className="min-w-0 space-y-5 [contain:paint]">
      <Card
        title={cycle ? monthName(cycle.month) : "Your salary cycles"}
        subtitle={
          cycle
            ? `${cycle.start} → ${cycle.end} · both dates included`
            : "Name a cycle by the month it funds. Its start and end dates decide which expenses appear."
        }
        action={
          <div className="flex flex-wrap gap-2">
            {cycle && (
              <button
                type="button"
                className={secondaryClass}
                onClick={() => openCycle(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit cycle dates
              </button>
            )}
            <button
              type="button"
              className={primaryClass}
              onClick={() => openCycle()}
            >
              <Plus className="h-4 w-4" />
              New cycle
            </button>
          </div>
        }
      >
        {!storageReady && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            Monthly plans save on this device. Your connection needs an update
            to sync them to Sheets.
          </p>
        )}
        {cycleNotice && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {cycleNotice}
          </p>
        )}
        {!cycle && (
          <div className="mb-4">
            <Empty>
              {plan.cycles.length
                ? "Select a cycle above to see its monthly picture."
                : "Create your first salary cycle to start your monthly plan."}
            </Empty>
          </div>
        )}
        <details className="rounded-xl border border-[#EFE8DC] bg-[#FAF7F2]/60">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#473F38]">
            Salary cycle settings
          </summary>
          <div className="flex flex-wrap items-end gap-4 border-t border-[#EFE8DC] p-4">
            <div className="w-full sm:w-48">
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
      </Card>
      {cycle && summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(
              [
                {
                  label: "Income",
                  value: summary.income,
                  hint: "Income recorded for this cycle",
                  semantic: false,
                },
                {
                  label: "Fixed commitments",
                  value: summary.commitments,
                  hint: "Your monthly committed payments",
                  semantic: false,
                },
                {
                  label: "Expenses",
                  value: summary.spent,
                  hint: `${summary.transactions.length} expenses within these dates`,
                  semantic: false,
                },
                {
                  label: "Expected savings",
                  value: summary.expected,
                  hint: "Income − commitments − planned budgets",
                  semantic: true,
                },
                {
                  label: "Actual surplus",
                  value: summary.surplus,
                  hint: "Income − commitments − recorded expenses",
                  semantic: true,
                },
                {
                  label: "Budget remaining",
                  value: summary.remaining,
                  hint: "Planned budgets − recorded expenses",
                  semantic: true,
                },
              ] as const
            ).map(({ label, value, hint, semantic }) => {
              const negative = value < 0;
              return (
                <div
                  key={label}
                  className={`min-w-0 rounded-2xl border p-5 shadow-xs ${
                    negative
                      ? "border-[#E8B8A9] bg-[#FBECE7]/60"
                      : "border-[#EAE2D6] bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8C8073]">
                    {label}
                  </p>
                  <p
                    className={`mt-2 break-words font-display text-2xl font-bold sm:text-3xl ${
                      negative
                        ? "text-[#B84727]"
                        : semantic && value > 0
                          ? "text-[#356651]"
                          : "text-[#24201D]"
                    }`}
                  >
                    {money(value)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#62584E]">
                    {hint}
                  </p>
                </div>
              );
            })}
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
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-[#FAF7F2] p-3">
                        <p className="text-xs text-[#8C8073]">
                          Liquid accounts
                        </p>
                        <p className="mt-1 break-words font-semibold">
                          {money(summary.liquid)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#FAF7F2] p-3">
                        <p className="text-xs text-[#8C8073]">
                          Total assets · before debts
                        </p>
                        <p className="mt-1 break-words font-semibold">
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
