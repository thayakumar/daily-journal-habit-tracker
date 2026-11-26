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

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            {
              label: "Recorded net worth",
              value: totals.netWorth,
              Icon: Landmark,
              tone:
                totals.netWorth < 0
                  ? "border-[#E8B8A9] bg-[#FBECE7]/60 text-[#A83E20]"
                  : "border-[#EAE2D6] bg-white text-[#24201D]",
              valueClass:
                totals.netWorth < 0 ? "text-[#B84727]" : "text-[#24201D]",
            },
            {
              label: "Total assets",
              value: totals.assets,
              Icon: Landmark,
              tone: "border-[#EAE2D6] bg-white text-[#24201D]",
              valueClass: "text-[#24201D]",
            },
            {
              label: "Liquid funds",
              value: totals.liquid,
              Icon: Wallet,
              tone: "border-[#EAE2D6] bg-white text-[#24201D]",
              valueClass: "text-[#356651]",
            },
            {
              label: "Outstanding debt",
              value: totals.debt,
              Icon: CreditCard,
              tone: "border-[#EAE2D6] bg-white text-[#24201D]",
              valueClass: totals.debt > 0 ? "text-[#B84727]" : "text-[#24201D]",
            },
          ] as const
        ).map(({ label, value, Icon, tone, valueClass }) => (
          <div
            key={label}
            className={`min-w-0 rounded-2xl border p-5 shadow-xs ${tone}`}
          >
            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-[#6E6358]">
              {label}
              <Icon className="h-4 w-4 shrink-0 text-[#6E6358]" />
            </p>
            <p
              className={`mt-2.5 break-words font-display text-2xl font-bold tabular-nums sm:text-3xl ${valueClass}`}
            >
              {money(value)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#5C5248]">
              {kpiInfo[label].text}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Bank balances", totals.bank, Landmark],
            ["Investments", totals.investments, TrendingUp],
            ["Physical gold", totals.gold, Gem],
            ["Monthly obligations", monthlyObligations, CreditCard],
          ] as const
        ).map(([label, value, Icon]) => (
          <div
            key={label}
            className="min-w-0 rounded-2xl border border-[#E7DDD0] bg-[#FAF7F2] p-4"
          >
            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-[#5C5248]">
              {label}
              <Icon className="h-4 w-4 shrink-0 text-[#6E6358]" />
            </p>
            <p className="mt-1.5 break-words font-display text-xl font-bold tabular-nums text-[#24201D]">
              {money(value)}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5C5248]">
              {kpiInfo[label].text}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-[#8C8073]">
        Older snapshots, purchase costs and monthly income are not added again.
      </p>
      <details className="clay-card rounded-2xl">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#473F38]">
          Calculation breakdown by account &amp; loan
        </summary>
        <div className="grid gap-4 border-t border-[#EFE8DC] p-5 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(kpiInfo).map(([label, info]) => (
            <div key={label} className="min-w-0 rounded-xl bg-[#FAF7F2] p-3.5">
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
                <p className="mt-2 text-xs text-[#8C8073]">
                  No matching records yet.
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
      {(!p.accounts.length || totals.missing > 0) && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
        >
          {!p.accounts.length
            ? "Add accounts and their balances for a complete net-worth picture."
            : `${totals.missing} accounts still need a recorded valuation. The totals include known balances only.`}
        </p>
      )}
      <Card
        title="Cycle closing and reconciliation"
        subtitle={
          cycle
            ? `${cycle.start} → ${cycle.end}. Opening and closing records are kept separately.`
            : "Select a salary cycle to compare your plan with actual balances."
        }
      >
        {summary && recon ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Planned savings", summary.expected],
                ["Logged surplus", summary.surplus],
                ["Actual wealth movement", recon.movement],
                ["Opening net worth", recon.complete ? recon.opening : null],
                ["Closing net worth", recon.complete ? recon.closing : null],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl bg-[#FAF7F2] p-4"
                >
                  <p className="text-sm text-[#62584E]">{label}</p>
                  <p className="mt-2 break-words text-xl font-bold">
                    {value === null
                      ? "Closing incomplete"
                      : money(Number(value))}
                  </p>
                </div>
              ))}
            </div>
            {!recon.complete ? (
              <p className="mt-4 text-sm text-amber-700">
                Record opening and closing asset and loan balances to complete
                this comparison.
                {recon.missing.length > 0 &&
                  ` Missing: ${recon.missing.join(", ")}.`}
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <p>
                  Investment / gold result:{" "}
                  <strong>{money(recon.investmentReturn)}</strong>
                </p>
                <p>
                  Debt balance reduction:{" "}
                  <strong>{money(recon.debtReduction)}</strong>
                </p>
                <p>
                  External movements outside budget:{" "}
                  <strong>{money(recon.external)}</strong>
                </p>
                <p
                  className={
                    Math.abs(recon.unreconciled ?? 0) > 0.01
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }
                >
                  Unreconciled difference:{" "}
                  <strong>{money(recon.unreconciled ?? 0)}</strong>
                </p>
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-[#62584E]">
              Transfers between your accounts do not create wealth. Investment
              results adjust for recorded contributions and withdrawals. An
              unexplained difference can include missing entries, new borrowing,
              fees or commitments also recorded as expenses; it is not
              automatically an investment loss.
            </p>
          </>
        ) : (
          <Empty>Create or select a salary cycle first.</Empty>
        )}
      </Card>
      <Card
        title="Recorded account values"
        subtitle="Each account is counted once using its latest dated valuation."
      >
        {!p.accounts.length ? (
          <Empty>
            Add your bank accounts, investments and physical assets in Accounts.
          </Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {totals.values.map(({ account, snapshot }) => (
              <div
                key={account.id}
                className="min-w-0 rounded-xl border border-[#EFE8DC] p-4"
              >
                <p className="break-words font-semibold">{account.name}</p>
                <p className="mt-2 text-xl font-bold">
                  {snapshot ? money(snapshot.value) : "No valuation"}
                </p>
                <p className="mt-1 text-xs text-[#8C8073]">
                  {snapshot
                    ? `As of ${snapshot.date} · ${snapshot.phase}`
                    : "Update this account in Accounts"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
