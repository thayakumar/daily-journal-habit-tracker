import { useEffect, useRef, useState } from "react";
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
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const prevToday = useRef(today);
  useEffect(() => {
    if (prevToday.current !== today) {
      if (selected === prevToday.current) setSelected(today);
      if (month === prevToday.current.slice(0, 7)) setMonth(today.slice(0, 7));
      prevToday.current = today;
    }
  }, [today, selected, month]);
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
  const selectedDayEvents = allEvents.filter((e) => e.date === selected);
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
  const formattedSelected = new Date(`${selected}T12:00`).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.45fr_1fr]">
      <div className="space-y-3 xl:col-start-1 xl:row-start-1">
        {/* Centered Monurus-Style Month Switcher */}
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            aria-label="Previous month"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold text-[#24201D] sm:text-lg">
              {new Date(`${first}T12:00`).toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              type="button"
              className="rounded-full border border-[#DFD5C6] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5C5248] hover:bg-[#FAF7F2] hover:text-[#24201D]"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(today);
              }}
            >
              Today
            </button>
          </div>
          <button
            type="button"
            aria-label="Next month"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DFD5C6] bg-white text-[#3B342E] shadow-xs hover:bg-[#FAF7F2]"
            onClick={() => shift(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Clean Clay Calendar Grid */}
        <section className="clay-card rounded-[22px] p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="pb-2 text-center text-[11px] font-semibold text-[#6E6358]"
              >
                {day}
              </div>
            ))}
            {cells.map((d) => {
              const entries = allEvents.filter((e) => e.date === d);
              const isSelected = selected === d;
              const isToday = d === today;
              const inMonth = d.startsWith(month);
              return (
                <button
                  type="button"
                  key={d}
                  aria-label={`${d}${entries.length ? `, ${entries.length} events` : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelected(d);
                    if (!d.startsWith(month)) setMonth(d.slice(0, 7));
                  }}
                  className={`flex min-h-12 min-w-0 flex-col items-center justify-start rounded-xl border p-1 transition sm:min-h-20 sm:items-start sm:p-1.5 ${
                    isSelected
                      ? "border-[#D95D39] bg-[#FBECE7]/75 ring-1 ring-[#D95D39]/40"
                      : "border-[#EFE8DC] bg-white hover:border-[#EAB9A9]"
                  } ${!inMonth ? "opacity-35" : ""}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                      isToday
                        ? "bg-[#D95D39] text-white"
                        : isSelected
                          ? "text-[#A83E20]"
                          : "text-[#3B342E]"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {entries.length > 0 && (
                    <>
                      {/* Mobile crisp indicator dots */}
                      <div className="mt-1 flex items-center justify-center gap-1 sm:hidden">
                        {entries.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              e.type === "holiday"
                                ? "bg-emerald-600"
                                : e.type === "leave"
                                  ? "bg-[#355380]"
                                  : "bg-sky-600"
                            }`}
                          />
                        ))}
                      </div>
                      {/* Desktop compact pills */}
                      <div className="mt-1 hidden w-full space-y-0.5 sm:block">
                        {entries.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            className={`max-w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium ${
                              e.type === "holiday"
                                ? "bg-emerald-50 text-emerald-700"
                                : e.type === "leave"
                                  ? "bg-[#EDF2F8] text-[#355380]"
                                  : "bg-sky-50 text-sky-700"
                            }`}
                          >
                            {e.title}
                          </div>
                        ))}
                        {entries.length > 2 && (
                          <span className="block px-1 text-left text-[10px] text-[#6E6358]">
                            +{entries.length - 2}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DC] pt-3 text-[11px] font-medium text-[#5C5248]">
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Holiday
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#355380]" />
                Leave
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-600" />
                Event
              </span>
            </div>
            <span className="tabular-nums text-[#6E6358]">
              {events.length} this month
            </span>
          </div>
        </section>
      </div>

      <div className="space-y-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        {/* Dedicated Selected-Day Detail Banner (Monurus-inspired) */}
        <section className="clay-card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-2 bg-[#24201D] px-4 py-3 text-white">
            <span className="font-display text-sm font-semibold">
              {formattedSelected}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums">
              {selectedDayEvents.length}{" "}
              {selectedDayEvents.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="p-3.5 sm:p-4">
            {selectedDayEvents.length > 0 ? (
              <ul className="space-y-2">
                {selectedDayEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#EFE8DC] bg-[#FAF7F2] px-3 py-2 text-xs text-[#24201D]"
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {e.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        e.type === "holiday"
                          ? "bg-emerald-50 text-emerald-700"
                          : e.type === "leave"
                            ? "bg-[#EDF2F8] text-[#355380]"
                            : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {e.type}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#6E6358]">
                Nothing planned for this day.
              </p>
            )}
          </div>
        </section>

        <Card compact title="Add to your calendar">
          <form
            className="space-y-3"
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
                aria-label="Title"
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
                aria-label="Notes"
                rows={3}
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to remember…"
              />
            </Field>
            <button type="submit" className={primaryClass}>
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
      <div className="xl:col-start-1 xl:row-start-2">
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
                    type="button"
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
    </div>
  );
}
