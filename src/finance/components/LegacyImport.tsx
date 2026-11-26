import { useMemo, useState } from "react";
import { fetchLegacyBudget } from "../../lib/sheets-api";
import { Dialog } from "../../workspace/Dialog";
import { localDate, isWorkspace, type Workspace } from "../../workspace/model";
import {
  Card,
  Field,
  inputClass,
  secondaryClass,
  primaryClass,
  type Update,
} from "../../workspace/ui";
import {
  parseLegacyTab,
  migrateLegacy,
  defaultLegacyChoices,
  type LegacyMonth,
  type LegacyChoice,
  type AccountChoice,
} from "../legacy-import";
export function LegacyImport({
  data,
  update,
  ready,
  compact = false,
}: {
  data: Workspace;
  update: Update;
  ready: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [months, setMonths] = useState<LegacyMonth[]>([]),
    [choices, setChoices] = useState<LegacyChoice[]>([]),
    [accounts, setAccounts] = useState<AccountChoice[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      const tabs = await fetchLegacyBudget();
      const parsed = tabs
        .map(parseLegacyTab)
        .filter((m): m is LegacyMonth => !!m);
      setMonths(parsed);
      setChoices(defaultLegacyChoices(parsed, data));
      setAccounts(
        [...new Set(parsed.flatMap((m) => m.balances.map((b) => b.name)))].map(
          (name) => ({
            name,
            accountId:
              data.financePortfolio?.accounts.find(
                (a) => a.name.trim().toLowerCase() === name.toLowerCase(),
              )?.id ?? "",
            kind: "other",
            liquid: false,
          }),
        ),
      );
      setOpen(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read the source Sheet",
      );
    } finally {
      setBusy(false);
    }
  }
  const { preview, previewError } = useMemo(() => {
    if (!open || !months.length) {
      return {
        preview: null as ReturnType<typeof migrateLegacy> | null,
        previewError: "",
      };
    }
    try {
      return {
        preview: migrateLegacy(data, months, choices, accounts, localDate()),
        previewError: "",
      };
    } catch (e) {
      return {
        preview: null,
        previewError: e instanceof Error ? e.message : "Check import settings",
      };
    }
  }, [open, data, months, choices, accounts]);
  function closeDialog() {
    setOpen(false);
    setMonths([]);
  }
  const trigger = (
    <>
      <button
        type="button"
        className={secondaryClass}
        disabled={!ready || busy}
        onClick={() => void load()}
      >
        {busy ? "Reading source Sheet…" : "Preview Sheet migration"}
      </button>
      {!ready && !compact && (
        <p className="mt-2 text-sm text-amber-700">
          Deploy the updated Apps Script to enable the migration preview.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[#A83E20]">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
    </>
  );
  const dialog = open && (
    <Dialog
      wide
      title="Review budget Sheet migration"
      onClose={closeDialog}
    >
      <p className="mb-4 text-sm text-[#62584E]">
        The original Sheet is read only. Existing app records stay in place.
        Duplicate source rows are skipped. Since Savings Breakdown was
        updated at different times, enter the actual balance date for each
        month you want imported. Leave it blank to skip that month’s
        balances. Undated expenses cannot be imported accurately and are
            excluded.
          </p>
          <div className="space-y-4">
            {choices.map((c) => {
              const m = months.find((m) => m.sheetId === c.sheetId)!;
              return (
                <section
                  key={c.sheetId}
                  className="rounded-xl border border-[#EAE2D6] p-4"
                >
                  <label className="flex min-h-11 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={(e) =>
                        setChoices((a) =>
                          a.map((x) =>
                            x.sheetId === c.sheetId
                              ? { ...x, selected: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    {m.name}
                  </label>
                  <p className="my-2 text-sm text-[#62584E]">
                    {m.income.length} income · {m.commitments.length}{" "}
                    commitments · {m.budgets.length} budgets ·{" "}
                    {m.expenses.length} dated expenses · {m.undated} undated
                    expenses excluded · {m.balances.length} balances
                  </p>
                  <label className="my-3 flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.includeCommitments !== false}
                      onChange={(e) =>
                        setChoices((rows) =>
                          rows.map((x) =>
                            x.sheetId === c.sheetId
                              ? { ...x, includeCommitments: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    Import fixed commitments
                  </label>
                  {m.expenses.some((e) =>
                    /^(Loan|Subscription|Mom)$/i.test(e.category),
                  ) && (
                    <p className="my-2 text-sm text-amber-700">
                      Some transaction rows already contain loan, family or
                      subscription payments. Fixed commitments are excluded by
                      default for this month to avoid subtracting those payments
                      twice. Review before enabling both.
                    </p>
                  )}
                  <details className="my-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Review transaction dates ({m.expenses.length})
                    </summary>
                    <p className="my-2 text-xs text-[#62584E]">
                      Dates are preserved from the source. Correct any source
                      errors; blank or future dates are excluded. Dates outside
                      the cycle appear under their actual date’s cycle.
                    </p>
                    {m.expenses.map((e) => (
                      <Field
                        key={e.row}
                        label={`${m.name} row ${e.row} · ${e.item} · RM ${e.amount.toFixed(2)}`}
                      >
                        <input
                          className={`${inputClass} mb-2`}
                          type="date"
                          value={c.expenseDates?.[String(e.row)] ?? e.date}
                          onChange={(event) =>
                            setChoices((rows) =>
                              rows.map((x) =>
                                x.sheetId === c.sheetId
                                  ? {
                                      ...x,
                                      expenseDates: {
                                        ...x.expenseDates,
                                        [String(e.row)]: event.target.value,
                                      },
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </details>
                  <details className="my-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Review income, commitments and budgets
                    </summary>
                    <p className="my-2 text-xs text-[#62584E]">
                      Existing matching app rows are retained, including Salary
                      / Wages aliases. Confirm amounts before importing.
                    </p>
                    {(
                      [
                        ["Income", m.income],
                        ["Commitments", m.commitments],
                        ["Budgets", m.budgets],
                      ] as const
                    ).map(([label, entries]) => (
                      <div key={label} className="my-3">
                        <h4 className="text-sm font-semibold">{label}</h4>
                        {entries.map((r, i) => (
                          <p
                            key={`${r.name}:${r.amount}:${i}`}
                            className="break-words text-sm text-[#62584E]"
                          >
                            {r.name} · RM {r.amount.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    ))}
                  </details>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["start", "end", "balanceDate"] as const).map((k) => (
                      <Field
                        key={k}
                        label={`${k === "start" ? "Cycle start" : k === "end" ? "Cycle end" : "Actual balance date (optional)"} · ${m.name}`}
                      >
                        <input
                          className={inputClass}
                          type="date"
                          value={c[k]}
                          onChange={(e) =>
                            setChoices((a) =>
                              a.map((x) =>
                                x.sheetId === c.sheetId
                                  ? { ...x, [k]: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <h3 className="my-4 font-semibold">Map balance accounts</h3>
          <p className="mb-3 text-sm text-[#62584E]">
            Choose the correct type and whether funds are available as cash.
            Instalments in commitments are not imported as outstanding debt.
            “NET” totals are recalculated rather than imported as assets.
          </p>
          {accounts.map((a) => (
            <div
              key={a.name}
              className="mb-3 grid gap-3 rounded-xl bg-[#FAF7F2] p-3 sm:grid-cols-3"
            >
              <strong className="self-center text-sm">{a.name}</strong>
              <Field label={`Destination · ${a.name}`}>
                <select
                  className={inputClass}
                  value={a.accountId}
                  onChange={(e) =>
                    setAccounts((rows) =>
                      rows.map((r) =>
                        r.name === a.name
                          ? { ...r, accountId: e.target.value }
                          : r,
                      ),
                    )
                  }
                >
                  <option value="">Create account</option>
                  {data.financePortfolio?.accounts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!a.accountId && (
                <div>
                  <Field label={`Type · ${a.name}`}>
                    <select
                      className={inputClass}
                      value={a.kind}
                      onChange={(e) =>
                        setAccounts((rows) =>
                          rows.map((r) =>
                            r.name === a.name
                              ? {
                                  ...r,
                                  kind: e.target.value as AccountChoice["kind"],
                                }
                              : r,
                          ),
                        )
                      }
                    >
                      {[
                        "bank",
                        "cash",
                        "wallet",
                        "gold",
                        "investment",
                        "other",
                      ].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </Field>
                  <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={a.liquid}
                      onChange={(e) =>
                        setAccounts((rows) =>
                          rows.map((r) =>
                            r.name === a.name
                              ? { ...r, liquid: e.target.checked }
                              : r,
                          ),
                        )
                      }
                    />
                    Liquid funds
                  </label>
                </div>
              )}
            </div>
          ))}
          {preview && (
            <div className="my-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              Will add {preview.report.cycles} cycles, {preview.report.rows}{" "}
              planning rows, {preview.report.expenses} expenses,{" "}
              {preview.report.accounts} accounts and {preview.report.snapshots}{" "}
              dated balances. Skip {preview.report.duplicates} duplicates,{" "}
              {preview.report.undated} undated expenses and{" "}
              {preview.report.undatedBalances} balances without dates. Also
              exclude {preview.report.excludedDates} transaction rows with
              blank/future dates and {preview.report.skippedCommitments}{" "}
              commitments to prevent double counting.
            </div>
          )}
          {error && (
            <p role="alert" className="my-3 text-sm text-[#A83E20]">
              {error}
            </p>
          )}
          {previewError && (
            <p role="alert" className="my-3 text-sm text-[#A83E20]">
              {previewError}
            </p>
          )}
          <button
            type="button"
            className={primaryClass}
            disabled={!preview || !choices.some((c) => c.selected)}
            onClick={() => {
              try {
                const outcome: {
                  report: ReturnType<typeof migrateLegacy>["report"] | null;
                  failure: string | null;
                } = { report: null, failure: null };
                update((latestWorkspace) => {
                  try {
                    const result = migrateLegacy(
                      latestWorkspace,
                      months,
                      choices,
                      accounts,
                      localDate(),
                    );
                    if (!isWorkspace(result.workspace)) {
                      outcome.failure =
                        "Import data is invalid. Check account mappings and date settings.";
                      return latestWorkspace;
                    }
                    outcome.report = result.report;
                    return result.workspace;
                  } catch (e) {
                    outcome.failure =
                      e instanceof Error ? e.message : "Import failed";
                    return latestWorkspace;
                  }
                });
                if (outcome.failure || !outcome.report) {
                  setError(outcome.failure || "Import failed");
                  return;
                }
                closeDialog();
                setMessage(
                  `Migration added ${outcome.report.expenses} expenses, ${outcome.report.rows} planning rows and ${outcome.report.snapshots} balances. ${outcome.report.undated} expenses without dates were excluded.`,
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed");
              }
            }}
          >
            Import reviewed records
          </button>
        </Dialog>
  );
  if (compact) {
    return (
      <div>
        {trigger}
        {dialog}
      </div>
    );
  }
  return (
    <Card
      title="Migrate your budget Sheet"
      subtitle="Preview historical income, commitments, budgets, dated expenses and recorded account values."
    >
      {trigger}
      {dialog}
    </Card>
  );
}
