import React, { useState } from "react";
import { type Expense, Category } from "../types";
import {
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  TrendingUp,
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
  onSync: () => void;
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
  onSync,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredExpenses = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
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
    <div id="expense-history-root" className="min-w-0 space-y-6">
      {/* Metrics Banner */}
      <div id="metrics-grid" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1 */}
        <div
          id="metric-total-box"
          className="min-w-0 p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm"
        >
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Total Recorded Spending
            </p>
            <p className="break-words text-xl font-sans font-bold text-slate-800 mt-1">
              $
              {totalAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="hidden 2xl:block p-3 bg-rose-50 rounded-lg text-rose-600 border border-rose-100 shadow-xs">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div
          id="metric-avg-box"
          className="min-w-0 p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm"
        >
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Average Expense
            </p>
            <p className="break-words text-xl font-sans font-bold text-slate-800 mt-1">
              $
              {averageAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="hidden 2xl:block p-3 bg-rose-50 rounded-lg text-rose-600 border border-rose-100 shadow-xs">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div
          id="metric-max-box"
          className="min-w-0 p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm"
        >
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Highest Transaction
            </p>
            <p className="break-words text-xl font-sans font-bold text-slate-800 mt-1">
              $
              {maxExpense.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="hidden 2xl:block p-3 bg-rose-50 rounded-lg text-rose-600 border border-rose-100 shadow-xs">
            <Receipt className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Control Block */}
      <div
        id="history-controls"
        className="min-w-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-3 border-b border-slate-100">
          <div className="w-full sm:w-auto">
            <h3 className="font-sans font-bold text-slate-800 text-sm">
              Expense History Log
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Saved with your planner’s finance records
            </p>
          </div>
          <button
            id="btn-refresh-logs"
            onClick={onSync}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Sync expenses</span>
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative sm:col-span-2">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              aria-label="Search expenses"
              placeholder="Search expenses by item or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-0 w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
            />
          </div>

          {/* Selector */}
          <select
            aria-label="Filter expense category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
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
            className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50 font-medium"
          >
            <Receipt className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">
              No transactions recorded
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {expenses.length === 0
                ? "Add your first expense using the form."
                : "No items match your active search filter."}
            </p>
          </div>
        ) : (
          <div
            id="expense-table"
            className="max-w-full overflow-x-auto rounded-lg border border-slate-200/80"
          >
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Expense Item
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                {filteredExpenses.map((exp) => {
                  const CategoryIcon =
                    CATEGORY_ICONS[exp.category] || HelpCircle;
                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[11px] font-mono text-slate-500">
                        {exp.date}
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 border border-slate-200/60 rounded text-[10px] text-slate-600 font-bold uppercase tracking-wide">
                          <CategoryIcon className="h-3 w-3 text-slate-500" />
                          <span className="max-w-[100px] truncate">
                            {exp.category}
                          </span>
                        </span>
                      </td>
                      {/* Item */}
                      <td className="px-4 py-3.5 max-w-xs truncate font-medium text-slate-900">
                        {exp.item}
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                        ${exp.amount.toFixed(2)}
                      </td>
                      {/* Receipt link */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {exp.receiptUrl ? (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] bg-slate-50 border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 font-bold rounded cursor-pointer transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                            <span>View</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-mono">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
