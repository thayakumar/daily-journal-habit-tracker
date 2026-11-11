import { Plus, Trash2, Check, Inbox } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  localDate,
  uid,
  wishlistExpired,
  type ItemKind,
  type Workspace,
} from "./model";
export type Update = (change: (previous: Workspace) => Workspace) => void;
export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100";
export const primaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed";
export const secondaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50";
export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-9 text-center text-sm text-slate-500">
      <Inbox className="h-6 w-6 text-slate-300" />
      {children}
    </div>
  );
}
export function Delete({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
export function Circle({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${checked ? "border-rose-500 bg-rose-500 text-white shadow-sm" : "border-slate-200 bg-white text-transparent hover:border-rose-400"}`}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-slate-500">
      {label}
      {children}
    </label>
  );
}
export function ListPanel({
  kind,
  title,
  subtitle,
  data,
  update,
  today,
  month,
}: {
  kind: ItemKind;
  title: string;
  subtitle: string;
  data: Workspace;
  update: Update;
  today: string;
  month?: string;
}) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState<"active" | "done" | "archived">(
    "active",
  );
  const all = data.items.filter(
    (i) => i.kind === kind && (!month || i.month === month),
  );
  const items = all.filter((i) =>
    filter === "archived"
      ? wishlistExpired(i, today)
      : !wishlistExpired(i, today) && i.done === (filter === "done"),
  );
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    update((s) => ({
      ...s,
      items: [
        ...s.items,
        {
          id: uid(),
          kind,
          text: text.trim(),
          done: false,
          created: localDate(),
          due,
          ...(month ? { month } : {}),
        },
      ],
    }));
    setText("");
    setDue("");
  };
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {all.filter((i) => i.done).length}/{all.length} done
        </span>
      }
    >
      <form onSubmit={add} className="mb-5 flex flex-wrap gap-2">
        <input
          aria-label={`New ${title.toLowerCase()} item`}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add something to your list…"
          className={`${inputClass} min-w-40 flex-1`}
        />
        {["work", "personal"].includes(kind) && (
          <input
            aria-label="Due date"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={`${inputClass} !w-auto`}
          />
        )}
        <button className={primaryClass} disabled={!text.trim()}>
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
      <div className="mb-4 flex gap-2">
        {(
          [
            "active",
            "done",
            ...(kind === "wishlist" ? ["archived"] : []),
          ] as const
        ).map((f) => (
          <button
            type="button"
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f as typeof filter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-rose-50 text-rose-600" : "text-slate-500 hover:bg-slate-50"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {items.length ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <Circle
                checked={item.done}
                label={`Mark ${item.text} ${item.done ? "incomplete" : "complete"}`}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    items: s.items.map((i) =>
                      i.id === item.id ? { ...i, done: !i.done } : i,
                    ),
                  }))
                }
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`break-words text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}
                >
                  {item.text}
                </p>
                {item.due && (
                  <p
                    className={`mt-1 text-xs ${item.due < today && !item.done ? "text-rose-600" : "text-slate-400"}`}
                  >
                    Due {item.due}
                  </p>
                )}
                {kind === "wishlist" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Saved {item.created}
                    {filter === "archived"
                      ? " · 30-day review"
                      : " · archives after 30 days"}
                  </p>
                )}
              </div>
              <Delete
                label={`Delete ${item.text}`}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    items: s.items.filter((i) => i.id !== item.id),
                  }))
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          {filter === "done"
            ? "Completed items will appear here."
            : filter === "archived"
              ? "Wishlist items move here after 30 days. Nothing is permanently removed."
              : "A little space for what comes next."}
        </Empty>
      )}
    </Card>
  );
}
