import { useMemo } from "react";
import { CreditCard, Gem, Landmark, TrendingUp, Wallet } from "lucide-react";
import { Card, Empty } from "../../workspace/ui";
import { money, type FinanceCycle, type summarizeCycle } from "../planning";
import {
  loanCurrentBalance,
  subscriptionMonthly,
  type cycleReconciliation,
  type FinancePortfolio,
  type portfolioTotals,
} from "../portfolio-model";

export function PortfolioOverviewTab({
  p,
  cycle,
  totals,
  summary,
  recon,
}: {
  p: FinancePortfolio;
  cycle: FinanceCycle | undefined;
  totals: ReturnType<typeof portfolioTotals>;
  summary: ReturnType<typeof summarizeCycle> | null;
  recon: ReturnType<typeof cycleReconciliation> | null;
}) {
  const monthlyObligations = useMemo(
    () =>
      p.loans
        .filter((l) => loanCurrentBalance(p, l).balance > 0)
        .reduce((s, l) => s + l.payment, 0) +
      p.subscriptions.reduce((s, r) => s + subscriptionMonthly(r), 0),
    [p],
  );

  const kpiInfo = useMemo(() => {
    const accountBreakdown = (
      filter: (a: FinancePortfolio["accounts"][number]) => boolean,
    ) =>
      totals.values
        .filter((v) => filter(v.account))
        .map(
          (v) =>
            `${v.account.name}: ${v.snapshot ? money(v.snapshot.value) : "not recorded (counts as RM 0)"}`,
        );
    return {
      "Recorded net worth": {
        text: "Total assets minus outstanding debt. Monthly bills are not subtracted again.",
        items: [
          `Assets: ${money(totals.assets)}`,
          `Less remaining debt: ${money(totals.debt)}`,
        ],
      },
      "Total assets": {
        text: "Latest recorded balance of each account counted once.",
        items: accountBreakdown(() => true),
      },
      "Bank balances": {
        text: "Accounts typed Bank (included in Total assets and Liquid funds).",
        items: accountBreakdown((a) => a.kind === "bank"),
      },
      "Liquid funds": {
        text: "Accounts marked liquid (bank & wallets; already part of Total assets).",
        items: accountBreakdown((a) => a.liquid),
      },
      "Physical gold": {
        text: "Latest value of Physical gold accounts (included in Total assets).",
        items: accountBreakdown((a) => a.kind === "gold"),
      },
      Investments: {
        text: "Latest value of Investment accounts (included in Total assets).",
        items: accountBreakdown((a) => a.kind === "investment"),
      },
      "Outstanding debt": {
        text: "Remaining principal from Loans using each loan’s latest dated balance.",
        items: p.loans.map(
          (l) => `${l.name}: ${money(loanCurrentBalance(p, l).balance)}`,
        ),
      },
      "Monthly obligations": {
        text: "Monthly loan instalments plus active recurring subscriptions.",
        items: [
          ...p.loans
            .filter((l) => loanCurrentBalance(p, l).balance > 0)
            .map((l) => `${l.name}: ${money(l.payment)}/month`),
          ...p.subscriptions
            .filter((s) => s.active)
            .map((s) => `${s.name}: ${money(subscriptionMonthly(s))}/month`),
        ],
      },
    } as Record<string, { text: string; items: string[] }>;
  }, [p, totals]);

  const assetShare =
    totals.assets + totals.debt > 0
      ? Math.round((totals.assets / (totals.assets + totals.debt)) * 100)
      : 100;

  return (
    <div className="space-y-4">
      {/* Row 1 — Terracotta Net Worth Hero + 2x2 Primary Bento Grid */}
      <div className="grid gap-3 lg:grid-cols-12">
        <div
          className={`flex min-w-0 flex-col justify-between rounded-[22px] p-5 lg:col-span-5 ${
            totals.netWorth < 0
              ? "border border-[#E8B8A9] bg-[#FBECE7] text-[#9A381D]"
              : "bg-gradient-to-br from-[#D95D39] to-[#B84727] text-white shadow-[0_12px_28px_-12px_rgba(184,71,39,0.55)]"
          }`}
        >
          <p
            className={`flex items-center justify-between gap-2 text-xs font-semibold ${
              totals.netWorth < 0 ? "text-[#9A381D]" : "text-white/85"
            }`}
          >
            Recorded net worth
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                totals.netWorth < 0 ? "bg-white/60" : "bg-white/15"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
            </span>
          </p>
          <p className="mt-2 break-words font-display text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
            {money(totals.netWorth)}
          </p>
          <p
            className={`mt-1.5 text-[11px] leading-snug ${
              totals.netWorth < 0 ? "text-[#9A381D]/85" : "text-white/80"
            }`}
          >
            {kpiInfo["Recorded net worth"].text}
          </p>
          <div className="mt-3.5 space-y-1.5">
            <div
              className={`h-1.5 w-full overflow-hidden rounded-full ${
                totals.netWorth < 0 ? "bg-[#E8B8A9]" : "bg-white/25"
              }`}
            >
              <div
                className={`h-full rounded-full ${
                  totals.netWorth < 0 ? "bg-[#B84727]" : "bg-white"
                }`}
                style={{ width: `${assetShare}%` }}
              />
            </div>
            <div
              className={`flex flex-wrap justify-between gap-2 text-[11px] font-semibold tabular-nums ${
                totals.netWorth < 0 ? "text-[#9A381D]" : "text-white/90"
              }`}
            >
              <span>Assets {money(totals.assets)}</span>
              <span>Debt {money(totals.debt)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:col-span-7">
          {(
            [
              {
                label: "Total assets",
                value: totals.assets,
                Icon: Landmark,
                valueClass: "text-[#24201D]",
              },
              {
                label: "Liquid funds",
                value: totals.liquid,
                Icon: Wallet,
                valueClass: "text-[#356651]",
              },
              {
                label: "Outstanding debt",
                value: totals.debt,
                Icon: CreditCard,
                valueClass:
                  totals.debt > 0 ? "text-[#B84727]" : "text-[#24201D]",
              },
              {
                label: "Monthly obligations",
                value: monthlyObligations,
                Icon: CreditCard,
                valueClass: "text-[#24201D]",
              },
            ] as const
          ).map(({ label, value, Icon, valueClass }) => (
            <div
              key={label}
              className="clay-card min-w-0 rounded-2xl p-3.5 sm:p-4"
            >
              <p className="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-[#6E6358] sm:text-xs">
                {label}
                <Icon className="h-3.5 w-3.5 shrink-0 text-[#8C8073]" />
              </p>
              <p
                className={`mt-1.5 break-words font-display text-lg font-bold tabular-nums sm:text-2xl ${valueClass}`}
              >
                {money(value)}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#5C5248]">
                {kpiInfo[label].text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — Asset Class Breakdown Strip */}
      <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-3 sm:gap-3">
        {(
          [
            ["Bank balances", totals.bank, Landmark],
            ["Investments", totals.investments, TrendingUp],
            ["Physical gold", totals.gold, Gem],
          ] as const
        ).map(([label, value, Icon]) => (
          <div
            key={label}
            className="min-w-0 rounded-2xl border border-[#E7DDD0] bg-[#FAF7F2] p-3.5 sm:p-4"
          >
            <p className="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-[#5C5248] sm:text-xs">
              {label}
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#6E6358]" />
            </p>
            <p className="mt-1 break-words font-display text-base font-bold tabular-nums text-[#24201D] sm:text-xl">
              {money(value)}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#5C5248] sm:text-[11px]">
              {kpiInfo[label].text}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-[#6E6358]">
        Older snapshots, purchase costs and monthly income are not added again.
      </p>

      {(!p.accounts.length || totals.missing > 0) && (
        <p
          role="status"
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
        >
          {!p.accounts.length
            ? "Add accounts and their balances for a complete net-worth picture."
            : `${totals.missing} accounts still need a recorded valuation. The totals include known balances only.`}
        </p>
      )}

      {/* Row 3 — Desktop 2-Column Split: Accounts List & Cycle Reconciliation */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card
          compact
          className="xl:col-span-5"
          title="Recorded account values"
          subtitle="Latest dated valuation per account."
        >
          {!p.accounts.length ? (
            <Empty compact>
              Add your bank accounts, investments and physical assets in
              Accounts.
            </Empty>
          ) : (
            <div className="divide-y divide-[#EFE8DC]">
              {totals.values.map(({ account, snapshot }) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#24201D]">
                      {account.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6E6358]">
                      {snapshot
                        ? `As of ${snapshot.date} · ${snapshot.phase}`
                        : "Update in Accounts"}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-sm font-bold tabular-nums text-[#24201D] sm:text-base">
                    {snapshot ? money(snapshot.value) : "No valuation"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          compact
          className="xl:col-span-7"
          title="Cycle closing and reconciliation"
          subtitle={
            cycle
              ? `${cycle.start} → ${cycle.end} · Opening and closing records kept separately.`
              : "Select a salary cycle to compare your plan with actual balances."
          }
        >
          {summary && recon ? (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  ["Planned savings", summary.expected],
                  ["Logged surplus", summary.surplus],
                  ["Actual wealth movement", recon.movement],
                  ["Opening net worth", recon.complete ? recon.opening : null],
                  ["Closing net worth", recon.complete ? recon.closing : null],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] p-3"
                  >
                    <p className="text-[11px] font-semibold text-[#6E6358]">
                      {label}
                    </p>
                    <p className="mt-1 break-words font-display text-base font-bold tabular-nums text-[#24201D] sm:text-lg">
                      {value === null
                        ? "Incomplete"
                        : money(Number(value))}
                    </p>
                  </div>
                ))}
              </div>
              {!recon.complete ? (
                <p className="mt-3 text-xs text-amber-800">
                  Record opening and closing asset and loan balances to complete
                  this comparison.
                  {recon.missing.length > 0 &&
                    ` Missing: ${recon.missing.join(", ")}.`}
                </p>
              ) : (
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <p>
                    Investment / gold result:{" "}
                    <strong className="tabular-nums">
                      {money(recon.investmentReturn)}
                    </strong>
                  </p>
                  <p>
                    Debt balance reduction:{" "}
                    <strong className="tabular-nums">
                      {money(recon.debtReduction)}
                    </strong>
                  </p>
                  <p>
                    External movements outside budget:{" "}
                    <strong className="tabular-nums">
                      {money(recon.external)}
                    </strong>
                  </p>
                  <p
                    className={
                      Math.abs(recon.unreconciled ?? 0) > 0.01
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }
                  >
                    Unreconciled difference:{" "}
                    <strong className="tabular-nums">
                      {money(recon.unreconciled ?? 0)}
                    </strong>
                  </p>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-[#6E6358]">
                Transfers between your accounts do not create wealth. Investment
                results adjust for recorded contributions and withdrawals. An
                unexplained difference can include missing entries, new
                borrowing, fees or commitments also recorded as expenses; it is
                not automatically an investment loss.
              </p>
            </>
          ) : (
            <Empty compact>Create or select a salary cycle first.</Empty>
          )}
        </Card>
      </div>

      <details className="clay-card rounded-2xl">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#473F38] sm:text-sm">
          Calculation breakdown by account &amp; loan
        </summary>
        <div className="grid gap-3 border-t border-[#EFE8DC] p-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(kpiInfo).map(([label, info]) => (
            <div key={label} className="min-w-0 rounded-xl bg-[#FAF7F2] p-3">
              <p className="text-xs font-semibold text-[#24201D]">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#62584E]">
                {info.text}
              </p>
              {info.items.length ? (
                <ul className="mt-2 space-y-1 border-t border-[#EAE2D6] pt-2 text-xs text-[#473F38]">
                  {info.items.map((item) => (
                    <li key={`${label}:${item}`} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[#6E6358]">
                  No matching records yet.
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
