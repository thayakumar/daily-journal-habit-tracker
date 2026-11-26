import { useState } from "react";
import { Dialog } from "../../workspace/Dialog";
import {
  Field,
  inputClass,
  parseNumberInput,
  primaryClass,
  type Update,
} from "../../workspace/ui";
import { localDate, uid, type Workspace } from "../../workspace/model";
import { Category } from "../types";
import {
  cycleDates,
  cycleError,
  emptyPlanning,
  monthName,
  type FinanceCycle,
  type FinancePlanRow,
  type FinancePlanning,
} from "../planning";
import {
  emptyPortfolio,
  syncPortfolioBalances,
  syncPortfolioCommitments,
} from "../portfolio-model";

export function CycleEditorDialog({
  initialCycle,
  editingCycle,
  plan,
  data,
  update,
  onSelect,
  onNotice,
  onClose,
}: {
  initialCycle: FinanceCycle;
  editingCycle: boolean;
  plan: FinancePlanning;
  data: Workspace;
  update: Update;
  onSelect: (id: string) => void;
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const [cycleDialog, setCycleDialog] = useState<FinanceCycle>(initialCycle);
  const [copyFrom, setCopyFrom] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog
      title={editingCycle ? "Edit salary cycle" : "New salary cycle"}
      onClose={onClose}
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
          const today = localDate();
          if (editingCycle) {
            const curPortfolio = data.financePortfolio ?? emptyPortfolio();
            const hasOpening =
              curPortfolio.snapshots.some(
                (r) => r.cycleId === saved.id && r.phase === "opening",
              ) ||
              curPortfolio.debtSnapshots.some(
                (r) => r.cycleId === saved.id && r.phase === "opening",
              );
            const hasClosing =
              curPortfolio.snapshots.some(
                (r) => r.cycleId === saved.id && r.phase === "closing",
              ) ||
              curPortfolio.debtSnapshots.some(
                (r) => r.cycleId === saved.id && r.phase === "closing",
              );
            if (hasOpening && saved.start > today) {
              setError(
                "Linked Portfolio opening balances cannot be moved into a future date.",
              );
              return;
            }
            if (hasClosing && saved.end > today) {
              setError(
                "Linked Portfolio closing balances cannot be moved into a future date.",
              );
              return;
            }
          }
          let shiftedCount = 0;
          let detachedCount = 0;
          update((s) => {
            const p = s.financePlanning ?? emptyPlanning();
            const source = p.rows.filter(
              (r) => r.cycleId === copyFrom && !r.id.startsWith("portfolio:"),
            );
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
                          c !== Category.Groceries && c !== Category.Unknown,
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
            let nextPortfolio = s.financePortfolio ?? emptyPortfolio();
            if (editingCycle) {
              const adjustSnap = <
                T extends { cycleId: string; phase: string; date: string },
              >(
                snap: T,
              ): T => {
                if (snap.cycleId !== saved.id) return snap;
                if (snap.phase === "opening" && snap.date !== saved.start) {
                  shiftedCount++;
                  return { ...snap, date: saved.start };
                }
                if (snap.phase === "closing" && snap.date !== saved.end) {
                  shiftedCount++;
                  return { ...snap, date: saved.end };
                }
                if (
                  snap.phase === "current" &&
                  (snap.date < saved.start || snap.date > saved.end)
                ) {
                  detachedCount++;
                  return { ...snap, cycleId: "" };
                }
                return snap;
              };
              nextPortfolio = {
                ...nextPortfolio,
                snapshots: nextPortfolio.snapshots.map(adjustSnap),
                debtSnapshots: nextPortfolio.debtSnapshots.map(adjustSnap),
                flows: nextPortfolio.flows.map((flow) => {
                  if (
                    flow.cycleId === saved.id &&
                    (flow.date < saved.start || flow.date > saved.end)
                  ) {
                    detachedCount++;
                    return { ...flow, cycleId: "" };
                  }
                  return flow;
                }),
              };
            }
            let nextPlan = {
              ...p,
              cycles: editingCycle
                ? p.cycles.map((c) => (c.id === saved.id ? saved : c))
                : [...p.cycles, saved],
              rows: [
                ...p.rows,
                ...(editingCycle ? [] : copyFrom ? copied : defaults),
              ],
            };
            if (nextPortfolio.accounts.length)
              nextPlan = syncPortfolioBalances(
                nextPlan,
                nextPortfolio,
                saved.id,
              );
            if (
              nextPortfolio.loans.length ||
              nextPortfolio.subscriptions.length
            )
              nextPlan = syncPortfolioCommitments(
                nextPlan,
                nextPortfolio,
                saved,
                today,
              );
            return {
              ...s,
              financePlanning: nextPlan,
              financePortfolio: nextPortfolio,
            };
          });
          if (shiftedCount || detachedCount) {
            const parts: string[] = [];
            if (shiftedCount)
              parts.push(
                `shifted ${shiftedCount} opening/closing Portfolio snapshot${shiftedCount === 1 ? "" : "s"} to match the new dates`,
              );
            if (detachedCount)
              parts.push(
                `${detachedCount} mid-cycle Portfolio record${detachedCount === 1 ? "" : "s"} fell outside the new dates and were moved to ongoing dated history`,
              );
            onNotice(`Cycle updated: ${parts.join("; ")}.`);
          } else {
            onNotice("");
          }
          onSelect(saved.id);
          onClose();
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
              <option value="">New setup · three RM300 budget groups</option>
              {[...plan.cycles]
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Copy {monthName(c.month)}
                  </option>
                ))}
            </select>
            <p className="mt-2 text-xs text-[#8C8073]">
              Copying carries income, commitments and budgets forward. Account
              names copy with zero balances. Expenses always come from their
              dates.
            </p>
          </Field>
        )}
        {error && (
          <p role="alert" className="text-sm text-[#D95D39]">
            {error}
          </p>
        )}
        <button type="submit" className={primaryClass}>
          {editingCycle ? "Save cycle dates" : "Create cycle"}
        </button>
      </form>
    </Dialog>
  );
}

