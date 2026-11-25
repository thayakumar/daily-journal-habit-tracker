import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  LayoutGrid,
  Menu,
  Upload,
  X,
} from "lucide-react";
import Journal, { type JournalBridge } from "../App";
import { isConfigured } from "../lib/sheets-api";
import { CalendarPanel } from "./Calendar";
import { Vehicles } from "./Vehicles";
import { Habits } from "./Habits";
import { Meals } from "./Wellness";
import { Fitness } from "./Fitness";
import { Vocabulary } from "./Vocabulary";
import { BrainDump, Ideas } from "./Creativity";
import { useWorkspace } from "./useWorkspace";
import { ClayObject, clayAssetUrl, type ClayAssetName } from "./clayAssets";
import {
  downloadJson,
  isJournal,
  isWorkspace,
  JOURNAL_KEY,
  localDate,
  readJournal,
  todayRecurring,
  recurringDone,
  WORKSPACE_KEY,
  type Workspace,
} from "./model";
import {
  Card,
  Field,
  ListPanel,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";

const Skincare = lazy(() => import("../skincare/Skincare"));
const Finance = lazy(() => import("../finance/Finance"));

interface NavEntry {
  id:
    | "overview"
    | "habits"
    | "personal"
    | "skincare"
    | "fitness"
    | "finance"
    | "calendar"
    | "vehicles"
    | "meals"
    | "dump"
    | "ideas"
    | "vocabulary"
    | "settings";
  label: string;
  asset?: ClayAssetName;
  description: string;
}

const NAV: readonly NavEntry[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Every room on your daily shelf.",
  },
  {
    id: "habits",
    label: "Habits",
    asset: "habits",
    description: "Daily check-ins and recurring routines.",
  },
  {
    id: "personal",
    label: "Personal",
    asset: "personal",
    description: "Errands, groceries, wishlist, and watch list.",
  },
  {
    id: "skincare",
    label: "Skincare",
    asset: "skincare",
    description: "Morning and night shelf, products, and notes.",
  },
  {
    id: "fitness",
    label: "Fitness",
    asset: "fitness",
    description: "Workouts, dated sets, and cardio sessions.",
  },
  {
    id: "finance",
    label: "Finance",
    asset: "finance",
    description: "Expenses, monthly cycles, receipts, and net worth.",
  },
  {
    id: "calendar",
    label: "Calendar",
    asset: "calendar",
    description: "Upcoming dates, holidays, and time off.",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    asset: "vehicles",
    description: "Renewals, mileage, and service logs.",
  },
  {
    id: "meals",
    label: "Meals",
    asset: "meals",
    description: "Weekly breakfast, lunch, dinner, and snacks.",
  },
  {
    id: "dump",
    label: "Brain dump",
    asset: "dump",
    description: "Unfiltered notes whenever something crosses your mind.",
  },
  {
    id: "ideas",
    label: "Ideas",
    asset: "ideas",
    description: "Saved links, references, and notes for later.",
  },
  {
    id: "vocabulary",
    label: "Vocabulary",
    asset: "vocabulary",
    description: "New words, meanings, and examples to keep.",
  },
  {
    id: "settings",
    label: "Settings & backup",
    asset: "settings",
    description: "Workspace name, sync status, and JSON backups.",
  },
] as const;

type Tab = NavEntry["id"];

function currentTab(): Tab {
  const id = window.location.hash.slice(1);
  return NAV.some((n) => n.id === id) ? (id as Tab) : "overview";
}

function useToday() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function countTodayHabits(
  data: Workspace,
  journal: JournalBridge | null,
  today: string,
) {
  const row = journal?.rows.find((r) => r.dateStr === today);
  const daily = journal?.habits ?? [];
  const recurring = todayRecurring(data, today);
  const doneDaily = daily.filter((h) => !!row?.habits[h.id]).length;
  const doneRecurring = recurring.filter((h) =>
    recurringDone(data, h.id, today),
  ).length;
  return {
    done: doneDaily + doneRecurring,
    total: daily.length + recurring.length,
  };
}

