import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchAllData,
  pollRevisions,
  saveHabits,
  saveEntries,
  saveSetting,
  saveJournal,
  isConfigured,
  type Row,
  type Habit,
} from "./lib/sheets-api";
import {
  localDate,
  blankRow,
  readJournal,
  isJournal,
  JOURNAL_KEY,
  type JournalSnapshot,
} from "./workspace/model";
import { journalContentEqual, mergeJournal } from "./workspace/merge";
import type { SyncState } from "./workspace/useWorkspace";

const JOURNAL_BASE_KEY = "daily-journal.base.v1";

const INITIAL_HABITS: Habit[] = [
  {
    id: "h1",
    name: "2L Water",
    color: "bg-sky-500 border-sky-500",
    lightBg: "bg-sky-50 text-sky-700 border-sky-200",
    ringColor: "hover:border-sky-400",
  },
  {
    id: "h2",
    name: "Read 20m",
    color: "bg-violet-500 border-violet-500",
    lightBg: "bg-violet-50 text-violet-700 border-violet-200",
    ringColor: "hover:border-violet-400",
  },
  {
    id: "h3",
    name: "Vitamins",
    color: "bg-amber-500 border-amber-500",
    lightBg: "bg-amber-50 text-amber-700 border-amber-200",
    ringColor: "hover:border-amber-400",
  },
  {
    id: "h4",
    name: "No Sugar",
    color: "bg-rose-500 border-rose-500",
    lightBg: "bg-rose-50 text-rose-700 border-rose-200",
    ringColor: "hover:border-rose-400",
  },
];

export const COLOR_OPTIONS = [
  {
    name: "Sky",
    color: "bg-sky-500 border-sky-500",
    lightBg: "bg-sky-50 text-sky-700 border-sky-200",
    ringColor: "hover:border-sky-400",
  },
  {
    name: "Emerald",
    color: "bg-emerald-500 border-emerald-500",
    lightBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ringColor: "hover:border-emerald-400",
  },
  {
    name: "Violet",
    color: "bg-violet-500 border-violet-500",
    lightBg: "bg-violet-50 text-violet-700 border-violet-200",
    ringColor: "hover:border-violet-400",
  },
  {
    name: "Amber",
    color: "bg-amber-500 border-amber-500",
    lightBg: "bg-amber-50 text-amber-700 border-amber-200",
    ringColor: "hover:border-amber-400",
  },
  {
    name: "Rose",
    color: "bg-rose-500 border-rose-500",
    lightBg: "bg-rose-50 text-rose-700 border-rose-200",
    ringColor: "hover:border-rose-400",
  },
  {
    name: "Indigo",
    color: "bg-indigo-500 border-indigo-500",
    lightBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    ringColor: "hover:border-indigo-400",
  },
];

export interface JournalBridge extends JournalSnapshot {
  toggleDay: (date: string, habitId: string) => void;
  addHabit: (name: string, colorIndex: number) => void;
  editHabit: (id: string, name: string, colorIndex: number) => void;
  removeHabit: (id: string, name: string) => void;
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
  saveStatus: string;
  syncState: SyncState;
}

interface JournalProps {
  onReady: (bridge: JournalBridge) => void;
  headless?: boolean;
}

