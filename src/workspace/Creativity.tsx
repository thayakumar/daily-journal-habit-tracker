import { useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink, Plus, Send } from "lucide-react";
import { safeUrl, uid, type Workspace } from "./model";
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
export function BrainDump({
  data,
  update,
}: {
  data: Workspace;
  update: Update;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(data.thoughts.length);
  useEffect(() => {
    if (data.thoughts.length > prevCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    prevCount.current = data.thoughts.length;
  }, [data.thoughts.length]);
  return (
    <Card
      title="Brain dump"
      subtitle="No structure needed. Drop a note and clear some space."
      action={
        <span className="rounded-lg bg-[#F3EDE3] px-2.5 py-1 text-xs font-semibold text-[#62584E]">
          {data.thoughts.length} thoughts
        </span>
      }
    >
      <div className="mx-auto max-w-3xl">
        <div
          ref={listRef}
          className="mb-6 max-h-[55vh] space-y-4 overflow-y-auto rounded-2xl bg-[#FAF7F2] p-3 sm:p-6"
        >
          {data.thoughts.length ? (
            data.thoughts.map((t) => (
              <article
                key={t.id}
                className="ml-auto max-w-[94%] rounded-2xl rounded-br-sm border border-[#EAE2D6] bg-white p-4 shadow-xs"
              >
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#24201D]">
                  {t.text}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <time
                    className="text-[11px] text-[#8C8073]"
                    dateTime={t.created}
                  >
                    {new Date(t.created).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <div className="flex items-center gap-2">
                    <Delete
                      label="Delete thought"
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          thoughts: s.thoughts.filter((i) => i.id !== t.id),
                        }))
                      }
                    />
                  </div>
                </div>
              </article>
            ))
          ) : (
            <Empty variant="mind" borderless>
              Nothing scribbled down yet. Drop your first note below.
            </Empty>
          )}
        </div>
        <form
          className="flex items-end gap-3"
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
            className={inputClass}
            rows={3}
            maxLength={10000}
            placeholder="Write down what’s on your mind…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Add thought"
            className={primaryClass}
            disabled={!text.trim()}
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
      </div>
    </Card>
  );
}
export function Ideas({ data, update }: { data: Workspace; update: Update }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <Card
        title="Save an idea"
        subtitle="Keep a link and a few lines of context for later."
      >
        <form
          className="space-y-4"
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
              rows={4}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did this catch your eye?"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-[#A83E20]">
              {error}
            </p>
          )}
          <button type="submit" className={primaryClass}>
            <Plus className="h-4 w-4" />
            Save idea
          </button>
        </form>
      </Card>
      <Card
        title="Saved ideas"
        subtitle={`${data.ideas.length} ${data.ideas.length === 1 ? "note" : "notes"} on the shelf`}
      >
        {data.ideas.length ? (
          <div className="space-y-3">
            {data.ideas.map((i) => (
              <article
                key={i.id}
                className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2]/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="break-words text-sm font-semibold text-[#24201D]">
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
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#62584E]">
                    {i.note}
                  </p>
                )}
                {safeUrl(i.url) && (
                  <a
                    href={safeUrl(i.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-[#D95D39] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{i.url}</span>
                  </a>
                )}
                <div className="mt-3">
                  <button
                    type="button"
                    className={secondaryClass}
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
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>Found something interesting? Save it here for later.</Empty>
        )}
      </Card>
    </div>
  );
}
