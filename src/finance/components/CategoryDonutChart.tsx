import { Card, Empty } from "../../workspace/ui";
import { money, monthName } from "../planning";

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

export function CategoryDonutChart({
  month,
  spent,
  categories,
}: {
  month: string;
  spent: number;
  categories: { name: string; amount: number }[];
}) {
  return (
    <Card
      title="Expenses by category"
      subtitle="Every category is included automatically, including Entertainment and new categories."
    >
      {!categories.length ? (
        <Empty>
          No expenses in this cycle yet. Add them in Expense Tracker.
        </Empty>
      ) : (
        <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
          <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={`Expense categories for ${monthName(month)}. Total ${money(spent)}.`}
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
            {categories.map((c, i) => {
              const before = categories
                .slice(0, i)
                .reduce((n, r) => n + r.amount, 0);
              const fraction = spent ? c.amount / spent : 0;
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
                  strokeDashoffset={spent ? (-before / spent) * 100 : 0}
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
              className="fill-[#8C8073]"
              fontSize="7"
            >
              TOTAL EXPENSES
            </text>
            <text
              x="60"
              y="70"
              textAnchor="middle"
              className="fill-[#24201D]"
              fontSize="9"
              fontWeight="600"
            >
              {money(spent)}
            </text>
          </svg>
          <ul aria-label="Category breakdown" className="space-y-3">
            {categories.map((c, i) => (
              <li
                key={c.name}
                className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="min-w-0 flex-1 break-words text-[#62584E]">
                  {c.name}
                </span>
                <span className="font-medium text-[#24201D]">
                  {money(c.amount)}
                </span>
                <span className="text-xs text-[#8C8073]">
                  ({spent ? ((c.amount / spent) * 100).toFixed(1) : "0"}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
