import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { Delete, primaryClass, type Update } from "../workspace/ui";
import { localDate, uid, type Workspace } from "../workspace/model";
import { emptyPlanning, summarizeCycle, type FinanceCycle } from "./planning";
import {
  cycleReconciliation,
  emptyPortfolio,
  investmentPerformance,
  isFinancePortfolio,
  latestSnapshot,
  portfolioCycleError,
  portfolioTotals,
  roundMoney,
  syncPortfolioBalances,
  syncPortfolioCommitments,
  type FinancePortfolio,
  type Phase,
} from "./portfolio-model";
import {
  defaultPortfolioDraft,
  ENTITY_NAMES,
  NUM_KEYS,
  type PortfolioDraft,
  type PortfolioEntity,
} from "./portfolio/fields";
import { PortfolioOverviewTab } from "./portfolio/PortfolioOverviewTab";
import { PortfolioAccountsTab } from "./portfolio/PortfolioAccountsTab";
import { PortfolioLoansTab } from "./portfolio/PortfolioLoansTab";
import {
  PortfolioGoalsTab,
  PortfolioSubscriptionsTab,
} from "./portfolio/PortfolioSubsGoalsTab";
import { PortfolioSimulatorTab } from "./portfolio/PortfolioSimulatorTab";
import { PortfolioEditorDialog } from "./portfolio/PortfolioEditorDialog";

