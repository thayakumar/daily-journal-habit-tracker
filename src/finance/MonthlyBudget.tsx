import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Dialog } from "../workspace/Dialog";
import {
  Card,
  Delete,
  Empty,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "../workspace/ui";
import { uid, localDate, type Workspace } from "../workspace/model";
import { Category } from "./types";
import {
  activeMonth,
  cycleDates,
  cycleError,
  emptyPlanning,
  money,
  monthName,
  summarizeCycle,
  type FinanceCycle,
  type FinancePlanRow,
  type PlanKind,
} from "./planning";
const TITLES: Record<PlanKind, string> = {
  income: "Income",
  commitment: "Fixed commitments",
  budget: "Spending budgets",
  balance: "Account balances",
};
const COLORS = [
  "#e11d48",
  "#f59e0b",
  "#0d9488",
  "#6366f1",
  "#0ea5e9",
  "#a855f7",
  "#84cc16",
  "#f97316",
];
export function MonthlyBudget({
  data,
  update,
  selectedId,
  onSelect,
  storageReady,
}: {
  data: Workspace;
  update: Update;
  selectedId: string;
  onSelect: (id: string) => void;
  storageReady: boolean;
}) {
  const plan = data.financePlanning ?? emptyPlanning();
  const cycle = plan.cycles.find((c) => c.id === selectedId);
  const [cycleDialog, setCycleDialog] = useState<FinanceCycle | null>(null),
    [editingCycle, setEditingCycle] = useState(false),
    [copyFrom, setCopyFrom] = useState("");
  const [rowDialog, setRowDialog] = useState<FinancePlanRow | null>(null),
    [error, setError] = useState("");
  const categories = [
    ...new Set([
      ...Object.values(Category),
      ...(data.financeExpenses ?? []).map((e) => e.category),
      ...plan.rows.flatMap((r) => r.categories),
    ]),
  ].sort();
  const rows = plan.rows.filter((r) => r.cycleId === selectedId);
  const summary = cycle
    ? summarizeCycle(plan, data.financeExpenses ?? [], cycle)
    : null;
  function openCycle(edit = false) {
    const month = activeMonth(localDate(), plan.defaultStartDay);
    setCycleDialog(
      edit && cycle
        ? { ...cycle }
        : { id: uid(), month, ...cycleDates(month, plan.defaultStartDay) },
    );
    setEditingCycle(edit);
    setCopyFrom("");
    setError("");
  }
  function openRow(kind: PlanKind, row?: FinancePlanRow) {
    setError("");
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
        title="Your salary cycles"
        subtitle="Name a cycle by the month it funds. Its start and end dates decide which expenses appear."
        action={
          <button className={primaryClass} onClick={() => openCycle()}>
            <Plus className="h-4 w-4" />
            New cycle
          </button>
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
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <Field label="Default salary day">
              <select
                aria-label="Default salary day"
                className={inputClass}
                value={plan.defaultStartDay}
                onChange={(e) => {
                  const day = Number(e.target.value);
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
          <p className="max-w-lg text-xs leading-relaxed text-slate-500">
            Used for new cycles only. You can adjust each cycle’s exact dates.
            Short months use the last available day.
          </p>
        </div>
        {cycle && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-4">
            <div>
              <p className="font-semibold text-slate-800">
                {monthName(cycle.month)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {cycle.start} → {cycle.end} · both dates included
              </p>
            </div>
            <button className={secondaryClass} onClick={() => openCycle(true)}>
              <Pencil className="h-4 w-4" />
              Edit cycle dates
            </button>
          </div>
        )}
        {!cycle && (
          <div className="mt-5">
            <Empty>
              {plan.cycles.length
                ? "Select a cycle above to see its monthly picture."
                : "Create your first salary cycle to start your monthly plan."}
            </Empty>
          </div>
        )}
      </Card>
      {cycle && summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Income", summary.income, "Income recorded for this cycle"],
              [
                "Fixed commitments",
                summary.commitments,
                "Your monthly committed payments",
              ],
              [
                "Expenses",
                summary.spent,
                `${summary.transactions.length} expenses within these dates`,
              ],
              [
                "Expected savings",
                summary.expected,
                "Income − commitments − planned budgets",
              ],
              [
                "Actual surplus",
                summary.surplus,
                "Income − commitments − recorded expenses",
              ],
              [
                "Budget remaining",
                summary.remaining,
                "Planned budgets − recorded expenses",
              ],
            ].map(([label, value, hint]) => (
              <div
                key={String(label)}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p
                  className={`mt-2 break-words text-2xl font-semibold ${Number(value) < 0 ? "text-rose-600" : "text-slate-900"}`}
                >
                  {money(Number(value))}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {hint}
                </p>
              </div>
            ))}
          </div>
          <Card
            title="Expenses by category"
            subtitle="Every category is included automatically, including Entertainment and new categories."
          >
            {!summary.categories.length ? (
              <Empty>
                No expenses in this cycle yet. Add them in Expense Tracker.
              </Empty>
            ) : (
              <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
                <svg
                  viewBox="0 0 120 120"
                  role="img"
                  aria-label={`Expense categories for ${monthName(cycle.month)}. Total ${money(summary.spent)}.`}
                  className="mx-auto h-52 w-52 max-w-full"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r="44"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="20"
                  />
                  {summary.categories.map((c, i) => {
                    const before = summary.categories
                      .slice(0, i)
                      .reduce((n, r) => n + r.amount, 0);
                    const fraction = summary.spent
                      ? c.amount / summary.spent
                      : 0;
                    return (
                      <circle
                        key={c.name}
                        cx="60"
                        cy="60"
                        r="44"
                        pathLength="100"
                        fill="none"
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth="20"
                        strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`}
                        strokeDashoffset={
                          summary.spent ? (-before / summary.spent) * 100 : 0
                        }
                        transform="rotate(-90 60 60)"
                      >
                        <title>
                          {c.name}: {money(c.amount)}
                        </title>
                      </circle>
                    );
                  })}
                  <text
                    x="60"
                    y="58"
                    textAnchor="middle"
                    className="fill-slate-400"
                    fontSize="7"
                  >
                    TOTAL EXPENSES
                  </text>
                  <text
                    x="60"
                    y="70"
                    textAnchor="middle"
                    className="fill-slate-800"
                    fontSize="9"
                    fontWeight="600"
                  >
                    {money(summary.spent)}
                  </text>
                </svg>
                <ul aria-label="Category breakdown" className="space-y-3">
                  {summary.categories.map((c, i) => (
                    <li
                      key={c.name}
                      className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 break-words text-slate-600">
                        {c.name}
                      </span>
                      <span className="font-medium text-slate-800">
                        {money(c.amount)}
                      </span>
                      <span className="text-xs text-slate-400">
                        (
                        {summary.spent
                          ? ((c.amount / summary.spent) * 100).toFixed(1)
                          : "0"}
                        %)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
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
                      className={secondaryClass}
                      onClick={() => openRow(kind)}
                    >
                      <Plus className="h-4 w-4" />
                      Add {kind}
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
                          <tr className="text-left text-xs text-slate-400">
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
                              const budget = summary.budgets.find(
                                (b) => b.id === row.id,
                              );
                              return (
                                <tr
                                  key={row.id}
                                  className="border-t border-slate-100"
                                >
                                  <th
                                    scope="row"
                                    className="max-w-48 break-words py-3 pr-3 text-left font-medium text-slate-700"
                                  >
                                    {row.name}
                                    {kind === "balance" && (
                                      <span className="block text-xs font-normal text-slate-400">
                                        {row.liquid
                                          ? "Liquid account"
                                          : "Other asset"}
                                      </span>
                                    )}
                                    {kind === "budget" && (
                                      <span className="block text-xs font-normal text-slate-400">
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
                                        className={`whitespace-nowrap px-2 text-right ${budget.remaining < 0 ? "text-rose-600" : "text-emerald-600"}`}
                                      >
                                        {money(budget.remaining)}
                                      </td>
                                    </>
                                  )}
                                  <td>
                                    <div className="flex justify-end">
                                      <button
                                        aria-label={`Edit ${row.name}`}
                                        className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-rose-600"
                                        onClick={() => openRow(kind, row)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <Delete
                                        label={`Delete ${row.name}`}
                                        onClick={() => removeRow(row)}
                                      />
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
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">
                          Liquid accounts
                        </p>
                        <p className="mt-1 break-words font-semibold">
                          {money(summary.liquid)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">
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
            subtitle="These are the same records as Expense Tracker, selected by the cycle dates."
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
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-3">Date</th>
                      <th>Item</th>
                      <th>Category</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.transactions]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((e) => (
                        <tr key={e.id} className="border-t border-slate-100">
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
        <Dialog
          title={editingCycle ? "Edit salary cycle" : "New salary cycle"}
          onClose={() => setCycleDialog(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const message = cycleError(cycleDialog, plan.cycles);
              if (message) {
                setError(message);
                return;
              }
              const saved = cycleDialog;
              update((s) => {
                const p = s.financePlanning ?? emptyPlanning();
                const source = p.rows.filter((r) => r.cycleId === copyFrom);
                const copied = source.map((r) => ({
                  ...r,
                  id: uid(),
                  cycleId: saved.id,
                  amount: r.kind === "balance" ? 0 : r.amount,
                }));
                const defaults: FinancePlanRow[] =
                  !editingCycle && !copyFrom
                    ? [
                        { name: "Groceries", categories: [Category.Groceries] },
                        {
                          name: "General expenses",
                          categories: Object.values(Category).filter(
                            (c) =>
                              c !== Category.Groceries &&
                              c !== Category.Unknown,
                          ),
                        },
                        {
                          name: "Unexpected / buffer",
                          categories: [Category.Unknown],
                        },
                      ].map((r) => ({
                        ...r,
                        id: uid(),
                        cycleId: saved.id,
                        kind: "budget",
                        amount: 300,
                        liquid: false,
                      }))
                    : [];
                return {
                  ...s,
                  financePlanning: {
                    ...p,
                    cycles: editingCycle
                      ? p.cycles.map((c) => (c.id === saved.id ? saved : c))
                      : [...p.cycles, saved],
                    rows: [
                      ...p.rows,
                      ...(editingCycle ? [] : copyFrom ? copied : defaults),
                    ],
                  },
                };
              });
              onSelect(saved.id);
              setCycleDialog(null);
            }}
          >
            <Field label="Cycle month">
              <input
                aria-label="Cycle month"
                type="month"
                required
                className={inputClass}
                value={cycleDialog.month}
                onChange={(e) => {
                  const month = e.target.value;
                  setCycleDialog({
                    ...cycleDialog,
                    month,
                    ...(/^\d{4}-\d{2}$/.test(month)
                      ? cycleDates(month, plan.defaultStartDay)
                      : {}),
                  });
                  setError("");
                }}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cycle start">
                <input
                  aria-label="Cycle start"
                  type="date"
                  required
                  className={inputClass}
                  value={cycleDialog.start}
                  onChange={(e) =>
                    setCycleDialog({ ...cycleDialog, start: e.target.value })
                  }
                />
              </Field>
              <Field label="Cycle end">
                <input
                  aria-label="Cycle end"
                  type="date"
                  required
                  className={inputClass}
                  min={cycleDialog.start}
                  value={cycleDialog.end}
                  onChange={(e) =>
                    setCycleDialog({ ...cycleDialog, end: e.target.value })
                  }
                />
              </Field>
            </div>
            {!editingCycle && (
              <Field label="Starting setup">
                <select
                  aria-label="Starting setup"
                  className={inputClass}
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                >
                  <option value="">
                    New setup · three RM300 budget groups
                  </option>
                  {[...plan.cycles]
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Copy {monthName(c.month)}
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  Copying carries income, commitments and budgets forward.
                  Account names copy with zero balances. Expenses always come
                  from their dates.
                </p>
              </Field>
            )}
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
            <button className={primaryClass}>
              {editingCycle ? "Save cycle dates" : "Create cycle"}
            </button>
          </form>
        </Dialog>
      )}
      {rowDialog && (
        <Dialog
          title={`${plan.rows.some((r) => r.id === rowDialog.id) ? "Edit" : "Add"} ${rowDialog.kind}`}
          onClose={() => setRowDialog(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !rowDialog.name.trim() ||
                !Number.isFinite(rowDialog.amount) ||
                rowDialog.amount < 0
              )
                return;
              if (
                rowDialog.kind === "budget" &&
                plan.rows.some(
                  (r) =>
                    r.kind === "budget" &&
                    r.cycleId === selectedId &&
                    r.id !== rowDialog.id &&
                    r.categories.some((c) => rowDialog.categories.includes(c)),
                )
              ) {
                setError(
                  "A category can belong to only one budget group in this cycle.",
                );
                return;
              }
              const saved = { ...rowDialog, name: rowDialog.name.trim() };
              update((s) => {
                const p = s.financePlanning ?? emptyPlanning();
                return {
                  ...s,
                  financePlanning: {
                    ...p,
                    rows: [...p.rows.filter((r) => r.id !== saved.id), saved],
                  },
                };
              });
              setRowDialog(null);
            }}
          >
            <Field label="Name">
              <input
                autoFocus
                required
                aria-label="Plan row name"
                maxLength={200}
                className={inputClass}
                value={rowDialog.name}
                onChange={(e) =>
                  setRowDialog({ ...rowDialog, name: e.target.value })
                }
              />
            </Field>
            <Field label="Amount (RM)">
              <input
                aria-label="Plan row amount"
                required
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={rowDialog.amount}
                onChange={(e) =>
                  setRowDialog({ ...rowDialog, amount: Number(e.target.value) })
                }
              />
            </Field>
            {rowDialog.kind === "budget" && (
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-slate-500">
                  Expense categories
                </legend>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={rowDialog.categories.includes(category)}
                        onChange={(e) =>
                          setRowDialog({
                            ...rowDialog,
                            categories: e.target.checked
                              ? [...rowDialog.categories, category]
                              : rowDialog.categories.filter(
                                  (c) => c !== category,
                                ),
                          })
                        }
                      />
                      <span className="break-words">{category}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {rowDialog.kind === "balance" && (
              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rowDialog.liquid}
                  onChange={(e) =>
                    setRowDialog({ ...rowDialog, liquid: e.target.checked })
                  }
                />
                Include in liquid accounts
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
            <button className={primaryClass}>Save {rowDialog.kind}</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
