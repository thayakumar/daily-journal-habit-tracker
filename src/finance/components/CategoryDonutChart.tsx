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
      compact
      title="Expenses by category"
      subtitle="Every category in this cycle, updated automatically."
    >
      {!categories.length ? (
        <Empty compact>
          No expenses in this cycle yet. Add them in Expense Tracker.
        </Empty>
      ) : (
        <div className="grid items-center gap-4 md:grid-cols-[190px_1fr] md:gap-6">
          <svg
            viewBox="0 0 120 120"
            role="img"
            aria-label={`Expense categories for ${monthName(month)}. Total ${money(spent)}.`}
            className="mx-auto h-40 w-40 max-w-full sm:h-44 sm:w-44"
          >
            <circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke="#EFE8DC"
              strokeWidth="18"
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
                  strokeWidth="18"
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
              y="56"
              textAnchor="middle"
              className="fill-[#6E6358]"
              fontSize="7"
              fontWeight="600"
            >
              TOTAL SPENT
            </text>
            <text
              x="60"
              y="69"
              textAnchor="middle"
              className="fill-[#24201D]"
              fontSize="9"
              fontWeight="700"
            >
              {money(spent)}
            </text>
          </svg>
          <ul aria-label="Category breakdown" className="space-y-2.5">
            {categories.map((c, i) => {
              const pct = spent ? (c.amount / spent) * 100 : 0;
              return (
                <li key={c.name} className="min-w-0 space-y-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-[#3B342E]">
                      {c.name}
                    </span>
                    <span className="font-semibold tabular-nums text-[#24201D]">
                      {money(c.amount)}
                    </span>
                    <span className="w-10 text-right text-[11px] tabular-nums text-[#6E6358]">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFE8DC]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, pct)}%`,
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
