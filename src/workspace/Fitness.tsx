import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Dumbbell } from "lucide-react";
import { isConfigured } from "../lib/sheets-api";
import {
  addDays,
  uid,
  weekDates,
  workoutDates,
  type Workspace,
  type WorkoutSet,
} from "./model";
import {
  Card,
  Delete,
  Empty,
  Field,
  inputClass,
  parseNumberInput,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";

function SetNumberInput({
  label,
  value,
  step,
  integer = false,
  onCommit,
}: {
  label: string;
  value: string;
  step: string;
  integer?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function valid(val: string) {
    if (val === "") return true;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return false;
    if (integer && !Number.isInteger(n)) return false;
    return true;
  }

  return (
    <input
      aria-label={label}
      type="number"
      min="0"
      step={step}
      className={inputClass}
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        if (!valid(next)) return;
        setDraft(next);
        onCommit(next);
      }}
    />
  );
}

export function Fitness({
  data,
  update,
  today,
  logStorageReady = true,
}: {
  data: Workspace;
  update: Update;
  today: string;
  logStorageReady?: boolean;
}) {
  const [date, setDate] = useState(today);
  const prevToday = useRef(today);
  useEffect(() => {
    if (prevToday.current !== today) {
      if (date === prevToday.current) setDate(today);
      prevToday.current = today;
    }
  }, [today, date]);

  const [exercise, setExercise] = useState("");
  const [type, setType] = useState<"strength" | "cardio">("strength");
  const [count, setCount] = useState(3);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [reps, setReps] = useState("10");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDraft, setTargetDraft] = useState(String(data.fitness.target));

  useEffect(() => {
    setTargetDraft(String(data.fitness.target));
  }, [data.fitness.target]);

  const workoutSets = useMemo(
    () => data.workoutSets ?? [],
    [data.workoutSets],
  );
  const sets = useMemo(
    () => workoutSets.filter((s) => s.date === date),
    [workoutSets, date],
  );
  const groups = useMemo(() => {
    const ids = [...new Set(sets.map((s) => s.exerciseId))];
    return ids.map((id) =>
      sets
        .filter((s) => s.exerciseId === id)
        .sort((a, b) => a.setNumber - b.setNumber),
    );
  }, [sets]);

  const setCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of workoutSets) {
      counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    }
    return counts;
  }, [workoutSets]);

  const weekSet = useMemo(() => new Set(weekDates(date)), [date]);
  const days = useMemo(() => workoutDates(data).sort().reverse(), [data]);
  const daysThisWeek = useMemo(
    () => days.filter((d) => weekSet.has(d)).length,
    [days, weekSet],
  );

  function patch(id: string, fields: Partial<WorkoutSet>) {
    update((s) => ({
      ...s,
      workoutSets: (s.workoutSets ?? []).map((row) =>
        row.id === id ? { ...row, ...fields } : row,
      ),
    }));
  }

  const completed = data.fitness.completed.includes(date);

  return (
    <div className="space-y-4">
      {/* Compact Session Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-1.5 sm:flex-initial">
          <button
            type="button"
            aria-label="Previous workout day"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => setDate(addDays(date, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            aria-label="Workout date"
            required
            type="date"
            max={today}
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#24201D] shadow-xs outline-none focus:border-[#D95D39] focus:ring-4 focus:ring-[#FBECE7] sm:w-44 sm:flex-initial sm:text-sm"
            value={date}
            onChange={(e) => {
              if (e.target.value && e.target.value <= today)
                setDate(e.target.value);
            }}
          />
          <button
            type="button"
            aria-label="Next workout day"
            disabled={date >= today}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2] disabled:opacity-40"
            onClick={() => setDate(addDays(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="min-h-10 shrink-0 rounded-xl border border-[#DFD5C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => setDate(today)}
          >
            Today
          </button>
        </div>
        <button
          type="button"
          className={`min-h-10 w-full rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors sm:w-auto ${
            completed
              ? "border-[#CFE0D7] bg-[#ECF4F0] text-[#2F5B48]"
              : "border-[#DFD5C6] bg-white text-[#3B342E] hover:bg-[#FAF7F2]"
          }`}
          aria-pressed={completed}
          onClick={() =>
            update((s) => ({
              ...s,
              fitness: {
                ...s.fitness,
                completed: completed
                  ? s.fitness.completed.filter((d) => d !== date)
                  : [...s.fitness.completed, date],
              },
            }))
          }
        >
          {completed ? "✓ Session complete · undo" : "Mark session complete"}
        </button>
      </div>

      {isConfigured() && !logStorageReady && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800"
        >
          Workout logs are saved on this device. The latest connection update is
          needed to sync them to Google Sheets.
        </p>
      )}

      {/* Joined 3-Column Session KPI Strip + Slim Weekly Target Row */}
      <div className="clay-card overflow-hidden rounded-2xl">
        <div className="grid grid-cols-3 divide-x divide-[#EFE8DC]">
          {[
            { label: "Exercises", value: groups.length },
            {
              label: "Strength sets",
              value: sets.filter((s) => s.type === "strength").length,
            },
            {
              label: "Cardio min",
              value:
                Math.round(
                  sets
                    .filter((s) => s.type === "cardio")
                    .reduce(
                      (sum, s) => sum + Number(s.durationMinutes || 0),
                      0,
                    ) * 100,
                ) / 100,
            },
          ].map((m) => (
            <div key={m.label} className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
              <p className="truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
                {m.label}
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#24201D] sm:text-2xl">
                {m.value}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFE8DC] bg-[#FAF7F2]/70 px-3.5 py-2.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tabular-nums text-[#4C433B]">
              {daysThisWeek} training {daysThisWeek === 1 ? "day" : "days"} this
              week · target {data.fitness.target}
            </p>
            <div className="mt-1.5 h-1.5 max-w-xs overflow-hidden rounded-full bg-[#E7DDD0]">
              <div
                className="h-full rounded-full bg-[#356651] transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, Math.round((daysThisWeek / Math.max(1, data.fitness.target)) * 100))}%`,
                }}
              />
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#5C5248]">
            <span>Weekly target</span>
            <input
              aria-label="Weekly training-day target"
              className="min-h-9 w-16 rounded-xl border border-[#DFD5C6] bg-white px-2.5 py-1 text-center text-xs font-bold tabular-nums text-[#24201D] outline-none focus:border-[#D95D39] focus:ring-2 focus:ring-[#FBECE7]"
              type="number"
              min="1"
              max="7"
              step="1"
              value={targetDraft}
              onChange={(e) => {
                const next = e.target.value;
                setTargetDraft(next);
                const n = Number(next);
                if (next !== "" && Number.isInteger(n) && n >= 1 && n <= 7) {
                  update((s) => ({
                    ...s,
                    fitness: { ...s.fitness, target: n },
                  }));
                }
              }}
              onBlur={() => {
                const n = Number(targetDraft);
                if (
                  !targetDraft ||
                  !Number.isInteger(n) ||
                  n < 1 ||
                  n > 7
                ) {
                  setTargetDraft(String(data.fitness.target));
                }
              }}
            />
          </label>
        </div>
      </div>

      <Card
        title={`Exercises · ${date}`}
        subtitle="Your recorded sets for this day. Changes save automatically."
      >
        {groups.length ? (
          <div className="space-y-5">
            {groups.map((group) => {
              const first = group[0];
              return (
                <article
                  key={first.exerciseId}
                  className="min-w-0 rounded-2xl border border-[#EAE2D6] p-4"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-xl bg-[#FBECE7] p-2 text-[#D95D39]">
                      <Dumbbell className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-[#24201D]">
                        {first.exercise}
                      </h3>
                      <p className="mt-1 text-xs text-[#8C8073]">
                        {first.type === "strength"
                          ? `${group.length} sets`
                          : "Cardio"}{" "}
                        · {date}
                      </p>
                    </div>
                    <Delete
                      label={`Delete exercise ${first.exercise}`}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete all recorded sets for ${first.exercise} on ${date}?`,
                          )
                        )
                          update((s) => ({
                            ...s,
                            workoutSets: (s.workoutSets ?? []).filter(
                              (row) => row.exerciseId !== first.exerciseId,
                            ),
                          }));
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    {group.map((row) => (
                      <div key={row.id} className="rounded-xl bg-[#FAF7F2] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#62584E]">
                            {row.type === "strength"
                              ? `Set ${row.setNumber}`
                              : "Cardio session"}
                          </span>
                          <Delete
                            label={`Delete set ${row.setNumber} of ${row.exercise}`}
                            onClick={() =>
                              update((s) => ({
                                ...s,
                                workoutSets: (s.workoutSets ?? []).filter(
                                  (r) => r.id !== row.id,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div
                          className={`grid grid-cols-2 gap-3 ${row.type === "strength" ? "sm:grid-cols-3" : ""}`}
                        >
                          {row.type === "strength" ? (
                            <>
                              <Field label="Weight">
                                <SetNumberInput
                                  label={`Weight for ${row.exercise} set ${row.setNumber}`}
                                  step="any"
                                  value={row.weight}
                                  onCommit={(val) =>
                                    patch(row.id, { weight: val })
                                  }
                                />
                              </Field>
                              <Field label="Unit">
                                <select
                                  aria-label={`Unit for ${row.exercise} set ${row.setNumber}`}
                                  className={inputClass}
                                  value={row.unit}
                                  onChange={(e) =>
                                    patch(row.id, {
                                      unit: e.target.value as "kg" | "lb",
                                    })
                                  }
                                >
                                  <option>kg</option>
                                  <option>lb</option>
                                </select>
                              </Field>
                              <Field label="Reps">
                                <SetNumberInput
                                  label={`Reps for ${row.exercise} set ${row.setNumber}`}
                                  step="1"
                                  integer
                                  value={row.reps}
                                  onCommit={(val) =>
                                    patch(row.id, { reps: val })
                                  }
                                />
                              </Field>
                            </>
                          ) : (
                            <>
                              <Field label="Minutes">
                                <SetNumberInput
                                  label={`Minutes for ${row.exercise}`}
                                  step="any"
                                  value={row.durationMinutes}
                                  onCommit={(val) =>
                                    patch(row.id, { durationMinutes: val })
                                  }
                                />
                              </Field>
                              <Field label="Distance (km)">
                                <SetNumberInput
                                  label={`Distance for ${row.exercise}`}
                                  step="any"
                                  value={row.distanceKm}
                                  onCommit={(val) =>
                                    patch(row.id, { distanceKm: val })
                                  }
                                />
                              </Field>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {first.notes && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-xs text-[#62584E]">
                      {first.notes}
                    </p>
                  )}
                  {first.type === "strength" && (
                    <button
                      type="button"
                      className={`${secondaryClass} mt-3`}
                      aria-label={`Add set to ${first.exercise}`}
                      onClick={() => {
                        const row = {
                          ...group.at(-1)!,
                          id: uid(),
                          setNumber:
                            Math.max(...group.map((s) => s.setNumber)) + 1,
                        };
                        update((s) => ({
                          ...s,
                          workoutSets: [...(s.workoutSets ?? []), row],
                        }));
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add set
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty>
            No exercises recorded for this day. Log your first exercise below.
          </Empty>
        )}
      </Card>

      <Card
        title="Add an exercise"
        subtitle="Log what you actually did. You can edit individual sets above after adding them."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!exercise.trim()) return;
            const exerciseId = uid();
            const safeCount =
              Number.isInteger(count) && count >= 1 && count <= 50 ? count : 1;
            const rows: WorkoutSet[] = Array.from(
              { length: type === "strength" ? safeCount : 1 },
              (_, i) => ({
                id: uid(),
                exerciseId,
                date,
                exercise: exercise.trim(),
                type,
                setNumber: i + 1,
                weight: type === "strength" ? weight : "",
                unit,
                reps: type === "strength" ? reps : "",
                durationMinutes: type === "cardio" ? minutes : "",
                distanceKm: type === "cardio" ? distance : "",
                notes,
              }),
            );
            update((s) => ({
              ...s,
              workoutSets: [...(s.workoutSets ?? []), ...rows],
            }));
            setExercise("");
            setNotes("");
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label="Exercise">
              <input
                aria-label="Exercise name"
                required
                maxLength={200}
                placeholder="Dumbbell curls, treadmill, leg extensions…"
                className={inputClass}
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
              />
            </Field>
            <Field label="Type">
              <select
                aria-label="Exercise type"
                className={inputClass}
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="strength">Strength / weights</option>
                <option value="cardio">Cardio / treadmill</option>
              </select>
            </Field>
          </div>
          {type === "strength" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Number of sets">
                <input
                  aria-label="Number of sets"
                  required
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  className={inputClass}
                  value={count}
                  onChange={(e) =>
                    setCount(parseNumberInput(e.target.value, count))
                  }
                />
              </Field>
              <Field label="Reps per set">
                <input
                  aria-label="Reps per set"
                  required
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </Field>
              <Field label="Weight (optional)">
                <input
                  aria-label="Exercise weight"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Bodyweight / 0"
                  className={inputClass}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </Field>
              <Field label="Unit">
                <select
                  aria-label="Weight unit"
                  className={inputClass}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as typeof unit)}
                >
                  <option>kg</option>
                  <option>lb</option>
                </select>
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (minutes)">
                <input
                  aria-label="Cardio duration"
                  required
                  type="number"
                  min="0.1"
                  step="any"
                  className={inputClass}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </Field>
              <Field label="Distance (km, optional)">
                <input
                  aria-label="Cardio distance"
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                />
              </Field>
            </div>
          )}
          <Field label="Notes (optional)">
            <textarea
              aria-label="Exercise notes"
              rows={2}
              maxLength={5000}
              className={inputClass}
              placeholder="Incline, machine setting, how it felt…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <button type="submit" className={primaryClass}>
            <Plus className="h-4 w-4" />
            Log exercise
          </button>
        </form>
      </Card>

      <Card
        title="Workout history"
        subtitle="Choose a recorded day to review its exercises and sets."
      >
        <div className="flex flex-wrap gap-2">
          {days.length ? (
            days.map((d) => {
              const countForDay = setCountByDate.get(d) ?? 0;
              return (
                <button
                  type="button"
                  key={d}
                  className={secondaryClass}
                  aria-pressed={date === d}
                  onClick={() => setDate(d)}
                >
                  {d}
                  {countForDay > 0 ? ` · ${countForDay} entries` : " · completed"}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-[#8C8073]">
              Your recorded workout days will appear here.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