function roomMeta(
  id: Tab,
  data: Workspace,
  journal: JournalBridge | null,
  today: string,
): string | null {
  switch (id) {
    case "habits": {
      const { done, total } = countTodayHabits(data, journal, today);
      return total ? `${done}/${total} today` : "No habits yet";
    }
    case "personal": {
      const open = data.items.filter(
        (i) =>
          ["personal", "grocery", "wishlist", "watch"].includes(i.kind) &&
          !i.done,
      ).length;
      return open ? `${open} open` : "All clear";
    }
    case "skincare": {
      const count = data.skincare?.products.filter((p) => p.active).length ?? 0;
      return count ? `${count} active` : "Routine & shelf";
    }
    case "fitness": {
      const count = data.workoutSets?.length ?? 0;
      return count ? `${count} logged sets` : "Log a session";
    }
    case "finance": {
      const count = data.financeExpenses?.length ?? 0;
      return count ? `${count} expenses` : "Budget & receipts";
    }
    case "calendar": {
      const upcoming = data.events.filter((e) => e.date >= today).length;
      return upcoming ? `${upcoming} upcoming` : "Open calendar";
    }
    case "vehicles": {
      const count = data.vehicles?.length ?? 0;
      return count ? `${count} tracked` : "Service & renewals";
    }
    case "meals":
      return "7-day table";
    case "dump": {
      const count = data.thoughts.length;
      return count ? `${count} notes` : "Clear mind";
    }
    case "ideas": {
      const count = data.ideas.length;
      return count ? `${count} saved` : "Shelf for later";
    }
    case "vocabulary": {
      const count = data.vocabulary?.length ?? 0;
      return count ? `${count} words` : "Pocket lexicon";
    }
    case "settings":
      return isConfigured() ? "Sheets sync" : "Local device";
    default:
      return null;
  }
}

