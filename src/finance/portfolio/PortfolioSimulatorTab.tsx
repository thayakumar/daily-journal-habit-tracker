import { useMemo, useState } from "react";
import { Card, Field, inputClass, parseNumberInput } from "../../workspace/ui";
import type { FinanceExpense } from "../../workspace/model";
import {
  money,
  summarizeCycle,
  type FinanceCycle,
  type FinancePlanning,
} from "../planning";
import {
  addMonths,
  goalProgress,
  goalScenarioProgress,
  latestSnapshot,
  purchaseSimulation,
  syncPortfolioCommitments,
  type FinancePortfolio,
} from "../portfolio-model";

export function PortfolioSimulatorTab({
  p,
  plan,
  expenses,
  cycle,
  today,
}: {
  p: FinancePortfolio;
  plan: FinancePlanning;
  expenses: FinanceExpense[];
  cycle: FinanceCycle | undefined;
  today: string;
}) {
  const [sim, setSim] = useState({
    method: "cash",
    amount: 1000,
    deposit: 0,
    apr: 5,
    months: 12,
    rateType: "reducing",
    reserve: 3000,
    accountId: "",
    goalId: "",
  });

  const { simAccount, validSim, scenario, simGoal, baselineGoal, changedGoal } =
    useMemo(() => {
      const sa =
        p.accounts.find((a) => a.id === sim.accountId && a.liquid) ||
        p.accounts.find((a) => a.liquid);
      const cash = sa ? (latestSnapshot(p, sa.id)?.value ?? 0) : 0;
      const simulationSummary = cycle
        ? summarizeCycle(
            syncPortfolioCommitments(plan, p, cycle, today),
            expenses,
            cycle,
          )
        : null;
      const headroom = simulationSummary
        ? Math.min(simulationSummary.expected, simulationSummary.surplus)
        : 0;
      const valid =
        Number.isFinite(sim.amount) &&
        sim.amount >= 0 &&
        Number.isFinite(sim.reserve) &&
        sim.reserve >= 0 &&
        (sim.method === "cash" ||
          (sim.deposit >= 0 &&
            sim.deposit <= sim.amount &&
            sim.apr >= 0 &&
            sim.apr <= 1000 &&
            sim.months >= 1 &&
            sim.months <= 600 &&
            Number.isInteger(sim.months)));
      const sc = valid
        ? purchaseSimulation(
            sim.amount,
            sim.method === "cash" ? sim.amount : sim.deposit,
            sim.method === "cash" ? 0 : sim.apr,
            sim.method === "cash" ? 1 : sim.months,
            sim.rateType as "flat" | "reducing",
            cash,
            headroom,
            sim.reserve,
          )
        : null;
      const sg = p.goals.find((g) => g.id === sim.goalId);
      const bg = sg ? goalProgress(p, sg, today) : null;
      const cg =
        sg && sc && sa
          ? goalScenarioProgress(
              p,
              sg,
              today,
              { accountId: sa.id, value: sc.cashAfter },
              sc.payment,
              sim.method === "loan" ? sim.months : 0,
            )
          : null;
      return {
        simAccount: sa,
        validSim: valid,
        scenario: sc,
        simGoal: sg,
        baselineGoal: bg,
        changedGoal: cg,
      };
    }, [p, plan, expenses, cycle, today, sim]);

  return (
    <Card
      title="Purchase and loan simulator"
      subtitle="A what-if comparison only. Nothing here changes your balances, loans or monthly records."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Payment method">
          <select
            aria-label="Simulation method"
            className={inputClass}
            value={sim.method}
            onChange={(e) => setSim({ ...sim, method: e.target.value })}
          >
            <option value="cash">Pay cash</option>
            <option value="loan">Take a loan</option>
          </select>
        </Field>
        <Field label="Purchase price (RM)">
          <input
            aria-label="Simulation price"
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={sim.amount}
            onChange={(e) =>
              setSim({ ...sim, amount: parseNumberInput(e.target.value, 0) })
            }
          />
        </Field>
        <Field label="Funding account">
          <select
            aria-label="Simulation funding account"
            className={inputClass}
            value={simAccount?.id ?? ""}
            onChange={(e) => setSim({ ...sim, accountId: e.target.value })}
          >
            {p.accounts
              .filter((a) => a.liquid)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Emergency reserve floor (RM)">
          <input
            aria-label="Simulation reserve"
            type="number"
            min="0"
            className={inputClass}
            value={sim.reserve}
            onChange={(e) =>
              setSim({ ...sim, reserve: parseNumberInput(e.target.value, 0) })
            }
          />
        </Field>
        {sim.method === "loan" && (
          <>
            <Field label="Deposit (RM)">
              <input
                aria-label="Simulation deposit"
                type="number"
                min="0"
                max={sim.amount}
                step="0.01"
                className={inputClass}
                value={sim.deposit}
                onChange={(e) =>
                  setSim({
                    ...sim,
                    deposit: parseNumberInput(e.target.value, 0),
                  })
                }
              />
            </Field>
            <Field label="Annual interest (%)">
              <input
                aria-label="Simulation interest"
                type="number"
                min="0"
                max="1000"
                step="0.01"
                className={inputClass}
                value={sim.apr}
                onChange={(e) =>
                  setSim({ ...sim, apr: parseNumberInput(e.target.value, 0) })
                }
              />
            </Field>
            <Field label="Term (months)">
              <input
                aria-label="Simulation term"
                type="number"
                min="1"
                max="600"
                className={inputClass}
                value={sim.months}
                onChange={(e) =>
                  setSim({
                    ...sim,
                    months: parseNumberInput(e.target.value, 1),
                  })
                }
              />
            </Field>
            <Field label="Interest method">
              <select
                aria-label="Simulation interest method"
                className={inputClass}
                value={sim.rateType}
                onChange={(e) => setSim({ ...sim, rateType: e.target.value })}
              >
                <option value="reducing">Reducing balance</option>
                <option value="flat">Flat interest</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Goal to compare">
          <select
            aria-label="Simulation goal"
            className={inputClass}
            value={sim.goalId}
            onChange={(e) => setSim({ ...sim, goalId: e.target.value })}
          >
            <option value="">No goal selected</option>
            {p.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!validSim ? (
        <p role="alert" className="mt-4 text-sm text-[#D95D39]">
          Check the price, deposit, interest and term.
        </p>
      ) : !simAccount || !latestSnapshot(p, simAccount.id) ? (
        <p className="mt-4 text-sm text-amber-700">
          Add and value a liquid account to compare available money.
        </p>
      ) : (
        scenario && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                ["Cash after purchase / deposit", scenario.cashAfter],
                ["Monthly instalment", scenario.payment],
                ["Total interest", scenario.interest],
                ["Total paid including deposit", scenario.total],
                ["Monthly headroom after payment", scenario.headroomAfter],
                ["Reserve shortfall", scenario.reserveGap],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] p-3 sm:p-4"
                >
                  <p className="text-[11px] font-semibold text-[#6E6358] sm:text-xs">
                    {label}
                  </p>
                  <p className="mt-1 break-words font-display text-base font-bold tabular-nums text-[#24201D] sm:text-xl">
                    {money(Number(value))}
                  </p>
                </div>
              ))}
            </div>
            {sim.method === "loan" && scenario.principal > 0 && (
              <p className="mt-4 text-sm text-[#62584E]">
                Estimated final payment: {addMonths(today, sim.months)} (first
                payment assumed next month).
              </p>
            )}
            {(scenario.cashAfter < 0 ||
              scenario.reserveGap > 0 ||
              scenario.headroomAfter < 0) && (
              <p
                role="status"
                className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
              >
                This scenario exceeds the funding balance, reserve floor or
                recorded monthly headroom. Adjust the assumptions before
                committing.
              </p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-[#62584E]">
              Headroom uses the lower of planned savings and logged surplus,
              including scheduled Portfolio commitments in the selected cycle.
              Sync commitments to show these in Monthly Budget. Estimates assume
              constant rates and spending, and exclude lender fees. This
              compares your inputs rather than approving a loan.
            </p>
            {simGoal && baselineGoal && changedGoal && (
              <p className="mt-4 rounded-xl bg-[#EDF2F8] p-4 text-sm text-[#355380]">
                {simGoal.name}: estimated completion{" "}
                {baselineGoal.completion || "unknown"} →{" "}
                {changedGoal.completion || "not funded at this rate"}. Assumes
                the purchase uses this account. Goal contributions return to
                their original amount after the loan term.
              </p>
            )}
          </>
        )
      )}
    </Card>
  );
}
