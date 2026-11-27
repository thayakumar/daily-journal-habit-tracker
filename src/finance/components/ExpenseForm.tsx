import type { FinanceCycle } from "../planning";
import React, { useState, useRef } from "react";
import { Category, type Expense } from "../types";
import { uploadFinanceReceipt } from "../../lib/sheets-api";
import {
  Calendar,
  Coins,
  Tag,
  Car,
  ShoppingBag,
  Sparkles,
  Film,
  Utensils,
  HelpCircle,
  FileUp,
  FileText,
  X,
  Check,
  Loader2,
} from "lucide-react";

interface ExpenseFormProps {
  receiptReady: boolean;
  cycle: FinanceCycle;
  onSave: (expense: Omit<Expense, "id">) => void;
}

const CATEGORY_META = [
  {
    name: Category.Transport,
    label: "Transport / Parking",
    icon: Car,
    bg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    name: Category.Groceries,
    label: "Groceries",
    icon: ShoppingBag,
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    name: Category.Lifestyle,
    label: "Lifestyle",
    icon: Sparkles,
    bg: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    name: Category.Entertainment,
    label: "Entertainment",
    icon: Film,
    bg: "bg-[#FBECE7] text-[#A83E20] border-[#F2C9BC]",
  },
  {
    name: Category.Food,
    label: "Food",
    icon: Utensils,
    bg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    name: Category.Unknown,
    label: "Unknown",
    icon: HelpCircle,
    bg: "bg-stone-50 text-stone-700 border-stone-200",
  },
];

