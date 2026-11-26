import { useMemo, useState, type ReactNode } from "react";
import {
  Card,
  Empty,
  Field,
  inputClass,
  parseNumberInput,
  primaryClass,
  secondaryClass,
  type Update,
} from "../../workspace/ui";
import { emptyPlanning, money, type FinanceCycle } from "../planning";
import {
  loanCurrentBalance,
  loanForecast,
  syncPortfolioCommitments,
  type FinancePortfolio,
} from "../portfolio-model";
import type { PortfolioDraft, PortfolioEntity } from "./fields";

export function PortfolioLoansTab({
  p,
  cycle,
  today,
  update,
  onNotice,
  onOpen,
  renderAction,
  renderAdd,
}: {
  p: FinancePortfolio;
  cycle: FinanceCycle | undefined;
  today: string;
  update: Update;
  onNotice: (message: string) => void;
  onOpen: (
    entity: PortfolioEntity,
    existing?: object,
    seed?: PortfolioDraft,
  ) => void;
  renderAction: (
    entity: PortfolioEntity,
    row: { id: string; name?: string },
  ) => ReactNode;
  renderAdd: (entity: PortfolioEntity) => ReactNode;
}) {
  const [extra, setExtra] = useState(0);
  const loanNameById = useMemo(
    () => new Map(p.loans.map((l) => [l.id, l.name])),
    [p.loans],
  );

  return (
    <>
      <Card
        title="Loans and payoff estimates"
        subtitle="Estimates assume the entered rate and monthly payment remain unchanged; fees and lender-specific settlement rules are excluded."
        action={renderAdd("loans")}
      >
        <div className="mb-5 max-w-xs">
          <Field label="Extra monthly payment for comparison (RM)">
            <input
              aria-label="Extra loan payment"
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={extra}
              onChange={(e) =>
                setExtra(Math.max(0, parseNumberInput(e.target.value, 0)))
              }
            />
          </Field>
        </div>
        {!p.loans.length ? (
          <Empty>
            Add outstanding loans to include debt in your net worth.
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {p.loans.map((l) => {
              const debt = loanCurrentBalance(p, l);
              const balance = debt.balance;
              const terms = { ...l, asOf: debt.date };
              const f = loanForecast(terms, 0, balance, debt.date);
              const faster = loanForecast(terms, extra, balance, debt.date);
              return (
                <div
                  key={l.id}
                  className="min-w-0 rounded-xl border border-[#EAE2D6] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                      {l.name}
                    </h3>
                    {renderAction("loans", l)}
                  </div>
                  <p className="mt-2 text-2xl font-bold">{money(balance)}</p>
                  <p className="mt-1 text-xs text-[#8C8073]">
                    As of {debt.date} · {l.apr}% {l.rateType} interest
                  </p>
                  <p className="mt-3 text-sm">
                    Payment: {money(l.payment)} · next due {l.nextDue}
                  </p>
                  <p className="mt-2 text-sm">
                    {f.amortizes
                      ? `${f.months} payments remaining · estimated finish ${f.completion}`
                      : "Payment does not clear the interest or the estimate exceeds 100 years."}
                  </p>
                  {f.amortizes && (
                    <p className="mt-1 text-sm text-[#62584E]">
                      Estimated remaining interest: {money(f.interest)}
                    </p>
                  )}
                  {extra > 0 && faster.amortizes && (
                    <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                      With {money(extra)} extra: finish {faster.completion};
                      estimated interest saving{" "}
                      {money(Math.max(0, f.interest - faster.interest))}.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={false}
                    className={`${secondaryClass} mt-4`}
                    onClick={() =>
                      onOpen("debtSnapshots", undefined, {
                        loanId: l.id,
                        balance,
                      })
                    }
                  >
                    Record loan balance
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card
        title="Loan balance history · all dates"
        subtitle="Record opening and closing principal separately to calculate actual net-worth movement."
      >
        {!p.debtSnapshots.length ? (
          <Empty>No loan snapshots recorded for this cycle.</Empty>
        ) : (
          <div className="space-y-3">
            {p.debtSnapshots.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EFE8DC] p-3"
              >
                <p className="break-words text-sm">
                  {loanNameById.get(s.loanId)} · {s.phase} · {s.date} ·{" "}
                  {money(s.balance)}
                </p>
                {renderAction("debtSnapshots", s)}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card
        title="Monthly commitments"
        subtitle="Sync scheduled charges into the selected current/future cycle. Historical commitments stay unchanged. Stable links prevent duplicates."
      >
        <button
          type="button"
          disabled={!cycle || cycle.end < today}
          className={primaryClass}
          onClick={() => {
            if (cycle) {
              update((s) => ({
                ...s,
                financePlanning: syncPortfolioCommitments(
                  s.financePlanning ?? emptyPlanning(),
                  p,
                  cycle,
                  today,
                ),
              }));
              onNotice("Scheduled commitments updated for this cycle only.");
            }
          }}
        >
          Sync cycle commitments
        </button>
      </Card>
    </>
  );
}
