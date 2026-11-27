import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, uid, weekDates, type MealDay, type Workspace } from "./model";
import {
  Card,
  inputClass,
  primaryClass,
  type Update,
} from "./ui";

const EMPTY_MEAL: MealDay = { breakfast: "", lunch: "", dinner: "", snack: "" };
const MEAL_SLOTS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
] as const;

function MealInput({
  label,
  value,
  onCommit,
  flushers,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  flushers: Set<() => void>;
}) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraft = useRef(draft);
  const latestValue = useRef(value);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    latestDraft.current = draft;
    latestValue.current = value;
    commitRef.current = onCommit;
  }, [draft, value, onCommit]);

  useEffect(() => {
    if (!timer.current) {
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const flushPending = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        if (latestDraft.current !== latestValue.current) {
          commitRef.current(latestDraft.current);
        }
      }
    };
    flushers.add(flushPending);
    return () => {
      flushers.delete(flushPending);
      flushPending();
    };
  }, [flushers]);

  function flushNow(val: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (val !== latestValue.current) {
      commitRef.current(val);
    }
  }

  return (
    <textarea
      rows={2}
      aria-label={label}
      className={inputClass}
      placeholder="What sounds good?"
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          commitRef.current(next);
        }, 180);
      }}
      onBlur={() => flushNow(draft)}
    />
  );
}

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
  const prevToday = useRef(today);
  const flushersRef = useRef<Set<() => void>>(new Set());
  function flushAllMeals() {
    for (const fn of flushersRef.current) fn();
  }
  useEffect(() => {
    if (prevToday.current !== today) {
      if (week === prevToday.current) setWeek(today);
      prevToday.current = today;
    }
  }, [today, week]);
  const [grocery, setGrocery] = useState("");
  const [added, setAdded] = useState(false);
  const dates = weekDates(week);
  const [selectedDay, setSelectedDay] = useState(today);
  const activeDay = dates.includes(selectedDay)
    ? selectedDay
    : dates.includes(today)
      ? today
      : dates[0];
  const weekRangeLabel = `${new Date(`${dates[0]}T12:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(`${dates[6]}T12:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-4">
      {/* Compact Single-Row Week Control Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous meal week"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => setWeek(addDays(week, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="min-h-10 rounded-xl border border-[#DFD5C6] bg-white px-3 text-xs font-semibold tabular-nums text-[#24201D] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => {
              setWeek(today);
              setSelectedDay(today);
            }}
          >
            {weekRangeLabel}
          </button>
          <button
            type="button"
            aria-label="Next meal week"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => setWeek(addDays(week, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="min-h-10 rounded-xl border border-[#DFD5C6] bg-white px-3 text-xs font-semibold text-[#5C5248] shadow-xs hover:bg-[#FAF7F2] hover:text-[#24201D]"
          onClick={() => {
            setWeek(today);
            setSelectedDay(today);
          }}
        >
          This week
        </button>
      </div>

      {/* Mobile 7-Day Pill Selector Strip (avoids 28-textarea wall!) */}
      <div className="grid grid-cols-7 gap-1 md:hidden">
        {dates.map((d) => {
          const isSelected = d === activeDay;
          const m = data.meals[d];
          const hasAny = Boolean(
            m &&
              [m.breakfast, m.lunch, m.dinner, m.snack].some((v) => v.trim()),
          );
          return (
            <button
              key={d}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedDay(d)}
              className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-colors ${
                isSelected
                  ? "border-[#D95D39] bg-[#D95D39] text-white shadow-xs"
                  : d === today
                    ? "border-[#EAB9A9] bg-[#FBECE7]/60 text-[#A83E20]"
                    : "border-[#E7DDD0] bg-white text-[#5C5248]"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase opacity-80">
                {new Date(`${d}T12:00`).toLocaleDateString("en", {
                  weekday: "narrow",
                })}
              </span>
              <span className="mt-0.5 text-xs font-bold tabular-nums">
                {Number(d.slice(8))}
              </span>
              <span
                className={`mt-1 h-1 w-1 rounded-full ${
                  hasAny
                    ? isSelected
                      ? "bg-white"
                      : "bg-[#356651]"
                    : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Weekly Meals Table (keeps all 28 textareas mounted in DOM!) */}
      <section className="clay-card rounded-2xl p-3.5 sm:p-5">
        <div className="max-w-full">
          <table
            aria-label="Weekly meals"
            className="block w-full border-collapse text-sm md:table"
          >
            <thead className="hidden md:table-header-group">
              <tr className="md:table-row">
                {["Day", "Breakfast", "Lunch", "Dinner", "Snack"].map(
                  (label) => (
                    <th
                      key={label}
                      className="p-2.5 text-left text-xs font-semibold text-[#6E6358] md:table-cell"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {dates.map((d) => (
                <tr
                  key={d}
                  className={`${
                    d === activeDay ? "block" : "hidden md:table-row"
                  } md:border-t md:border-[#EFE8DC] ${
                    d === today ? "md:bg-[#FBECE7]/35" : ""
                  }`}
                >
                  <th
                    scope="row"
                    className="mb-2.5 block text-left font-display text-sm font-bold text-[#24201D] md:mb-0 md:table-cell md:w-28 md:p-2.5 md:align-top md:font-sans md:text-xs md:font-semibold md:text-[#5C5248]"
                  >
                    <div className="flex items-center justify-between gap-2 md:block">
                      <span>
                        {new Date(`${d}T12:00`).toLocaleDateString("en", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {d === today && (
                        <span className="rounded-full bg-[#FBECE7] px-2 py-0.5 text-[11px] font-semibold text-[#B84727] md:mt-1 md:block md:w-fit">
                          Today
                        </span>
                      )}
                    </div>
                  </th>
                  {MEAL_SLOTS.map(({ key: meal, label }) => (
                    <td
                      key={meal}
                      className="block py-1.5 md:table-cell md:p-2 md:align-top"
                    >
                      <span className="mb-1 block text-[11px] font-semibold text-[#6E6358] md:hidden">
                        {label}
                      </span>
                      <MealInput
                        label={`${meal} for ${d}`}
                        value={data.meals[d]?.[meal] ?? ""}
                        flushers={flushersRef.current}
                        onCommit={(val) =>
                          update((s) => ({
                            ...s,
                            meals: {
                              ...s.meals,
                              [d]: {
                                ...EMPTY_MEAL,
                                ...s.meals[d],
                                [meal]: val,
                              },
                            },
                          }))
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Card
        compact
        title="Shopping prep"
        subtitle="One ingredient per line — sent straight to Groceries."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            flushAllMeals();
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
            rows={2}
            className={inputClass}
            value={grocery}
            onChange={(e) => {
              setGrocery(e.target.value);
              setAdded(false);
            }}
            placeholder={"Eggs\nSpinach\nOats"}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className={primaryClass}
              disabled={!grocery.trim()}
            >
              <Plus className="h-4 w-4" />
              Add to grocery list
            </button>
            {added && (
              <span role="status" className="text-xs font-semibold text-[#356651]">
                Added to Groceries in Personal.
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
