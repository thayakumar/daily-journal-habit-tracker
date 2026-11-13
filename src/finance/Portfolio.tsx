import { useState } from "react";
import {
  Plus,
  Pencil,
  ArrowRightLeft,
  Landmark,
  Wallet,
  Gem,
  TrendingUp,
  CreditCard,
  Target,
} from "lucide-react";
import {
  Card,
  Empty,
  Field,
  Delete,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "../workspace/ui";
import { Dialog } from "../workspace/Dialog";
import { localDate, uid, type Workspace } from "../workspace/model";
import {
  emptyPlanning,
  money,
  summarizeCycle,
  type FinanceCycle,
} from "./planning";
import {
  emptyPortfolio,
  isFinancePortfolio,
  portfolioCycleError,
  portfolioTotals,
  latestSnapshot,
  loanCurrentBalance,
  investmentPerformance,
  loanForecast,
  subscriptionMonthly,
  goalProgress,
  goalScenarioProgress,
  addMonths,
  cycleReconciliation,
  syncPortfolioBalances,
  syncPortfolioCommitments,
  purchaseSimulation,
  roundMoney,
  type FinancePortfolio,
  type Phase,
} from "./portfolio-model";
type Entity = keyof FinancePortfolio;
type Draft = Record<string, string | number | boolean>;
type InputField = {
  key: string;
  label: string;
  type?: "number" | "date" | "checkbox" | "url";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: string;
  optional?: boolean;
  hint?: string;
};
const NAMES: Record<Entity, string> = {
  accounts: "account",
  snapshots: "account balance",
  flows: "money movement",
  loans: "loan",
  debtSnapshots: "loan balance",
  subscriptions: "subscription",
  goals: "goal",
  allocations: "goal allocation",
};
const PHASES = [
  { value: "opening", label: "Opening balance" },
  { value: "current", label: "Current balance" },
  { value: "closing", label: "Closing balance" },
];
const KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
  { value: "gold", label: "Physical gold" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other asset" },
];
const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "weekly", label: "Weekly" },
];
const numKeys = [
  "costBasis",
  "value",
  "units",
  "price",
  "amount",
  "principal",
  "balance",
  "apr",
  "payment",
  "target",
  "monthlyContribution",
];
const TABLE = "w-full min-w-[600px] text-sm";
export function Portfolio({
  data,
  update,
  cycle,
  storageReady,
  initialSection = "overview",
}: {
  data: Workspace;
  update: Update;
  cycle: FinanceCycle | undefined;
  storageReady: boolean;
  initialSection?: string;
}) {
  const p = data.financePortfolio ?? emptyPortfolio(),
    plan = data.financePlanning ?? emptyPlanning(),
    today = localDate();
  const [tab, setTab] = useState(initialSection),
    [editor, setEditor] = useState<{ entity: Entity; draft: Draft } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [importPhase, setImportPhase] = useState<Phase>("current");
  const [extra, setExtra] = useState(0);
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
  const totals = portfolioTotals(p),
    summary = cycle
      ? summarizeCycle(plan, data.financeExpenses ?? [], cycle)
      : null,
    recon =
      cycle && summary ? cycleReconciliation(p, cycle, summary.surplus) : null;
  const accounts = p.accounts.map((a) => ({ value: a.id, label: a.name })),
    loans = p.loans.map((l) => ({ value: l.id, label: l.name }));
  const emptyOption = { value: "", label: "Select…" };
  function fields(entity: Entity, d: Draft): InputField[] {
    const basicName: InputField = { key: "name", label: "Name" };
    const amount: InputField = {
      key: "amount",
      label: "Amount (RM)",
      type: "number",
      min: 0,
      step: "0.01",
    };
    const date: InputField = { key: "date", label: "As-of date", type: "date" };
    const account: InputField = {
      key: "accountId",
      label: "Account",
      options: [emptyOption, ...accounts],
    };
    const phase: InputField = {
      key: "phase",
      label: "Balance phase",
      options: PHASES,
    };
    if (entity === "accounts")
      return [
        basicName,
        {
          key: "trackingFrom",
          label: "Track this account from",
          type: "date",
          hint: "New accounts are excluded from earlier cycles unless you add historical balances.",
        },
        { key: "kind", label: "Account type", options: KINDS },
        { key: "liquid", label: "Available as liquid funds", type: "checkbox" },
        {
          key: "maskedRef",
          label: "Account reference · last 4 digits only",
          optional: true,
          hint: "Store the last four digits, not a full account number or banking password.",
        },
        {
          key: "vaultUrl",
          label: "Password manager item link (HTTPS)",
          type: "url",
          optional: true,
          hint: "A reference to your password manager only. Never paste a password, PIN, OTP or access token.",
        },
        {
          key: "costBasis",
          label: "Recorded purchase cost (RM)",
          type: "number",
          min: 0,
          step: "0.01",
          hint: "Optional reference for gold/investments. Set 0 if not tracked.",
        },
        {
          key: "planName",
          label: "Link an existing monthly balance",
          optional: true,
          options: [
            { value: "", label: "No existing row to replace" },
            ...plan.rows
              .filter(
                (r) =>
                  r.cycleId === cycle?.id &&
                  r.kind === "balance" &&
                  !r.id.startsWith("portfolio:"),
              )
              .map((r) => ({ value: r.name, label: r.name })),
          ],
        },
      ];
    if (entity === "snapshots")
      return [
        account,
        phase,
        date,
        ...(p.accounts.find((a) => a.id === d.accountId)?.kind === "gold"
          ? [
              {
                key: "units",
                label: "Gold quantity (grams)",
                type: "number" as const,
                min: 0,
                step: "0.001",
              },
              {
                key: "price",
                label: "Value per gram (RM)",
                type: "number" as const,
                min: 0,
                step: "0.01",
              },
            ]
          : [
              {
                key: "value",
                label: "Account value (RM)",
                type: "number" as const,
                min: 0,
                step: "0.01",
              },
            ]),
      ];
    if (entity === "flows")
      return [
        {
          key: "kind",
          label: "Movement type",
          options: [
            { value: "transfer", label: "Transfer between my accounts" },
            {
              value: "contribution",
              label: "Money entering from outside my portfolio",
            },
            { value: "withdrawal", label: "Money leaving my portfolio" },
            { value: "fee", label: "Account / investment fee" },
          ],
        },
        ...(d.kind !== "contribution"
          ? [
              {
                key: "fromId",
                label: "From account",
                options: [emptyOption, ...accounts],
              },
            ]
          : []),
        ...(d.kind === "transfer" || d.kind === "contribution"
          ? [
              {
                key: "toId",
                label: "To account",
                options: [emptyOption, ...accounts],
              },
            ]
          : []),
        date,
        { ...amount, min: 0.01 },
        {
          key: "budgetIncluded",
          label:
            "Already included in this cycle’s income, commitments or expense log",
          type: "checkbox",
          hint: "Transfers between your accounts are not expenses. Record investment purchases here so deposits do not look like returns.",
        },
      ];
    if (entity === "loans")
      return [
        basicName,
        {
          key: "balance",
          label: "Outstanding principal (RM)",
          type: "number",
          min: 0,
          step: "0.01",
        },
        {
          key: "principal",
          label: "Original principal (RM)",
          type: "number",
          min: 0,
          step: "0.01",
          hint: "Required for accurate flat-interest estimates.",
        },
        {
          key: "apr",
          label: "Annual interest rate (%)",
          type: "number",
          min: 0,
          max: 1000,
          step: "0.01",
        },
        {
          key: "rateType",
          label: "Interest method",
          options: [
            { value: "reducing", label: "Reducing balance" },
            { value: "flat", label: "Flat interest on original principal" },
          ],
        },
        {
          key: "payment",
          label: "Monthly instalment (RM)",
          type: "number",
          min: 0,
          step: "0.01",
        },
        { key: "startDate", label: "Loan start date", type: "date" },
        { key: "asOf", label: "Balance as of", type: "date" },
        { key: "nextDue", label: "Next payment due", type: "date" },
        {
          key: "planName",
          label: "Link an existing monthly commitment",
          optional: true,
          options: [
            { value: "", label: "No existing row to replace" },
            ...plan.rows
              .filter((r) => r.cycleId === cycle?.id && r.kind === "commitment")
              .map((r) => ({ value: r.name, label: r.name })),
          ],
        },
      ];
    if (entity === "debtSnapshots")
      return [
        { key: "loanId", label: "Loan", options: [emptyOption, ...loans] },
        phase,
        date,
        {
          key: "balance",
          label: "Outstanding principal (RM)",
          type: "number",
          min: 0,
          step: "0.01",
        },
      ];
    if (entity === "subscriptions")
      return [
        basicName,
        { key: "startDate", label: "Subscription start date", type: "date" },
        amount,
        { key: "frequency", label: "Billing frequency", options: FREQUENCIES },
        { key: "nextDue", label: "Next renewal date", type: "date" },
        { key: "active", label: "Subscription active", type: "checkbox" },
        {
          key: "accountId",
          label: "Payment account",
          optional: true,
          options: [{ value: "", label: "Not linked" }, ...accounts],
        },
        {
          key: "manageUrl",
          label: "Manage subscription link (HTTPS)",
          type: "url",
          optional: true,
        },
        {
          key: "planName",
          label: "Link an existing monthly commitment",
          optional: true,
          options: [
            { value: "", label: "No existing row to replace" },
            ...plan.rows
              .filter((r) => r.cycleId === cycle?.id && r.kind === "commitment")
              .map((r) => ({ value: r.name, label: r.name })),
          ],
        },
      ];
    if (entity === "goals")
      return [
        basicName,
        {
          key: "target",
          label: "Target amount (RM)",
          type: "number",
          min: 0.01,
          step: "0.01",
        },
        { key: "deadline", label: "Goal deadline", type: "date" },
        {
          key: "monthlyContribution",
          label: "Planned monthly contribution (RM)",
          type: "number",
          min: 0,
          step: "0.01",
        },
      ];
    return [
      {
        key: "goalId",
        label: "Goal",
        options: [
          emptyOption,
          ...p.goals.map((g) => ({ value: g.id, label: g.name })),
        ],
      },
      account,
      amount,
    ];
  }
  function open(entity: Entity, existing?: object, seed: Draft = {}) {
    setError("");
    const date = cycle
      ? today < cycle.start
        ? cycle.start
        : today > cycle.end
          ? cycle.end
          : today
      : today;
    const defaults: Record<Entity, Draft> = {
      accounts: {
        id: uid(),
        name: "",
        kind: "bank",
        liquid: true,
        maskedRef: "",
        vaultUrl: "",
        costBasis: 0,
        planName: "",
        trackingFrom: cycle && cycle.start <= today ? cycle.start : today,
      },
      snapshots: {
        id: uid(),
        accountId: p.accounts[0]?.id ?? "",
        cycleId: cycle?.id ?? "",
        phase: "current",
        date,
        value: 0,
        units: 0,
        price: 0,
        updatedAt: new Date().toISOString(),
      },
      flows: {
        id: uid(),
        cycleId: cycle?.id ?? "",
        date,
        kind: "transfer",
        fromId: p.accounts[0]?.id ?? "",
        toId: p.accounts[1]?.id ?? "",
        amount: 0,
        budgetIncluded: false,
      },
      loans: {
        id: uid(),
        name: "",
        principal: 0,
        balance: 0,
        apr: 0,
        payment: 0,
        rateType: "reducing",
        asOf: today,
        nextDue: today,
        planName: "",
        startDate: cycle && cycle.start <= today ? cycle.start : today,
      },
      debtSnapshots: {
        id: uid(),
        loanId: p.loans[0]?.id ?? "",
        cycleId: cycle?.id ?? "",
        phase: "current",
        date,
        balance: 0,
        updatedAt: new Date().toISOString(),
      },
      subscriptions: {
        id: uid(),
        name: "",
        amount: 0,
        frequency: "monthly",
        nextDue: today,
        active: true,
        accountId: "",
        manageUrl: "",
        planName: "",
        startDate: cycle && cycle.start <= today ? cycle.start : today,
      },
      goals: {
        id: uid(),
        name: "",
        target: 1000,
        deadline: today,
        monthlyContribution: 0,
      },
      allocations: {
        id: uid(),
        goalId: p.goals[0]?.id ?? "",
        accountId: p.accounts[0]?.id ?? "",
        amount: 0,
      },
    };
    setEditor({ entity, draft: { ...defaults[entity], ...existing, ...seed } });
  }
  function changeDraft(key: string, value: string | boolean) {
    if (!editor) return;
    const d = { ...editor.draft, [key]: value };
    if (editor.entity === "accounts" && key === "kind")
      d.liquid = ["bank", "cash", "wallet"].includes(String(value));
    if (key === "phase" && cycle) {
      d.date =
        value === "opening"
          ? cycle.start
          : value === "closing"
            ? cycle.end
            : today < cycle.start
              ? cycle.start
              : today > cycle.end
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
    const message = portfolioCycleError(next, plan.cycles, today);
    if (message) throw new Error(message);
    update((s) => ({
      ...s,
      financePortfolio: next,
      financePlanning: cycle
        ? syncPortfolioBalances(
            s.financePlanning ?? emptyPlanning(),
            next,
            cycle.id,
          )
        : s.financePlanning,
    }));
  }
  function save() {
    if (!editor) return;
    const { entity } = editor;
    const d = { ...editor.draft };
    for (const key of numKeys) if (key in d) d[key] = Number(d[key]);
    if (entity === "flows") {
      if (d.kind === "contribution") d.fromId = "";
      if (d.kind === "withdrawal" || d.kind === "fee") d.toId = "";
      if (d.kind === "transfer") d.budgetIncluded = false;
    }
    if (entity === "snapshots") {
      const a = p.accounts.find((a) => a.id === d.accountId);
      if (a?.kind === "gold")
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
        .filter((a) => a.accountId === d.accountId && a.id !== d.id)
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
      [entity]: [...p[entity].filter((r) => r.id !== d.id), d],
    } as FinancePortfolio;
    try {
      commit(next);
      setEditor(null);
      setNotice(`Saved ${NAMES[entity]}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }
  function remove(entity: Entity, id: string) {
    if (!confirm(`Delete this ${NAMES[entity]}?`)) return;
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
  const action = (entity: Entity, row: { id: string; name?: string }) => (
    <div className="flex shrink-0 justify-end">
      <button
        aria-label={`Edit ${row.name ?? NAMES[entity]}`}
        className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-rose-600"
        onClick={() => open(entity, row)}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <Delete
        label={`Delete ${row.name ?? NAMES[entity]}`}
        onClick={() => remove(entity, row.id)}
      />
    </div>
  );
  const add = (entity: Entity) => (
    <button className={primaryClass} onClick={() => open(entity)}>
      <Plus className="h-4 w-4" />
      Add {NAMES[entity]}
    </button>
  );
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
      let a = next.accounts.find((a) => a.planName === r.name);
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
  const simAccount =
      p.accounts.find((a) => a.id === sim.accountId && a.liquid) ||
      p.accounts.find((a) => a.liquid),
    cash = simAccount ? (latestSnapshot(p, simAccount.id)?.value ?? 0) : 0,
    simulationSummary = cycle
      ? summarizeCycle(
          syncPortfolioCommitments(plan, p, cycle, today),
          data.financeExpenses ?? [],
          cycle,
        )
      : null,
    headroom = simulationSummary
      ? Math.min(simulationSummary.expected, simulationSummary.surplus)
      : 0;
  const validSim =
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
  const scenario = validSim
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
  const simGoal = p.goals.find((g) => g.id === sim.goalId),
    baselineGoal = simGoal ? goalProgress(p, simGoal, today) : null,
    changedGoal =
      simGoal && scenario && simAccount
        ? goalScenarioProgress(
            p,
            simGoal,
            today,
            { accountId: simAccount.id, value: scenario.cashAfter },
            scenario.payment,
            sim.method === "loan" ? sim.months : 0,
          )
        : null;
  return (
    <div className="min-w-0 space-y-5 break-words [contain:paint]">
      <Card
        title="Your financial portfolio"
        subtitle="Accounts, debt, investments and goals. Latest figures use recorded valuations across cycles, not live bank feeds. The cycle controls balance entry and reconciliation."
      >
        {!storageReady && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            Portfolio changes save on this device. Update the planner connection
            to sync the new tables.
          </p>
        )}
        <div
          role="tablist"
          aria-label="Portfolio sections"
          className="flex flex-wrap gap-2"
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
              role="tab"
              aria-selected={tab === id}
              key={id}
              onClick={() => {
                setTab(id);
                setNotice("");
              }}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === id ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-500"}`}
            >
              {id}
            </button>
          ))}
        </div>
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
          >
            {notice}
          </p>
        )}
      </Card>
      {tab === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              [
                "Recorded net worth",
                totals.netWorth,
                Landmark,
                "bg-violet-50 border-violet-200 text-violet-800",
              ],
              [
                "Total assets",
                totals.assets,
                Landmark,
                "bg-slate-50 border-slate-200 text-slate-800",
              ],
              [
                "Bank balances",
                totals.bank,
                Landmark,
                "bg-indigo-50 border-indigo-200 text-indigo-800",
              ],
              [
                "Liquid funds",
                totals.liquid,
                Wallet,
                "bg-emerald-50 border-emerald-200 text-emerald-800",
              ],
              [
                "Physical gold",
                totals.gold,
                Gem,
                "bg-amber-50 border-amber-200 text-amber-800",
              ],
              [
                "Investments",
                totals.investments,
                TrendingUp,
                "bg-sky-50 border-sky-200 text-sky-800",
              ],
              [
                "Outstanding debt",
                totals.debt,
                CreditCard,
                "bg-rose-50 border-rose-200 text-rose-800",
              ],
              [
                "Monthly obligations",
                p.loans
                  .filter((l) => loanCurrentBalance(p, l).balance > 0)
                  .reduce((s, l) => s + l.payment, 0) +
                  p.subscriptions.reduce(
                    (s, r) => s + subscriptionMonthly(r),
                    0,
                  ),
                CreditCard,
                "bg-teal-50 border-teal-200 text-teal-800",
              ],
            ].map(([label, value, Icon, color]) => {
              const I = Icon as typeof Wallet;
              return (
                <div
                  key={String(label)}
                  className={`min-w-0 rounded-2xl border p-5 ${color}`}
                >
                  <I className="mb-3 h-6 w-6" />
                  <p className="text-lg font-bold">{String(label)}</p>
                  <p className="mt-3 break-words text-3xl font-bold">
                    {money(Number(value))}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-sm leading-relaxed text-slate-500">
            Net worth = recorded assets minus recorded outstanding debt. Liquid
            funds follow your account settings. Monthly obligations use loan
            instalments and subscription monthly equivalents; actual cycle
            charges are shown when syncing commitments.
          </p>
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
                    [
                      "Opening net worth",
                      recon.complete ? recon.opening : null,
                    ],
                    [
                      "Closing net worth",
                      recon.complete ? recon.closing : null,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-slate-50 p-4"
                    >
                      <p className="text-sm text-slate-500">{label}</p>
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
                    Record opening and closing asset and loan balances to
                    complete this comparison.
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
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  Transfers between your accounts do not create wealth.
                  Investment results adjust for recorded contributions and
                  withdrawals. An unexplained difference can include missing
                  entries, new borrowing, fees or commitments also recorded as
                  expenses; it is not automatically an investment loss.
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
                Add your bank accounts, investments and physical assets in
                Accounts.
              </Empty>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {totals.values.map(({ account, snapshot }) => (
                  <div
                    key={account.id}
                    className="min-w-0 rounded-xl border border-slate-100 p-4"
                  >
                    <p className="break-words font-semibold">{account.name}</p>
                    <p className="mt-2 text-xl font-bold">
                      {snapshot ? money(snapshot.value) : "No valuation"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
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
      )}
      {tab === "accounts" && (
        <>
          <Card
            title="Accounts and holdings"
            subtitle="MYR valuations only. Store masked references and password-manager links; no banking passwords, PINs or OTPs."
            action={add("accounts")}
          >
            {!p.accounts.length ? (
              <Empty>
                Add banks, cash, wallets, gold and investments once, then reuse
                them each cycle.
              </Empty>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {p.accounts.map((a) => {
                  const latest = latestSnapshot(p, a.id);
                  return (
                    <div
                      key={a.id}
                      className="min-w-0 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                            {a.name}
                          </h3>
                          <p className="mt-1 text-xs capitalize text-slate-400">
                            {a.kind}
                            {a.maskedRef ? ` · •••• ${a.maskedRef}` : ""}
                          </p>
                        </div>
                        {action("accounts", a)}
                      </div>
                      <p className="mt-3 text-2xl font-bold">
                        {latest ? money(latest.value) : "No valuation"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {latest
                          ? `As of ${latest.date} · ${latest.phase}`
                          : "No date recorded"}
                      </p>
                      {a.costBasis > 0 && latest && (
                        <p className="mt-2 text-sm text-slate-500">
                          Value vs recorded cost:{" "}
                          {money(latest.value - a.costBasis)}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          disabled={!cycle}
                          className={secondaryClass}
                          onClick={() =>
                            open("snapshots", undefined, { accountId: a.id })
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
            title="This cycle’s opening, current and closing balances"
            subtitle="Closing balances can be recorded after the cycle ends. Gold values use grams × value per gram."
            action={
              <button
                disabled={!cycle || !p.accounts.length}
                className={secondaryClass}
                onClick={() => open("snapshots")}
              >
                Record account balance
              </button>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                disabled={!cycle}
                className={secondaryClass}
                onClick={carry}
              >
                Use previous closing as opening
              </button>
              <select
                aria-label="Import balance phase"
                className={`${inputClass} max-w-48`}
                value={importPhase}
                onChange={(e) => setImportPhase(e.target.value as Phase)}
              >
                {PHASES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                disabled={!cycle}
                className={secondaryClass}
                onClick={importBalances}
              >
                Link monthly balances
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Linking imports existing Monthly Budget balance rows using the
              phase you choose. Other monthly rows stay unchanged. Record the
              correct phase before importing historical balances.
            </p>
            {!p.snapshots.some((s) => s.cycleId === cycle?.id) ? (
              <Empty>No account balances recorded for this cycle.</Empty>
            ) : (
              <div
                data-horizontal-scroll
                className="max-w-full overflow-x-auto"
              >
                <table aria-label="Portfolio balances" className={TABLE}>
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th>Account</th>
                      <th>Phase</th>
                      <th>Date</th>
                      <th className="text-right">Value</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.snapshots
                      .filter((s) => s.cycleId === cycle?.id)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((s) => (
                        <tr className="border-t border-slate-100" key={s.id}>
                          <td className="max-w-48 break-words py-3 pr-3">
                            {p.accounts.find((a) => a.id === s.accountId)?.name}
                          </td>
                          <td className="capitalize">{s.phase}</td>
                          <td>{s.date}</td>
                          <td className="text-right">{money(s.value)}</td>
                          <td>{action("snapshots", s)}</td>
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
            {!cycle || !investmentPerformance(p, cycle).length ? (
              <Empty>
                Add an investment or physical-gold account to track its result.
              </Empty>
            ) : (
              <div
                data-horizontal-scroll
                className="max-w-full overflow-x-auto"
              >
                <table aria-label="Investment performance" className={TABLE}>
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th>Account</th>
                      <th>Opening</th>
                      <th>Closing</th>
                      <th>Net deposits</th>
                      <th>Gain / loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investmentPerformance(p, cycle).map((r) => (
                      <tr
                        key={r.account.id}
                        className="border-t border-slate-100"
                      >
                        <th className="max-w-44 break-words py-3 pr-3 text-left font-medium">
                          {r.account.name}
                        </th>
                        <td>
                          {r.opening === null
                            ? "Not recorded"
                            : money(r.opening)}
                        </td>
                        <td>
                          {r.closing === null
                            ? "Not recorded"
                            : money(r.closing)}
                        </td>
                        <td>{money(r.netDeposits)}</td>
                        <td
                          className={
                            r.result !== null && r.result < 0
                              ? "text-rose-600"
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
                disabled={!cycle || !p.accounts.length}
                className={secondaryClass}
                onClick={() => open("flows")}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Add movement
              </button>
            }
          >
            {!p.flows.some((f) => f.cycleId === cycle?.id) ? (
              <Empty>No money movements recorded in this cycle.</Empty>
            ) : (
              <div className="space-y-3">
                {p.flows
                  .filter((f) => f.cycleId === cycle?.id)
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-medium">
                          {p.accounts.find((a) => a.id === f.fromId)?.name ??
                            "Outside portfolio"}{" "}
                          →{" "}
                          {p.accounts.find((a) => a.id === f.toId)?.name ??
                            "Outside portfolio"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {f.date} · {f.kind} · {money(f.amount)}
                          {f.budgetIncluded ? " · already in budget" : ""}
                        </p>
                      </div>
                      {action("flows", f)}
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}
      {tab === "loans" && (
        <>
          <Card
            title="Loans and payoff estimates"
            subtitle="Estimates assume the entered rate and monthly payment remain unchanged; fees and lender-specific settlement rules are excluded."
            action={add("loans")}
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
                    setExtra(Math.max(0, Number(e.target.value)))
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
                  const balance = debt.balance,
                    terms = { ...l, asOf: debt.date },
                    f = loanForecast(terms, 0, balance),
                    faster = loanForecast(terms, extra, balance);
                  return (
                    <div
                      key={l.id}
                      className="min-w-0 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                          {l.name}
                        </h3>
                        {action("loans", l)}
                      </div>
                      <p className="mt-2 text-2xl font-bold">
                        {money(balance)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
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
                        <p className="mt-1 text-sm text-slate-500">
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
                        disabled={!cycle}
                        className={`${secondaryClass} mt-4`}
                        onClick={() =>
                          open("debtSnapshots", undefined, {
                            loanId: l.id,
                            balance,
                          })
                        }
                      >
                        Record cycle loan balance
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card
            title="Cycle loan balances"
            subtitle="Record opening and closing principal separately to calculate actual net-worth movement."
          >
            {!p.debtSnapshots.some((s) => s.cycleId === cycle?.id) ? (
              <Empty>No loan snapshots recorded for this cycle.</Empty>
            ) : (
              <div className="space-y-3">
                {p.debtSnapshots
                  .filter((s) => s.cycleId === cycle?.id)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                    >
                      <p className="break-words text-sm">
                        {p.loans.find((l) => l.id === s.loanId)?.name} ·{" "}
                        {s.phase} · {s.date} · {money(s.balance)}
                      </p>
                      {action("debtSnapshots", s)}
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
                  setNotice(
                    "Scheduled commitments updated for this cycle only.",
                  );
                }
              }}
            >
              Sync cycle commitments
            </button>
          </Card>
        </>
      )}
      {tab === "subscriptions" && (
        <Card
          title="Subscriptions and renewals"
          subtitle="Monthly equivalents are for comparison. Syncing uses actual renewal dates in current or future cycles; historical commitments stay unchanged."
          action={add("subscriptions")}
        >
          {!p.subscriptions.length ? (
            <Empty>
              Add active subscriptions and their next renewal dates.
            </Empty>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {p.subscriptions.map((s) => (
                <div
                  key={s.id}
                  className="min-w-0 rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex justify-between gap-2">
                    <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                      {s.name}
                    </h3>
                    {action("subscriptions", s)}
                  </div>
                  <p className="mt-2 text-xl font-bold">
                    {money(s.amount)} / {s.frequency}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {s.active ? "Active" : "Inactive"} · next renewal{" "}
                    {s.nextDue}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
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
                setNotice("Scheduled cycle commitments updated.");
              }
            }}
          >
            Sync cycle commitments
          </button>
        </Card>
      )}
      {tab === "goals" && (
        <>
          <Card
            title="Financial goals and deadlines"
            subtitle="Progress uses allocated money at its latest valuation. An account cannot fund several goals with the same money."
            action={add("goals")}
          >
            {!p.goals.length ? (
              <Empty>
                Add a target and deadline, then allocate money from your
                accounts.
              </Empty>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {p.goals.map((g) => {
                  const progress = goalProgress(p, g, today);
                  return (
                    <div
                      key={g.id}
                      className="min-w-0 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex justify-between gap-2">
                        <h3 className="min-w-0 flex-1 break-words text-lg font-bold">
                          {g.name}
                        </h3>
                        {action("goals", g)}
                      </div>
                      <p className="mt-3 text-xl font-bold">
                        {money(progress.progress)} / {money(g.target)}
                      </p>
                      <progress
                        aria-label={`Progress for ${g.name}`}
                        className="mt-3 h-3 w-full accent-rose-600"
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
                      <p className="mt-2 text-sm text-slate-500">
                        Monthly amount needed:{" "}
                        {progress.required === null
                          ? "Deadline passed"
                          : money(progress.required)}
                        . Planned: {money(g.monthlyContribution)}.
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Projected completion:{" "}
                        {progress.completion || "Add a monthly contribution"}.
                      </p>
                      <button
                        className={`${secondaryClass} mt-4`}
                        onClick={() =>
                          open("allocations", undefined, { goalId: g.id })
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
            {p.accounts.some(
              (a) =>
                p.allocations
                  .filter((x) => x.accountId === a.id)
                  .reduce((s, x) => s + x.amount, 0) >
                (latestSnapshot(p, a.id)?.value ?? 0),
            ) && (
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <p className="break-words text-sm">
                      {p.accounts.find((x) => x.id === a.accountId)?.name} →{" "}
                      {p.goals.find((g) => g.id === a.goalId)?.name} ·{" "}
                      {money(a.amount)}
                    </p>
                    {action("allocations", a)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
      {tab === "simulator" && (
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
                  setSim({ ...sim, amount: Number(e.target.value) })
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
                  setSim({ ...sim, reserve: Number(e.target.value) })
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
                      setSim({ ...sim, deposit: Number(e.target.value) })
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
                      setSim({ ...sim, apr: Number(e.target.value) })
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
                      setSim({ ...sim, months: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Interest method">
                  <select
                    aria-label="Simulation interest method"
                    className={inputClass}
                    value={sim.rateType}
                    onChange={(e) =>
                      setSim({ ...sim, rateType: e.target.value })
                    }
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
            <p role="alert" className="mt-4 text-sm text-rose-600">
              Check the price, deposit, interest and term.
            </p>
          ) : !simAccount || !latestSnapshot(p, simAccount.id) ? (
            <p className="mt-4 text-sm text-amber-700">
              Add and value a liquid account to compare available money.
            </p>
          ) : (
            scenario && (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      className="rounded-xl bg-slate-50 p-4"
                    >
                      <p className="text-sm text-slate-500">{label}</p>
                      <p className="mt-2 break-words text-xl font-bold">
                        {money(Number(value))}
                      </p>
                    </div>
                  ))}
                </div>
                {sim.method === "loan" && scenario.principal > 0 && (
                  <p className="mt-4 text-sm text-slate-600">
                    Estimated final payment: {addMonths(today, sim.months)}{" "}
                    (first payment assumed next month).
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
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  Headroom uses the lower of planned savings and logged surplus,
                  including scheduled Portfolio commitments in the selected
                  cycle. Sync commitments to show these in Monthly Budget.
                  Estimates assume constant rates and spending, and exclude
                  lender fees. This compares your inputs rather than approving a
                  loan.
                </p>
                {simGoal && baselineGoal && changedGoal && (
                  <p className="mt-4 rounded-xl bg-violet-50 p-4 text-sm text-violet-800">
                    {simGoal.name}: estimated completion{" "}
                    {baselineGoal.completion || "unknown"} →{" "}
                    {changedGoal.completion || "not funded at this rate"}.
                    Assumes the purchase uses this account. Goal contributions
                    return to their original amount after the loan term.
                  </p>
                )}
              </>
            )
          )}
        </Card>
      )}
      {editor && (
        <Dialog
          title={`${p[editor.entity].some((r) => r.id === editor.draft.id) ? "Edit" : "Add"} ${NAMES[editor.entity]}`}
          onClose={() => setEditor(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {fields(editor.entity, editor.draft).map((f) => (
              <Field key={f.key} label={f.label}>
                {f.options ? (
                  <select
                    aria-label={f.label}
                    required={!f.optional}
                    className={inputClass}
                    value={String(editor.draft[f.key] ?? "")}
                    onChange={(e) => changeDraft(f.key, e.target.value)}
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <input
                    aria-label={f.label}
                    type="checkbox"
                    className="h-5 w-5 accent-rose-600"
                    checked={!!editor.draft[f.key]}
                    onChange={(e) => changeDraft(f.key, e.target.checked)}
                  />
                ) : (
                  <input
                    aria-label={f.label}
                    required={!f.optional}
                    type={f.type ?? "text"}
                    className={inputClass}
                    value={String(editor.draft[f.key] ?? "")}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    maxLength={f.key === "maskedRef" ? 4 : 200}
                    pattern={f.key === "maskedRef" ? "[0-9]{4}" : undefined}
                    onChange={(e) => changeDraft(f.key, e.target.value)}
                  />
                )}{" "}
                {f.hint && (
                  <p className="mt-1 text-xs font-normal leading-relaxed text-slate-400">
                    {f.hint}
                  </p>
                )}
              </Field>
            ))}
            {editor.entity === "snapshots" &&
              p.accounts.find((a) => a.id === editor.draft.accountId)?.kind ===
                "gold" && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold">
                  Recorded value:{" "}
                  {money(
                    Number(editor.draft.units) * Number(editor.draft.price),
                  )}
                </p>
              )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            <button className={primaryClass}>
              Save {NAMES[editor.entity]}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
