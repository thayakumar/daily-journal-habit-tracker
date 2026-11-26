import { ArrowRight } from "lucide-react";
import type { JournalBridge } from "../App";
import { ClayObject, clayAssetUrl } from "./clayAssets";
import type { Workspace } from "./model";
import {
  countOpenPersonalItems,
  countTodayHabits,
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
      {/* Clay Shelf Hero Banner — flat #FAF7F2 surface with lush shelf diorama on the right */}
      <section className="relative overflow-hidden rounded-3xl border border-[#EAE2D6] bg-[#FAF7F2]">
        <div className="relative z-10 grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-12 lg:gap-4 lg:p-10">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8C8073]">
              {formattedDate}
            </p>
            <h1 className="font-display mt-3 text-3xl font-bold leading-tight text-[#24201D] sm:text-4xl">
              {timeGreeting()}, {data.name}.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#62584E] sm:text-base">
              {total > 0
                ? `${done} of ${total} habits checked today`
                : "Your daily habits are ready"}
              {openTasks > 0
                ? ` · ${openTasks} personal ${openTasks === 1 ? "item" : "items"} open.`
                : " · Everything else sits neatly on your shelf."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
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
          <div className="flex items-center justify-center lg:col-span-6 lg:justify-end">
            <img
              src={clayAssetUrl("hero-shelf-scene")}
              alt="A warm pale-oak wall shelf holding a potted sprout, stacked notebooks, a ceramic coffee mug, and a butter-ochre tabletop clock"
              className="w-full max-w-[440px] select-none object-contain lg:max-w-[480px]"
            />
          </div>
        </div>
      </section>

      {/* 12 Rooms Shelf Grid — keeps exact 12 buttons inside nav[aria-label="Open a page"] */}
      <div>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[#24201D]">
            On your shelf
          </h2>
          <span className="text-xs font-medium text-[#8C8073]">12 rooms</span>
        </div>
        <nav
          aria-label="Open a page"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {NAV.filter((item) => item.id !== "overview").map((item) => {
            const meta = roomMeta(item.id, data, journal, today);
            return (
              <div
                key={item.id}
                className="clay-card clay-card-interactive group relative flex min-h-36 items-center gap-4 rounded-2xl p-6 text-left focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#D95D39]"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F3EDE3] p-2 transition group-hover:bg-[#ECE3D5]">
                  {item.asset && (
                    <ClayObject
                      name={item.asset}
                      className="h-12 w-12 transition-transform duration-200 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(item.id)}
                      className="font-display text-left text-lg font-semibold text-[#24201D] outline-none after:absolute after:inset-0 after:rounded-2xl"
                    >
                      {item.label}
                    </button>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[#B8AA9B] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#D95D39]"
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#62584E]">
                    {item.description}
                  </p>
                  {meta && (
                    <span className="mt-2 inline-block text-[11px] font-semibold text-[#8C8073]">
                      {meta}
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
