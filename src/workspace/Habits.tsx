import { useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {(journal?.habits ?? []).map((h) => (
        <div
          key={h.id}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3"
        >
          <button
            type="button"
            aria-label={`${h.name} today`}
            aria-pressed={!!row?.habits[h.id]}
            onClick={() => journal?.toggleDay(today, h.id)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm ${row?.habits[h.id] ? `${h.color} text-white` : "border-slate-200 text-slate-300"}`}
          >
            {row?.habits[h.id] ? "✓" : ""}
          </button>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-slate-700">
              {h.name}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Daily{data.reminders[h.id] ? ` · ${data.reminders[h.id]}` : ""}
            </p>
          </div>
        </div>
      ))}
      {recurring.map((h) => {
        const done = recurringDone(data, h.id, today);
        const canUndo = (data.recurringChecks ?? []).some(
          (c) => c.habitId === h.id && c.date === today,
        );
        return (
          <div
            key={h.id}
            className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/50"}`}
          >
            <Circle
              checked={done}
              label={`${done ? "Undo" : "Complete"} ${h.name} today`}
              onClick={() => {
                if (done && !canUndo) return;
                const id = uid();
                update((s) => toggleRecurring(s, h.id, today, id));
              }}
            />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-slate-700">
                {h.name}
              </p>
              <p
                className={`mt-1 text-xs ${done ? "text-emerald-600" : "text-amber-700"}`}
              >
                {done
                  ? "Completed today"
                  : recurrenceDue(h, today) < 0
                    ? "Overdue · due today"
                    : "Due today"}{" "}
                · every {h.interval} days
              </p>
            </div>
          </div>
        );
      })}
      {!journal?.habits.length && !recurring.length && (
        <Empty>Nothing due today. Add a habit below to get started.</Empty>
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
  const [week, setWeek] = useState(today),
    [name, setName] = useState(""),
    [interval, setIntervalDays] = useState(7),
    [lastDone, setLastDone] = useState(today),
    [dailyName, setDailyName] = useState(""),
    [color, setColor] = useState(0);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const dates = weekDates(week);
  async function enableNotifications() {
    if (!("Notification" in window)) {
      alert("Notifications are unavailable in this browser.");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      alert(
        p === "granted"
          ? "Reminders enabled while this app is open."
          : "Notifications were not enabled.",
      );
    } catch {
      alert("Notifications are unavailable in this browser.");
    }
  }
  return (
    <div className="space-y-5">
      <Card
        title="Today’s habits"
        subtitle="Daily habits and recurring routines due today, together. Overdue routines stay here until completed."
      >
        <TodayHabits
          data={data}
          update={update}
          journal={journal}
          today={today}
        />
      </Card>
      <Card
        title="Customize daily habits"
        subtitle="Add, rename, recolour or remove habits here. Existing checkmarks stay attached to the same habit."
        action={
          <span role="status" className="text-xs text-slate-500">
            {journal?.saveStatus ?? "Loading habits…"}
          </span>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!dailyName.trim() || !journal) return;
            journal.addHabit(dailyName, color);
            setDailyName("");
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
            disabled={!journal || !dailyName.trim()}
            className={primaryClass}
          >
            <Plus className="h-4 w-4" />
            Add habit
          </button>
        </form>
        <div className="space-y-3">
          {journal?.habits.map((h) => {
            const c = Math.max(
              0,
              COLOR_OPTIONS.findIndex((t) => t.color === h.color),
            );
            return (
              <div
                key={h.id}
                className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_120px_130px_auto]"
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
                    )
                      journal.removeHabit(h.id, h.name);
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={secondaryClass} onClick={enableNotifications}>
            <Bell className="h-4 w-4" />
            Allow reminders
          </button>
          {journal && (
            <button
              className={secondaryClass}
              onClick={() => void journal.sync()}
            >
              Sync habits
            </button>
          )}
        </div>
      </Card>
      <Card
        title="Weekly habit history"
        subtitle="Check any past day to update it. On a small screen, swipe the week horizontally."
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            aria-label="Previous week"
            className={secondaryClass}
            onClick={() => setWeek(addDays(week, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="text-xs font-medium text-slate-500"
            onClick={() => setWeek(today)}
          >
            {dates[0]} — {dates[6]}
          </button>
          <button
            aria-label="Next week"
            className={secondaryClass}
            onClick={() => setWeek(addDays(week, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[550px] text-sm">
            <thead>
              <tr>
                <th className="pb-3 text-left text-xs text-slate-400">Habit</th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className="pb-3 text-xs font-medium text-slate-400"
                  >
                    {new Date(`${d}T12:00`).toLocaleDateString("en", {
                      weekday: "short",
                    })}
                    <span className="block">{d.slice(8)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journal?.habits.map((h) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex max-w-[170px] break-words rounded-xl border px-2 py-1 text-xs ${h.lightBg}`}
                    >
                      {h.name}
                    </span>
                  </td>
                  {dates.map((d) => {
                    const checked = !!journal.rows.find((r) => r.dateStr === d)
                      ?.habits[h.id];
                    return (
                      <td key={d} className="px-1 py-3">
                        <button
                          aria-label={`${h.name} on ${d}`}
                          aria-pressed={checked}
                          disabled={d > today}
                          onClick={() => journal.toggleDay(d, h.id)}
                          className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 disabled:opacity-30 ${checked ? `${h.color} text-white` : "border-slate-200"}`}
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
      <Card
        title="Recurring routines"
        subtitle="Set how often it repeats. When the interval is reached, it automatically joins today’s habits."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
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
          }}
          className="mb-5 grid items-end gap-3 sm:grid-cols-[1fr_110px_160px_auto]"
        >
          <Field label="Habit">
            <input
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
              onChange={(e) => setIntervalDays(Number(e.target.value))}
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
          <button className={primaryClass}>
            <Plus className="h-4 w-4" />
            Add routine
          </button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {data.recurring.map((h) => {
            const due = recurrenceDue(h, today);
            return (
              <div
                key={h.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-medium text-slate-700">
                    {h.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Every {h.interval} days · last done {h.lastDone}
                  </p>
                  <p
                    className={`mt-2 text-xs font-semibold ${due <= 0 ? "text-amber-700" : "text-emerald-600"}`}
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
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
