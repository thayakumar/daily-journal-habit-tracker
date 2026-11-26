import { uid } from "../../workspace/model";
import type { FinanceCycle, FinancePlanning } from "../planning";
import type { FinancePortfolio } from "../portfolio-model";

export type PortfolioEntity = keyof FinancePortfolio;
export type PortfolioDraft = Record<string, string | number | boolean>;

export interface InputField {
  key: string;
  label: string;
  type?: "number" | "date" | "checkbox" | "url";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: string;
  optional?: boolean;
  hint?: string;
}

export const ENTITY_NAMES: Record<PortfolioEntity, string> = {
  accounts: "account",
  snapshots: "account balance",
  flows: "money movement",
  loans: "loan",
  debtSnapshots: "loan balance",
  subscriptions: "subscription",
  goals: "goal",
  allocations: "goal allocation",
};

export const PHASES = [
  { value: "opening", label: "Opening balance" },
  { value: "current", label: "Current balance" },
  { value: "closing", label: "Closing balance" },
];

export const KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
  { value: "gold", label: "Physical gold" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other asset" },
];

export const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "weekly", label: "Weekly" },
];

export const NUM_KEYS = [
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
] as const;

export const PORTFOLIO_TABLE_CLASS = "w-full min-w-[600px] text-sm";

const EMPTY_OPTION = { value: "", label: "Select…" };

export function getPortfolioFields(
  entity: PortfolioEntity,
  d: PortfolioDraft,
  p: FinancePortfolio,
  plan: FinancePlanning,
  cycle: FinanceCycle | undefined,
): InputField[] {
  const accounts = p.accounts.map((a) => ({ value: a.id, label: a.name }));
  const loans = p.loans.map((l) => ({ value: l.id, label: l.name }));
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
    options: [EMPTY_OPTION, ...accounts],
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
            ...(Number(d.units) > 0 && Number(d.price) > 0
              ? []
              : [
                  {
                    key: "value",
                    label: "Recorded gold value (RM)",
                    type: "number" as const,
                    min: 0,
                    step: "0.01",
                    hint: "Use the recorded total when quantity or price is unknown. Enter both quantity and price to calculate instead.",
                  },
                ]),
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
              options: [EMPTY_OPTION, ...accounts],
            },
          ]
        : []),
      ...(d.kind === "transfer" || d.kind === "contribution"
        ? [
            {
              key: "toId",
              label: "To account",
              options: [EMPTY_OPTION, ...accounts],
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
      { key: "loanId", label: "Loan", options: [EMPTY_OPTION, ...loans] },
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
        EMPTY_OPTION,
        ...p.goals.map((g) => ({ value: g.id, label: g.name })),
      ],
    },
    account,
    amount,
  ];
}

export function defaultPortfolioDraft(
  entity: PortfolioEntity,
  p: FinancePortfolio,
  today: string,
): PortfolioDraft {
  const defaults: Record<PortfolioEntity, PortfolioDraft> = {
    accounts: {
      id: uid(),
      name: "",
      kind: "bank",
      liquid: true,
      maskedRef: "",
      vaultUrl: "",
      costBasis: 0,
      planName: "",
      trackingFrom: today,
    },
    snapshots: {
      id: uid(),
      accountId: p.accounts[0]?.id ?? "",
      cycleId: "",
      phase: "current",
      date: today,
      value: 0,
      units: 0,
      price: 0,
      updatedAt: new Date().toISOString(),
    },
    flows: {
      id: uid(),
      cycleId: "",
      date: today,
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
      startDate: today,
    },
    debtSnapshots: {
      id: uid(),
      loanId: p.loans[0]?.id ?? "",
      cycleId: "",
      phase: "current",
      date: today,
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
      startDate: today,
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
  return defaults[entity];
}
