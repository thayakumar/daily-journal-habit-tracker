import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, uid, type CalendarEvent, type Workspace } from "./model";
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
export function CalendarPanel({
  data,
  update,
  today,
}: {
  data: Workspace;
  update: Update;
  today: string;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEvent["type"]>("event");
  const [note, setNote] = useState("");
  const first = `${month}-01`;
  const startDay = (new Date(`${first}T12:00`).getDay() + 6) % 7;
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const cells = Array.from(
    { length: Math.ceil((startDay + daysInMonth) / 7) * 7 },
    (_, i) => addDays(first, i - startDay),
  );
  const vehicleEvents: CalendarEvent[] = (data.vehicles ?? []).flatMap((v) =>
    (
      [
        ["Road tax renewal", v.roadTaxDue],
        ["Insurance renewal", v.insuranceDue],
        ["Vehicle service", v.serviceDue],
      ] as const
    )
      .filter(([, date]) => !!date)
      .map(([label, date]) => ({
        id: `vehicle:${v.id}:${label}`,
        title: `${v.name} · ${label}`,
        date,
        type: "event" as const,
        note: v.plate,
      })),
  );
  const allEvents = [...data.events, ...vehicleEvents];
  const events = allEvents
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  function shift(n: number) {
    const date = new Date(`${first}T12:00`);
    date.setMonth(date.getMonth() + n);
    const m = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    setMonth(m);
    setSelected(`${m}-01`);
  }
  const suggestions = events
    .filter((e) => e.type === "holiday")
    .flatMap((e) => {
      const day = new Date(`${e.date}T12:00`).getDay();
      return day === 2
        ? [
            {
              holiday: e,
              date: addDays(e.date, -1),
              text: "Take Monday off for a four-day break.",
            },
          ]
        : day === 4
          ? [
              {
                holiday: e,
                date: addDays(e.date, 1),
                text: "Take Friday off for a four-day break.",
              },
            ]
          : [];
    });
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <Card
          title={new Date(`${first}T12:00`).toLocaleDateString("en", {
            month: "long",
            year: "numeric",
          })}
          subtitle="Your events, holidays and little plans for time off."
          action={
            <div className="flex gap-1">
              <button
                aria-label="Previous month"
                className={secondaryClass}
                onClick={() => shift(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className={secondaryClass}
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }}
              >
                Today
              </button>
              <button
                aria-label="Next month"
                className={secondaryClass}
                onClick={() => shift(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="pb-3 text-center text-xs font-medium text-[#8C8073]"
              >
                {day}
              </div>
            ))}
            {cells.map((d) => {
              const entries = allEvents.filter((e) => e.date === d);
              return (
                <button
                  key={d}
                  aria-label={`${d}${entries.length ? `, ${entries.length} events` : ""}`}
                  aria-pressed={selected === d}
                  onClick={() => {
                    setSelected(d);
                    if (!d.startsWith(month)) setMonth(d.slice(0, 7));
                  }}
                  className={`min-h-14 min-w-0 rounded-xl border p-1 text-left transition sm:min-h-24 sm:p-2 ${selected === d ? "border-[#D95D39] bg-[#FBECE7] ring-1 ring-[#F2C9BC]" : "border-[#EFE8DC] hover:border-[#EAB9A9]"} ${!d.startsWith(month) ? "opacity-40" : ""}`}
                >
                  <span
                    className={`inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-xs font-semibold ${d === today ? "bg-[#D95D39] text-white" : "text-[#62584E]"}`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1 sm:block">
                    {entries.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className={`mt-1 max-w-full truncate rounded px-1 py-0.5 text-[10px] ${e.type === "holiday" ? "bg-emerald-50 text-emerald-700" : e.type === "leave" ? "bg-[#EDF2F8] text-[#355380]" : "bg-sky-50 text-sky-700"}`}
                      >
                        <span className="hidden sm:inline">{e.title}</span>
                        <span className="sm:hidden">●</span>
                      </div>
                    ))}
                    {entries.length > 2 && (
                      <span className="text-[10px] text-[#8C8073]">
                        +{entries.length - 2}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#62584E]">
            <span>🟢 Holiday</span>
            <span>🟣 Leave</span>
            <span>🔵 Event</span>
          </div>
        </Card>
        <Card
          title="Leave ideas"
          subtitle="Suggestions use the holidays you add and assume a Saturday–Sunday weekend."
        >
          {suggestions.length ? (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div
                  key={s.holiday.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      {s.holiday.title} · {s.holiday.date}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">{s.text}</p>
                  </div>
                  <button
                    className={secondaryClass}
                    disabled={data.events.some(
                      (e) => e.date === s.date && e.type === "leave",
                    )}
                    onClick={() =>
                      update((w) => ({
                        ...w,
                        events: [
                          ...w.events,
                          {
                            id: uid(),
                            date: s.date,
                            title: "Day off",
                            type: "leave",
                            note: `Next to ${s.holiday.title}`,
                          },
                        ],
                      }))
                    }
                  >
                    {data.events.some(
                      (e) => e.date === s.date && e.type === "leave",
                    )
                      ? "Added"
                      : "Plan leave"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              Add a Tuesday or Thursday public holiday to see a long-weekend
              suggestion.
            </Empty>
          )}
        </Card>
      </div>
      <div className="space-y-5">
        <Card
          title="Add to your calendar"
          subtitle={`Selected date: ${selected}. Add the holidays observed where you live.`}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              update((s) => ({
                ...s,
                events: [
                  ...s.events,
                  {
                    id: uid(),
                    title: title.trim(),
                    date: selected,
                    type,
                    note,
                  },
                ],
              }));
              setTitle("");
              setNote("");
            }}
          >
            <Field label="Title">
              <input
                required
                maxLength={200}
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What’s happening?"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    if (e.target.value) setMonth(e.target.value.slice(0, 7));
                  }}
                />
              </Field>
              <Field label="Type">
                <select
                  className={inputClass}
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as CalendarEvent["type"])
                  }
                >
                  <option value="event">Event</option>
                  <option value="holiday">Public holiday</option>
                  <option value="leave">Leave</option>
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                rows={3}
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to remember…"
              />
            </Field>
            <button className={primaryClass}>
              <Plus className="h-4 w-4" />
              Add event
            </button>
          </form>
        </Card>
        <Card title="This month" subtitle={`${events.length} events planned`}>
          {events.length ? (
            <ul className="divide-y divide-[#EFE8DC]">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3EDE3] text-sm font-semibold text-[#62584E]">
                    {e.date.slice(8)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-[#3B342E]">
                      {e.title}
                    </p>
                    <p className="mt-1 text-xs capitalize text-[#8C8073]">
                      {e.type}
                      {e.note && ` · ${e.note}`}
                    </p>
                  </div>
                  {e.id.startsWith("vehicle:") ? (
                    <a href="#vehicles" className={secondaryClass}>
                      Manage
                    </a>
                  ) : (
                    <Delete
                      label={`Delete ${e.title}`}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          events: s.events.filter((i) => i.id !== e.id),
                        }))
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Your month is a blank page.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
