import { useState } from "react";
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
  return (
    <Card
      title="A little room for your mind"
      subtitle="No structure needed. Drop a thought and clear some space."
      action={
        <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600">
          {data.thoughts.length} thoughts
        </span>
      }
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 max-h-[55vh] space-y-4 overflow-y-auto rounded-xl bg-slate-50/50 p-3 sm:p-5">
          {data.thoughts.length ? (
            data.thoughts.map((t) => (
              <article
                key={t.id}
                className="ml-auto max-w-[94%] rounded-2xl rounded-br-sm border border-rose-100 bg-rose-50 p-4"
              >
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                  {t.text}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <time
                    className="text-[10px] text-slate-400"
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
            <Empty>What’s on your mind? Your first thought goes here.</Empty>
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
            placeholder="Type a thought. It doesn’t have to be a good one…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className={primaryClass} disabled={!text.trim()}>
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
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
      <Card
        title="Keep a spark"
        subtitle="Save ideas with a link and a little context."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            if (url && !safeUrl(url)) {
              alert("Please enter a full http:// or https:// link.");
              return;
            }
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
              type="url"
              className={inputClass}
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={4}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did this catch your eye?"
            />
          </Field>
          <button className={primaryClass}>
            <Plus className="h-4 w-4" />
            Save idea
          </button>
        </form>
      </Card>
      <Card
        title="Your collection"
        subtitle={`${data.ideas.length} sparks saved for later`}
      >
        {data.ideas.length ? (
          <div className="space-y-3">
            {data.ideas.map((i) => (
              <article
                key={i.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="break-words text-sm font-semibold text-slate-700">
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
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">
                    {i.note}
                  </p>
                )}
                {safeUrl(i.url) && (
                  <a
                    href={safeUrl(i.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{i.url}</span>
                  </a>
                )}
                <div className="mt-3">
                  <button
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
          <Empty>Found something interesting? Save it here.</Empty>
        )}
      </Card>
    </div>
  );
}
