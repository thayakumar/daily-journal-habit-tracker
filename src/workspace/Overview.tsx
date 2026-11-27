import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  Plus,
} from "lucide-react";
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
import { compactSecondaryClass, SectionHeader } from "./ui";

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
      weekday: "short",
      month: "short",
      day: "numeric",
    },
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Compact Borderless Greeting Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#6E6358]">
            {formattedDate}
          </p>
          <h1 className="font-display truncate text-xl font-bold text-[#24201D] sm:text-2xl">
            {timeGreeting()}, {data.name}.
          </h1>
        </div>
        <button
          type="button"
          className={`${compactSecondaryClass} shrink-0`}
          onClick={() => navigate("dump")}
        >
          <Plus className="h-3.5 w-3.5 text-[#D95D39]" />
          Thought
        </button>
      </div>

      {/* Asymmetric Bento Pulse Hero */}
      <section
        aria-label="Daily summary"
        className="grid grid-cols-12 gap-2.5 sm:gap-3.5"
      >
        {/* Terracotta Signature Accent Tile — Today's Habits */}
        <button
          type="button"
          onClick={() => navigate("habits")}
          className="group col-span-7 flex min-w-0 flex-col justify-between rounded-[22px] bg-gradient-to-br from-[#D95D39] to-[#B84727] p-4 text-left text-white shadow-[0_10px_24px_-10px_rgba(184,71,39,0.55)] transition duration-150 hover:brightness-[1.03] active:scale-[0.99] sm:p-5 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Daily rhythm
            </span>
            <ArrowRight className="h-4 w-4 text-white/75 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold leading-none tabular-nums sm:text-4xl">
              {total > 0 ? `${habitPercent}%` : "Ready"}
            </span>
            {total > 0 && (
              <span className="text-xs font-semibold tabular-nums text-white/85">
                {done}/{total} done
              </span>
            )}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
              style={{ width: `${habitPercent}%` }}
            />
          </div>
        </button>

        {/* Stacked Compact White Bento KPIs */}
        <div className="col-span-5 grid gap-2.5 sm:gap-3 lg:col-span-4">
          <button
            type="button"
            onClick={() => navigate("personal")}
            className="clay-card clay-card-interactive flex min-w-0 items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-left sm:px-4"
          >
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-none tabular-nums text-[#24201D] sm:text-2xl">
                {openTasks}
              </p>
              <p className="mt-1 truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
                Open items
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FBECE7] text-[#D95D39]">
              <ListTodo className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("calendar")}
            className="clay-card clay-card-interactive flex min-w-0 items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-left sm:px-4"
          >
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-none tabular-nums text-[#24201D] sm:text-2xl">
                {upcomingDates}
              </p>
              <p className="mt-1 truncate text-[11px] font-semibold text-[#6E6358] sm:text-xs">
                Upcoming
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ECF4F0] text-[#356651]">
              <CalendarDays className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* Desktop-only Clay Shelf Diorama Tile */}
        <div className="clay-card hidden items-center justify-center rounded-[22px] bg-[#FAF7F2] p-3 lg:col-span-3 lg:flex">
          <img
            src={clayAssetUrl("hero-shelf-scene")}
            alt="A warm pale-oak wall shelf holding a potted sprout, stacked notebooks, a ceramic coffee mug, and a butter-ochre tabletop clock"
            className="max-h-[126px] w-full select-none object-contain"
          />
        </div>
      </section>

      {/* 12 Rooms Compact Clay Launcher Grid — keeps exact 12 buttons inside nav[aria-label="Open a page"] */}
      <div className="space-y-3">
        <SectionHeader title="On your shelf" count="12 rooms" />
        <nav
          aria-label="Open a page"
          className="grid grid-cols-3 gap-2.5 min-[375px]:grid-cols-4 sm:gap-3 lg:grid-cols-6"
        >
          {NAV.filter((item) => item.id !== "overview").map((item) => {
            const meta = roomMeta(item.id, data, journal, today);
            return (
              <div
                key={item.id}
                className="clay-card clay-card-interactive group relative flex min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-3 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D95D39] sm:px-2.5 sm:py-3.5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#EFE8DC] bg-[#FAF7F2] p-1.5 transition-colors duration-150 group-hover:border-[#F2C9BC] group-hover:bg-[#FBECE7]/60 sm:h-12 sm:w-12">
                  {item.asset && (
                    <ClayObject
                      name={item.asset}
                      className="h-9 w-9 transition-transform duration-150 group-hover:scale-105 sm:h-10 sm:w-10"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(item.id)}
                  className="font-display mt-2 max-w-full truncate text-[11px] font-semibold text-[#24201D] outline-none after:absolute after:inset-0 after:rounded-2xl sm:text-xs"
                >
                  {item.label}
                </button>
                {meta && (
                  <span
                    className={`mt-1 max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${BADGE_CLASSES[meta.tone]}`}
                  >
                    {meta.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
