import { Dialog } from "./Dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { COLOR_OPTIONS, type JournalBridge } from "../App";
import {
  addDays,
  recurrenceDue,
  recurringDone,
  todayRecurring,
  toggleRecurring,
  uid,
  weekDates,
  type Workspace,
} from "./model";
import {
  Card,
  Circle,
  Delete,
  Empty,
  Field,
  inputClass,
  parseNumberInput,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";

export function TodayHabits({
  data,
  update,
  journal,
  today,
}: {
  data: Workspace;
  update: Update;
  journal: JournalBridge | null;
  today: string;
}) {
  const row = journal?.rows.find((r) => r.dateStr === today);
  const recurring = todayRecurring(data, today);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!journal && (
        <p
          role="status"
          className="col-span-full rounded-xl bg-[#FAF7F2] px-4 py-6 text-center text-sm text-[#6E6358]"
        >
          Loading habits…
        </p>
      )}
      {(journal?.habits ?? []).map((h) => {
        const isChecked = !!row?.habits[h.id];
        return (
          <div
            key={h.id}
            className={`flex min-w-0 items-center gap-3.5 rounded-2xl border p-3.5 transition-colors duration-150 ${
              isChecked
                ? "border-[#E8B8A9] bg-[#FBECE7]/50"
                : "border-[#E7DDD0] bg-[#FAF7F2]/65 hover:border-[#D6C8B6] hover:bg-white"
            }`}
          >
            <button
              type="button"
              aria-label={`${h.name} today`}
              aria-pressed={isChecked}
              onClick={() => journal?.toggleDay(today, h.id)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition duration-150 active:scale-95 ${
                isChecked
                  ? `${h.color} text-white shadow-xs`
                  : "border-[#D6C8B6] bg-white text-transparent hover:border-[#D95D39]"
              }`}
            >
              {isChecked ? "✓" : ""}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${h.color.split(" ")[0]}`}
                />
                <p
                  className={`break-words text-sm font-semibold ${
                    isChecked
                      ? "text-[#5C5248] line-through"
                      : "text-[#24201D]"
                  }`}
                >
                  {h.name}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-[#6E6358]">
                {isChecked ? "Done today" : "Daily"}
                {data.reminders[h.id] ? ` · ${data.reminders[h.id]}` : ""}
              </p>
            </div>
          </div>
        );
      })}
      {recurring.map((h) => {
        const done = recurringDone(data, h.id, today);
        const canUndo = (data.recurringChecks ?? []).some(
          (c) => c.habitId === h.id && c.date === today,
        );
        return (
          <div
            key={h.id}
            className={`flex min-w-0 items-center gap-3 rounded-xl border p-3.5 ${done ? "border-[#CFE0D7] bg-[#F1F6F3]" : "border-[#EFE0BE] bg-[#FBF6EA]"}`}
          >
            {done && !canUndo ? (
              <span
                aria-label={`${h.name} logged today`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#5C8D78] bg-[#5C8D78] text-xs font-bold text-white">
                  ✓
                </span>
              </span>
            ) : (
              <Circle
                checked={done}
                label={`${done ? "Undo" : "Complete"} ${h.name} today`}
                onClick={() => {
                  const id = uid();
                  update((s) => toggleRecurring(s, h.id, today, id));
                }}
              />
            )}
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-[#24201D]">
                {h.name}
              </p>
              <p
                className={`mt-0.5 text-xs ${done ? "text-[#3F6B57]" : "text-[#9A6F25]"}`}
              >
                {done
                  ? canUndo
                    ? "Completed today"
                    : "Logged today"
                  : recurrenceDue(h, today) < 0
                    ? "Overdue · due today"
                    : "Due today"}{" "}
                · every {h.interval} days
              </p>
            </div>
          </div>
        );
      })}
      {journal && !journal.habits.length && !recurring.length && (
        <div className="col-span-full">
          <Empty>
            Nothing due today. Use the add buttons above to get started.
          </Empty>
        </div>
      )}
    </div>
  );
}

export function Habits({
  data,
  update,
  journal,
  today,
}: {
  data: Workspace;
  update: Update;
  journal: JournalBridge | null;
  today: string;
}) {
  const [week, setWeek] = useState(today);
  const prevToday = useRef(today);
  useEffect(() => {
    if (prevToday.current !== today) {
      if (week === prevToday.current) setWeek(today);
      prevToday.current = today;
    }
  }, [today, week]);

  const [name, setName] = useState("");
  const [interval, setIntervalDays] = useState(7);
  const [lastDone, setLastDone] = useState(today);
  const [dailyName, setDailyName] = useState("");
  const [color, setColor] = useState(0);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<"daily" | "routine" | null>(null);
  const [notice, setNotice] = useState("");
  const dates = useMemo(() => weekDates(week), [week]);
  const todayRow = journal?.rows.find((r) => r.dateStr === today);
  const dueRecurring = useMemo(() => todayRecurring(data, today), [data, today]);
  const todayTotal = (journal?.habits.length ?? 0) + dueRecurring.length;
  const todayDone =
    (journal?.habits.filter((h) => !!todayRow?.habits[h.id]).length ?? 0) +
    dueRecurring.filter((h) => recurringDone(data, h.id, today)).length;
  const weekLabel = useMemo(() => {
    const start = new Date(`${dates[0]}T12:00`);
    const end = new Date(`${dates[6]}T12:00`);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startFmt = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
    const endFmt = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${startFmt} – ${endFmt}`;
  }, [dates]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, Record<string, boolean>>();
    for (const r of journal?.rows ?? []) {
      map.set(r.dateStr, r.habits);
    }
    return map;
  }, [journal?.rows]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotice("Notifications are unavailable in this browser.");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotice(
        p === "granted"
          ? "Reminders enabled while this app is open."
          : "Notifications were not enabled.",
      );
    } catch {
      setNotice("Notifications are unavailable in this browser.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="clay-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={primaryClass}
            onClick={() => {
              setDailyName("");
              setColor(0);
              setAdding("daily");
            }}
          >
            <Plus className="h-4 w-4" />
            Add daily habit
          </button>
          <button
            type="button"
            className={secondaryClass}
            onClick={() => {
              setName("");
              setIntervalDays(7);
              setLastDone(today);
              setAdding("routine");
            }}
          >
            <Plus className="h-4 w-4" />
            Add recurring routine
          </button>
        </div>
        {journal && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              role="status"
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                journal.syncState === "error"
                  ? "border-[#E3A694] bg-[#FBECE7] text-[#9A381D]"
                  : journal.syncState === "syncing"
                    ? "border-[#E5CF9E] bg-[#FDF6E7] text-[#8C5A12]"
                    : "border-[#E4DBCE] bg-[#FAF7F2] text-[#5C5248]"
              }`}
            >
              {journal.saveStatus}
            </span>
            <button
              type="button"
              className={secondaryClass}
              onClick={() => void journal.sync()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync habits
            </button>
          </div>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-[#EAE2D6] bg-white px-4 py-3 text-sm text-[#4C433B]"
        >
          {notice}
        </p>
      )}

      {adding && (
        <Dialog
          title={
            adding === "daily" ? "Add daily habit" : "Add recurring routine"
          }
          onClose={() => setAdding(null)}
        >
          {adding === "daily" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!dailyName.trim() || !journal) return;
                journal.addHabit(dailyName, color);
                setDailyName("");
                setAdding(null);
              }}
              className="mb-5 flex flex-wrap items-end gap-3"
            >
              <div className="min-w-40 flex-1">
                <Field label="New daily habit">
                  <input
                    aria-label="New daily habit"
                    required
                    maxLength={200}
                    className={inputClass}
                    placeholder="Read, water, vitamins…"
                    value={dailyName}
                    onChange={(e) => setDailyName(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Colour">
                <select
                  aria-label="New habit colour"
                  className={inputClass}
                  value={color}
                  onChange={(e) => setColor(Number(e.target.value))}
                >
                  {COLOR_OPTIONS.map((c, i) => (
                    <option key={c.name} value={i}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="submit"
                disabled={!journal || !dailyName.trim()}
                className={primaryClass}
              >
                <Plus className="h-4 w-4" />
                Add habit
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !name.trim() ||
                  !Number.isInteger(interval) ||
                  interval < 1 ||
                  interval > 3650 ||
                  !lastDone ||
                  lastDone > today
                )
                  return;
                update((s) => ({
                  ...s,
                  recurring: [
                    ...s.recurring,
                    {
                      id: uid(),
                      name: name.trim(),
                      interval,
                      lastDone,
                      reminder: "",
                    },
                  ],
                }));
                setName("");
                setAdding(null);
              }}
              className="mb-5 grid items-end gap-3 sm:grid-cols-[1fr_110px_160px_auto]"
            >
              <Field label="Habit">
                <input
                  aria-label="Habit"
                  required
                  placeholder="Change bedsheets"
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Every N days">
                <input
                  required
                  type="number"
                  min="1"
                  max="3650"
                  className={inputClass}
                  value={interval}
                  onChange={(e) =>
                    setIntervalDays(parseNumberInput(e.target.value, interval))
                  }
                />
              </Field>
              <Field label="Last completed">
                <input
                  required
                  type="date"
                  max={today}
                  className={inputClass}
                  value={lastDone}
                  onChange={(e) => setLastDone(e.target.value)}
                />
              </Field>
              <button type="submit" className={primaryClass}>
                <Plus className="h-4 w-4" />
                Add routine
              </button>
            </form>
          )}
        </Dialog>
      )}

      <Card
        title="Today’s habits"
        subtitle="Daily habits and recurring routines due today, together. Overdue routines stay here until completed."
        action={
          todayTotal > 0 ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${
                todayDone === todayTotal
                  ? "bg-[#E6F1EC] text-[#2F5B48]"
                  : "bg-[#FBECE7] text-[#A83E20]"
              }`}
            >
              {todayDone}/{todayTotal} done
            </span>
          ) : undefined
        }
      >
        <TodayHabits
          data={data}
          update={update}
          journal={journal}
          today={today}
        />
      </Card>

      <Card
        title="Weekly habit history"
        subtitle="Check any past day to update it. On a small screen, swipe the week horizontally."
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous week"
              className={secondaryClass}
              onClick={() => setWeek(addDays(week, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl px-3 text-xs font-semibold tabular-nums text-[#4C433B] transition-colors hover:bg-[#F3EDE3] hover:text-[#24201D]"
              onClick={() => setWeek(today)}
              title="Jump to current week"
            >
              {weekLabel}
            </button>
            <button
              type="button"
              aria-label="Next week"
              className={secondaryClass}
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[550px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="pb-3 text-left text-xs font-semibold text-[#6E6358]">
                  Habit
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className={`rounded-t-xl px-1 py-2 text-xs font-semibold ${
                      d === today
                        ? "bg-[#FBECE7]/60 text-[#A83E20]"
                        : "text-[#6E6358]"
                    }`}
                  >
                    {new Date(`${d}T12:00`).toLocaleDateString("en", {
                      weekday: "short",
                    })}
                    <span className="mt-0.5 block tabular-nums">
                      {d.slice(8)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journal?.habits.map((h) => (
                <tr key={h.id}>
                  <td className="border-t border-[#EFE8DC] py-3 pr-3">
                    <span
                      className={`inline-flex max-w-[170px] break-words rounded-xl border px-2.5 py-1 text-xs font-medium ${h.lightBg}`}
                    >
                      {h.name}
                    </span>
                  </td>
                  {dates.map((d) => {
                    const checked = !!rowsByDate.get(d)?.[h.id];
                    return (
                      <td
                        key={d}
                        className={`border-t border-[#EFE8DC] px-1 py-3 ${
                          d === today ? "bg-[#FBECE7]/35" : ""
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`${h.name} on ${d}`}
                          aria-pressed={checked}
                          disabled={d > today}
                          onClick={() => journal.toggleDay(d, h.id)}
                          className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 transition duration-150 active:scale-95 disabled:opacity-30 ${checked ? `${h.color} text-white shadow-xs` : "border-[#DDD2C3] bg-white hover:border-[#D95D39]"}`}
                        >
                          {checked ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <details className="clay-card rounded-2xl">
        <summary className="cursor-pointer p-5 text-sm font-semibold text-[#24201D]">
          Customize daily habits ({journal?.habits.length ?? 0})
        </summary>
        <div className="border-t border-[#EFE8DC] p-5">
          <p className="mb-4 text-sm text-[#62584E]">
            Rename, recolour, set reminders or remove habits here. Existing
            checkmarks stay attached to the same habit.
          </p>
          <div className="space-y-3">
            {journal?.habits.map((h) => {
              const c = Math.max(
                0,
                COLOR_OPTIONS.findIndex((t) => t.color === h.color),
              );
              return (
                <div
                  key={h.id}
                  className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-3 rounded-xl border border-[#EFE8DC] bg-[#FAF7F2]/50 p-3 sm:grid-cols-[1fr_120px_130px_auto]"
                >
                  <Field label="Name">
                    <input
                      aria-label={`Name for ${h.id}`}
                      className={inputClass}
                      value={draftNames[h.id] ?? h.name}
                      maxLength={200}
                      onChange={(e) =>
                        setDraftNames((previous) => ({
                          ...previous,
                          [h.id]: e.target.value,
                        }))
                      }
                      onBlur={(e) => {
                        if (e.target.value.trim())
                          journal.editHabit(h.id, e.target.value.trim(), c);
                        setDraftNames((previous) => {
                          const next = { ...previous };
                          delete next[h.id];
                          return next;
                        });
                      }}
                    />
                  </Field>
                  <Field label="Colour">
                    <select
                      aria-label={`Colour for ${h.name}`}
                      className={inputClass}
                      value={c}
                      onChange={(e) =>
                        journal.editHabit(h.id, h.name, Number(e.target.value))
                      }
                    >
                      {COLOR_OPTIONS.map((t, i) => (
                        <option key={t.name} value={i}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Reminder">
                    <input
                      aria-label={`Reminder for ${h.name}`}
                      type="time"
                      className={inputClass}
                      value={data.reminders[h.id] || ""}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          reminders: { ...s.reminders, [h.id]: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Delete
                    label={`Remove ${h.name}`}
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${h.name} from active habits? Its historical checkmarks remain in your backup.`,
                        )
                      ) {
                        journal.removeHabit(h.id, h.name);
                        update((s) => {
                          const nextReminders = { ...s.reminders };
                          delete nextReminders[h.id];
                          return { ...s, reminders: nextReminders };
                        });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={secondaryClass}
              onClick={enableNotifications}
            >
              <Bell className="h-4 w-4" />
              Allow reminders
            </button>
          </div>
        </div>
      </details>

      <details className="clay-card rounded-2xl">
        <summary className="cursor-pointer p-5 text-sm font-semibold text-[#24201D]">
          Recurring routines ({data.recurring.length})
        </summary>
        <div className="border-t border-[#EFE8DC] p-5">
          <p className="mb-4 text-sm text-[#62584E]">
            Set how often a routine repeats. When the interval is reached, it
            automatically joins today’s habits.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.recurring.map((h) => {
              const due = recurrenceDue(h, today);
              return (
                <div
                  key={h.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2]/60 p-4"
                >
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-[#24201D]">
                      {h.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#8C8073]">
                      Every {h.interval} days · last done {h.lastDone}
                    </p>
                    <p
                      className={`mt-2 text-xs font-semibold ${due <= 0 ? "text-[#9A6F25]" : "text-[#3F6B57]"}`}
                    >
                      {due < 0
                        ? `${-due} days overdue`
                        : due === 0
                          ? "Due today"
                          : `Due in ${due} days`}
                    </p>
                  </div>
                  <Delete
                    label={`Delete ${h.name}`}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        recurring: s.recurring.filter((r) => r.id !== h.id),
                        recurringChecks: (s.recurringChecks ?? []).filter(
                          (c) => c.habitId !== h.id,
                        ),
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