function normalizeDateStr(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatToDDMM(dateString: string): string {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}`;
}

function getDayShortName(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function normalizeRows(entries: Row[]): Row[] {
  return entries.map((r) => {
    const dateStr = normalizeDateStr(String(r.dateStr ?? ""));
    return {
      ...r,
      id: String(r.id),
      dateStr,
      displayDate: formatToDDMM(dateStr),
      dayName: getDayShortName(dateStr),
      sleepTime: String(r.sleepTime ?? ""),
      exercise: String(r.exercise ?? ""),
      morningFood: String(r.morningFood ?? ""),
      afternoonFood: String(r.afternoonFood ?? ""),
      dinnerFood: String(r.dinnerFood ?? ""),
      snack: String(r.snack ?? ""),
      tasks: String(r.tasks ?? ""),
      habits: r.habits && typeof r.habits === "object" ? r.habits : {},
    };
  });
}

function readJournalBase(): JournalSnapshot | null {
  try {
    const raw = localStorage.getItem(JOURNAL_BASE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isJournal(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJournalBase(snapshot: JournalSnapshot) {
  try {
    localStorage.setItem(JOURNAL_BASE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Non-critical if storage is near quota. */
  }
}

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return true;
  if (error instanceof Error) {
    return /Failed to fetch|NetworkError|Load failed|offline|network/i.test(
      error.message,
    );
  }
  return false;
}

export function useJournal(): JournalBridge & { isLoaded: boolean } {
  const [cached] = useState(() => readJournal());
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>(
    isConfigured() ? "Loading..." : "Saved on this device",
  );
  const [syncState, setSyncState] = useState<SyncState>(
    isConfigured() ? "syncing" : "local",
  );

  const [habits, setHabits] = useState<Habit[]>(
    cached?.habits ?? INITIAL_HABITS,
  );
  const [rows, setRows] = useState<Row[]>(
    cached?.rows ?? [blankRow(localDate())],
  );
  const [showTasksColumn, setShowTasksColumn] = useState(
    cached?.showTasksColumn ?? true,
  );

  const [canSync, setCanSync] = useState(false);
  const revision = useRef(0);
  const saving = useRef(false);
  const pulling = useRef(false);
  const lastPullAt = useRef(0);
  const pauseSync = useRef(false);
  const atomicJournal = useRef(false);
  const journalRevision = useRef("");
  const [fastPoll, setFastPoll] = useState(false);
  const [initialBase] = useState(readJournalBase);
  const baseRef = useRef<JournalSnapshot | null>(initialBase);
  const latest = useRef<JournalSnapshot>({ rows, habits, showTasksColumn });
  const configured = isConfigured();

  useEffect(() => {
    latest.current = { rows, habits, showTasksColumn };
  }, [rows, habits, showTasksColumn]);

  const applySnapshot = useCallback((snap: JournalSnapshot) => {
    latest.current = snap;
    setRows(snap.rows);
    setHabits(snap.habits);
    setShowTasksColumn(snap.showTasksColumn);
  }, []);

  const markDirty = useCallback(() => {
    revision.current++;
    pauseSync.current = false;
    try {
      localStorage.setItem("journal.pending.v1", "true");
    } catch {
      setSyncState("error");
      setSaveStatus("Device storage full · export a backup");
    }
  }, []);

  const pullJournal = useCallback(
    async (reason: "mount" | "visible" | "focus" | "online" | "manual") => {
      if (!configured) {
        setIsLoaded(true);
        setSyncState("local");
        setSaveStatus("Saved on this device");
        return;
      }
      if (saving.current || pulling.current) return;
      if (
        (reason === "visible" || reason === "focus") &&
        Date.now() - lastPullAt.current < 8000
      ) {
        return;
      }
      pulling.current = true;
      lastPullAt.current = Date.now();
      if (reason === "manual") {
        setSaveStatus("Refreshing...");
        setSyncState("syncing");
      }
      try {
        const atStart = revision.current;
        const data = await fetchAllData();
        atomicJournal.current = data.features?.atomicJournal === true;
        setFastPoll(data.features?.fastPoll === true);
        if (data.journalRevision) journalRevision.current = data.journalRevision;
        const remoteSnap: JournalSnapshot = {
          rows: normalizeRows(data.entries),
          habits: data.habits,
          showTasksColumn:
            data.settings.showTasksColumn !== undefined
              ? data.settings.showTasksColumn === "true"
              : latest.current.showTasksColumn,
        };
        const pending =
          localStorage.getItem("journal.pending.v1") === "true" ||
          atStart !== revision.current;
        if (pending && !pauseSync.current) {
          const merged = mergeJournal(
            baseRef.current,
            latest.current,
            remoteSnap,
          );
          baseRef.current = remoteSnap;
          writeJournalBase(remoteSnap);
          applySnapshot(merged);
          setCanSync(true);
          if (journalContentEqual(merged, remoteSnap)) {
            localStorage.removeItem("journal.pending.v1");
            setSyncState("synced");
            setSaveStatus("Saved to Sheet");
          } else {
            setSyncState("syncing");
            setSaveStatus("Merged habits · syncing…");
          }
        } else if (!pauseSync.current) {
          baseRef.current = remoteSnap;
          writeJournalBase(remoteSnap);
          applySnapshot(remoteSnap);
          setCanSync(true);
          setSyncState("synced");
          setSaveStatus("Saved to Sheet");
        }
      } catch (error) {
        const offline = isOfflineError(error);
        setSyncState(offline ? "offline" : "error");
        setSaveStatus(
          offline
            ? "Offline · saved on this device"
            : "Local copy · cloud unavailable",
        );
      } finally {
        pulling.current = false;
        if (reason === "mount") setIsLoaded(true);
      }
    },
    [configured, applySnapshot],
  );

  useEffect(() => {
    void pullJournal("mount");
  }, [pullJournal]);

  useEffect(() => {
    if (!configured || typeof window === "undefined") return;
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void pullJournal("visible");
      }
    };
    const onFocus = () => {
      void pullJournal("focus");
    };
    const onOnline = () => {
      void pullJournal("online");
    };
    const canDoc =
      typeof document !== "undefined" &&
      typeof document.addEventListener === "function";
    const canWin = typeof window.addEventListener === "function";
    if (canDoc) document.addEventListener("visibilitychange", onVisible);
    if (canWin) {
      window.addEventListener("focus", onFocus);
      window.addEventListener("online", onOnline);
    }
    return () => {
      if (canDoc) document.removeEventListener("visibilitychange", onVisible);
      if (canWin) {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
      }
    };
  }, [configured, pullJournal]);

  useEffect(() => {
    if (!configured || !fastPoll || !isLoaded) return;
    const timer = setInterval(() => {
      if (
        (typeof document !== "undefined" &&
          document.visibilityState === "hidden") ||
        saving.current ||
        pulling.current
      ) {
        return;
      }
      void pollRevisions()
        .then((rev) => {
          if (
            rev.journalRevision &&
            rev.journalRevision !== journalRevision.current
          ) {
            void pullJournal("online");
          }
        })
        .catch(() => {
          /* Ignore transient poll errors. */
        });
    }, 12_000);
    return () => clearInterval(timer);
  }, [configured, fastPoll, isLoaded, pullJournal]);

  // Fetch + 3-way merge before writing so concurrent Phone/Desktop habit toggles never clobber each other.
  const syncLocal = useCallback(async () => {
    if (!configured || saving.current) return;
    saving.current = true;
    setSyncState("syncing");
    setSaveStatus("Saving...");
    try {
      let savedRevision: number;
      do {
        savedRevision = revision.current;
        let snapshot = latest.current;
        try {
          const remote = await fetchAllData();
          atomicJournal.current = remote.features?.atomicJournal === true;
          const remoteSnap: JournalSnapshot = {
            rows: normalizeRows(remote.entries),
            habits: remote.habits,
            showTasksColumn:
              remote.settings.showTasksColumn !== undefined
                ? remote.settings.showTasksColumn === "true"
                : snapshot.showTasksColumn,
          };
          const merged = mergeJournal(baseRef.current, snapshot, remoteSnap);
          snapshot = merged;
          if (!journalContentEqual(merged, latest.current)) {
            applySnapshot(merged);
          }
        } catch {
          // If pre-read fails, still attempt the write (or fail cleanly in the write step).
        }
        if (atomicJournal.current) {
          await saveJournal({
            entries: snapshot.rows,
            habits: snapshot.habits,
            showTasksColumn: snapshot.showTasksColumn,
          });
        } else {
          await saveEntries(snapshot.rows);
          await saveHabits(snapshot.habits);
          await saveSetting("showTasksColumn", String(snapshot.showTasksColumn));
        }
        baseRef.current = snapshot;
        writeJournalBase(snapshot);
        if (pauseSync.current) {
          setSyncState("local");
          setSaveStatus("Restored locally · press Sync");
          return;
        }
      } while (savedRevision !== revision.current);
      if (pauseSync.current) {
        setSyncState("local");
        setSaveStatus("Restored locally · press Sync");
        return;
      }
      localStorage.removeItem("journal.pending.v1");
      setCanSync(true);
      setSyncState("synced");
      setSaveStatus("Saved to Sheet");
    } catch (error) {
      const offline = isOfflineError(error);
      setSyncState(offline ? "offline" : "error");
      setSaveStatus(
        offline
          ? "Offline · saved on this device"
          : "Device saved · sync needed",
      );
    } finally {
      saving.current = false;
    }
  }, [configured, applySnapshot]);

  useEffect(() => {
    if (
      !isLoaded ||
      !canSync ||
      !configured ||
      pauseSync.current ||
      localStorage.getItem("journal.pending.v1") !== "true"
    )
      return;
    const timer = setTimeout(() => {
      void syncLocal();
    }, 1000);
    return () => clearTimeout(timer);
  }, [rows, habits, showTasksColumn, isLoaded, canSync, configured, syncLocal]);

  const handleRefresh = useCallback(async () => {
    if (!configured || saving.current) return;
    if (localStorage.getItem("journal.pending.v1") === "true" || pauseSync.current) {
      pauseSync.current = false;
      await syncLocal();
      setCanSync(true);
      return;
    }
    await pullJournal("manual");
  }, [configured, syncLocal, pullJournal]);

  const refresh = useCallback(() => pullJournal("manual"), [pullJournal]);

  const toggleDay = useCallback(
    (date: string, habitId: string) => {
      markDirty();
      const prev = latest.current.rows;
      const existing = prev.find((row) => row.dateStr === date);
      const entry = existing ?? blankRow(date);
      const updated = {
        ...entry,
        habits: { ...entry.habits, [habitId]: !entry.habits[habitId] },
      };
      const next = existing
        ? prev.map((row) => (row.id === existing.id ? updated : row))
        : [...prev, updated].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      latest.current = { ...latest.current, rows: next };
      setRows(next);
    },
    [markDirty],
  );

  const addHabit = useCallback(
    (name: string, colorIndex: number) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const colorTheme = COLOR_OPTIONS[colorIndex % COLOR_OPTIONS.length];
      markDirty();
      const next = [
        ...latest.current.habits,
        {
          id: crypto.randomUUID(),
          name: trimmed,
          color: colorTheme.color,
          lightBg: colorTheme.lightBg,
          ringColor: colorTheme.ringColor,
        },
      ];
      latest.current = { ...latest.current, habits: next };
      setHabits(next);
    },
    [markDirty],
  );

  const editHabit = useCallback(
    (id: string, name: string, colorIndex: number) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const colorTheme = COLOR_OPTIONS[colorIndex % COLOR_OPTIONS.length];
      markDirty();
      const next = latest.current.habits.map((h) =>
        h.id === id
          ? {
              ...h,
              name: trimmed,
              color: colorTheme.color,
              lightBg: colorTheme.lightBg,
              ringColor: colorTheme.ringColor,
            }
          : h,
      );
      latest.current = { ...latest.current, habits: next };
      setHabits(next);
    },
    [markDirty],
  );

  const handleRemoveHabit = useCallback(
    (habitId: string, _habitName: string) => {
      markDirty();
      const next = latest.current.habits.filter((h) => h.id !== habitId);
      latest.current = { ...latest.current, habits: next };
      setHabits(next);
    },
    [markDirty],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        JOURNAL_KEY,
        JSON.stringify({ rows, habits, showTasksColumn }),
      );
    } catch {
      setSyncState("error");
      setSaveStatus("Device storage full");
    }
  }, [rows, habits, showTasksColumn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restore = () => {
      const data = readJournal();
      revision.current++;
      pauseSync.current = true;
      setCanSync(false);
      if (data) {
        applySnapshot(data);
      } else {
        applySnapshot({
          rows: [blankRow(localDate())],
          habits: INITIAL_HABITS,
          showTasksColumn: true,
        });
      }
      baseRef.current = null;
      localStorage.removeItem(JOURNAL_BASE_KEY);
      localStorage.setItem("journal.pending.v1", "true");
      setSyncState("local");
      setSaveStatus("Restored locally · press Sync");
    };
    window.addEventListener("journal-restored", restore);
    return () => window.removeEventListener("journal-restored", restore);
  }, [applySnapshot]);

  return {
    rows,
    habits,
    showTasksColumn,
    toggleDay,
    addHabit,
    editHabit,
    removeHabit: handleRemoveHabit,
    sync: handleRefresh,
    refresh,
    saveStatus,
    syncState,
    isLoaded,
  };
}

export default function Journal({ onReady }: JournalProps) {
  const { isLoaded, ...bridge } = useJournal();
  const {
    rows,
    habits,
    showTasksColumn,
    toggleDay,
    addHabit,
    editHabit,
    removeHabit,
    sync,
    refresh,
    saveStatus,
    syncState,
  } = bridge;

  useEffect(() => {
    if (isLoaded) {
      onReady({
        rows,
        habits,
        showTasksColumn,
        toggleDay,
        addHabit,
        editHabit,
        removeHabit,
        sync,
        refresh,
        saveStatus,
        syncState,
      });
    }
  }, [
    isLoaded,
    onReady,
    rows,
    habits,
    showTasksColumn,
    toggleDay,
    addHabit,
    editHabit,
    removeHabit,
    sync,
    refresh,
    saveStatus,
    syncState,
  ]);

  return null;
}
