import { ArrowRight, CalendarDays, CheckCircle2, ListTodo } from "lucide-react";
import type { JournalBridge } from "../App";
import { ClayObject, clayAssetUrl } from "./clayAssets";
import type { Workspace } from "./model";
import {
  countOpenPersonalItems,
  countTodayHabits,
  countUpcomingCalendarItems,
  NAV,
  roomMeta,
  type Tab,
} from "./nav";
import { primaryClass, secondaryClass } from "./ui";

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const BADGE_CLASSES = {
  neutral: "bg-[#F3EDE3] text-[#5C5248]",
  accent: "bg-[#FBECE7] text-[#A83E20]",
  sage: "bg-[#ECF4F0] text-[#2F5B48]",
} as const;

export function Overview({
  data,
  journal,
  today,
  navigate,
}: {
  data: Workspace;
  journal: JournalBridge | null;
  today: string;
  navigate: (tab: Tab) => void;
}) {
  const { done, total } = countTodayHabits(data, journal, today);
  const openTasks = countOpenPersonalItems(data, today);
  const upcomingDates = countUpcomingCalendarItems(data, today);
  const habitPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  const formattedDate = new Date(`${today}T12:00`).toLocaleDateString(
    undefined,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <div className="space-y-8">
      {/* Elevated Clay Shelf Hero Card */}
      <section className="clay-card-elevated relative overflow-hidden rounded-[26px]">
        <div className="relative z-10 grid items-center gap-6 p-5 sm:p-8 lg:grid-cols-12 lg:gap-6 lg:p-9">
          <div className="min-w-0 lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#EAE2D6] bg-[#FAF7F2] px-3 py-1 text-xs font-semibold text-[#5C5248]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D95D39]" />
              {formattedDate}
            </p>
            <h1 className="font-display mt-3.5 text-3xl font-bold leading-[1.12] text-[#24201D] sm:text-4xl">
              {timeGreeting()}, {data.name}.
            </h1>
            <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-[#5C5248] sm:text-[15px]">
              {total > 0
                ? `${done} of ${total} habits checked today`
                : "Your daily habits are ready"}
              {openTasks > 0
                ? ` · ${openTasks} personal ${openTasks === 1 ? "item" : "items"} open.`
                : " · Everything else sits neatly on your shelf."}
            </p>

            {/* Live Daily Pulse Strip */}
            <div className="mt-5 rounded-2xl border border-[#EFE8DC] bg-[#FAF7F2]/90 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#473F38]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#356651]" />
                  Daily rhythm
                </span>
                <span className="tabular-nums text-[#5C5248]">
                  {total > 0 ? `${done}/${total} (${habitPercent}%)` : "Ready"}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#EAE2D6]">
                <div
                  className="h-full rounded-full bg-[#D95D39] transition-[width] duration-300 ease-out"
                  style={{ width: `${habitPercent}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5C5248]">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-medium shadow-[0_1px_2px_rgba(58,44,32,0.04)] tabular-nums">
                  <ListTodo className="h-3.5 w-3.5 text-[#D95D39]" />
                  {openTasks} open {openTasks === 1 ? "item" : "items"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-medium shadow-[0_1px_2px_rgba(58,44,32,0.04)] tabular-nums">
                  <CalendarDays className="h-3.5 w-3.5 text-[#356651]" />
                  {upcomingDates} upcoming{" "}
                  {upcomingDates === 1 ? "date" : "dates"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                className={primaryClass}
                onClick={() => navigate("habits")}
              >
                Check today&apos;s habits
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={secondaryClass}
                onClick={() => navigate("dump")}
              >
                Drop a thought
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-2xl bg-[#FAF7F2] p-4 sm:p-5 lg:col-span-5">
            <img
              src={clayAssetUrl("hero-shelf-scene")}
              alt="A warm pale-oak wall shelf holding a potted sprout, stacked notebooks, a ceramic coffee mug, and a butter-ochre tabletop clock"
              className="w-full max-w-[340px] select-none object-contain sm:max-w-[400px]"
            />
          </div>
        </div>
      </section>

      {/* 12 Rooms Shelf Grid — keeps exact 12 buttons inside nav[aria-label="Open a page"] */}
      <div>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#24201D]">
              On your shelf
            </h2>
            <p className="text-xs text-[#6E6358]">
              Pick a room to jump straight in.
            </p>
          </div>
          <span className="rounded-full border border-[#EAE2D6] bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#5C5248]">
            12 rooms
          </span>
        </div>
        <nav
          aria-label="Open a page"
          className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {NAV.filter((item) => item.id !== "overview").map((item) => {
            const meta = roomMeta(item.id, data, journal, today);
            return (
              <div
                key={item.id}
                className="clay-card clay-card-interactive group relative flex min-h-[124px] items-center gap-4 rounded-2xl p-4 text-left focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D95D39] sm:p-5"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#EFE8DC] bg-[#FAF7F2] p-2 transition-colors duration-150 group-hover:border-[#F2C9BC] group-hover:bg-[#FBECE7]/60 sm:h-15 sm:w-15">
                  {item.asset && (
                    <ClayObject
                      name={item.asset}
                      className="h-11 w-11 transition-transform duration-150 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(item.id)}
                      className="font-display text-left text-[17px] font-semibold text-[#24201D] outline-none after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {item.label}
                    </button>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[#9D9083] transition-transform duration-150 group-hover:translate-x-1 group-hover:text-[#D95D39]"
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#5C5248]">
                    {item.description}
                  </p>
                  {meta && (
                    <span
                      className={`mt-2.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold tabular-nums ${BADGE_CLASSES[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
