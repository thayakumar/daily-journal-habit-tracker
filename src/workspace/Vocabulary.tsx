import { useEffect, useRef, useState } from "react";
import { BookOpen, Plus, Pencil, Search, X } from "lucide-react";
import { isConfigured } from "../lib/sheets-api";
import { uid, type VocabularyEntry, type Workspace } from "./model";
import {
  Card,
  Delete,
  Empty,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";
const BLANK = { word: "", definition: "", example: "" };
export function Vocabulary({
  data,
  update,
  storageReady = true,
}: {
  data: Workspace;
  update: Update;
  storageReady?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<"newest" | "az">("newest"),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState(BLANK),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null),
    firstInput = useRef<HTMLInputElement>(null),
    returnFocus = useRef<HTMLElement | null>(null);
  const entries = (data.vocabulary ?? [])
    .filter((e) =>
      `${e.word} ${e.definition} ${e.example}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "az"
        ? a.word.localeCompare(b.word)
        : b.createdAt.localeCompare(a.createdAt),
    );
  function close() {
    setOpen(false);
  }
  function show(entry?: VocabularyEntry) {
    returnFocus.current = document.activeElement as HTMLElement;
    setEditing(entry?.id ?? null);
    setDraft(
      entry
        ? {
            word: entry.word,
            definition: entry.definition,
            example: entry.example,
          }
        : BLANK,
    );
    setError("");
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    firstInput.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const controls = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input,textarea,select,[tabindex="0"]',
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", key);
      returnFocus.current?.focus();
    };
  }, [open]);
  return (
    <div className="space-y-5">
      <Card
        title="Your word collection"
        subtitle="Keep new words, their meanings and an example you can remember."
        action={
          <button className={primaryClass} onClick={() => show()}>
            <Plus className="h-4 w-4" />
            Add word
          </button>
        }
      >
        {isConfigured() && !storageReady && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            Vocabulary is saved on this device. The latest connection update is
            needed to sync words to Google Sheets.
          </p>
        )}
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Field label="Search vocabulary">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  aria-label="Search vocabulary"
                  className={`${inputClass} !pl-9`}
                  placeholder="Search words, meanings or examples…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </Field>
          </div>
          <Field label="Sort">
            <select
              aria-label="Sort vocabulary"
              className={inputClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="newest">Newest first</option>
              <option value="az">A–Z</option>
            </select>
          </Field>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          {entries.length} of {(data.vocabulary ?? []).length} words
        </p>
        {entries.length ? (
          <div className="max-w-full overflow-x-auto">
            <table
              aria-label="Vocabulary list"
              className="block w-full border-collapse text-sm md:table"
            >
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th scope="col" className="p-3">
                    Word
                  </th>
                  <th scope="col" className="p-3">
                    Definition
                  </th>
                  <th scope="col" className="p-3">
                    Example usage
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="mb-4 block rounded-xl border border-slate-200 p-1 md:mb-0 md:table-row md:rounded-none md:border-x-0 md:border-t-0"
                  >
                    <th
                      scope="row"
                      className="block min-w-0 break-words p-3 text-left font-semibold text-slate-800 md:table-cell md:w-[18%] md:align-top"
                    >
                      {entry.word}
                    </th>
                    <td className="block min-w-0 p-3 pt-0 md:table-cell md:w-[32%] md:pt-3 md:align-top">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:hidden">
                        Definition
                      </span>
                      <p className="whitespace-pre-wrap break-words text-slate-600 [overflow-wrap:anywhere]">
                        {entry.definition}
                      </p>
                    </td>
                    <td className="block min-w-0 p-3 pt-0 md:table-cell md:w-[36%] md:pt-3 md:align-top">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:hidden">
                        Example usage
                      </span>
                      <p className="whitespace-pre-wrap break-words text-slate-500 [overflow-wrap:anywhere]">
                        {entry.example}
                      </p>
                    </td>
                    <td className="block p-2 md:table-cell md:align-top">
                      <div className="flex justify-end gap-1">
                        <button
                          aria-label={`Edit ${entry.word}`}
                          title={`Edit ${entry.word}`}
                          className={secondaryClass}
                          onClick={() => show(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="md:sr-only">Edit</span>
                        </button>
                        <Delete
                          label={`Delete ${entry.word}`}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete “${entry.word}” from your vocabulary?`,
                              )
                            )
                              update((s) => ({
                                ...s,
                                vocabulary: (s.vocabulary ?? []).filter(
                                  (v) => v.id !== entry.id,
                                ),
                              }));
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {query
              ? "No words match your search."
              : "Your vocabulary starts with one word. Choose Add word to get started."}
          </Empty>
        )}
      </Card>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vocabulary-dialog-title"
            aria-describedby="vocabulary-dialog-description"
            className="max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2
                  id="vocabulary-dialog-title"
                  className="flex items-center gap-2 font-semibold text-slate-900"
                >
                  <BookOpen className="h-5 w-5 text-rose-500" />
                  {editing ? "Edit word" : "Add a new word"}
                </h2>
                <p
                  id="vocabulary-dialog-description"
                  className="mt-1 text-sm text-slate-500"
                >
                  All three fields help make the word stick.
                </p>
              </div>
              <button
                aria-label="Close vocabulary popup"
                className={secondaryClass}
                onClick={close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const clean = {
                  word: draft.word.trim(),
                  definition: draft.definition.trim(),
                  example: draft.example.trim(),
                };
                if (!clean.word || !clean.definition || !clean.example) {
                  setError("Enter the word, its definition and an example.");
                  return;
                }
                if (
                  (data.vocabulary ?? []).some(
                    (v) =>
                      v.id !== editing &&
                      v.word.toLocaleLowerCase() ===
                        clean.word.toLocaleLowerCase(),
                  )
                ) {
                  setError(
                    "This word is already in your list. Edit the existing entry instead.",
                  );
                  return;
                }
                const now = new Date().toISOString();
                const id = editing ?? uid();
                update((s) => ({
                  ...s,
                  vocabulary: editing
                    ? (s.vocabulary ?? []).map((v) =>
                        v.id === editing
                          ? { ...v, ...clean, updatedAt: now }
                          : v,
                      )
                    : [
                        { id, ...clean, createdAt: now, updatedAt: now },
                        ...(s.vocabulary ?? []),
                      ],
                }));
                close();
              }}
            >
              <Field label="New vocabulary word">
                <input
                  ref={firstInput}
                  aria-label="Vocabulary word"
                  required
                  maxLength={200}
                  autoComplete="off"
                  className={inputClass}
                  placeholder="e.g. Serendipity"
                  value={draft.word}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, word: e.target.value }))
                  }
                />
              </Field>
              <Field label="Definition">
                <textarea
                  aria-label="Vocabulary definition"
                  required
                  rows={3}
                  maxLength={5000}
                  className={inputClass}
                  placeholder="What does it mean?"
                  value={draft.definition}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, definition: e.target.value }))
                  }
                />
              </Field>
              <Field label="Example usage">
                <textarea
                  aria-label="Vocabulary example usage"
                  required
                  rows={3}
                  maxLength={5000}
                  className={inputClass}
                  placeholder="Use the word in a sentence…"
                  value={draft.example}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, example: e.target.value }))
                  }
                />
              </Field>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
                >
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={close}
                >
                  Cancel
                </button>
                <button className={primaryClass}>
                  {editing ? "Save changes" : "Save word"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