export function PlanRowDialog({
  initialRow,
  selectedId,
  plan,
  categories,
  update,
  onClose,
}: {
  initialRow: FinancePlanRow;
  selectedId: string;
  plan: FinancePlanning;
  categories: string[];
  update: Update;
  onClose: () => void;
}) {
  const [rowDialog, setRowDialog] = useState<FinancePlanRow>(initialRow);
  const [error, setError] = useState("");
  const isEditing = plan.rows.some((r) => r.id === rowDialog.id);
  const selectedCategories = new Set(rowDialog.categories);

  return (
    <Dialog
      title={`${isEditing ? "Edit" : "Add"} ${rowDialog.kind}`}
      onClose={onClose}
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
                r.categories.some((c) => selectedCategories.has(c)),
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
          onClose();
        }}
      >
        <Field label="Name">
          <input
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
              setRowDialog({
                ...rowDialog,
                amount: parseNumberInput(e.target.value, 0),
              })
            }
          />
        </Field>
        {rowDialog.kind === "budget" && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-[#62584E]">
              Expense categories
            </legend>
            <div className="space-y-2">
              {categories.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-3 rounded-xl border border-[#EFE8DC] p-3 text-sm text-[#62584E]"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(category)}
                    onChange={(e) =>
                      setRowDialog({
                        ...rowDialog,
                        categories: e.target.checked
                          ? [...rowDialog.categories, category]
                          : rowDialog.categories.filter((c) => c !== category),
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
          <label className="flex items-center gap-3 text-sm text-[#62584E]">
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
          <p role="alert" className="text-sm text-[#D95D39]">
            {error}
          </p>
        )}
        <button type="submit" className={primaryClass}>
          Save {rowDialog.kind}
        </button>
      </form>
    </Dialog>
  );
}
