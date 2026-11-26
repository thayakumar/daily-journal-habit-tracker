import { useMemo, type ReactNode } from "react";
import { ArrowRightLeft } from "lucide-react";
import {
  Card,
  Empty,
  inputClass,
  secondaryClass,
  type Update,
} from "../../workspace/ui";
import type { Workspace } from "../../workspace/model";
import { money, type FinanceCycle } from "../planning";
import {
  latestSnapshot,
  type FinancePortfolio,
  type investmentPerformance,
  type Phase,
} from "../portfolio-model";
import { LegacyImport } from "../components/LegacyImport";
import {
  PHASES,
  PORTFOLIO_TABLE_CLASS,
  type PortfolioDraft,
  type PortfolioEntity,
} from "./fields";

export function PortfolioAccountsTab({
  data,
  update,
  p,
  cycle,
  migrationReady,
  sortedSnapshots,
  perfRows,
  importPhase,
  onImportPhaseChange,
  onCarry,
  onImportBalances,
  onOpen,
  renderAction,
  renderAdd,
}: {
  data: Workspace;
  update: Update;
  p: FinancePortfolio;
  cycle: FinanceCycle | undefined;
  migrationReady: boolean;
  sortedSnapshots: FinancePortfolio["snapshots"];
  perfRows: ReturnType<typeof investmentPerformance>;
  importPhase: Phase;
  onImportPhaseChange: (phase: Phase) => void;
  onCarry: () => void;
  onImportBalances: () => void;
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

  return (
    <>
      <Card
        title="Accounts and holdings"
        subtitle="MYR valuations only. Store masked references and password-manager links; no banking passwords, PINs or OTPs."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LegacyImport
              compact
              data={data}
              update={update}
              ready={migrationReady}
            />
            {renderAdd("accounts")}
          </div>
        }
      >
        {!p.accounts.length ? (
          <Empty>
            Add banks, cash, wallets, gold and investments once, then reuse them
            each cycle.
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {p.accounts.map((a) => {
              const latest = latestSnapshot(p, a.id);
              return (
                <div
                  key={a.id}
                  className="min-w-0 rounded-xl border border-[#EAE2D6] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                        {a.name}
                      </h3>
                      <p className="mt-1 text-xs capitalize text-[#8C8073]">
                        {a.kind}
                        {a.maskedRef ? ` · •••• ${a.maskedRef}` : ""}
                      </p>
                    </div>
                    {renderAction("accounts", a)}
                  </div>
                  <p className="mt-3 text-2xl font-bold">
                    {latest ? money(latest.value) : "No valuation"}
                  </p>
                  <p className="mt-1 text-xs text-[#8C8073]">
                    {latest
                      ? `As of ${latest.date} · ${latest.phase}`
                      : "No date recorded"}
                  </p>
                  {a.costBasis > 0 && latest && (
                    <p className="mt-2 text-sm text-[#62584E]">
                      Value vs recorded cost:{" "}
                      {money(latest.value - a.costBasis)}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={false}
                      className={secondaryClass}
                      onClick={() =>
                        onOpen("snapshots", undefined, { accountId: a.id })
                      }
                    >
                      Record balance
                    </button>
                    {a.vaultUrl && (
                      <a
                        href={a.vaultUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={secondaryClass}
                      >
                        Open password manager
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card
        title="Balance history · all dates"
        subtitle="Closing balances can be recorded after the cycle ends. Gold values use grams × value per gram."
        action={
          <button
            type="button"
            disabled={!p.accounts.length}
            className={secondaryClass}
            onClick={() => onOpen("snapshots")}
          >
            Record account balance
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!cycle}
            className={secondaryClass}
            onClick={onCarry}
          >
            Use previous closing as opening
          </button>
          <select
            aria-label="Import balance phase"
            className={`${inputClass} max-w-48`}
            value={importPhase}
            onChange={(e) => onImportPhaseChange(e.target.value as Phase)}
          >
            {PHASES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!cycle}
            className={secondaryClass}
            onClick={onImportBalances}
          >
            Link monthly balances
          </button>
        </div>
        <p className="mb-4 text-xs text-[#62584E]">
          Linking imports existing Monthly Budget balance rows using the phase
          you choose. Other monthly rows stay unchanged. Record the correct
          phase before importing historical balances.
        </p>
        {!p.snapshots.length ? (
          <Empty>No account balances recorded yet.</Empty>
        ) : (
          <div data-horizontal-scroll className="max-w-full overflow-x-auto">
            <table
              aria-label="Portfolio balances"
              className={PORTFOLIO_TABLE_CLASS}
            >
              <thead>
                <tr className="text-left text-xs text-[#8C8073]">
                  <th>Account</th>
                  <th>Phase</th>
                  <th>Date</th>
                  <th className="text-right">Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedSnapshots.map((s) => (
                  <tr className="border-t border-[#EFE8DC]" key={s.id}>
                    <td className="max-w-48 break-words py-3 pr-3">
                      {accountNameById.get(s.accountId)}
                    </td>
                    <td className="capitalize">{s.phase}</td>
                    <td>{s.date}</td>
                    <td className="text-right">{money(s.value)}</td>
                    <td>{renderAction("snapshots", s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card
        title="Investment and gold performance"
        subtitle="Opening-to-closing result after adjusting for money added and withdrawn. Fees remain part of the result."
      >
        {!cycle || !perfRows.length ? (
          <Empty>
            Add an investment or physical-gold account to track its result.
          </Empty>
        ) : (
          <div data-horizontal-scroll className="max-w-full overflow-x-auto">
            <table
              aria-label="Investment performance"
              className={PORTFOLIO_TABLE_CLASS}
            >
              <thead>
                <tr className="text-left text-xs text-[#8C8073]">
                  <th>Account</th>
                  <th>Opening</th>
                  <th>Closing</th>
                  <th>Net deposits</th>
                  <th>Gain / loss</th>
                </tr>
              </thead>
              <tbody>
                {perfRows.map((r) => (
                  <tr key={r.account.id} className="border-t border-[#EFE8DC]">
                    <th className="max-w-44 break-words py-3 pr-3 text-left font-medium">
                      {r.account.name}
                    </th>
                    <td>
                      {r.opening === null ? "Not recorded" : money(r.opening)}
                    </td>
                    <td>
                      {r.closing === null ? "Not recorded" : money(r.closing)}
                    </td>
                    <td>{money(r.netDeposits)}</td>
                    <td
                      className={
                        r.result !== null && r.result < 0
                          ? "text-[#D95D39]"
                          : "text-emerald-700"
                      }
                    >
                      {r.result === null
                        ? "Closing incomplete"
                        : money(r.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card
        title="Transfers, contributions and fees"
        subtitle="Record movements separately from spending so investment deposits are not treated as gains."
        action={
          <button
            type="button"
            disabled={!p.accounts.length}
            className={secondaryClass}
            onClick={() => onOpen("flows")}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Add movement
          </button>
        }
      >
        {!p.flows.length ? (
          <Empty>No money movements recorded yet.</Empty>
        ) : (
          <div className="space-y-3">
            {p.flows.map((f) => (
              <div
                key={f.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EFE8DC] p-3"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {accountNameById.get(f.fromId) ?? "Outside portfolio"} →{" "}
                    {accountNameById.get(f.toId) ?? "Outside portfolio"}
                  </p>
                  <p className="mt-1 text-xs text-[#8C8073]">
                    {f.date} · {f.kind} · {money(f.amount)}
                    {f.budgetIncluded ? " · already in budget" : ""}
                  </p>
                </div>
                {renderAction("flows", f)}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