const EN_CA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA");

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  receiptReady,
  cycle,
  onSave,
}) => {
  const [date, setDate] = useState<string>(() => {
    const today = EN_CA_DATE_FORMATTER.format(new Date());
    return today >= cycle.start && today <= cycle.end ? today : "";
  });
  const [item, setItem] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    Category.Food,
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setReceiptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !item.trim() || !amount) {
      setSubmitError("Please fill out all required fields marked with *");
      return;
    }

    if (date < cycle.start || date > cycle.end) {
      setSubmitError(
        "Choose a date within the selected salary cycle, or switch cycles first.",
      );
      return;
    }
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitError("Please input a valid positive expense amount.");
      return;
    }

    if (receiptFile && !receiptReady) {
      setSubmitError(
        "Deploy the updated planner Apps Script before uploading receipts.",
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      let receiptUrl = "";
      let receiptName = "";

      if (receiptFile) {
        setIsUploading(true);
        const sanitizedItem = item
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .replace(/__+/g, "_");
        const customName = `${selectedCategory.toLowerCase()}_${sanitizedItem.toLowerCase()}_${date}`;
        const uploadResult = await uploadFinanceReceipt(
          new File(
            [receiptFile],
            `${customName}.${receiptFile.name.split(".").pop()}`,
            { type: receiptFile.type },
          ),
        );
        receiptUrl = uploadResult.receiptUrl;
        receiptName = uploadResult.receiptName;
        setIsUploading(false);
      }

      const expenseData: Omit<Expense, "id"> = {
        date,
        item,
        amount: numericAmount,
        category: selectedCategory,
        receiptUrl,
        receiptName,
      };

      onSave(expenseData);

      // Success State Reset
      setSubmitSuccess(true);
      setItem("");
      setAmount("");
      setReceiptFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => {
        setSubmitSuccess(false);
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setSubmitError(
        err?.message || "Failed to log transaction. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div
      id="expense-form-root"
      className="clay-card w-full overflow-hidden rounded-2xl"
    >
      <div
        id="form-header"
        className="flex items-center justify-between gap-2 border-b border-[#EFE8DC] bg-[#FAF7F2]/70 px-4 py-2.5 sm:px-5 sm:py-3"
      >
        <h2 className="font-display text-sm font-semibold text-[#24201D] sm:text-base">
          New expense
        </h2>
        {!receiptReady && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900">
            Local save
          </span>
        )}
      </div>

      <div className="p-3.5 sm:p-4">
        <form
          id="expense-entry-form"
          onSubmit={handleSubmit}
          className="space-y-3"
        >
          {/* Item Row */}
          <div id="input-group-item">
            <label
              htmlFor="expense-item-input"
              className="mb-1 block text-[11px] font-semibold text-[#5C5248]"
            >
              Item or description <span className="text-[#D95D39]">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#6E6358]">
                <Tag className="h-3.5 w-3.5" />
              </span>
              <input
                id="expense-item-input"
                type="text"
                aria-label="Expense description"
                required
                placeholder="e.g., Lunch, groceries, broadband"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="min-w-0 w-full rounded-xl border border-[#DFD5C6] bg-[#FAF7F2]/60 py-2 pl-9 pr-3 text-sm text-[#24201D] placeholder:text-[#7C7064] outline-none transition-colors focus:border-[#D95D39] focus:bg-white focus:ring-4 focus:ring-[#FBECE7]"
              />
            </div>
          </div>

          {/* Date + Amount Side-by-Side */}
          <div className="grid grid-cols-2 gap-2.5">
            <div id="input-group-amount" className="min-w-0">
              <label
                htmlFor="expense-amount-input"
                className="mb-1 block text-[11px] font-semibold text-[#5C5248]"
              >
                Amount (RM) <span className="text-[#D95D39]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#6E6358]">
                  <Coins className="h-3.5 w-3.5" />
                </span>
                <input
                  id="expense-amount-input"
                  type="number"
                  aria-label="Expense amount"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-[#DFD5C6] bg-[#FAF7F2]/60 py-2 pl-9 pr-2.5 text-sm tabular-nums text-[#24201D] placeholder:text-[#7C7064] outline-none transition-colors focus:border-[#D95D39] focus:bg-white focus:ring-4 focus:ring-[#FBECE7]"
                />
              </div>
            </div>

            <div id="input-group-date" className="min-w-0">
              <label
                htmlFor="expense-date-input"
                className="mb-1 block text-[11px] font-semibold text-[#5C5248]"
              >
                Date <span className="text-[#D95D39]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 hidden items-center pl-2.5 text-[#6E6358] sm:flex">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <input
                  id="expense-date-input"
                  type="date"
                  aria-label="Expense date"
                  min={cycle.start}
                  max={cycle.end}
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-w-0 w-full rounded-xl border border-[#DFD5C6] bg-[#FAF7F2]/60 px-2.5 py-2 text-xs text-[#24201D] outline-none transition-colors focus:border-[#D95D39] focus:bg-white focus:ring-4 focus:ring-[#FBECE7] sm:pl-8 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Category Compact Chip Grid */}
          <div id="input-group-category">
            <span
              id="expense-category-label"
              className="mb-1.5 block text-[11px] font-semibold text-[#5C5248]"
            >
              Category <span className="text-[#D95D39]">*</span>
            </span>
            <div
              role="group"
              aria-labelledby="expense-category-label"
              className="grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-3"
            >
              {CATEGORY_META.map((meta) => {
                const Icon = meta.icon;
                const isSelected = selectedCategory === meta.name;
                return (
                  <button
                    key={meta.name}
                    type="button"
                    onClick={() => setSelectedCategory(meta.name)}
                    className={`flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] transition-colors duration-150 ${
                      isSelected
                        ? "border-[#D95D39] bg-[#FBECE7] font-semibold text-[#A83E20] shadow-xs"
                        : "border-[#E7DDD0] bg-[#FAF7F2]/70 text-[#5C5248] hover:border-[#D6C8B6] hover:bg-[#F3EDE3]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact 1-Line Receipt Upload Strip */}
          <div id="input-group-receipt">
            {!receiptFile ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label="Choose a receipt file"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 transition-colors duration-150 ${
                  dragActive
                    ? "border-[#D95D39] bg-[#FBECE7]/40"
                    : "border-[#DFD5C6] bg-[#FAF7F2]/60 hover:bg-[#FAF7F2]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#5C5248]">
                  <FileUp className="h-4 w-4 shrink-0 text-[#6E6358]" />
                  <span className="truncate">Attach receipt (optional)</span>
                </span>
                <span className="shrink-0 rounded-lg border border-[#E7DDD0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3B342E]">
                  Browse
                </span>
                <input
                  id="expense-receipt-input"
                  type="file"
                  aria-label="Expense receipt"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="h-4 w-4 shrink-0 text-[#62584E]" />
                  <div className="overflow-hidden">
                    <p className="truncate text-xs font-medium text-[#24201D]">
                      {receiptFile.name}
                    </p>
                    <p className="text-[10px] text-[#6E6358]">
                      {(receiptFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remove selected receipt"
                  onClick={handleRemoveFile}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#6E6358] hover:bg-[#EAE2D6] hover:text-[#24201D]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Messaging Feedback */}
          {submitError && (
            <div
              id="submit-error"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600"
            >
              {submitError}
            </div>
          )}

          {submitSuccess && (
            <div
              id="submit-success"
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Expense saved. Sheet sync follows your planner connection.
              </span>
            </div>
          )}

          {/* Form Action */}
          <button
            id="btn-submit-expense"
            type="submit"
            disabled={isSubmitting || (!!receiptFile && !receiptReady)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#D95D39] py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(217,93,57,0.45)] transition duration-150 hover:bg-[#C04C2B] active:scale-[0.98] disabled:bg-[#D5C9B9]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isUploading
                    ? "Uploading receipt to Drive..."
                    : "Saving expense..."}
                </span>
              </>
            ) : (
              <span>Save expense</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
