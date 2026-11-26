import { useState } from "react";
import { Plus, Pencil, Search } from "lucide-react";
import { isConfigured } from "../lib/sheets-api";
import { Dialog } from "./Dialog";
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
  return (
    <div className="space-y-5">
      <Card
        title="Your word collection"
        subtitle="Keep new words, their meanings and an example you can remember."
        action={
          <button
            type="button"
            className={primaryClass}
            onClick={() => show()}
          >
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
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#6E6358]" />
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
        <p className="mb-4 text-xs tabular-nums text-[#6E6358]">
          {entries.length} of {(data.vocabulary ?? []).length} words
        </p>
        {entries.length ? (
          <div className="max-w-full overflow-x-auto">
            <table
              aria-label="Vocabulary list"
              className="block w-full border-collapse text-sm md:table"
            >
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-[#EAE2D6] text-left text-xs text-[#6E6358]">
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
                    className="mb-4 block rounded-xl border border-[#EAE2D6] p-1 md:mb-0 md:table-row md:rounded-none md:border-x-0 md:border-t-0"
                  >
                    <th
                      scope="row"
                      className="block min-w-0 break-words p-3 text-left font-semibold text-[#24201D] md:table-cell md:w-[18%] md:align-top"
                    >
                      {entry.word}
                    </th>
                    <td className="block min-w-0 p-3 pt-0 md:table-cell md:w-[32%] md:pt-3 md:align-top">
                      <span className="mb-1 block text-xs font-medium text-[#6E6358] md:hidden">
                        Definition
                      </span>
                      <p className="whitespace-pre-wrap break-words text-[#4C433B] [overflow-wrap:anywhere]">
                        {entry.definition}
                      </p>
                    </td>
                    <td className="block min-w-0 p-3 pt-0 md:table-cell md:w-[36%] md:pt-3 md:align-top">
                      <span className="mb-1 block text-xs font-medium text-[#6E6358] md:hidden">
                        Example usage
                      </span>
                      <p className="whitespace-pre-wrap break-words text-[#4C433B] [overflow-wrap:anywhere]">
                        {entry.example}
                      </p>
                    </td>
                    <td className="block p-2 md:table-cell md:align-top">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
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
        <Dialog
          title={editing ? "Edit word" : "Add a new word"}
          onClose={close}
        >
          <p className="mb-4 text-sm text-[#5C5248]">
            All three fields help make the word stick.
          </p>
          <form
            className="space-y-4"
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
              update((s) => {
                const list = s.vocabulary ?? [];
                if (editing) {
                  const exists = list.some((v) => v.id === editing);
                  return {
                    ...s,
                    vocabulary: exists
                      ? list.map((v) =>
                          v.id === editing
                            ? { ...v, ...clean, updatedAt: now }
                            : v,
                        )
                      : [{ id, ...clean, createdAt: now, updatedAt: now }, ...list],
                  };
                }
                return {
                  ...s,
                  vocabulary: [
                    { id, ...clean, createdAt: now, updatedAt: now },
                    ...list,
                  ],
                };
              });
              close();
            }}
          >
            <Field label={editing ? "Vocabulary word" : "New vocabulary word"}>
              <input
                data-autofocus
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
                className="rounded-xl bg-[#FBECE7] p-3 text-sm text-[#A83E20]"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-[#EFE8DC] pt-4">
              <button
                type="button"
                className={secondaryClass}
                onClick={close}
              >
                Cancel
              </button>
              <button type="submit" className={primaryClass}>
                {editing ? "Save changes" : "Save word"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
