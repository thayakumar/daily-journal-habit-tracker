import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../../workspace/Dialog";
import {
  Card,
  Field,
  inputClass,
  parseNumberInput,
  primaryClass,
  secondaryClass,
} from "../../workspace/ui";
import { localDate, uid, type FinanceExpense } from "../../workspace/model";
import {
  parseStatement,
  duplicateExpense,
  type ImportRow,
} from "../statement-import";
import type { FinanceCycle } from "../planning";
import { Category } from "../types";
export function StatementImport({
  cycle,
  existing,
  onSave,
}: {
  cycle: FinanceCycle;
  existing: FinanceExpense[];
  onSave: (rows: FinanceExpense[]) => void;
}) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [rows, setRows] = useState<ImportRow[]>([]),
    [year, setYear] = useState(Number(cycle.end.slice(0, 4))),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const alive = useRef(true),
    worker = useRef<{ terminate: () => Promise<unknown> } | null>(null);
  const existingKeys = useMemo(
    () =>
      new Set(
        existing.map(
          (e) =>
            `${e.date}|${Math.round(e.amount * 100)}|${e.item.trim().toLowerCase()}`,
        ),
      ),
    [existing],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void worker.current?.terminate();
    };
  }, []);
  async function scan(file: File) {
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setError("Choose a PNG, JPEG or WebP image up to 12 MB.");
      return;
    }
    const request = ++generation.current;
    setBusy(true);
    setError("");
    setStatus("Loading OCR engine…");
    setRows([]);
    let activeWorker: { terminate: () => Promise<unknown> } | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng", 1, {
        logger: (m) => {
          if (alive.current && generation.current === request)
            setStatus(`${m.status} ${Math.round((m.progress ?? 0) * 100)}%`);
        },
      });
      activeWorker = w;
      worker.current = w;
      if (!alive.current || generation.current !== request) {
        return;
      }
      const result = await w.recognize(file);
      if (alive.current && generation.current === request) {
        setText(result.data.text);
        setRows(parseStatement(result.data.text, year));
        setStatus("Text extracted. Review every row before importing.");
      }
    } catch (e) {
      if (alive.current && generation.current === request)
        setError(
          e instanceof Error
            ? e.message
            : "OCR failed. Try pasting the transaction text instead.",
        );
    } finally {
      if (activeWorker) {
        try {
          await activeWorker.terminate();
        } catch {
          /* Ignore worker teardown errors. */
        }
        if (worker.current === activeWorker) worker.current = null;
      }
      if (alive.current && generation.current === request) setBusy(false);
    }
  }
  function edit(id: string, key: keyof ImportRow, value: string | boolean) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    setError("");
  }
  function save() {
    const chosen = rows.filter((r) => r.selected),
      today = localDate(),
      batch: FinanceExpense[] = [];
    if (!chosen.length) {
      setError("Select the debit transactions you want to import.");
      return;
    }
    for (const r of chosen) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        !Number.isFinite(Date.parse(r.date)) ||
        new Date(r.date + "T12:00Z").toISOString().slice(0, 10) !== r.date ||
        r.date < cycle.start ||
        r.date > cycle.end ||
        r.date > today ||
        !r.item.trim() ||
        !Number.isFinite(Number(r.amount)) ||
        Number(r.amount) <= 0
      ) {
        setError(
          "Every selected row needs a valid date within this cycle (up to today), description and positive amount.",
        );
        return;
      }
      if (duplicateExpense(r, [...existing, ...batch])) {
        setError(
          `Possible duplicate: ${r.item} on ${r.date}. Unselect it or correct the details.`,
        );
        return;
      }
      batch.push({
        id: uid(),
        date: r.date,
        item: r.item.trim(),
        amount: Math.round(Number(r.amount) * 100) / 100,
        category: r.category,
        receiptName: "Bulk screenshot import · reviewed",
        receiptUrl: "",
        createdAt: new Date().toISOString(),
      });
    }
    onSave(batch);
    setOpen(false);
    setRows([]);
    setText("");
    setStatus(`Imported ${batch.length} expenses.`);
  }
  return (
    <>
      <Card
        title="Import bank transactions"
        subtitle="Extract a screenshot, review the debit rows, then add them together."
      >
        <button
          type="button"
          className={secondaryClass}
          onClick={() => {
            setOpen(true);
            setError("");
          }}
        >
          Import screenshot / pasted text
        </button>
        {status && !open && (
          <p role="status" className="mt-3 text-sm text-emerald-700">
            {status}
          </p>
        )}
      </Card>
      {open && (
        <Dialog
          wide
          title="Review screenshot transactions"
          onClose={() => {
            generation.current++;
            void worker.current?.terminate();
            worker.current = null;
            setBusy(false);
            setOpen(false);
          }}
        >
          <p className="mb-4 text-sm text-[#62584E]">
            OCR runs in your browser. The screenshot is not uploaded or stored.
            OCR language files download on first use. Select only outgoing
            expenses; incoming payments and transfers between your own accounts
            should be excluded. Imported rows are labelled “Bulk screenshot
            import”.
          </p>
          <p className="mb-4 rounded-xl bg-[#FBECE7] p-3 text-sm text-[#A83E20]">
            Import into {cycle.start} → {cycle.end}. Switch salary cycle before
            importing a different period. Review any dates without a printed
            year, especially around New Year.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Transaction screenshot">
              <input
                aria-label="Transaction screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void scan(f);
                  e.target.value = "";
                }}
                className={inputClass}
              />
            </Field>
            <Field label="Year for dates without a year">
              <input
                className={inputClass}
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseNumberInput(e.target.value, year))}
              />
            </Field>
          </div>
          <Field label="Extracted text (or paste transaction text)">
            <textarea
              className={`${inputClass} my-3`}
              rows={6}
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className={secondaryClass}
            disabled={busy || !text.trim()}
            onClick={() => {
              setRows(parseStatement(text, year));
              setError("");
            }}
          >
            Build review rows
          </button>
          {busy && (
            <p role="status" className="my-3 text-sm">
              {status}
            </p>
          )}
          {!busy && text && !rows.length && (
            <p className="my-3 text-sm text-amber-700">
              No amounts recognised. Correct the text above and build the review
              rows again.
            </p>
          )}
          <div className="my-5 space-y-3">
            {rows.map((r, i) => (
              <section
                key={r.id}
                className="rounded-xl border border-[#EAE2D6] p-3"
              >
                <label className="mb-3 flex min-h-11 items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => edit(r.id, "selected", e.target.checked)}
                  />
                  Import row {i + 1}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`Date · row ${i + 1}`}>
                    <input
                      className={inputClass}
                      type="date"
                      value={r.date}
                      onChange={(e) => edit(r.id, "date", e.target.value)}
                    />
                  </Field>
                  <Field label={`Amount (RM) · row ${i + 1}`}>
                    <input
                      className={inputClass}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={r.amount}
                      onChange={(e) => edit(r.id, "amount", e.target.value)}
                    />
                  </Field>
                  <Field label={`Description · row ${i + 1}`}>
                    <input
                      className={inputClass}
                      value={r.item}
                      onChange={(e) => edit(r.id, "item", e.target.value)}
                    />
                  </Field>
                  <Field label={`Category · row ${i + 1}`}>
                    <select
                      className={inputClass}
                      value={r.category}
                      onChange={(e) => edit(r.id, "category", e.target.value)}
                    >
                      {Object.values(Category).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  {r.warning}
                  {existingKeys.has(
                    `${r.date}|${Math.round(Number(r.amount || 0) * 100)}|${r.item.trim().toLowerCase()}`,
                  )
                    ? " · Possible existing duplicate"
                    : ""}
                </p>
              </section>
            ))}
          </div>
          {error && (
            <p role="alert" className="mb-3 text-sm text-[#A83E20]">
              {error}
            </p>
          )}
          <button
            type="button"
            className={primaryClass}
            disabled={busy || !rows.some((r) => r.selected)}
            onClick={save}
          >
            Import {rows.filter((r) => r.selected).length} reviewed expenses
          </button>
        </Dialog>
      )}
    </>
  );
}
