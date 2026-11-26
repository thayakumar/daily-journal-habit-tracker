import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  LayoutGrid,
  Menu,
  RefreshCw,
  X,
} from "lucide-react";
import { useJournal, type JournalBridge } from "../App";
import { isConfigured } from "../lib/sheets-api";
import { CalendarPanel } from "./Calendar";
import { Vehicles } from "./Vehicles";
import { Habits } from "./Habits";
import { Meals } from "./Wellness";
import { Fitness } from "./Fitness";
import { Vocabulary } from "./Vocabulary";
import { BrainDump, Ideas } from "./Creativity";
import { Overview } from "./Overview";
import { SettingsPanel } from "./SettingsPanel";
import { useWorkspace } from "./useWorkspace";
import { ClayObject } from "./clayAssets";
import { localDate } from "./model";
import { countTodayHabits, currentTab, NAV, type Tab } from "./nav";
import { ListPanel, RoomErrorBoundary } from "./ui";

const Skincare = lazy(() => import("../skincare/Skincare"));
const Finance = lazy(() => import("../finance/Finance"));

function useToday() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = setInterval(refresh, 30_000);
    const canDoc =
      typeof document !== "undefined" &&
      typeof document.addEventListener === "function";
    if (canDoc) document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      if (canDoc) document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}

