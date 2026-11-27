import {
  Delete,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
} from "../../workspace/ui";
import { localDate } from "../../workspace/model";
import { validDate } from "../planning";
import { Dialog } from "../../workspace/Dialog";
import { receiptPreviewUrl } from "../receipts";
import { money } from "../planning";
import React, { useState } from "react";
import { type Expense, Category } from "../types";
import {
  Pencil,
  RefreshCw,
  Search,
  ExternalLink,
  Receipt,
  Car,
  ShoppingBag,
  Sparkles,
  Film,
  Utensils,
  HelpCircle,
  FileText,
} from "lucide-react";

interface ExpenseHistoryProps {
  expenses: Expense[];
  maxDate?: string;
  onSync: () => void;
  lastSaved?: { id: string; name: string; action?: "Added" | "Updated" } | null;
  onEdit?: (expense: Expense) => void;
  onDelete?: (id: string) => void;
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  [Category.Transport]: Car,
  [Category.Groceries]: ShoppingBag,
  [Category.Lifestyle]: Sparkles,
  [Category.Entertainment]: Film,
  [Category.Food]: Utensils,
  [Category.Unknown]: HelpCircle,
};

export const ExpenseHistory: React.FC<ExpenseHistoryProps> = ({
  expenses,
  maxDate,
  onSync,
  lastSaved,
  onEdit,
  onDelete,
}) => {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [amountText, setAmountText] = useState("");
  const [editError, setEditError] = useState("");
  const [receipt, setReceipt] = useState<Expense | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const previewUrl = receipt?.receiptUrl
    ? receiptPreviewUrl(receipt.receiptUrl)
    : null;
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const editMaxDate = maxDate || localDate();
  const isFiltered = filterCategory !== "All" || searchTerm.trim().length > 0;

  const filteredExpenses = [...expenses]
    .sort((a, b) =>
      lastSaved && a.id === lastSaved.id
        ? -1
        : lastSaved && b.id === lastSaved.id
          ? 1
          : b.date.localeCompare(a.date) ||
            (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    )
    .filter((exp) => {
      const matchesCategory =
        filterCategory === "All" || exp.category === filterCategory;
      const matchesSearch =
        exp.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });

  // Calculate Metrics
  const totalAmount = filteredExpenses.reduce(
    (sum, exp) => sum + exp.amount,
    0,
  );
  const averageAmount = filteredExpenses.length
    ? totalAmount / filteredExpenses.length
    : 0;
  const maxExpense = filteredExpenses.length
    ? Math.max(...filteredExpenses.map((e) => e.amount))
    : 0;

  return (
    <div
      id="expense-history-root"
      className="min-w-0 space-y-4 [contain:paint]"
    >
      {/* Joined 3-Column KPI Summary Strip */}
      <div
        id="metrics-grid"
        className="clay-card grid grid-cols-3 divide-x divide-[#EFE8DC] rounded-2xl"
      >
        <div id="metric-total-box" className="min-w-0 px-3 py-3 sm:px-4 sm:py-4">
          <p className="truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
            {isFiltered ? "Filtered" : "Total spent"}
          </p>
          <p className="mt-1 truncate font-display text-sm font-bold tabular-nums text-[#D95D39] min-[375px]:text-base sm:text-2xl">
            {money(totalAmount)}
          </p>
        </div>
        <div id="metric-avg-box" className="min-w-0 px-3 py-3 sm:px-4 sm:py-4">
          <p className="truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
            {isFiltered ? "Avg (filt.)" : "Average"}
          </p>
          <p className="mt-1 truncate font-display text-sm font-bold tabular-nums text-[#24201D] min-[375px]:text-base sm:text-2xl">
            {money(averageAmount)}
          </p>
        </div>
        <div id="metric-max-box" className="min-w-0 px-3 py-3 sm:px-4 sm:py-4">
          <p className="truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
            {isFiltered ? "Max (filt.)" : "Highest"}
          </p>
          <p className="mt-1 truncate font-display text-sm font-bold tabular-nums text-[#24201D] min-[375px]:text-base sm:text-2xl">
            {money(maxExpense)}
          </p>
        </div>
      </div>

      {/* Ledger Card */}
      <div
        id="history-controls"
        className="clay-card min-w-0 space-y-3 rounded-2xl p-3.5 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#EFE8DC] pb-3">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-[#24201D] sm:text-base">
              Expense history
            </h3>
            {lastSaved && (
              <p
                role="status"
                className="mt-1 break-words text-xs font-medium text-[#356651]"
              >
                {lastSaved.action ?? "Added"} {lastSaved.name}. Your history is
                up to date.
              </p>
            )}
          </div>
          <button
            type="button"
            id="btn-refresh-logs"
            onClick={onSync}
            className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#3B342E] shadow-xs transition-colors hover:bg-[#FAF7F2] disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync expenses</span>
          </button>
        </div>

        {/* Single-Row Search & Category Filter */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="relative min-w-0">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#6E6358]">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              aria-label="Search expenses"
              placeholder="Search expenses…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-0 w-full rounded-xl border border-[#E7DDD0] bg-[#FAF7F2] py-2 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[#D95D39] focus:bg-white focus:ring-2 focus:ring-[#FBECE7]"
            />
          </div>

          <select
            aria-label="Filter expense category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="max-w-[132px] rounded-xl border border-[#E7DDD0] bg-[#FAF7F2] px-2.5 py-2 text-xs font-medium text-[#3B342E] outline-none transition-colors focus:border-[#D95D39] focus:bg-white focus:ring-2 focus:ring-[#FBECE7] sm:max-w-[180px]"
          >
            <option value="All">All Categories</option>
            {Object.values(Category).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Main List */}
        {filteredExpenses.length === 0 ? (
          <div
            id="empty-history"
            className="rounded-xl border border-dashed border-[#EAE2D6] bg-[#FAF7F2] py-10 text-center font-medium text-[#6E6358]"
          >
            <Receipt className="mx-auto mb-2 h-7 w-7 text-[#C5B8A8]" />
            <p className="text-xs font-bold text-[#5C5248]">
              No transactions recorded
            </p>
            <p className="mt-1 text-[11px] text-[#6E6358]">
              {expenses.length === 0
                ? "Add your first expense using the form."
                : "No items match your active search filter."}
            </p>
          </div>
        ) : (
          <div
            id="expense-table"
            className="max-w-full overflow-x-auto rounded-xl border border-[#EAE2D6]"
          >
            <table className="w-full divide-y divide-[#EFE8DC] text-left">
              <thead className="hidden bg-[#FAF7F2] text-[11px] font-semibold text-[#5C5248] md:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Expense Item
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-center">
                    Receipt
                  </th>
                  {(onEdit || onDelete) && (
                    <th scope="col" className="px-4 py-2.5 text-center">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE8DC] bg-white text-xs text-[#3B342E]">
                {filteredExpenses.map((exp) => {
                  const CategoryIcon =
                    CATEGORY_ICONS[exp.category] || HelpCircle;
                  return (
                    <tr
                      key={exp.id}
                      className={
                        exp.id === lastSaved?.id
                          ? "bg-emerald-50"
                          : "transition-colors hover:bg-[#FAF7F2]/70"
                      }
                    >
                      {/* Desktop Date */}
                      <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[#5C5248] md:table-cell">
                        {exp.date}
                      </td>
                      {/* Desktop Category */}
                      <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAE2D6] bg-[#F3EDE3] px-2 py-0.5 text-[11px] font-semibold text-[#5C5248]">
                          <CategoryIcon className="h-3 w-3 text-[#5C5248]" />
                          <span className="max-w-[100px] truncate">
                            {exp.category}
                          </span>
                        </span>
                      </td>
                      {/* Item (also serves as compact mobile transaction summary cell) */}
                      <td className="px-3 py-3 md:max-w-xs md:px-4">
                        <div className="flex items-start gap-2.5 md:block">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3EDE3] text-[#5C5248] md:hidden">
                            <CategoryIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#24201D]">
                              {exp.item}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#6E6358] md:hidden">
                              {exp.date} · {exp.category}
                            </p>
                            {exp.receiptName?.startsWith(
                              "Bulk screenshot import",
                            ) && (
                              <span className="mt-1 inline-block rounded bg-[#EDF2F8] px-1.5 py-0.5 text-[10px] font-semibold text-[#355380]">
                                Bulk import
                              </span>
                            )}
                            {exp.receiptName?.startsWith("Imported ") && (
                              <span className="mt-1 inline-block rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                Sheet import
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Amount (also carries compact mobile actions below amount!) */}
                      <td className="whitespace-nowrap px-3 py-3 text-right align-top md:px-4 md:align-middle">
                        <span className="font-display text-sm font-bold tabular-nums text-[#24201D] md:font-mono md:text-xs">
                          {money(exp.amount)}
                        </span>
                      </td>
                      {/* Receipt link */}
                      <td className="whitespace-nowrap px-1.5 py-3 text-center align-middle md:px-4">
                        {exp.receiptUrl ? (
                          <button
                            type="button"
                            aria-label={`View receipt for ${exp.item}`}
                            onClick={() => {
                              setPreviewLoading(true);
                              setReceipt(exp);
                            }}
                            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[#F2C9BC] bg-[#FBECE7] px-2.5 py-1.5 text-[11px] font-semibold text-[#A83E20] hover:bg-[#F7DDD4] md:min-h-10 md:px-3"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </button>
                        ) : (
                          <span className="hidden font-mono text-[10px] text-[#C5B8A8] md:inline">
                            -
                          </span>
                        )}
                      </td>
                      {(onEdit || onDelete) && (
                        <td className="px-2 py-3 text-right align-middle md:px-4 md:text-center">
                          <div className="inline-flex items-center justify-end gap-1">
                            {onEdit && (
                              <button
                                type="button"
                                aria-label={`Edit transaction ${exp.item}`}
                                className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[#DFD5C6] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3B342E] shadow-xs hover:bg-[#FAF7F2] md:min-h-10 md:px-3"
                                onClick={() => {
                                  setEditing({ ...exp });
                                  setAmountText(String(exp.amount));
                                  setEditError("");
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                            )}
                            {onDelete && exp.id && (
                              <Delete
                                label={`Delete transaction ${exp.item}`}
                                onClick={() => {
                                  if (
                                    exp.id &&
                                    confirm(
                                      `Delete expense "${exp.item}" (${money(exp.amount)})?`,
                                    )
                                  ) {
                                    onDelete(exp.id);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <Dialog title="Edit transaction" onClose={() => setEditing(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(amountText);
              if (
                !validDate(editing.date) ||
                editing.date > editMaxDate ||
                !editing.item.trim() ||
                !amountText.trim() ||
                !Number.isFinite(amount) ||
                amount <= 0
              ) {
                setEditError(
                  `Enter a valid date up to ${editMaxDate}, description and positive amount.`,
                );
                return;
              }
              try {
                onEdit?.({
                  ...editing,
                  item: editing.item.trim(),
                  amount: Math.round(amount * 100) / 100,
                });
                setFilterCategory("All");
                setSearchTerm("");
                setEditing(null);
              } catch (error) {
                setEditError(
                  error instanceof Error
                    ? error.message
                    : "Could not update this transaction.",
                );
              }
            }}
          >
            <Field label="Transaction date">
              <input
                className={inputClass}
                required
                type="date"
                max={editMaxDate}
                value={editing.date}
                onChange={(e) =>
                  setEditing({ ...editing, date: e.target.value })
                }
              />
            </Field>
            <p className="text-xs text-[#62584E]">
              Changing the date moves this transaction into the matching salary
              cycle.
            </p>
            <Field label="Transaction description">
              <input
                className={inputClass}
                required
                maxLength={500}
                value={editing.item}
                onChange={(e) =>
                  setEditing({ ...editing, item: e.target.value })
                }
              />
            </Field>
            <Field label="Transaction amount (RM)">
              <input
                className={inputClass}
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
            </Field>
            <Field label="Transaction category">
              <select
                aria-label="Transaction category"
                className={inputClass}
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
              >
                {[
                  ...new Set([...Object.values(Category), editing.category]),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {editing.receiptUrl && (
              <p className="text-sm text-[#62584E]">
                Your existing receipt will be kept.
              </p>
            )}
            {editError && (
              <p role="alert" className="text-sm text-[#A83E20]">
                {editError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={primaryClass}>
                  Save changes
                </button>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
              {onDelete && editing.id && (
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-[#E8B8A9] bg-[#FBECE7] px-3.5 py-2 text-sm font-semibold text-[#A83E20] transition hover:bg-[#F7DDD4]"
                  onClick={() => {
                    if (
                      editing.id &&
                      confirm(
                        `Delete expense "${editing.item}" (${money(editing.amount)})?`,
                      )
                    ) {
                      onDelete(editing.id);
                      setEditing(null);
                    }
                  }}
                >
                  Delete expense
                </button>
              )}
            </div>
          </form>
        </Dialog>
      )}
      {receipt && (
        <Dialog wide title="Receipt preview" onClose={() => setReceipt(null)}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="break-words text-sm text-[#62584E]">
              {receipt.receiptName || receipt.item}
            </p>
            {previewUrl && (
              <a
                className={secondaryClass}
                href={previewUrl.replace(/\/preview$/, "/view")}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Google Drive
              </a>
            )}
          </div>
          {previewUrl ? (
            <>
              {previewLoading && (
                <p role="status" className="mb-3 text-sm text-[#62584E]">
                  Loading receipt…
                </p>
              )}
              <iframe
                title={`Receipt for ${receipt.item}`}
                src={previewUrl}
                onLoad={() => setPreviewLoading(false)}
                className="h-[60dvh] min-h-64 w-full rounded-xl border border-[#EAE2D6]"
                sandbox="allow-scripts allow-same-origin allow-popups"
                allow="fullscreen"
              />
              <p className="mt-3 text-xs leading-relaxed text-[#62584E]">
                On iPhone Safari or strict privacy browsers, Google Drive may
                block embedded previews. Use{" "}
                <a
                  className="font-medium text-[#D95D39] underline"
                  href={previewUrl.replace(/\/preview$/, "/view")}
                  target="_blank"
                  rel="noreferrer"
                >
                  open the original receipt{" "}
                  <ExternalLink className="inline h-3 w-3" />
                </a>{" "}
                above if it stays blank.
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              This receipt link cannot be previewed. Use a receipt uploaded to
              your Google Drive folder.
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
};
