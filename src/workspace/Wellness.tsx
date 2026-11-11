import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, uid, weekDates, type MealDay, type Workspace } from "./model";
import {
  Card,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";
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
  const [week, setWeek] = useState(today),
    [grocery, setGrocery] = useState(""),
    [added, setAdded] = useState(false);
  const dates = weekDates(week);
  return (
    <div className="space-y-5">
      <Card
        title="A week at your table"
        subtitle="Plan each day’s meals. Your existing meal records are preserved."
        action={
          <div className="flex flex-wrap gap-2">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dates.map((d) => (
            <details
              key={d}
              className={`min-w-0 rounded-xl border p-4 ${d === today ? "border-rose-200 bg-rose-50/20" : "border-slate-200"}`}
              open={d === today || undefined}
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                {new Date(`${d}T12:00`).toLocaleDateString("en", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                {d === today ? " · Today" : ""}
              </summary>
              <div className="mt-4 space-y-3">
                {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                  (meal) => (
                    <Field
                      key={meal}
                      label={meal.charAt(0).toUpperCase() + meal.slice(1)}
                    >
                      <textarea
                        rows={2}
                        aria-label={`${meal} for ${d}`}
                        className={inputClass}
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
                    </Field>
                  ),
                )}
              </div>
            </details>
          ))}
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
            placeholder={"Eggs\nSpinach\nRice"}
            onChange={(e) => {
              setGrocery(e.target.value);
              setAdded(false);
            }}
          />
          <button className={primaryClass} disabled={!grocery.trim()}>
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