export default function WorkspaceApp() {
  const {
    data,
    initialLoading,
    update,
    status,
    retrySync,
    reloadCloud,
    tableStorage,
    logStorageReady,
    vocabularyStorageReady,
    financeStorageReady,
    planningStorageReady,
    portfolioStorageReady,
    vehicleStorageReady,
    skincareStorageReady,
    skincarePhotosReady,
    migrationReady,
  } = useWorkspace();
  const [tab, setTab] = useState<Tab>(currentTab);
  const [menu, setMenu] = useState(false);
  const [journal, setJournal] = useState<JournalBridge | null>(null);
  const today = useToday();
  const heading = NAV.find((n) => n.id === tab)!;
  const onJournalReady = useCallback(
    (next: JournalBridge) => setJournal(next),
    [],
  );
  const reminderSource = useRef({ data, journal });
  reminderSource.current = { data, journal };
  const notified = useRef(new Set<string>());
  const navigate = useCallback((next: Tab) => {
    window.location.hash = next;
    setTab(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    const change = () => {
      setTab(currentTab());
      setMenu(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted")
        return;
      const now = new Date();
      const date = localDate(now);
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const { data: state, journal: j } = reminderSource.current;
      for (const h of j?.habits ?? []) {
        const key = `${date}:${h.id}:${time}`;
        if (
          state.reminders[h.id] === time &&
          !notified.current.has(key) &&
          !j?.rows.find((r) => r.dateStr === date)?.habits[h.id]
        ) {
          notified.current.add(key);
          try {
            new Notification("A little reminder", { body: h.name, tag: key });
          } catch {
            /* Some mobile browsers only support push notifications. */
          }
        }
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, []);

  const habitSummary = countTodayHabits(data, journal, today);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#24201D] selection:bg-[#FBECE7] selection:text-[#9A381D]">
      {menu && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-[#24201D]/30 backdrop-blur-xs lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#EAE2D6] bg-white transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
          className="flex items-center gap-3 px-6 pb-6 pt-6"
        >
          <ClayObject
            name="brand-shelf"
            className="h-11 w-11 shrink-0 rounded-2xl shadow-xs"
          />
          <div className="min-w-0">
            <span className="font-display block max-w-36 truncate text-lg font-bold text-[#24201D]">
              {data.name}
            </span>
            <span className="block text-[11px] font-medium text-[#8C8073]">
              Daily shelf
            </span>
          </div>
        </a>
        <div className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9D9083]">
          Rooms
        </div>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 pb-4"
        >
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(n.id);
                }}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${n.id === "settings" ? "!mt-4 border-t border-[#EFE8DC] pt-3" : ""} ${active ? "bg-[#FBECE7] font-semibold text-[#B84727]" : "text-[#62584E] hover:bg-[#F6F1E9] hover:text-[#24201D]"}`}
              >
                {n.asset ? (
                  <ClayObject
                    name={n.asset}
                    className="h-6 w-6 shrink-0"
                  />
                ) : (
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#F6D6CB] text-[#B84727]" : "bg-[#F3EDE3] text-[#62584E]"}`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="truncate">{n.label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#D95D39]" />
                )}
              </a>
            );
          })}
        </nav>
        <div className="m-4 rounded-2xl border border-[#EAE2D6] bg-[#F3EDE3] p-4">
          <div className="flex items-center gap-3">
            <ClayObject
              name="spot-cup"
              className="h-12 w-12 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-[#24201D]">
                {habitSummary.total > 0
                  ? `${habitSummary.done} of ${habitSummary.total} today`
                  : "Fresh shelf today"}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[#62584E]">
                {habitSummary.total > 0 && habitSummary.done === habitSummary.total
                  ? "All daily habits checked."
                  : "Check off habits as the day goes."}
              </p>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#EAE2D6] bg-[#FAF7F2]/92 px-4 py-3 backdrop-blur-sm sm:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-[#E4DBCE] bg-white p-2 text-[#62584E] transition hover:bg-[#F3EDE3] lg:hidden"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                {menu ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <div className="flex items-center gap-2 text-xs text-[#8C8073]">
                <span className="hidden sm:inline">{data.name}</span>
                <ChevronRight className="hidden h-3 w-3 sm:block" />
                <span className="font-semibold text-[#24201D]">
                  {heading.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-medium text-[#62584E] md:inline">
                {new Date(`${today}T12:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                onClick={() => navigate("settings")}
                className="flex items-center gap-1.5 rounded-full border border-[#E4DBCE] bg-white px-3 py-1.5 text-[11px] font-medium text-[#62584E] transition hover:border-[#D5C9B9] hover:text-[#24201D]"
                title={status}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#5C8D78]" />
                <span>
                  {isConfigured()
                    ? tableStorage
                      ? "Per-page tables"
                      : "Legacy sync"
                    : "Device storage"}
                </span>
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E4DBCE] bg-[#F3EDE3] font-display text-xs font-bold text-[#24201D]">
                {data.name.trim().slice(0, 1).toUpperCase() || "M"}
              </div>
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10"
        >
          {tab !== "overview" && (
            <div className="mb-8 flex items-center gap-4">
              {heading.asset && (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#EAE2D6] bg-[#F3EDE3] p-2">
                  <ClayObject name={heading.asset} className="h-12 w-12" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold text-[#24201D] sm:text-3xl">
                  {heading.label}
                </h1>
                <p className="mt-1 text-sm text-[#62584E]">
                  {heading.description}
                </p>
              </div>
            </div>
          )}
          {tab === "overview" && (
            <Overview
              data={data}
              journal={journal}
              today={today}
              navigate={navigate}
            />
          )}
          {tab === "calendar" && (
            <CalendarPanel data={data} update={update} today={today} />
          )}
          {tab === "vehicles" && (
            <Vehicles
              data={data}
              update={update}
              today={today}
              storageReady={vehicleStorageReady}
            />
          )}
          {tab === "skincare" && (
            <Suspense fallback={<p role="status">Loading skincare…</p>}>
              <Skincare
                data={data}
                update={update}
                today={today}
                storageReady={skincareStorageReady}
                photoReady={skincarePhotosReady}
              />
            </Suspense>
          )}
          {tab === "finance" && (
            <Suspense fallback={<p role="status">Loading finance…</p>}>
              <Finance
                data={data}
                initialLoading={initialLoading}
                update={update}
                receiptReady={financeStorageReady}
                planningReady={planningStorageReady}
                portfolioReady={portfolioStorageReady}
                migrationReady={migrationReady}
                onSync={() => void retrySync()}
              />
            </Suspense>
          )}
          {tab === "habits" && (
            <Habits
              data={data}
              update={update}
              journal={journal}
              today={today}
            />
          )}
          {tab === "personal" && (
            <div className="grid items-start gap-6 xl:grid-cols-2">
              <ListPanel
                kind="personal"
                title="Personal to-do list"
                subtitle="Appointments, errands, and personal tasks."
                data={data}
                update={update}
                today={today}
              />
              <ListPanel
                kind="wishlist"
                title="Shopping wishlist"
                subtitle="Park a want for 30 days before deciding whether it still matters."
                data={data}
                update={update}
                today={today}
              />
              <ListPanel
                kind="grocery"
                title="Groceries"
                subtitle="Items ready for your next market trip."
                data={data}
                update={update}
                today={today}
              />
              <ListPanel
                kind="watch"
                title="Watch & read"
                subtitle="Books, shows, and films worth making time for."
                data={data}
                update={update}
                today={today}
              />
            </div>
          )}
          {tab === "fitness" && (
            <Fitness
              data={data}
              update={update}
              today={today}
              logStorageReady={logStorageReady}
            />
          )}
          {tab === "meals" && (
            <Meals data={data} update={update} today={today} />
          )}
          {tab === "dump" && <BrainDump data={data} update={update} />}
          {tab === "ideas" && <Ideas data={data} update={update} />}
          {tab === "vocabulary" && (
            <Vocabulary
              data={data}
              update={update}
              storageReady={vocabularyStorageReady}
            />
          )}
          {tab === "settings" && (
            <SettingsPanel
              data={data}
              update={update}
              status={status}
              retrySync={retrySync}
              reloadCloud={reloadCloud}
              tableStorage={tableStorage}
              logStorageReady={logStorageReady}
            />
          )}
        </main>
        <Journal onReady={onJournalReady} headless />
        <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DC] px-4 py-6 text-xs text-[#8C8073] sm:px-8">
          <span>{data.name} · Habits, meals, notes, and plans in one quiet place.</span>
          <button
            className="font-medium text-[#62584E] transition hover:text-[#D95D39]"
            onClick={() => navigate("settings")}
          >
            Your data &amp; backups <ArrowRight className="ml-1 inline h-3 w-3" />
          </button>
        </footer>
      </div>
    </div>
  );
}

function Overview({
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
  const openTasks = data.items.filter(
    (i) =>
      ["personal", "grocery", "wishlist", "watch"].includes(i.kind) && !i.done,
  ).length;
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

function SettingsPanel({
  data,
  update,
  status,
  retrySync,
  reloadCloud,
  tableStorage,
  logStorageReady,
}: {
  data: Workspace;
  update: Update;
  status: string;
  retrySync: () => Promise<void>;
  reloadCloud: () => Promise<void>;
  tableStorage: boolean;
  logStorageReady: boolean;
}) {
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function restore(file: File) {
    try {
      if (file.size > 10_000_000)
        throw new Error("Backup is too large (maximum 10 MB).");
      const backup: unknown = JSON.parse(await file.text());
      if (
        !backup ||
        typeof backup !== "object" ||
        !("workspace" in backup) ||
        !("journal" in backup) ||
        !isWorkspace(backup.workspace) ||
        (backup.journal !== null && !isJournal(backup.journal))
      )
        throw new Error("This file is not a valid My Space backup.");
      if (
        !confirm(
          "Restore this backup? It will replace the planner and journal on this device. If Sheets is connected, the planner will sync automatically; the journal will remain local until you press Sync habits in Habits. Export your current backup first if you want to keep both.",
        )
      )
        return;
      // Persist validated records before notifying the mounted journal.
      if (backup.journal)
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(backup.journal));
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(backup.workspace));
      if (backup.journal) {
        localStorage.setItem("journal.pending.v1", "true");
        window.dispatchEvent(new Event("journal-restored"));
      }
      const restored = backup.workspace;
      update(() => restored);
      setMessage(
        "Backup restored. Your journal is saved locally; use Sync habits in Habits to send it to Sheets.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not restore this backup.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card
        title="Make yourself at home"
        subtitle="Give your personal space a name."
      >
        <Field label="Workspace name">
          <input
            maxLength={40}
            className={inputClass}
            value={data.name}
            onChange={(e) => update((s) => ({ ...s, name: e.target.value }))}
          />
        </Field>
        <p className="mt-4 text-sm leading-relaxed text-[#62584E]">
          Your habits, daily workouts, meals and personal lists live in their
          own sections. Historical journal records are preserved in your
          backups.
        </p>
      </Card>
      <Card
        title="Storage & sync"
        subtitle="Your existing Google Sheets connection and historical records are preserved."
      >
        <div className="flex items-start gap-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-4">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-[#8C8073]" />
          <div>
            <p role="status" className="text-sm font-medium text-[#24201D]">
              {status}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#62584E]">
              {isConfigured()
                ? "Planner sections save to their own Sheet tables after the Apps Script update. Journal records continue to use Entries and Habits. The sync status above identifies the active storage mode."
                : "Changes stay in this browser, on this device. Your existing GitHub Pages deployment keeps its Sheets configuration when this update is merged."}
            </p>
          </div>
        </div>
        {isConfigured() && (
          <button
            className={`${secondaryClass} mt-4`}
            onClick={() => {
              void retrySync();
            }}
          >
            Retry planner sync
          </button>
        )}
        {isConfigured() && (
          <button
            className={`${secondaryClass} mt-3`}
            onClick={() => {
              if (
                confirm(
                  "Load the latest planner from Google Sheets and replace this device’s planner? Export a backup first if you have unsynced edits.",
                )
              )
                void reloadCloud();
            }}
          >
            Load latest Sheet tables
          </button>
        )}
        <div className="mt-4 rounded-xl border border-[#EAE2D6] p-4 text-xs leading-relaxed text-[#62584E]">
          <p className="font-semibold text-[#24201D]">
            Where your data is stored
          </p>
          <p className="mt-2">
            On this browser: localStorage keys <code>daily-journal.v1</code> and{" "}
            <code>personal-workspace.v1</code>.
          </p>
          <p className="mt-2">
            {tableStorage
              ? logStorageReady
                ? "Per-page storage, including dated workout sets and routine completion history, is active."
                : "Existing per-page sync is active. Detailed workout sets and routine completion history stay on this device until the latest connection update is deployed."
              : "The deployed Apps Script still uses legacy JSON. The new per-page tables become live after the backend update is deployed."}
          </p>
          <p className="mt-2">
            Habits: Habits, HabitChecks, RecurringHabits, RecurringChecks and
            HabitReminders. Historical journal records: Entries. Personal:
            PersonalTasks, ShoppingWishlist, Groceries, WatchRead. Fitness:
            FitnessPlan, FitnessSessions and WorkoutSets. The old weekly
            schedule is preserved as an archive. Meals: Meals. Brain dump:
            BrainDump. Ideas: Ideas. Preferences: Settings.
          </p>
          <p className="mt-2">
            Only a successful sync confirms that a browser edit has reached the
            Sheet. A configured connection alone does not confirm a saved copy.
          </p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[#8C8073]">
          Keep a backup before clearing browser data or changing devices.
          Journal sync and planner sync have separate status indicators. Legacy
          JSON storage has a per-cell size limit; per-page table storage removes
          that combined planner limit.
        </p>
      </Card>
      <Card
        title="Keep a copy"
        subtitle="One backup includes the journal, daily habits and every planner section."
      >
        <div className="flex flex-wrap gap-3">
          <button
            className={primaryClass}
            onClick={() => {
              downloadJson(
                {
                  format: "my-space-backup",
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  workspace: data,
                  journal: readJournal(),
                },
                `my-space-${localDate()}.json`,
              );
              setMessage("Backup exported. Keep the JSON file somewhere safe.");
            }}
          >
            <Download className="h-4 w-4" />
            Export full backup
          </button>
          <button
            className={secondaryClass}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void restore(file);
            }}
          />
        </div>
        {message && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-[#FAF7F2] p-3 text-sm text-[#62584E]"
          >
            {message}
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-[#8C8073]">
          Historical journal records remain in Entries and in your full backup.
        </p>
      </Card>
      <Card
        title="A few useful details"
        subtitle="Simple controls, so you know what to expect."
      >
        <ul className="space-y-3 text-sm leading-relaxed text-[#62584E]">
          <li>
            Habit reminders need notification permission and the app open.
          </li>
          <li>
            Due and overdue recurring habits automatically appear in Today’s
            habits.
          </li>
          <li>
            Fitness records dated exercises and individual sets. Weights, reps,
            cardio time and distance stay attached to the day you logged them.
          </li>
        </ul>
      </Card>
    </div>
  );
}
