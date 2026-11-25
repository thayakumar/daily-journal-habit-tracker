import { Plus, Trash2, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ClayObject, type ClayAssetName } from "./clayAssets";
import {
  localDate,
  uid,
  wishlistExpired,
  type ItemKind,
  type Workspace,
} from "./model";
export type Update = (change: (previous: Workspace) => Workspace) => void;
export const inputClass =
  "w-full rounded-xl border border-[#E4DBCE] bg-white px-3.5 py-2.5 text-sm text-[#24201D] placeholder:text-[#9D9083] outline-none transition focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7]";
export const primaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#D95D39] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#C04C2B] disabled:opacity-50 disabled:cursor-not-allowed";
export const secondaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E4DBCE] bg-white px-3.5 py-2 text-sm font-medium text-[#473F38] transition hover:border-[#D5C9B9] hover:bg-[#F6F1E9]";
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
    <section className={`clay-card rounded-2xl ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFE8DC] p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#24201D]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#62584E]">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
export function Empty({
  children,
  variant = "desk",
  asset,
  borderless = false,
}: {
  children: ReactNode;
  variant?: "desk" | "mind";
  asset?: ClayAssetName;
  borderless?: boolean;
}) {
  const name = asset ?? (variant === "mind" ? "empty-mind" : "empty-desk");
  const isWide = name === "empty-desk" || name === "empty-mind";
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center text-sm text-[#62584E] ${borderless ? "bg-transparent" : "border border-[#EDE5D9] bg-[#FAF7F2]"}`}
    >
      <ClayObject
        name={name}
        className={isWide ? "h-24 w-36" : "h-20 w-20"}
      />
      <div className="max-w-sm leading-relaxed">{children}</div>
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
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl p-2 text-[#8C8073] transition hover:bg-[#FBECE7] hover:text-[#C04C2B]"
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
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${checked ? "border-[#D95D39] bg-[#D95D39] text-white shadow-sm" : "border-[#DDD2C3] bg-white text-transparent hover:border-[#D95D39]"}`}
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
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#62584E]">
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
  const emptyActiveCopy: Record<ItemKind, string> = {
    personal: "No open errands or appointments.",
    wishlist: "Nothing parked on your 30-day wishlist yet.",
    grocery: "Your grocery list is clear for the next run.",
    watch: "No books, shows, or films queued yet.",
    work: "No work tasks listed right now.",
    goal: "No goals added for this month yet.",
  };
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        <span className="rounded-lg bg-[#F3EDE3] px-2.5 py-1 text-xs font-semibold text-[#62584E]">
          {all.filter((i) => i.done).length}/{all.length} done
        </span>
      }
    >
      <form onSubmit={add} className="mb-4 flex flex-wrap gap-2">
        <input
          aria-label={`New ${title.toLowerCase()} item`}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item…"
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
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "bg-[#FBECE7] text-[#B84727]" : "text-[#62584E] hover:bg-[#F3EDE3]"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#EFE8DC]">
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
                  className={`break-words text-sm ${item.done ? "text-[#9D9083] line-through" : "text-[#24201D]"}`}
                >
                  {item.text}
                </p>
                {item.due && (
                  <p
                    className={`mt-1 text-xs ${item.due < today && !item.done ? "font-medium text-[#C04C2B]" : "text-[#8C8073]"}`}
                  >
                    Due {item.due}
                  </p>
                )}
                {kind === "wishlist" && (
                  <p className="mt-1 text-xs text-[#8C8073]">
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
        <Empty
          asset={
            kind === "wishlist"
              ? "finance"
              : kind === "grocery"
                ? "meals"
                : kind === "watch"
                  ? "vocabulary"
                  : "empty-desk"
          }
        >
          {filter === "done"
            ? "Completed items will appear here."
            : filter === "archived"
              ? "Wishlist items move here after 30 days. Nothing is permanently removed."
              : emptyActiveCopy[kind]}
        </Empty>
      )}
    </Card>
  );
}
