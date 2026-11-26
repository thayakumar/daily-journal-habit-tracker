import { useMemo, type ReactNode } from "react";
import { Target } from "lucide-react";
import { Card, Empty, secondaryClass, type Update } from "../../workspace/ui";
import { emptyPlanning, money, type FinanceCycle } from "../planning";
import {
  goalProgress,
  latestSnapshot,
  subscriptionMonthly,
  syncPortfolioCommitments,
  type FinancePortfolio,
} from "../portfolio-model";
import type { PortfolioDraft, PortfolioEntity } from "./fields";

export function PortfolioSubscriptionsTab({
  p,
  cycle,
  today,
  update,
  onNotice,
  renderAction,
  renderAdd,
}: {
  p: FinancePortfolio;
  cycle: FinanceCycle | undefined;
  today: string;
  update: Update;
  onNotice: (message: string) => void;
  renderAction: (
    entity: PortfolioEntity,
    row: { id: string; name?: string },
  ) => ReactNode;
  renderAdd: (entity: PortfolioEntity) => ReactNode;
}) {
  return (
    <Card
      title="Subscriptions and renewals"
      subtitle="Monthly equivalents are for comparison. Syncing uses actual renewal dates in current or future cycles; historical commitments stay unchanged."
      action={renderAdd("subscriptions")}
    >
      {!p.subscriptions.length ? (
        <Empty>Add active subscriptions and their next renewal dates.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {p.subscriptions.map((s) => (
            <div
              key={s.id}
              className="min-w-0 rounded-xl border border-[#EAE2D6] p-4"
            >
              <div className="flex justify-between gap-2">
                <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                  {s.name}
                </h3>
                {renderAction("subscriptions", s)}
              </div>
              <p className="mt-2 text-xl font-bold">
                {money(s.amount)} / {s.frequency}
              </p>
              <p className="mt-2 text-sm text-[#62584E]">
                {s.active ? "Active" : "Inactive"} · next renewal {s.nextDue}
              </p>
              <p className="mt-1 text-sm text-[#62584E]">
                Monthly equivalent {money(subscriptionMonthly(s))}
              </p>
              {s.manageUrl && (
                <a
                  className={`${secondaryClass} mt-4`}
                  href={s.manageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage subscription
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={!cycle || cycle.end < today}
        className={`${secondaryClass} mt-5`}
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
            onNotice("Scheduled cycle commitments updated.");
          }
        }}
      >
        Sync cycle commitments
      </button>
    </Card>
  );
}

export function PortfolioGoalsTab({
  p,
  today,
  onOpen,
  renderAction,
  renderAdd,
}: {
  p: FinancePortfolio;
  today: string;
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
  const accountNameById = useMemo(
    () => new Map(p.accounts.map((a) => [a.id, a.name])),
    [p.accounts],
  );
  const goalNameById = useMemo(
    () => new Map(p.goals.map((g) => [g.id, g.name])),
    [p.goals],
  );
  const overAllocated = useMemo(() => {
    const allocatedByAccount = new Map<string, number>();
    for (const a of p.allocations) {
      allocatedByAccount.set(
        a.accountId,
        (allocatedByAccount.get(a.accountId) ?? 0) + a.amount,
      );
    }
    return p.accounts.some(
      (a) =>
        (allocatedByAccount.get(a.id) ?? 0) >
        (latestSnapshot(p, a.id)?.value ?? 0),
    );
  }, [p]);

  return (
    <>
      <Card
        title="Financial goals and deadlines"
        subtitle="Progress uses allocated money at its latest valuation. An account cannot fund several goals with the same money."
        action={renderAdd("goals")}
      >
        {!p.goals.length ? (
          <Empty>
            Add a target and deadline, then allocate money from your accounts.
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {p.goals.map((g) => {
              const progress = goalProgress(p, g, today);
              return (
                <div
                  key={g.id}
                  className="min-w-0 rounded-xl border border-[#EAE2D6] p-4"
                >
                  <div className="flex justify-between gap-2">
                    <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                      {g.name}
                    </h3>
                    {renderAction("goals", g)}
                  </div>
                  <p className="mt-3 text-xl font-bold">
                    {money(progress.progress)} / {money(g.target)}
                  </p>
                  <progress
                    aria-label={`Progress for ${g.name}`}
                    className="mt-3 h-3 w-full accent-[#D95D39]"
                    value={Math.min(progress.progress, g.target)}
                    max={g.target}
                  />
                  <p className="mt-3 text-sm">
                    Deadline {g.deadline} ·{" "}
                    {progress.overdue
                      ? "Overdue"
                      : progress.onTrack
                        ? "On track"
                        : "Needs more saving"}
                  </p>
                  <p className="mt-2 text-sm text-[#62584E]">
                    Monthly amount needed:{" "}
                    {progress.required === null
                      ? "Deadline passed"
                      : money(progress.required)}
                    . Planned: {money(g.monthlyContribution)}.
                  </p>
                  <p className="mt-1 text-sm text-[#62584E]">
                    Projected completion:{" "}
                    {progress.completion || "Add a monthly contribution"}.
                  </p>
                  <button
                    type="button"
                    className={`${secondaryClass} mt-4`}
                    onClick={() =>
                      onOpen("allocations", undefined, { goalId: g.id })
                    }
                  >
                    <Target className="h-4 w-4" />
                    Allocate funds
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card
        title="Goal allocations"
        subtitle="If an account’s value falls below its allocations, progress is reduced proportionally until you rebalance."
      >
        {overAllocated && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            Some account allocations exceed their latest value. Rebalance
            allocations; the same money is not counted twice.
          </p>
        )}
        {!p.allocations.length ? (
          <Empty>No funds allocated yet.</Empty>
        ) : (
          <div className="space-y-3">
            {p.allocations.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EFE8DC] p-3"
              >
                <p className="break-words text-sm">
                  {accountNameById.get(a.accountId)} →{" "}
                  {goalNameById.get(a.goalId)} · {money(a.amount)}
                </p>
                {renderAction("allocations", a)}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