export default function WorkspaceApp() {
  const {
    data,
    initialLoading,
    update,
    status,
    syncState,
    syncError,
    retrySync,
    flushSync,
    pullCloud,
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
    fastBackend,
    sheetsImportReady,
  } = useWorkspace();

  const journalHook = useJournal();
  const journal: JournalBridge | null = useMemo(
    () =>
      journalHook.isLoaded
        ? {
            rows: journalHook.rows,
            habits: journalHook.habits,
            showTasksColumn: journalHook.showTasksColumn,
            toggleDay: journalHook.toggleDay,
            addHabit: journalHook.addHabit,
            editHabit: journalHook.editHabit,
            removeHabit: journalHook.removeHabit,
            sync: journalHook.sync,
            refresh: journalHook.refresh,
            saveStatus: journalHook.saveStatus,
            syncState: journalHook.syncState,
          }
        : null,
    [
      journalHook.isLoaded,
      journalHook.rows,
      journalHook.habits,
      journalHook.showTasksColumn,
      journalHook.toggleDay,
      journalHook.addHabit,
      journalHook.editHabit,
      journalHook.removeHabit,
      journalHook.sync,
      journalHook.refresh,
      journalHook.saveStatus,
      journalHook.syncState,
    ],
  );

  const [tab, setTab] = useState<Tab>(currentTab);
  const [menu, setMenu] = useState(false);
  const today = useToday();
  const heading = NAV.find((n) => n.id === tab)!;

  const reminderSource = useRef({ data, journal });
  useEffect(() => {
    reminderSource.current = { data, journal };
  }, [data, journal]);

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
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  useEffect(() => {
    const checkReminders = () => {
      if (
        typeof Notification === "undefined" ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      )
        return;
      const now = new Date();
      const date = localDate(now);
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const { data: state, journal: j } = reminderSource.current;
      const todayRow = j?.rows.find((r) => r.dateStr === date);
      for (const h of j?.habits ?? []) {
        const scheduled = state.reminders[h.id];
        if (!scheduled || scheduled > time) continue;
        const key = `${date}:${h.id}:${scheduled}`;
        if (!notified.current.has(key) && !todayRow?.habits[h.id]) {
          notified.current.add(key);
          try {
            new Notification("A little reminder", { body: h.name, tag: key });
          } catch {
            /* Some mobile browsers only support push notifications. */
          }
        }
      }
    };
    const timer = setInterval(checkReminders, 15_000);
    return () => clearInterval(timer);
  }, []);

  const habitSummary = countTodayHabits(data, journal, today);
  const journalState =
    journal?.syncState ?? (isConfigured() ? "syncing" : "local");
  const effectiveSyncState =
    syncState === "error" || journalState === "error"
      ? "error"
      : syncState === "offline" || journalState === "offline"
        ? "offline"
        : syncState === "syncing" || journalState === "syncing"
          ? "syncing"
          : isConfigured()
            ? "synced"
            : "local";
  const bannerMessage =
    syncState === "error"
      ? syncError || status
      : journalState === "error"
        ? journal?.saveStatus || "Habits sync failed · tap Retry"
        : effectiveSyncState === "offline"
          ? "Offline — edits are safely saved on this device and will auto-sync when back online."
          : null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#24201D] selection:bg-[#FBECE7] selection:text-[#9A381D]">
      {menu && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-[#24201D]/30 backdrop-blur-xs lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#EAE2D6] bg-white transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-5 pt-5 sm:px-6">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              navigate("overview");
            }}
            className="flex min-w-0 items-center gap-3"
          >
            <ClayObject
              name="brand-shelf"
              className="h-11 w-11 shrink-0 rounded-2xl shadow-xs"
            />
            <div className="min-w-0">
              <span className="font-display block max-w-32 truncate text-lg font-bold text-[#24201D]">
                {data.name}
              </span>
              <span className="block text-[11px] font-medium text-[#8C8073]">
                Daily shelf
              </span>
            </div>
          </a>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E4DBCE] bg-[#FAF7F2] text-[#62584E] transition hover:bg-[#F3EDE3] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
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
                className={`flex min-h-[40px] items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${n.id === "settings" ? "!mt-4 border-t border-[#EFE8DC] pt-3" : ""} ${active ? "bg-[#FBECE7] font-semibold text-[#B84727]" : "text-[#62584E] hover:bg-[#F6F1E9] hover:text-[#24201D]"}`}
              >
                {n.asset ? (
                  <ClayObject name={n.asset} className="h-6 w-6 shrink-0" />
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
            <ClayObject name="spot-cup" className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-[#24201D]">
                {habitSummary.total > 0
                  ? `${habitSummary.done} of ${habitSummary.total} today`
                  : "Fresh shelf today"}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[#62584E]">
                {habitSummary.total > 0 &&
                habitSummary.done === habitSummary.total
                  ? "All daily habits checked."
                  : "Check off habits as the day goes."}
              </p>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#EAE2D6] bg-[#FAF7F2]/92 px-4 py-2.5 backdrop-blur-sm sm:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4DBCE] bg-white text-[#62584E] transition hover:bg-[#F3EDE3] lg:hidden"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-xs text-[#8C8073]">
                <span className="hidden sm:inline">{data.name}</span>
                <ChevronRight className="hidden h-3 w-3 sm:block" />
                <span className="font-semibold text-[#24201D]">
                  {heading.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden text-xs font-medium text-[#62584E] md:inline">
                {new Date(`${today}T12:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (
                    effectiveSyncState === "error" ||
                    effectiveSyncState === "offline"
                  ) {
                    void retrySync();
                    void journal?.sync();
                  } else if (isConfigured()) {
                    void pullCloud();
                  } else {
                    navigate("settings");
                  }
                }}
                aria-label={`Sync status: ${status}`}
                className={`flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  effectiveSyncState === "error"
                    ? "border-[#E3A694] bg-[#FBECE7] text-[#9A381D] hover:bg-[#F7DDD4]"
                    : effectiveSyncState === "offline"
                      ? "border-[#DFD4C3] bg-[#F3EDE3] text-[#62584E] hover:bg-[#EAE1D3]"
                      : effectiveSyncState === "syncing"
                        ? "border-[#E5CF9E] bg-[#FDF6E7] text-[#8C5A12]"
                        : "border-[#E4DBCE] bg-white text-[#62584E] hover:border-[#D5C9B9] hover:text-[#24201D]"
                }`}
                title={status}
              >
                {effectiveSyncState === "error" ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#B84727]" />
                ) : effectiveSyncState === "offline" ? (
                  <CloudOff className="h-3.5 w-3.5 shrink-0 text-[#8C8073]" />
                ) : effectiveSyncState === "syncing" ? (
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[#B27B22]" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#5C8D78]" />
                )}
                <span>
                  {effectiveSyncState === "error"
                    ? "Sync issue · Retry"
                    : effectiveSyncState === "offline"
                      ? "Offline"
                      : effectiveSyncState === "syncing"
                        ? "Syncing…"
                        : isConfigured()
                          ? tableStorage
                            ? "Synced"
                            : "Legacy sync"
                          : "Device only"}
                </span>
              </button>
              <button
                type="button"
                aria-label="Open settings"
                onClick={() => navigate("settings")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4DBCE] bg-[#F3EDE3] font-display text-xs font-bold text-[#24201D] transition hover:border-[#D5C9B9]"
              >
                {data.name.trim().slice(0, 1).toUpperCase() || "M"}
              </button>
            </div>
          </div>
        </header>
        {bannerMessage && (
          <div
            role="status"
            className={`border-b px-4 py-2.5 text-xs sm:px-8 ${
              effectiveSyncState === "error"
                ? "border-[#E8B8A9] bg-[#FBECE7] text-[#9A381D]"
                : "border-[#E4DBCE] bg-[#F3EDE3] text-[#4C433B]"
            }`}
          >
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{bannerMessage}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void retrySync();
                    void journal?.sync();
                  }}
                  className="min-h-[34px] rounded-lg border border-current/25 bg-white/80 px-3 py-1 font-semibold transition hover:bg-white"
                >
                  Sync now
                </button>
                <button
                  type="button"
                  onClick={() => navigate("settings")}
                  className="min-h-[34px] rounded-lg px-2.5 py-1 font-medium underline underline-offset-2"
                >
                  Settings
                </button>
              </div>
            </div>
          </div>
        )}
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
          <RoomErrorBoundary key={tab} roomName={heading.label}>
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
                  onSync={() => void flushSync()}
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
                  onSync={() => void flushSync()}
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
                journal={journal}
                update={update}
                status={status}
                retrySync={retrySync}
                reloadCloud={reloadCloud}
                tableStorage={tableStorage}
                logStorageReady={logStorageReady}
                fastBackend={fastBackend}
                sheetsImportReady={sheetsImportReady}
              />
            )}
          </RoomErrorBoundary>
        </main>
        <footer className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 border-t border-[#EFE8DC] px-4 py-4 text-xs text-[#8C8073] sm:px-8">
          <span>
            {data.name} · Habits, meals, notes, and plans in one quiet place.
          </span>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-medium text-[#62584E] transition hover:text-[#D95D39]"
            onClick={() => navigate("settings")}
          >
            Your data &amp; backups{" "}
            <ArrowRight className="ml-1 inline h-3 w-3" />
          </button>
        </footer>
      </div>
    </div>
  );
}
