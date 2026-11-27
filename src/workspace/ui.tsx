import { Plus, Trash2, Check, RefreshCw } from "lucide-react";
import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { ClayObject, type ClayAssetName } from "./clayAssets";
import {
  localDate,
  uid,
  wishlistExpired,
  type ItemKind,
  type Workspace,
} from "./model";
export type Update = (change: (previous: Workspace) => Workspace) => void;
export function parseNumberInput(raw: string, fallback = 0): number {
  if (raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
export class RoomErrorBoundary extends Component<
  { roomName: string; children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Something went wrong rendering this room.",
    };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RoomErrorBoundary:${this.props.roomName}]`, error, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="clay-card rounded-2xl p-6 text-center">
        <h2 className="font-display text-lg font-semibold text-[#24201D]">
          {this.props.roomName} ran into a display error
        </h2>
        <p className="mt-2 text-sm text-[#62584E]">{this.state.message}</p>
        <p className="mt-1 text-xs text-[#8C8073]">
          Your saved data is safe. Try reloading this room or switching tabs.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false, message: "" })}
          className={`${primaryClass} mt-4`}
        >
          <RefreshCw className="h-4 w-4" />
          Retry {this.props.roomName}
        </button>
      </section>
    );
  }
}
export const inputClass =
  "w-full rounded-xl border border-[#DFD5C6] bg-white px-3.5 py-2.5 text-sm text-[#24201D] placeholder:text-[#7C7064] shadow-[inset_0_1px_2px_rgba(58,44,32,0.03)] outline-none transition-colors focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7]";
export const primaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#D95D39] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(217,93,57,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] transition duration-150 hover:bg-[#C04C2B] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
export const secondaryClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DFD5C6] bg-white px-3.5 py-2 text-sm font-medium text-[#3B342E] shadow-[0_1px_2px_rgba(58,44,32,0.04)] transition duration-150 hover:border-[#CFC1AE] hover:bg-[#FAF7F2] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
export const compactPrimaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#D95D39] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_6px_-2px_rgba(217,93,57,0.45)] transition duration-150 hover:bg-[#C04C2B] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
export const compactSecondaryClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DFD5C6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3B342E] shadow-[0_1px_2px_rgba(58,44,32,0.04)] transition duration-150 hover:border-[#CFC1AE] hover:bg-[#FAF7F2] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

export function SectionHeader({
  title,
  count,
  action,
  accent = "clay",
  className = "",
}: {
  title: string;
  count?: string | number;
  action?: ReactNode;
  accent?: "clay" | "sage";
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-4 w-1 shrink-0 rounded-full ${accent === "sage" ? "bg-[#356651]" : "bg-[#D95D39]"}`}
        />
        <h2 className="font-display truncate text-[15px] font-bold text-[#24201D] sm:text-base">
          {title}
        </h2>
        {count !== undefined && (
          <span className="rounded-full bg-[#EFE8DC] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#5C5248]">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

export function RoomSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div className="clay-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <div className="clay-skeleton h-9 w-28 rounded-xl" />
          <div className="clay-skeleton h-9 w-28 rounded-xl" />
          <div className="clay-skeleton h-9 w-20 rounded-xl" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="clay-skeleton h-16 rounded-xl" />
          <div className="clay-skeleton h-16 rounded-xl" />
          <div className="clay-skeleton h-16 rounded-xl" />
        </div>
      </div>
      <div className="clay-card rounded-2xl p-4 sm:p-5">
        <div className="clay-skeleton h-5 w-40 rounded-lg" />
        <div className="mt-3 space-y-2.5">
          <div className="clay-skeleton h-11 rounded-xl" />
          <div className="clay-skeleton h-11 rounded-xl" />
          <div className="clay-skeleton h-11 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  compact = false,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={`clay-card rounded-2xl ${className}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-2.5 border-b border-[#EFE8DC] ${
          compact
            ? "px-4 py-3 sm:px-5 sm:py-3.5"
            : "px-4 py-3.5 sm:px-5 sm:py-4"
        }`}
      >
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-[#24201D] sm:text-lg">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-[#5C5248] sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className={compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}
export function Empty({
  children,
  variant = "desk",
  asset,
  borderless = false,
  compact = false,
}: {
  children: ReactNode;
  variant?: "desk" | "mind";
  asset?: ClayAssetName;
  borderless?: boolean;
  compact?: boolean;
}) {
  const name = asset ?? (variant === "mind" ? "empty-mind" : "empty-desk");
  const isWide = name === "empty-desk" || name === "empty-mind";
  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-xs text-[#5C5248] sm:text-sm ${borderless ? "bg-transparent" : "border border-[#EDE5D9] bg-[#FAF7F2]"}`}
      >
        <ClayObject name={name} className="h-11 w-11 shrink-0" />
        <div className="min-w-0 leading-relaxed">{children}</div>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col items-center gap-2.5 rounded-2xl px-5 py-6 text-center text-sm text-[#62584E] ${borderless ? "bg-transparent" : "border border-[#EDE5D9] bg-[#FAF7F2]"}`}
    >
      <ClayObject
        name={name}
        className={isWide ? "h-18 w-28" : "h-16 w-16"}
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
      className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl p-2 text-[#8C8073] transition hover:bg-[#FBECE7] hover:text-[#C04C2B]"
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
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${checked ? "border-[#D95D39] bg-[#D95D39] text-white shadow-sm" : "border-[#DDD2C3] bg-white text-transparent hover:border-[#D95D39]"}`}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
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
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-[#5C5248]">
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
  const activeCount = all.filter(
    (i) => !wishlistExpired(i, today) && !i.done,
  ).length;
  const doneCount = all.filter(
    (i) => !wishlistExpired(i, today) && i.done,
  ).length;
  const archivedCount = all.filter((i) => wishlistExpired(i, today)).length;
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
    if (filter !== "active") setFilter("active");
  };
  const emptyActiveCopy: Record<ItemKind, string> = {
    personal: "No open errands or appointments.",
    wishlist: "Nothing parked on your 30-day wishlist yet.",
    grocery: "Your grocery list is clear for the next run.",
    watch: "No books, shows, or films queued yet.",
    work: "No work tasks listed right now.",
    goal: "No goals added for this month yet.",
  };
  const showDue = ["work", "personal"].includes(kind);
  const countMap = {
    active: activeCount,
    done: doneCount,
    archived: archivedCount,
  };
  return (
    <Card
      compact
      title={title}
      subtitle={subtitle}
      action={
        <span className="rounded-full bg-[#F3EDE3] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#5C5248]">
          {doneCount}/{all.length} done
        </span>
      }
    >
      <form onSubmit={add} className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            aria-label={`New ${title.toLowerCase()} item`}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add an item…"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="submit"
            className={`${primaryClass} shrink-0 px-3.5`}
            disabled={!text.trim()}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {showDue && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#6E6358]">Due</span>
            <input
              aria-label="Due date"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="min-h-9 rounded-xl border border-[#DFD5C6] bg-[#FAF7F2] px-2.5 py-1.5 text-xs font-medium text-[#24201D] outline-none focus:border-[#D95D39] focus:bg-white focus:ring-2 focus:ring-[#FBECE7]"
            />
          </div>
        )}
      </form>
      <div className="mb-3 flex gap-1 border-b border-[#EFE8DC]">
        {(
          (kind === "wishlist"
            ? ["active", "done", "archived"]
            : ["active", "done"]) as ("active" | "done" | "archived")[]
        ).map((f) => {
          const isSelected = filter === f;
          return (
            <button
              type="button"
              key={f}
              aria-pressed={isSelected}
              onClick={() => setFilter(f)}
              className={`relative min-h-10 px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                isSelected
                  ? "text-[#D95D39]"
                  : "text-[#6E6358] hover:text-[#24201D]"
              }`}
            >
              {f}{" "}
              <span className="ml-0.5 tabular-nums opacity-75">
                ({countMap[f]})
              </span>
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#D95D39]"
                />
              )}
            </button>
          );
        })}
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#EFE8DC]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 py-2">
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
                    className={`mt-0.5 text-xs tabular-nums ${item.due < today && !item.done ? "font-medium text-[#C04C2B]" : "text-[#6E6358]"}`}
                  >
                    Due {item.due}
                  </p>
                )}
                {kind === "wishlist" && (
                  <p className="mt-0.5 text-xs text-[#6E6358]">
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
          compact
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
