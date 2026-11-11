import { useState } from "react";
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
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";

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
  const [date, setDate] = useState(today),
    [exercise, setExercise] = useState(""),
    [type, setType] = useState<"strength" | "cardio">("strength"),
    [count, setCount] = useState(3),
    [weight, setWeight] = useState(""),
    [unit, setUnit] = useState<"kg" | "lb">("kg"),
    [reps, setReps] = useState("10"),
    [minutes, setMinutes] = useState(""),
    [distance, setDistance] = useState(""),
    [notes, setNotes] = useState("");
  const sets = (data.workoutSets ?? []).filter((s) => s.date === date);
  const groups = [...new Set(sets.map((s) => s.exerciseId))].map((id) =>
    sets
      .filter((s) => s.exerciseId === id)
      .sort((a, b) => a.setNumber - b.setNumber),
  );
  const week = weekDates(date);
  const days = workoutDates(data);
  const daysThisWeek = days.filter((d) => week.includes(d)).length;
  function patch(id: string, fields: Partial<WorkoutSet>) {
    update((s) => ({
      ...s,
      workoutSets: (s.workoutSets ?? []).map((row) =>
        row.id === id ? { ...row, ...fields } : row,
      ),
    }));
  }
  function numberInput(
    id: string,
    field: "weight" | "reps" | "durationMinutes" | "distanceKm",
    value: string,
  ) {
    if (
      value !== "" &&
      (!Number.isFinite(Number(value)) ||
        Number(value) < 0 ||
        (field === "reps" && !Number.isInteger(Number(value))))
    )
      return;
    patch(id, { [field]: value });
  }
  const completed = data.fitness.completed.includes(date);
  return (
    <div className="space-y-5">
      <Card
        title="Daily workout log"
        subtitle="Choose a day and record every exercise. Each strength set can have its own weight and reps; cardio can have time and distance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-label="Previous workout day"
              className={secondaryClass}
              onClick={() => setDate(addDays(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              aria-label="Workout date"
              required
              type="date"
              max={today}
              className={`${inputClass} !w-auto max-w-full`}
              value={date}
              onChange={(e) => {
                if (e.target.value && e.target.value <= today)
                  setDate(e.target.value);
              }}
            />
            <button
              aria-label="Next workout day"
              disabled={date >= today}
              className={secondaryClass}
              onClick={() => setDate(addDays(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className={secondaryClass} onClick={() => setDate(today)}>
              Today
            </button>
          </div>
        }
      >
        {isConfigured() && !logStorageReady && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            Workout logs are saved on this device. The latest connection update
            is needed to sync them to Google Sheets.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Exercises", value: groups.length },
            {
              label: "Strength sets",
              value: sets.filter((s) => s.type === "strength").length,
            },
            {
              label: "Cardio minutes",
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
            <div key={m.label} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">
                {m.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {daysThisWeek} training {daysThisWeek === 1 ? "day" : "days"} this
            week · target {data.fitness.target}
          </p>
          <button
            className={secondaryClass}
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
      </Card>
      <Card
        title="Add an exercise"
        subtitle="Log what you actually did. You can edit individual sets after adding them."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!exercise.trim()) return;
            const exerciseId = uid();
            const rows: WorkoutSet[] = Array.from(
              { length: type === "strength" ? count : 1 },
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
                  onChange={(e) => setCount(Number(e.target.value))}
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
          <button className={primaryClass}>
            <Plus className="h-4 w-4" />
            Log exercise
          </button>
        </form>
      </Card>
      <Card
        title={`Exercises · ${date}`}
        subtitle="Your recorded sets for this day. Changes save as you type."
      >
        {groups.length ? (
          <div className="space-y-5">
            {groups.map((group) => {
              const first = group[0];
              return (
                <article
                  key={first.exerciseId}
                  className="min-w-0 rounded-2xl border border-slate-200 p-4"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-xl bg-rose-50 p-2 text-rose-500">
                      <Dumbbell className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-slate-800">
                        {first.exercise}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
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
                      <div key={row.id} className="rounded-xl bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">
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
                                <input
                                  aria-label={`Weight for ${row.exercise} set ${row.setNumber}`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  className={inputClass}
                                  value={row.weight}
                                  onChange={(e) =>
                                    numberInput(
                                      row.id,
                                      "weight",
                                      e.target.value,
                                    )
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
                                <input
                                  aria-label={`Reps for ${row.exercise} set ${row.setNumber}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  className={inputClass}
                                  value={row.reps}
                                  onChange={(e) =>
                                    numberInput(row.id, "reps", e.target.value)
                                  }
                                />
                              </Field>
                            </>
                          ) : (
                            <>
                              <Field label="Minutes">
                                <input
                                  aria-label={`Minutes for ${row.exercise}`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  className={inputClass}
                                  value={row.durationMinutes}
                                  onChange={(e) =>
                                    numberInput(
                                      row.id,
                                      "durationMinutes",
                                      e.target.value,
                                    )
                                  }
                                />
                              </Field>
                              <Field label="Distance (km)">
                                <input
                                  aria-label={`Distance for ${row.exercise}`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  className={inputClass}
                                  value={row.distanceKm}
                                  onChange={(e) =>
                                    numberInput(
                                      row.id,
                                      "distanceKm",
                                      e.target.value,
                                    )
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
                    <p className="mt-3 whitespace-pre-wrap break-words text-xs text-slate-500">
                      {first.notes}
                    </p>
                  )}
                  {first.type === "strength" && (
                    <button
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
            No exercises recorded for this day. Add your first exercise above.
          </Empty>
        )}
      </Card>
      <Card
        title="Workout history"
        subtitle="Choose a recorded day to review its exercises and sets."
      >
        <div className="flex flex-wrap gap-2">
          {days.length ? (
            days
              .sort()
              .reverse()
              .map((d) => (
                <button
                  key={d}
                  className={secondaryClass}
                  aria-pressed={date === d}
                  onClick={() => setDate(d)}
                >
                  {d}
                  {(data.workoutSets ?? []).some((s) => s.date === d)
                    ? ` · ${(data.workoutSets ?? []).filter((s) => s.date === d).length} entries`
                    : " · completed"}
                </button>
              ))
          ) : (
            <p className="text-sm text-slate-400">
              Your recorded workout days will appear here.
            </p>
          )}
        </div>
        <div className="mt-5 max-w-xs">
          <Field label="Weekly training-day target">
            <input
              aria-label="Weekly training-day target"
              className={inputClass}
              type="number"
              min="1"
              max="7"
              value={data.fitness.target}
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
      </Card>
    </div>
  );
}
