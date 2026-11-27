import { useState } from "react";
import { Plus, Pencil, Search } from "lucide-react";
import { isConfigured } from "../lib/sheets-api";
import { Dialog } from "./Dialog";
import { uid, type VocabularyEntry, type Workspace } from "./model";
import {
  Delete,
  Empty,
  Field,
  SectionHeader,
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
    <div className="space-y-4">
      {/* Compact Single-Row Control Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-36 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6E6358]" />
          <input
            aria-label="Search vocabulary"
            className="min-h-10 w-full rounded-xl border border-[#DFD5C6] bg-white py-2 pl-9 pr-3 text-xs text-[#24201D] placeholder:text-[#7C7064] shadow-xs outline-none transition-colors focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7] sm:text-sm"
            placeholder="Search words, meanings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Sort vocabulary"
          className="min-h-10 rounded-xl border border-[#DFD5C6] bg-white px-2.5 py-2 text-xs font-semibold text-[#3B342E] shadow-xs outline-none focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7] sm:text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="newest">Newest first</option>
          <option value="az">A–Z</option>
        </select>
        <button
          type="button"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#D95D39] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition duration-150 hover:bg-[#C04C2B] sm:text-sm"
          onClick={() => show()}
        >
          <Plus className="h-4 w-4" />
          Add word
        </button>
      </div>

      {isConfigured() && !storageReady && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800"
        >
          Vocabulary is saved on this device. The latest connection update is
          needed to sync words to Google Sheets.
        </p>
      )}

      <SectionHeader
        title="Lexicon"
        count={`${entries.length} of ${(data.vocabulary ?? []).length}`}
      />

      {entries.length ? (
        <div className="max-w-full overflow-x-auto md:clay-card md:rounded-2xl">
          <table
            aria-label="Vocabulary list"
            className="block w-full border-collapse text-sm md:table"
          >
            <thead className="hidden bg-[#FAF7F2] md:table-header-group">
              <tr className="border-b border-[#EAE2D6] text-left text-xs font-semibold text-[#6E6358]">
                <th scope="col" className="px-4 py-3">
                  Word
                </th>
                <th scope="col" className="px-4 py-3">
                  Definition
                </th>
                <th scope="col" className="px-4 py-3">
                  Example usage
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="block space-y-2.5 md:table-row-group md:space-y-0">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="clay-card block rounded-2xl p-3.5 md:table-row md:rounded-none md:border-0 md:border-b md:border-[#EFE8DC] md:bg-transparent md:p-0 md:shadow-none"
                >
                  <th
                    scope="row"
                    className="block min-w-0 break-words font-display text-base font-bold text-[#24201D] md:table-cell md:w-[18%] md:px-4 md:py-3 md:align-top md:font-sans md:text-sm md:font-semibold"
                  >
                    {entry.word}
                  </th>
                  <td className="mt-1.5 block min-w-0 md:mt-0 md:table-cell md:w-[32%] md:px-4 md:py-3 md:align-top">
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#3B342E] [overflow-wrap:anywhere] sm:text-sm">
                      {entry.definition}
                    </p>
                  </td>
                  <td className="mt-2 block min-w-0 md:mt-0 md:table-cell md:w-[36%] md:px-4 md:py-3 md:align-top">
                    <p className="whitespace-pre-wrap break-words border-l-2 border-[#E8B8A9] pl-2.5 text-xs italic leading-relaxed text-[#5C5248] [overflow-wrap:anywhere] md:border-l-0 md:pl-0 md:not-italic sm:text-sm">
                      {entry.example}
                    </p>
                  </td>
                  <td className="mt-2.5 block border-t border-[#EFE8DC] pt-2 md:mt-0 md:table-cell md:border-t-0 md:px-4 md:py-2 md:align-top">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${entry.word}`}
                        title={`Edit ${entry.word}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#DFD5C6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3B342E] hover:bg-[#FAF7F2]"
                        onClick={() => show(entry)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
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
        <div className="clay-card rounded-2xl p-4">
          <Empty compact asset="vocabulary">
            {query
              ? "No words match your search."
              : "Your vocabulary starts with one word. Choose Add word to get started."}
          </Empty>
        </div>
      )}
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
