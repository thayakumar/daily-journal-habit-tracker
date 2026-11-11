import { useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react";
import type { JournalBridge } from "../App";
import {
  addDays,
  recurrenceDue,
  uid,
  weekDates,
  type Workspace,
} from "./model";
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

export function Habits({
  data,
  update,
  journal,
  today,
  openJournal,
}: {
  data: Workspace;
  update: Update;
  journal: JournalBridge | null;
  today: string;
  openJournal: () => void;
}) {
  const [week, setWeek] = useState(today);
  const [name, setName] = useState("");
  const [interval, setIntervalDays] = useState(7);
  const [lastDone, setLastDone] = useState(today);
  const dates = weekDates(week);
  async function enableNotifications() {
    if (!("Notification" in window)) {
      alert(
        "This browser does not support notifications. Your in-app reminders still work.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      alert(
        permission === "granted"
          ? "Notifications enabled. Keep this app open for timed reminders."
          : "Notifications were not enabled. You can change this in your browser settings.",
      );
    } catch {
      alert("Notifications are unavailable in this browser.");
    }
  }
  return (
    <div className="space-y-5">
      <Card
        title="Daily habits"
        subtitle="The same coloured circles as your journal, with a little more room to see your week."
        action={
          <button className={secondaryClass} onClick={openJournal}>
            Manage in journal
          </button>
        }
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <button
            aria-label="Previous week"
            className={secondaryClass}
            onClick={() => setWeek(addDays(week, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="text-sm font-medium text-slate-600"
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
        {!journal ? (
          <Empty>Loading your journal habits…</Empty>
        ) : !journal.habits.length ? (
          <Empty>Add your first habit in the journal to get started.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className="pb-4 text-left text-xs font-medium text-slate-400">
                    Habit
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d}
                      className={`pb-4 text-center text-xs font-medium ${d === today ? "text-rose-600" : "text-slate-400"}`}
                    >
                      {new Date(`${d}T12:00`).toLocaleDateString("en", {
                        weekday: "short",
                      })}
                      <span className="mt-1 block">{d.slice(8)}</span>
                    </th>
                  ))}
                  <th className="pb-4 text-xs font-medium text-slate-400">
                    Week
                  </th>
                </tr>
              </thead>
              <tbody>
                {journal.habits.map((h) => {
                  const count = dates.filter((d) =>
                    journal.rows.some((r) => r.dateStr === d && r.habits[h.id]),
                  ).length;
                  return (
                    <tr key={h.id} className="border-t border-slate-100">
                      <td className="py-4 pr-4">
                        <span
                          className={`mb-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${h.lightBg}`}
                        >
                          {h.name}
                        </span>
                        <input
                          aria-label={`Reminder for ${h.name}`}
                          type="time"
                          value={data.reminders[h.id] || ""}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              reminders: {
                                ...s.reminders,
                                [h.id]: e.target.value,
                              },
                            }))
                          }
                          className="block rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500"
                        />
                      </td>
                      {dates.map((d) => {
                        const checked = !!journal.rows.find(
                          (r) => r.dateStr === d,
                        )?.habits[h.id];
                        return (
                          <td key={d} className="px-1 py-3">
                            <button
                              aria-label={`${h.name} on ${d}`}
                              aria-pressed={checked}
                              disabled={d > today}
                              onClick={() => journal.toggleDay(d, h.id)}
                              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${checked ? `${h.color} text-white` : "border-slate-200 bg-white text-slate-400 hover:border-rose-400"}`}
                            >
                              {checked ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-center text-xs font-semibold text-slate-500">
                        {count}/7
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button className={secondaryClass} onClick={enableNotifications}>
            <Bell className="h-4 w-4" />
            Allow reminders
          </button>
          <p className="text-xs text-slate-400">
            Timed reminders work while this app is open. Clear a time to disable
            it.
          </p>
        </div>
      </Card>
      <Card
        title="Not-daily habits"
        subtitle="For things you do every few days or weeks. Set an interval and mark it done to restart the countdown."
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
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Change bedsheets"
              maxLength={200}
              required
            />
          </Field>
          <Field label="Every N days">
            <input
              type="number"
              min="1"
              max="3650"
              required
              className={inputClass}
              value={interval}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
            />
          </Field>
          <Field label="Last completed">
            <input
              type="date"
              required
              max={today}
              className={inputClass}
              value={lastDone}
              onChange={(e) => setLastDone(e.target.value)}
            />
          </Field>
          <button className={primaryClass}>
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
        {data.recurring.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.recurring.map((h) => {
              const remaining = recurrenceDue(h, today);
              return (
                <div
                  key={h.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-slate-800">{h.name}</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Every {h.interval} days · last done {h.lastDone}
                      </p>
                    </div>
                    <Delete
                      label={`Delete ${h.name}`}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          recurring: s.recurring.filter((i) => i.id !== h.id),
                        }))
                      }
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${remaining <= 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {remaining < 0
                        ? `${Math.abs(remaining)} days overdue`
                        : remaining === 0
                          ? "Due today"
                          : `Due in ${remaining} days`}
                    </span>
                    <button
                      className={secondaryClass}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          recurring: s.recurring.map((i) =>
                            i.id === h.id ? { ...i, lastDone: today } : i,
                          ),
                        }))
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Done today
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>No recurring habits yet. Start with one small routine.</Empty>
        )}
        {!data.recurring.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["Change bedsheets", 7],
              ["Water plants", 3],
              ["Clean fridge", 14],
            ].map(([n, d]) => (
              <button
                key={n}
                className={secondaryClass}
                onClick={() => {
                  setName(String(n));
                  setIntervalDays(Number(d));
                }}
              >
                {n} · {d}d
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
