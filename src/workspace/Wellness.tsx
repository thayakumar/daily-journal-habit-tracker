import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Plus,
} from "lucide-react";
import {
  addDays,
  daysBetween,
  uid,
  weekDates,
  type MealDay,
  type Workspace,
} from "./model";
import {
  Card,
  Circle,
  Field,
  ListPanel,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";
export function Prayer({
  data,
  update,
  today,
}: {
  data: Workspace;
  update: Update;
  today: string;
}) {
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const checks = data.prayer.checks[date] ?? Array<boolean>(5).fill(false);
  const monthChecks = Object.entries(data.prayer.checks).filter(([d]) =>
    d.startsWith(month),
  );
  const done = monthChecks.reduce(
    (sum, [, c]) => sum + c.filter(Boolean).length,
    0,
  );
  return (
    <div className="space-y-5">
      <Card
        title="Prayer & reflection"
        subtitle="A quiet space to stay consistent. Enter the prayer times you follow; these are manual times, not location-based calculations."
        action={
          <input
            aria-label="Prayer date"
            type="date"
            max={today}
            className={`${inputClass} !w-auto`}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.prayer.names.map((name, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 ${checks[i] ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/30"}`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  {name}
                </span>
                <Circle
                  checked={checks[i]}
                  label={`${name} on ${date}`}
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      prayer: {
                        ...s.prayer,
                        checks: {
                          ...s.prayer.checks,
                          [date]: checks.map((c, j) => (j === i ? !c : c)),
                        },
                      },
                    }))
                  }
                />
              </div>
              <Field label="Prayer time">
                <input
                  aria-label={`${name} time`}
                  type="time"
                  className={inputClass}
                  value={data.prayer.times[i]}
                  onChange={(e) =>
                    update((s) => ({
                      ...s,
                      prayer: {
                        ...s.prayer,
                        times: s.prayer.times.map((t, j) =>
                          j === i ? e.target.value : t,
                        ),
                      },
                    }))
                  }
                />
              </Field>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${checks.filter(Boolean).length * 20}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {checks.filter(Boolean).length}/5 completed
          </span>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card title="Monthly consistency" subtitle="Every small act counts.">
          <Field label="Month">
            <input
              type="month"
              value={month}
              required
              className={inputClass}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </Field>
          <p className="mt-5 text-4xl font-bold tracking-tight text-slate-900">
            {done}
            <span className="ml-2 text-sm font-normal text-slate-400">
              prayers logged
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Across {monthChecks.filter(([, c]) => c.some(Boolean)).length} days
            this month.
          </p>
          <div className="mt-5 space-y-2">
            {[
              "Read for 10 minutes daily",
              "Practice one act of kindness",
              "Make time for reflection",
            ].map((t) => (
              <button
                key={t}
                className="block w-full rounded-xl border border-slate-200 p-3 text-left text-xs text-slate-500 hover:border-rose-200 hover:bg-rose-50"
                onClick={() =>
                  update((s) => ({
                    ...s,
                    items: [
                      ...s.items,
                      {
                        id: uid(),
                        kind: "goal",
                        text: t,
                        done: false,
                        created: today,
                        due: "",
                        month,
                      },
                    ],
                  }))
                }
              >
                + {t}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Optional starter ideas. Choose one or two, or write your own.
          </p>
        </Card>
        <ListPanel
          key={month}
          kind="goal"
          title="Monthly goals"
          subtitle="A couple of intentions for this month. Make them your own."
          data={data}
          update={update}
          today={today}
          month={month}
        />
      </div>
    </div>
  );
}
export function Fitness({
  data,
  update,
  today,
}: {
  data: Workspace;
  update: Update;
  today: string;
}) {
  const f = data.fitness,
    total = f.weeks * 7,
    elapsed = Math.max(0, daysBetween(f.start, today));
  const started = today >= f.start;
  const current = Math.min(total, elapsed + 1);
  const thisWeek = weekDates(today);
  const count = thisWeek.filter((d) => f.completed.includes(d)).length;
  const dayIndex = (new Date(`${today}T12:00`).getDay() + 6) % 7;
  const completed = f.completed.includes(today);
  return (
    <div className="space-y-5">
      <Card
        title="Your training, your pace"
        subtitle="An editable weekly template for gym, cardio, swimming and rest. Adjust every session to your own programme."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Programme start">
            <input
              type="date"
              required
              className={inputClass}
              value={f.start}
              onChange={(e) => {
                if (e.target.value)
                  update((s) => ({
                    ...s,
                    fitness: { ...s.fitness, start: e.target.value },
                  }));
              }}
            />
          </Field>
          <Field label="Programme length (weeks)">
            <input
              type="number"
              min="1"
              max="104"
              className={inputClass}
              value={f.weeks}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= 104)
                  update((s) => ({
                    ...s,
                    fitness: { ...s.fitness, weeks: n },
                  }));
              }}
            />
          </Field>
          <Field label="Weekly session target">
            <input
              type="number"
              min="1"
              max="7"
              className={inputClass}
              value={f.target}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= 7)
                  update((s) => ({
                    ...s,
                    fitness: { ...s.fitness, target: n },
                  }));
              }}
            />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">
              {started ? `Day ${current}` : "Starting soon"}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {started
                  ? `of ${total} · ${Math.max(0, total - elapsed - 1)} days to go`
                  : f.start}
              </span>
            </p>
          </div>
          <button
            className={secondaryClass}
            onClick={() => {
              if (
                confirm(
                  "Restart the programme countdown from today? Your completed sessions will be kept.",
                )
              )
                update((s) => ({
                  ...s,
                  fitness: { ...s.fitness, start: today },
                }));
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Restart countdown
          </button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-rose-50">
          <div
            className="h-full rounded-full bg-rose-500"
            style={{
              width: `${started ? Math.min(100, ((elapsed + 1) / total) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            Math.max(1, Math.round(total / 3)),
            Math.max(1, Math.round(total / 2)),
            total,
          ].map((day, i) => (
            <div key={i} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-rose-500">
                Day {day} · {addDays(f.start, day - 1)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {
                  [
                    "Check in on your energy",
                    "Review your routine",
                    "Reflect on your progress",
                  ][i]
                }
              </p>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card
          title={`Today: ${f.schedule[dayIndex].title || "Your session"}`}
          subtitle={`${count} of ${f.target} sessions this week`}
        >
          <button
            className={`${completed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white`}
            aria-pressed={completed}
            onClick={() =>
              update((s) => ({
                ...s,
                fitness: {
                  ...s.fitness,
                  completed: completed
                    ? s.fitness.completed.filter((d) => d !== today)
                    : [...s.fitness.completed, today],
                },
              }))
            }
          >
            <Check className="h-4 w-4" />
            {completed ? "Done today · tap to undo" : "Mark today complete"}
          </button>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-500">
            {f.schedule[dayIndex].exercises ||
              "No exercises added. Edit today’s session in the weekly plan."}
          </p>
          <div className="mt-6 flex justify-between">
            {thisWeek.map((d) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${f.completed.includes(d) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
                >
                  {f.completed.includes(d) ? "✓" : d.slice(8)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(`${d}T12:00`).toLocaleDateString("en", {
                    weekday: "narrow",
                  })}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Weekly menu"
          subtitle="Open any day to edit the session, exercises, sets and reps."
        >
          <div className="divide-y divide-slate-100">
            {f.schedule.map((session, i) => (
              <details
                key={i}
                className="group py-3"
                open={i === dayIndex ? true : undefined}
              >
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  <span className="mr-2 text-slate-400">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </span>
                  {session.title || "Untitled session"}
                </summary>
                <div className="mt-4 space-y-3">
                  <Field label="Session name">
                    <input
                      className={inputClass}
                      value={session.title}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          fitness: {
                            ...s.fitness,
                            schedule: s.fitness.schedule.map((d, j) =>
                              j === i ? { ...d, title: e.target.value } : d,
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Exercises, sets & reps">
                    <textarea
                      rows={4}
                      className={inputClass}
                      value={session.exercises}
                      onChange={(e) =>
                        update((s) => ({
                          ...s,
                          fitness: {
                            ...s.fitness,
                            schedule: s.fitness.schedule.map((d, j) =>
                              j === i ? { ...d, exercises: e.target.value } : d,
                            ),
                          },
                        }))
                      }
                      placeholder="One exercise per line…"
                    />
                  </Field>
                </div>
              </details>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
const EMPTY_MEAL: MealDay = { breakfast: "", lunch: "", dinner: "", snack: "" };
export function Meals({
  data,
  update,
  today,
}: {
  data: Workspace;
  update: Update;
  today: string;
}) {
  const [week, setWeek] = useState(today);
  const [grocery, setGrocery] = useState("");
  const [added, setAdded] = useState(false);
  const dates = weekDates(week);
  return (
    <div className="space-y-5">
      <Card
        title="A week at your table"
        subtitle="Plan ahead here. Record what you actually ate in your daily journal."
        action={
          <div className="flex gap-1">
            <button
              aria-label="Previous meal week"
              className={secondaryClass}
              onClick={() => setWeek(addDays(week, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className={secondaryClass} onClick={() => setWeek(today)}>
              This week
            </button>
            <button
              aria-label="Next meal week"
              className={secondaryClass}
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <p className="mb-4 text-xs text-slate-400">
          {dates[0]} — {dates[6]} · saves as you type
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr>
                <th className="pb-3 text-left text-xs text-slate-400">Day</th>
                {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                  (meal) => (
                    <th
                      key={meal}
                      className="px-2 pb-3 text-left text-xs font-semibold capitalize text-slate-500"
                    >
                      {meal}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr key={d} className="border-t border-slate-100">
                  <td className="pr-3 align-top pt-5">
                    <p
                      className={`text-xs font-semibold ${d === today ? "text-rose-600" : "text-slate-700"}`}
                    >
                      {new Date(`${d}T12:00`).toLocaleDateString("en", {
                        weekday: "short",
                      })}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {d.slice(5)}
                    </p>
                  </td>
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                    (meal) => (
                      <td key={meal} className="p-2">
                        <textarea
                          rows={3}
                          aria-label={`${meal} for ${d}`}
                          className={`${inputClass} resize-y !bg-slate-50/50 !text-xs`}
                          placeholder="What sounds good?"
                          value={data.meals[d]?.[meal] ?? ""}
                          onChange={(e) =>
                            update((s) => ({
                              ...s,
                              meals: {
                                ...s.meals,
                                [d]: {
                                  ...EMPTY_MEAL,
                                  ...s.meals[d],
                                  [meal]: e.target.value,
                                },
                              },
                            }))
                          }
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card
        title="Shopping prep"
        subtitle="Add the ingredients you’ll need, one per line. They go straight into your Personal grocery list."
      >
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            const lines = grocery
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            if (!lines.length) return;
            update((s) => ({
              ...s,
              items: [
                ...s.items,
                ...lines.map((text) => ({
                  id: uid(),
                  text,
                  kind: "grocery" as const,
                  done: false,
                  created: today,
                  due: "",
                })),
              ],
            }));
            setGrocery("");
            setAdded(true);
          }}
        >
          <textarea
            aria-label="Ingredients, one per line"
            rows={3}
            className={inputClass}
            placeholder={"Eggs\nSpinach\nRice"}
            value={grocery}
            onChange={(e) => {
              setGrocery(e.target.value);
              setAdded(false);
            }}
          />
          <button
            className={`${primaryClass} shrink-0`}
            disabled={!grocery.trim()}
          >
            <Plus className="h-4 w-4" />
            Add to groceries
          </button>
        </form>
        {added && (
          <p role="status" className="mt-3 text-sm text-emerald-600">
            Added to your grocery list.
          </p>
        )}
      </Card>
    </div>
  );
}