export function Portfolio({
  data,
  update,
  cycle,
  storageReady,
  initialSection = "overview",
  migrationReady = false,
  cycleDisclosure,
}: {
  data: Workspace;
  update: Update;
  cycle: FinanceCycle | undefined;
  storageReady: boolean;
  initialSection?: string;
  migrationReady?: boolean;
  cycleDisclosure?: ReactNode;
}) {
  const p = useMemo(
    () => data.financePortfolio ?? emptyPortfolio(),
    [data.financePortfolio],
  );
  const plan = useMemo(
    () => data.financePlanning ?? emptyPlanning(),
    [data.financePlanning],
  );
  const expenses = useMemo(
    () => data.financeExpenses ?? [],
    [data.financeExpenses],
  );
  const today = localDate();

  const [tab, setTab] = useState(initialSection);
  const [editor, setEditor] = useState<{
    entity: PortfolioEntity;
    draft: PortfolioDraft;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importPhase, setImportPhase] = useState<Phase>("current");

  const totals = useMemo(() => portfolioTotals(p), [p]);
  const summary = useMemo(
    () => (cycle ? summarizeCycle(plan, expenses, cycle) : null),
    [plan, expenses, cycle],
  );
  const recon = useMemo(
    () =>
      cycle && summary ? cycleReconciliation(p, cycle, summary.surplus) : null,
    [p, cycle, summary],
  );
  const sortedSnapshots = useMemo(
    () => [...p.snapshots].sort((a, b) => b.date.localeCompare(a.date)),
    [p.snapshots],
  );
  const perfRows = useMemo(
    () => (cycle ? investmentPerformance(p, cycle) : []),
    [p, cycle],
  );

  function open(
    entity: PortfolioEntity,
    existing?: object,
    seed: PortfolioDraft = {},
  ) {
    setError("");
    setEditor({
      entity,
      draft: { ...defaultPortfolioDraft(entity, p, today), ...existing, ...seed },
    });
  }

  function changeDraft(key: string, value: string | boolean) {
    if (!editor) return;
    const d = { ...editor.draft, [key]: value };
    if (editor.entity === "accounts" && key === "kind")
      d.liquid = ["bank", "cash", "wallet"].includes(String(value));
    if (key === "phase") {
      d.cycleId = value === "current" ? "" : (cycle?.id ?? "");
    }
    if (key === "phase" && cycle) {
      d.date =
        value === "opening"
          ? cycle.start
          : value === "closing"
            ? cycle.end
            : today;
    }
    setEditor({ ...editor, draft: d });
    setError("");
  }

  function commit(next: FinancePortfolio) {
    if (!isFinancePortfolio(next))
      throw new Error(
        "Check required fields, unique records, account references, dates and amounts. Only masked bank references and safe password-manager links are accepted.",
      );
    const message = portfolioCycleError(
      next,
      cycle && !plan.cycles.some((c) => c.id === cycle.id)
        ? [...plan.cycles, cycle]
        : plan.cycles,
      today,
    );
    if (message) throw new Error(message);
    update((s) => {
      const basePlan = s.financePlanning ?? emptyPlanning();
      let synced = basePlan.cycles.reduce(
        (planning, c) => syncPortfolioBalances(planning, next, c.id),
        basePlan,
      );
      synced = synced.cycles.reduce(
        (planning, c) => syncPortfolioCommitments(planning, next, c, today),
        synced,
      );
      return {
        ...s,
        financePortfolio: next,
        financePlanning: synced,
      };
    });
  }

  function save() {
    if (!editor) return;
    const { entity } = editor;
    const d = { ...editor.draft };
    const originalId = String(d.id ?? "");
    for (const key of NUM_KEYS) if (key in d) d[key] = Number(d[key]);
    if (
      (entity === "snapshots" || entity === "debtSnapshots") &&
      d.phase === "current"
    )
      d.cycleId = "";
    if (entity === "flows") {
      d.cycleId = "";
      if (d.kind === "contribution") d.fromId = "";
      if (d.kind === "withdrawal" || d.kind === "fee") d.toId = "";
      if (d.kind === "transfer") d.budgetIncluded = false;
    }
    if (entity === "snapshots") {
      const a = p.accounts.find((a) => a.id === d.accountId);
      if (a?.kind === "gold" && Number(d.units) > 0 && Number(d.price) > 0)
        d.value = roundMoney(Number(d.units) * Number(d.price));
      d.updatedAt = new Date().toISOString();
      const old = p.snapshots.find(
        (s) =>
          s.accountId === d.accountId &&
          s.cycleId === d.cycleId &&
          s.phase === d.phase &&
          (d.phase !== "current" || s.date === d.date),
      );
      if (old) d.id = old.id;
    }
    if (entity === "debtSnapshots") {
      d.updatedAt = new Date().toISOString();
      const old = p.debtSnapshots.find(
        (s) =>
          s.loanId === d.loanId &&
          s.cycleId === d.cycleId &&
          s.phase === d.phase &&
          (d.phase !== "current" || s.date === d.date),
      );
      if (old) d.id = old.id;
    }
    if (entity === "allocations") {
      const old = p.allocations.find(
        (a) => a.goalId === d.goalId && a.accountId === d.accountId,
      );
      if (old) d.id = old.id;
      const available = latestSnapshot(p, String(d.accountId))?.value ?? 0;
      const assigned = p.allocations
        .filter(
          (a) =>
            a.accountId === d.accountId &&
            a.id !== d.id &&
            a.id !== originalId,
        )
        .reduce((sum, a) => sum + a.amount, 0);
      if (Number(d.amount) + assigned > available + 0.001) {
        setError(
          "Allocations exceed this account’s latest value. Record a balance or reduce another allocation.",
        );
        return;
      }
    }
    const next = {
      ...p,
      [entity]: [
        ...p[entity].filter((r) => r.id !== d.id && r.id !== originalId),
        d,
      ],
    } as FinancePortfolio;
    try {
      commit(next);
      setEditor(null);
      setNotice(`Saved ${ENTITY_NAMES[entity]}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }

  function remove(entity: PortfolioEntity, id: string) {
    if (!confirm(`Delete this ${ENTITY_NAMES[entity]}?`)) return;
    const next = {
      ...p,
      [entity]: p[entity].filter((r) => r.id !== id),
    } as FinancePortfolio;
    if (
      entity === "accounts" &&
      (p.snapshots.some((s) => s.accountId === id) ||
        p.flows.some((f) => f.fromId === id || f.toId === id) ||
        p.allocations.some((a) => a.accountId === id) ||
        p.subscriptions.some((s) => s.accountId === id))
    ) {
      setNotice(
        "This account has balances, movements or links. Remove those records first.",
      );
      return;
    }
    if (entity === "loans" && p.debtSnapshots.some((s) => s.loanId === id)) {
      setNotice("Remove this loan’s balance snapshots first.");
      return;
    }
    if (entity === "goals")
      next.allocations = p.allocations.filter((a) => a.goalId !== id);
    try {
      commit(next);
      setNotice("Record removed.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not remove record.");
    }
  }

  function carry() {
    if (!cycle) return;
    const next = { ...p, snapshots: [...p.snapshots] };
    for (const a of p.accounts) {
      if (latestSnapshot(p, a.id, cycle.id, "opening")) continue;
      const prior = p.snapshots
        .filter(
          (s) =>
            s.accountId === a.id &&
            s.phase === "closing" &&
            s.date < cycle.start,
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (prior)
        next.snapshots.push({
          ...prior,
          id: uid(),
          cycleId: cycle.id,
          phase: "opening",
          date: cycle.start,
          updatedAt: new Date().toISOString(),
        });
    }
    try {
      commit(next);
      setNotice(
        "Available previous closing balances copied to opening. Existing openings were kept.",
      );
    } catch (e) {
      setNotice(String(e));
    }
  }

  function importBalances() {
    if (!cycle) return;
    const candidates = plan.rows.filter(
      (r) =>
        r.cycleId === cycle.id &&
        r.kind === "balance" &&
        !r.id.startsWith("portfolio:"),
    );
    if (new Set(candidates.map((r) => r.name)).size !== candidates.length) {
      setNotice("Rename duplicate monthly account labels before linking them.");
      return;
    }
    if (
      candidates.some((r) =>
        p.accounts.some((a) => a.name === r.name && a.planName !== r.name),
      )
    ) {
      setNotice(
        "An account with this name already exists. Edit it and link its monthly balance before importing.",
      );
      return;
    }
    const next = {
      ...p,
      accounts: [...p.accounts],
      snapshots: [...p.snapshots],
    };
    const date =
      importPhase === "opening"
        ? cycle.start
        : importPhase === "closing"
          ? cycle.end
          : today < cycle.start
            ? cycle.start
            : today > cycle.end
              ? cycle.end
              : today;
    for (const r of candidates) {
      let a = next.accounts.find((x) => x.planName === r.name);
      if (!a) {
        a = {
          id: uid(),
          name: r.name,
          kind: r.liquid ? "bank" : "other",
          liquid: r.liquid,
          maskedRef: "",
          vaultUrl: "",
          costBasis: 0,
          planName: r.name,
          trackingFrom: cycle.start,
        };
        next.accounts.push(a);
      }
      if (
        !next.snapshots.some(
          (s) =>
            s.accountId === a!.id &&
            s.cycleId === cycle.id &&
            s.phase === importPhase,
        )
      )
        next.snapshots.push({
          id: uid(),
          accountId: a.id,
          cycleId: cycle.id,
          phase: importPhase,
          date,
          value: r.amount,
          units: 0,
          price: 0,
          updatedAt: new Date().toISOString(),
        });
    }
    try {
      commit(next);
      setNotice(
        "Monthly balance rows linked. Future portfolio updates refresh their monthly rows.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Import failed.");
    }
  }

  const renderAction = (
    entity: PortfolioEntity,
    row: { id: string; name?: string },
  ) => (
    <div className="flex shrink-0 justify-end">
      <button
        type="button"
        aria-label={`Edit ${row.name ?? ENTITY_NAMES[entity]}`}
        className="flex h-11 w-11 items-center justify-center text-[#8C8073] hover:text-[#C04C2B]"
        onClick={() => open(entity, row)}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <Delete
        label={`Delete ${row.name ?? ENTITY_NAMES[entity]}`}
        onClick={() => remove(entity, row.id)}
      />
    </div>
  );

  const renderAdd = (entity: PortfolioEntity) => (
    <button
      type="button"
      className={primaryClass}
      onClick={() => open(entity)}
    >
      <Plus className="h-4 w-4" />
      Add {ENTITY_NAMES[entity]}
    </button>
  );

  return (
    <div className="min-w-0 space-y-4 break-words [contain:paint]">
      <div
        data-horizontal-scroll
        className="-mx-3.5 overflow-x-auto px-3.5 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          role="tablist"
          aria-label="Portfolio sections"
          className="inline-flex min-w-full items-center gap-1.5 sm:min-w-0"
        >
          {[
            "overview",
            "accounts",
            "loans",
            "subscriptions",
            "goals",
            "simulator",
          ].map((id) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === id}
              key={id}
              onClick={() => {
                setTab(id);
                setNotice("");
              }}
              className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors duration-150 sm:text-[13px] ${
                tab === id
                  ? "bg-[#24201D] text-white shadow-xs"
                  : "border border-[#E7DDD0] bg-white text-[#5C5248] hover:border-[#CFC1AE] hover:text-[#24201D]"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
      {!storageReady && (
        <p
          role="status"
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-900"
        >
          Portfolio changes save on this device. Update the planner connection
          to sync the new tables.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-[#EAE2D6] bg-white px-3.5 py-2.5 text-xs font-medium text-[#5C5248]"
        >
          {notice}
        </p>
      )}
      {tab === "overview" && (
        <PortfolioOverviewTab
          p={p}
          cycle={cycle}
          totals={totals}
          summary={summary}
          recon={recon}
        />
      )}
      {tab === "accounts" && (
        <PortfolioAccountsTab
          data={data}
          update={update}
          p={p}
          cycle={cycle}
          migrationReady={migrationReady}
          sortedSnapshots={sortedSnapshots}
          perfRows={perfRows}
          importPhase={importPhase}
          onImportPhaseChange={setImportPhase}
          onCarry={carry}
          onImportBalances={importBalances}
          onOpen={open}
          renderAction={renderAction}
          renderAdd={renderAdd}
        />
      )}
      {tab === "loans" && (
        <PortfolioLoansTab
          p={p}
          cycle={cycle}
          today={today}
          update={update}
          onNotice={setNotice}
          onOpen={open}
          renderAction={renderAction}
          renderAdd={renderAdd}
        />
      )}
      {tab === "subscriptions" && (
        <PortfolioSubscriptionsTab
          p={p}
          cycle={cycle}
          today={today}
          update={update}
          onNotice={setNotice}
          renderAction={renderAction}
          renderAdd={renderAdd}
        />
      )}
      {tab === "goals" && (
        <PortfolioGoalsTab
          p={p}
          today={today}
          onOpen={open}
          renderAction={renderAction}
          renderAdd={renderAdd}
        />
      )}
      {tab === "simulator" && (
        <PortfolioSimulatorTab
          p={p}
          plan={plan}
          expenses={expenses}
          cycle={cycle}
          today={today}
        />
      )}
      {cycleDisclosure}
      {editor && (
        <PortfolioEditorDialog
          editor={editor}
          p={p}
          plan={plan}
          cycle={cycle}
          error={error}
          onChangeDraft={changeDraft}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
