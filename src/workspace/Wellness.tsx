import { useState } from "react";
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
        <p className="mb-3 text-xs text-slate-500">
          All days are shown below. Swipe horizontally on smaller screens.
        </p>
        <div data-horizontal-scroll className="max-w-full overflow-x-auto">
          <table
            aria-label="Weekly meals"
            className="w-full min-w-[850px] border-collapse text-sm"
          >
            <thead>
              <tr>
                {["Day", "Breakfast", "Lunch", "Dinner", "Snack"].map(
                  (label) => (
                    <th
                      key={label}
                      className="p-3 text-left font-semibold text-slate-600"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr
                  key={d}
                  className={
                    d === today ? "bg-rose-50/50" : "border-t border-slate-100"
                  }
                >
                  <th scope="row" className="w-28 p-3 text-left text-slate-600">
                    {new Date(`${d}T12:00`).toLocaleDateString("en", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {d === today && (
                      <span className="block text-xs text-rose-500">Today</span>
                    )}
                  </th>
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                    (meal) => (
                      <td key={meal} className="p-2">
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
