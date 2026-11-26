import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, uid, weekDates, type MealDay, type Workspace } from "./model";
import {
  Card,
  inputClass,
  primaryClass,
  secondaryClass,
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
  latestDraft.current = draft;
  latestValue.current = value;
  commitRef.current = onCommit;

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

  return (
    <div className="space-y-5">
      <Card
        title="A week at your table"
        subtitle="Plan each day’s meals. Your existing meal records are preserved."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="Previous meal week"
              className={secondaryClass}
              onClick={() => setWeek(addDays(week, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={secondaryClass}
              onClick={() => setWeek(today)}
            >
              This week
            </button>
            <button
              type="button"
              aria-label="Next meal week"
              className={secondaryClass}
              onClick={() => setWeek(addDays(week, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <p className="mb-4 text-xs text-[#8C8073]">
          {dates[0]} — {dates[6]} · saves automatically
        </p>
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
                      className="p-3 text-left font-semibold text-[#62584E] md:table-cell"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="block space-y-4 md:table-row-group md:space-y-0">
              {dates.map((d) => (
                <tr
                  key={d}
                  className={`block rounded-2xl border p-4 md:table-row md:rounded-none md:border-x-0 md:border-b-0 md:p-0 ${
                    d === today
                      ? "border-[#EAB9A9] bg-[#FBECE7]/60 md:border-t-[#EFE8DC]"
                      : "border-[#EFE8DC] bg-[#FAF7F2]/60 md:border-t md:bg-transparent"
                  }`}
                >
                  <th
                    scope="row"
                    className="mb-2 block text-left font-semibold text-[#24201D] md:mb-0 md:table-cell md:w-28 md:p-3 md:align-top md:text-[#62584E]"
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
                        <span className="rounded-full bg-[#FBECE7] px-2 py-0.5 text-xs font-semibold text-[#B84727] md:mt-1 md:block md:bg-transparent md:p-0 md:text-[#D95D39]">
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
                      <span className="mb-1 block text-xs font-semibold text-[#62584E] md:hidden">
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
      </Card>
      <Card
        title="Shopping prep"
        subtitle="One ingredient per line. Add them directly to your grocery list."
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
            rows={3}
            className={inputClass}
            value={grocery}
            onChange={(e) => {
              setGrocery(e.target.value);
              setAdded(false);
            }}
            placeholder={"Eggs\nSpinach\nOats"}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button className={primaryClass} disabled={!grocery.trim()}>
              <Plus className="h-4 w-4" />
              Add to grocery list
            </button>
            {added && (
              <span role="status" className="text-sm text-emerald-700">
                Added to Groceries in Personal.
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
