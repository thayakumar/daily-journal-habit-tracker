import { useState } from "react";
import { ArrowRight, ExternalLink, Plus, Send } from "lucide-react";
import { safeUrl, uid, type Workspace } from "./model";
import {
  Card,
  Delete,
  Empty,
  Field,
  SectionHeader,
  inputClass,
  primaryClass,
  type Update,
} from "./ui";
export function BrainDump({
  data,
  update,
}: {
  data: Workspace;
  update: Update;
}) {
  const [text, setText] = useState("");
  const ordered = [...data.thoughts].reverse();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Instant Top Capture Bar */}
      <form
        className="clay-card flex items-end gap-2.5 rounded-2xl p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          update((s) => ({
            ...s,
            thoughts: [
              ...s.thoughts,
              {
                id: uid(),
                text: text.trim(),
                created: new Date().toISOString(),
              },
            ],
          }));
          setText("");
        }}
      >
        <textarea
          aria-label="New thought"
          className={`${inputClass} resize-none`}
          rows={2}
          maxLength={10000}
          placeholder="Write down what’s on your mind…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Add thought"
          className={`${primaryClass} shrink-0`}
          disabled={!text.trim()}
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      <SectionHeader
        title="Recent thoughts"
        count={`${data.thoughts.length} ${data.thoughts.length === 1 ? "note" : "notes"}`}
      />

      {ordered.length ? (
        <div className="space-y-2.5">
          {ordered.map((t) => (
            <article
              key={t.id}
              className="clay-card flex items-start gap-2 rounded-2xl p-3.5 sm:p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#24201D]">
                  {t.text}
                </p>
                <time
                  className="mt-1.5 block text-[11px] tabular-nums text-[#6E6358]"
                  dateTime={t.created}
                >
                  {new Date(t.created).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <Delete
                label="Delete thought"
                onClick={() =>
                  update((s) => ({
                    ...s,
                    thoughts: s.thoughts.filter((i) => i.id !== t.id),
                  }))
                }
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="clay-card rounded-2xl p-4">
          <Empty compact variant="mind">
            Nothing scribbled down yet. Drop your first note above.
          </Empty>
        </div>
      )}
    </div>
  );
}
export function Ideas({ data, update }: { data: Workspace; update: Update }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card compact title="Save an idea">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            if (url && !safeUrl(url)) {
              setError("Please enter a full http:// or https:// link.");
              return;
            }
            setError("");
            update((s) => ({
              ...s,
              ideas: [
                ...s.ideas,
                { id: uid(), title: title.trim(), url, note },
              ],
            }));
            setTitle("");
            setUrl("");
            setNote("");
          }}
        >
          <Field label="Idea">
            <input
              aria-label="Idea"
              className={inputClass}
              required
              maxLength={300}
              placeholder="Something worth coming back to"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Link (optional)">
            <input
              aria-label="Link (optional)"
              type="url"
              className={inputClass}
              placeholder="https://…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
            />
          </Field>
          <Field label="Notes">
            <textarea
              aria-label="Notes"
              rows={2}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did this catch your eye?"
            />
          </Field>
          {error && (
            <p role="alert" className="text-xs font-medium text-[#A83E20]">
              {error}
            </p>
          )}
          <button type="submit" className={`${primaryClass} w-full sm:w-auto`}>
            <Plus className="h-4 w-4" />
            Save idea
          </button>
        </form>
      </Card>

      <div className="min-w-0 space-y-3">
        <SectionHeader
          title="Saved ideas"
          count={`${data.ideas.length} ${data.ideas.length === 1 ? "note" : "notes"}`}
        />
        {data.ideas.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.ideas.map((i) => (
              <article
                key={i.id}
                className="clay-card flex flex-col justify-between rounded-2xl p-3.5 sm:p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="break-words font-display text-sm font-bold text-[#24201D]">
                      {i.title}
                    </h3>
                    <Delete
                      label={`Delete ${i.title}`}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          ideas: s.ideas.filter((item) => item.id !== i.id),
                        }))
                      }
                    />
                  </div>
                  {i.note && (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-[#5C5248]">
                      {i.note}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DC] pt-2.5">
                  {safeUrl(i.url) ? (
                    <a
                      href={safeUrl(i.url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[180px] items-center gap-1 text-xs font-semibold text-[#D95D39] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{i.url}</span>
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[#DFD5C6] bg-[#FAF7F2] px-2.5 py-1 text-xs font-semibold text-[#3B342E] transition-colors hover:bg-white"
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        ideas: s.ideas.filter((item) => item.id !== i.id),
                        thoughts: [
                          ...s.thoughts,
                          {
                            id: uid(),
                            text: [i.title, i.note, i.url]
                              .filter(Boolean)
                              .join("\n"),
                            created: new Date().toISOString(),
                          },
                        ],
                      }))
                    }
                  >
                    Move to brain dump
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="clay-card rounded-2xl p-4">
            <Empty compact asset="ideas">
              Found something interesting? Save it here for later.
            </Empty>
          </div>
        )}
      </div>
    </div>
  );
}
