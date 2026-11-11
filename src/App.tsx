import { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Check,
  Calendar,
  Moon,
  Dumbbell,
  Coffee,
  Sun,
  Utensils,
  Cookie,
  Sparkles,
  ListTodo,
  BookOpen,
  Info,
  X,
  Download,
  CheckCircle2,
  RefreshCw,
  Copy,
} from "lucide-react";
import {
  fetchAllData,
  saveHabits,
  saveEntries,
  saveSetting,
  isConfigured,
  type Row,
  type Habit,
} from "./lib/sheets-api";
import {
  localDate,
  blankRow,
  readJournal,
  JOURNAL_KEY,
  type JournalSnapshot,
} from "./workspace/model";

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
  saveStatus: string;
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

function getNextDateStr(lastDateStr?: string): string {
  const date = lastDateStr ? new Date(`${lastDateStr}T00:00:00`) : new Date();
  date.setDate(date.getDate() + 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Journal({ onReady, headless = false }: JournalProps) {
  const [cached] = useState(() => readJournal());
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("Loading...");

  const [habits, setHabits] = useState<Habit[]>(
    cached?.habits ?? INITIAL_HABITS,
  );
  const [rows, setRows] = useState<Row[]>(
    cached?.rows ?? [blankRow(localDate())],
  );
  const [newHabitName, setNewHabitName] = useState("");
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [showTasksColumn, setShowTasksColumn] = useState(
    cached?.showTasksColumn ?? true,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [canSync, setCanSync] = useState(false);
  const revision = useRef(0);
  const saving = useRef(false);
  const pauseSync = useRef(false);
  const latest = useRef({ rows, habits, showTasksColumn });
  latest.current = { rows, habits, showTasksColumn };
  const configured = isConfigured();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3200);
  };
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const markDirty = () => {
    revision.current++;
    try {
      localStorage.setItem("journal.pending.v1", "true");
    } catch {
      setSaveStatus("Device storage full · export a backup");
    }
  };

  useEffect(() => {
    if (!configured) {
      setIsLoaded(true);
      setSaveStatus("Saved on this device");
      return;
    }
    let cancelled = false;
    fetchAllData()
      .then((data) => {
        if (cancelled) return;
        if (localStorage.getItem("journal.pending.v1") === "true") {
          setSaveStatus("Local changes · press Sync");
          return;
        }
        setRows(normalizeRows(data.entries));
        setHabits(data.habits);
        if (data.settings.showTasksColumn !== undefined)
          setShowTasksColumn(data.settings.showTasksColumn === "true");
        setCanSync(true);
        setSaveStatus("Saved to Sheet");
      })
      .catch(() => {
        if (!cancelled) {
          setSaveStatus("Local copy · cloud unavailable");
          triggerToast(
            "Could not load your Sheet. Local edits are kept until you reconnect.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  // Serialize full snapshots. Edits during an in-flight save are written in the next pass.
  async function syncLocal() {
    if (!configured || saving.current) return;
    saving.current = true;
    setSaveStatus("Saving...");
    try {
      let savedRevision: number;
      do {
        savedRevision = revision.current;
        const snapshot = latest.current;
        await saveEntries(snapshot.rows);
        await saveHabits(snapshot.habits);
        await saveSetting("showTasksColumn", String(snapshot.showTasksColumn));
        if (pauseSync.current) {
          setSaveStatus("Restored locally · press Sync");
          return;
        }
      } while (savedRevision !== revision.current);
      if (pauseSync.current) {
        setSaveStatus("Restored locally · press Sync");
        return;
      }
      localStorage.removeItem("journal.pending.v1");
      setSaveStatus("Saved to Sheet");
    } catch {
      setSaveStatus("Device saved · sync needed");
      triggerToast(
        "Cloud sync failed. Your journal is still on this device. Press Sync to retry.",
      );
    } finally {
      saving.current = false;
    }
  }

  useEffect(() => {
    if (
      !isLoaded ||
      !canSync ||
      !configured ||
      localStorage.getItem("journal.pending.v1") !== "true"
    )
      return;
    const timer = setTimeout(() => {
      void syncLocal();
    }, 1000);
    return () => clearTimeout(timer);
  }, [rows, habits, showTasksColumn, isLoaded, canSync, configured]);

  const handleRefresh = async () => {
    if (!configured || saving.current) return;
    if (localStorage.getItem("journal.pending.v1") === "true") {
      if (
        !canSync &&
        !confirm(
          "Sync the local journal to Google Sheets? This will replace the Sheet journal and habit definitions with this device’s copy. Export a backup first if you need to keep both.",
        )
      )
        return;
      pauseSync.current = false;
      await syncLocal();
      setCanSync(true);
      return;
    }
    const atStart = revision.current;
    setSaveStatus("Refreshing...");
    try {
      const data = await fetchAllData();
      if (atStart !== revision.current) {
        setSaveStatus("Local edits kept · press Sync");
        return;
      }
      setRows(normalizeRows(data.entries));
      setHabits(data.habits);
      if (data.settings.showTasksColumn !== undefined)
        setShowTasksColumn(data.settings.showTasksColumn === "true");
      setCanSync(true);
      setSaveStatus("Saved to Sheet");
      triggerToast("Refreshed from Google Sheet");
    } catch {
      setSaveStatus("Local copy · cloud unavailable");
      triggerToast("Could not refresh from Google Sheet.");
    }
  };

  useEffect(() => {
    if (!isHabitModalOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsHabitModalOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isHabitModalOpen]);

  // Add a new date row
  const handleAddRow = () => {
    const lastRow = [...rows]
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
      .at(-1);
    const nextDate = rows.some((row) => row.dateStr === localDate())
      ? getNextDateStr(lastRow?.dateStr)
      : localDate();
    const defaultHabitsState: Record<string, boolean> = {};
    habits.forEach((h) => {
      defaultHabitsState[h.id] = false;
    });

    const newRow: Row = {
      id: `row-${Date.now()}`,
      dateStr: nextDate,
      displayDate: formatToDDMM(nextDate),
      dayName: getDayShortName(nextDate),
      sleepTime: "",
      exercise: "",
      morningFood: "",
      afternoonFood: "",
      dinnerFood: "",
      snack: "",
      tasks: "",
      habits: defaultHabitsState,
    };

    markDirty();
    setRows((prev) =>
      [...prev, newRow].sort((a, b) => a.dateStr.localeCompare(b.dateStr)),
    );
    triggerToast(`Added entry for ${formatToDDMM(nextDate)}`);
  };

  // Delete a date row
  const handleDeleteRow = (rowId: string) => {
    if (rows.length <= 1) {
      triggerToast("Need at least one date row in the tracker.");
      return;
    }
    if (!confirm("Delete this journal day and its entries?")) return;
    markDirty();
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Update local state immediately; cloud snapshots are debounced above.
  const handleCellChange = (rowId: string, field: string, value: string) => {
    if (
      field === "dateStr" &&
      (!value || rows.some((r) => r.id !== rowId && r.dateStr === value))
    ) {
      triggerToast("Each journal day needs a unique date.");
      return;
    }
    markDirty();
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (field === "dateStr") {
          return {
            ...row,
            dateStr: value,
            displayDate: formatToDDMM(value),
            dayName: getDayShortName(value),
          };
        }
        return { ...row, [field]: value };
      }),
    );
  };

  const toggleDay = (date: string, habitId: string) => {
    const existing = rows.find((row) => row.dateStr === date);
    const entry = existing ?? blankRow(date);
    const updated = {
      ...entry,
      habits: { ...entry.habits, [habitId]: !entry.habits[habitId] },
    };
    markDirty();
    setRows((prev) =>
      existing
        ? prev.map((row) => (row.id === existing.id ? updated : row))
        : [...prev, updated].sort((a, b) => a.dateStr.localeCompare(b.dateStr)),
    );
  };
  const handleToggleHabit = (rowId: string, habitId: string) => {
    const row = rows.find((item) => item.id === rowId);
    if (row) toggleDay(row.dateStr, habitId);
  };

  useEffect(() => {
    if (isLoaded)
      onReady({
        rows,
        habits,
        showTasksColumn,
        toggleDay,
        addHabit,
        editHabit,
        removeHabit: handleRemoveHabit,
        sync: handleRefresh,
        saveStatus,
      });
  }, [rows, habits, showTasksColumn, isLoaded, saveStatus, onReady]);

  useEffect(() => {
    try {
      localStorage.setItem(
        JOURNAL_KEY,
        JSON.stringify({ rows, habits, showTasksColumn }),
      );
    } catch {
      setSaveStatus("Device storage full");
    }
  }, [rows, habits, showTasksColumn]);

  useEffect(() => {
    const restore = () => {
      const data = readJournal();
      if (data) {
        revision.current++;
        pauseSync.current = true;
        setCanSync(false);
        setRows(data.rows);
        setHabits(data.habits);
        setShowTasksColumn(data.showTasksColumn);
        setSaveStatus("Restored locally · press Sync");
      }
    };
    window.addEventListener("journal-restored", restore);
    return () => window.removeEventListener("journal-restored", restore);
  }, []);

  const addHabit = (name: string, colorIndex: number) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const colorTheme = COLOR_OPTIONS[colorIndex % COLOR_OPTIONS.length];
    markDirty();
    setHabits((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: trimmed,
        color: colorTheme.color,
        lightBg: colorTheme.lightBg,
        ringColor: colorTheme.ringColor,
      },
    ]);
  };
  const editHabit = (id: string, name: string, colorIndex: number) => {
    if (!name.trim()) return;
    const colorTheme = COLOR_OPTIONS[colorIndex % COLOR_OPTIONS.length];
    markDirty();
    setHabits((previous) =>
      previous.map((h) =>
        h.id === id
          ? {
              ...h,
              name,
              color: colorTheme.color,
              lightBg: colorTheme.lightBg,
              ringColor: colorTheme.ringColor,
            }
          : h,
      ),
    );
  };
  const handleAddHabit = (event: React.FormEvent) => {
    event.preventDefault();
    addHabit(newHabitName, selectedColorIdx);
    setNewHabitName("");
  };

  // Remove habit
  const handleRemoveHabit = (habitId: string, habitName: string) => {
    const updatedHabits = habits.filter((h) => h.id !== habitId);
    markDirty();
    setHabits(updatedHabits);
    triggerToast(`Removed habit "${habitName}"`);
  };

  // Toggle tasks column
  const handleToggleTasks = () => {
    const nextVal = !showTasksColumn;
    markDirty();
    setShowTasksColumn(nextVal);
  };

  // Copy for sheets paste
  const handleCopyForSheets = () => {
    const headers = [
      "Date",
      "Morning Food",
      "Afternoon Food",
      "Dinner Food",
      "Snack",
      ...(showTasksColumn ? ["Tasks & Notes"] : []),
      "Sleep Time",
      "Exercise",
      ...habits.map((h) => `Habit: ${h.name}`),
    ];
    const tsvRows = rows.map((r) => {
      const habitCols = habits.map((h) => (r.habits[h.id] ? "TRUE" : "FALSE"));
      const clean = (txt: string) =>
        (txt || "").replace(/\t/g, " ").replace(/\n/g, " / ");
      return [
        clean(r.displayDate),
        clean(r.morningFood),
        clean(r.afternoonFood),
        clean(r.dinnerFood),
        clean(r.snack),
        ...(showTasksColumn ? [clean(r.tasks)] : []),
        clean(r.sleepTime),
        clean(r.exercise),
        ...habitCols,
      ].join("\t");
    });
    navigator.clipboard
      .writeText([headers.join("\t"), ...tsvRows].join("\n"))
      .then(() => triggerToast("Copied! Paste into Google Sheets."))
      .catch(() =>
        triggerToast("Clipboard unavailable. Please use CSV export."),
      );
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Morning Food",
      "Afternoon Food",
      "Dinner Food",
      "Snack",
      ...(showTasksColumn ? ["Tasks & Notes"] : []),
      "Sleep Time",
      "Exercise",
      ...habits.map((h) => `Habit: ${h.name}`),
    ];
    const csvRows = rows.map((r) => {
      const habitCols = habits.map((h) => (r.habits[h.id] ? "Done" : "Missed"));
      const clean = (txt: string) =>
        `"${(txt || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
      return [
        clean(r.displayDate),
        clean(r.morningFood),
        clean(r.afternoonFood),
        clean(r.dinnerFood),
        clean(r.snack),
        ...(showTasksColumn ? [clean(r.tasks)] : []),
        clean(r.sleepTime),
        clean(r.exercise),
        ...habitCols.map(clean),
      ].join(",");
    });
    const csvString = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "daily_journal_tracker.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("Exported journal to CSV!");
  };

  const stats = useMemo(() => {
    let totalChecks = 0;
    const possibleChecks = rows.length * habits.length;
    rows.forEach((r) => {
      habits.forEach((h) => {
        if (r.habits[h.id]) totalChecks++;
      });
    });
    const completionRate =
      possibleChecks > 0 ? Math.round((totalChecks / possibleChecks) * 100) : 0;
    return { totalDays: rows.length, totalChecks, completionRate };
  }, [rows, habits]);

  if (headless) return null;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">
            Loading from Google Sheet...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 relative z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Daily journal
                </h1>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                  Grid View
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Your original meal, wellness and habit matrix. Everything in one
                familiar grid.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Save Status */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                saveStatus.includes("unavailable") ||
                saveStatus.includes("needed") ||
                saveStatus.includes("press Sync") ||
                saveStatus.includes("full")
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {saveStatus === "Saving..." ||
              saveStatus === "Refreshing..." ||
              saveStatus === "Loading..." ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{saveStatus}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 bg-slate-100/80 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 mr-1">
              <div>
                <span className="text-slate-400">Days Logged:</span>{" "}
                <span className="font-bold text-slate-800">
                  {stats.totalDays}
                </span>
              </div>
              <div className="h-3.5 w-[1px] bg-slate-300" />
              <div>
                <span className="text-slate-400">Habit Score:</span>{" "}
                <span className="font-bold text-emerald-600">
                  {stats.completionRate}%
                </span>
              </div>
            </div>

            {/* Refresh */}
            {configured && (
              <button
                onClick={handleRefresh}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm"
                title="Sync pending local changes, or refresh from Google Sheet"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}

            {/* Tasks Column Toggle */}
            <button
              onClick={handleToggleTasks}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-sm ${
                showTasksColumn
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Tasks Col</span>
            </button>

            {/* Manage Habits */}
            <button
              onClick={() => setIsHabitModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition flex items-center gap-1.5 shadow-sm shadow-rose-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Manage Habits ({habits.length})</span>
            </button>

            {/* Copy for Sheets */}
            <button
              onClick={handleCopyForSheets}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm"
              title="Copy for Google Sheets"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Copy</span>
            </button>

            {/* CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Habit Bar */}
        <div className="bg-slate-100/70 border-t border-slate-200/80 px-4 sm:px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                Active Habits (Circles in Grid):
              </span>
              {habits.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  No habits added yet. Add one on the right!
                </span>
              ) : (
                habits.map((habit, idx) => (
                  <div
                    key={habit.id}
                    className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium border ${habit.lightBg}`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${habit.color}`}
                    >
                      {idx + 1}
                    </span>
                    <span>{habit.name}</span>
                    <button
                      onClick={() => handleRemoveHabit(habit.id, habit.name)}
                      className="p-0.5 hover:bg-black/10 rounded-full transition"
                      title={`Remove ${habit.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleAddHabit}
              className="flex items-center gap-1.5"
            >
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="New habit name..."
                  className="text-xs bg-transparent focus:outline-none w-32 sm:w-40 text-slate-800 placeholder:text-slate-400"
                />
                <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
                  {COLOR_OPTIONS.slice(0, 4).map((c, i) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColorIdx(i)}
                      className={`w-3.5 h-3.5 rounded-full ${c.color} transition-transform ${selectedColorIdx === i ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "opacity-60 hover:opacity-100"}`}
                      title={`Color: ${c.name}`}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Table */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-6">
        <div className="bg-white rounded-2xl shadow-md border-2 border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1150px]">
              <thead>
                <tr className="bg-slate-100/90 border-b-2 border-slate-300 text-left">
                  <th className="py-3.5 px-3 w-32 text-center font-bold text-xs uppercase tracking-wider text-rose-600 border-r-2 border-slate-300 sticky left-0 bg-slate-100 z-20">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Calendar className="w-4 h-4 text-rose-500 mb-0.5" />
                      <span>Date</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        (DD/MM)
                      </span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[170px] font-bold text-xs uppercase tracking-wider text-slate-700 border-r-2 border-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Morning Food</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[170px] font-bold text-xs uppercase tracking-wider text-slate-700 border-r-2 border-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Afternoon Food</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[170px] font-bold text-xs uppercase tracking-wider text-slate-700 border-r-2 border-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Utensils className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Dinner Food</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 min-w-[150px] font-bold text-xs uppercase tracking-wider text-slate-700 border-r-2 border-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Cookie className="w-4 h-4 text-yellow-600 shrink-0" />
                      <span>Snack</span>
                    </div>
                  </th>
                  {showTasksColumn && (
                    <th className="py-3.5 px-3 min-w-[180px] font-bold text-xs uppercase tracking-wider text-indigo-600 border-r-2 border-slate-300">
                      <div className="flex items-center gap-1.5">
                        <ListTodo className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>Tasks & Journal</span>
                      </div>
                    </th>
                  )}
                  <th className="py-3.5 px-3 w-40 font-bold text-xs uppercase tracking-wider text-rose-600 border-r-2 border-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Sleep Time</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 w-40 font-bold text-xs uppercase tracking-wider text-rose-600 border-r-2 border-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Dumbbell className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Exercise</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3 w-48 font-bold text-xs uppercase tracking-wider text-rose-600 border-r-2 border-slate-300 bg-rose-50/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Habit</span>
                      </div>
                      <button
                        onClick={() => setIsHabitModalOpen(true)}
                        className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  </th>
                  <th className="py-3.5 px-2 w-12 text-center font-bold text-xs text-slate-400">
                    Del
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-300">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Date */}
                    <td className="p-2 align-top border-r-2 border-slate-300 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                      <div className="border-2 border-rose-500/80 rounded-xl p-2 h-28 flex flex-col items-center justify-center text-center bg-rose-50/20">
                        <span className="text-2xl font-extrabold tracking-tight text-rose-600 leading-none">
                          {row.displayDate || "—"}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mt-1">
                          {row.dayName}
                        </span>
                        <input
                          type="date"
                          value={row.dateStr}
                          onChange={(e) =>
                            handleCellChange(row.id, "dateStr", e.target.value)
                          }
                          className="mt-2 w-24 text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-rose-400 cursor-pointer"
                          title="Change Date"
                        />
                      </div>
                    </td>

                    {/* Morning */}
                    <td className="p-2 align-top border-r-2 border-slate-300">
                      <div className="border-2 border-slate-200 focus-within:border-amber-400 rounded-xl p-2 h-28 flex flex-col transition-colors">
                        <textarea
                          value={row.morningFood}
                          onChange={(e) =>
                            handleCellChange(
                              row.id,
                              "morningFood",
                              e.target.value,
                            )
                          }
                          placeholder="Breakfast & morning drinks..."
                          className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </td>

                    {/* Afternoon */}
                    <td className="p-2 align-top border-r-2 border-slate-300">
                      <div className="border-2 border-slate-200 focus-within:border-orange-400 rounded-xl p-2 h-28 flex flex-col transition-colors">
                        <textarea
                          value={row.afternoonFood}
                          onChange={(e) =>
                            handleCellChange(
                              row.id,
                              "afternoonFood",
                              e.target.value,
                            )
                          }
                          placeholder="Lunch meal details..."
                          className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </td>

                    {/* Dinner */}
                    <td className="p-2 align-top border-r-2 border-slate-300">
                      <div className="border-2 border-slate-200 focus-within:border-rose-400 rounded-xl p-2 h-28 flex flex-col transition-colors">
                        <textarea
                          value={row.dinnerFood}
                          onChange={(e) =>
                            handleCellChange(
                              row.id,
                              "dinnerFood",
                              e.target.value,
                            )
                          }
                          placeholder="Dinner meal details..."
                          className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </td>

                    {/* Snack */}
                    <td className="p-2 align-top border-r-2 border-slate-300">
                      <div className="border-2 border-slate-200 focus-within:border-yellow-500 rounded-xl p-2 h-28 flex flex-col transition-colors">
                        <textarea
                          value={row.snack}
                          onChange={(e) =>
                            handleCellChange(row.id, "snack", e.target.value)
                          }
                          placeholder="Fruits, nuts, tea, snacks..."
                          className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </td>

                    {/* Tasks */}
                    {showTasksColumn && (
                      <td className="p-2 align-top border-r-2 border-slate-300">
                        <div className="border-2 border-indigo-100 focus-within:border-indigo-400 rounded-xl p-2 h-28 flex flex-col transition-colors bg-indigo-50/10">
                          <textarea
                            value={row.tasks}
                            onChange={(e) =>
                              handleCellChange(row.id, "tasks", e.target.value)
                            }
                            placeholder="&#8226; Top tasks for today&#10;&#8226; Daily journal thoughts..."
                            className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                          />
                        </div>
                      </td>
                    )}

                    {/* Sleep */}
                    <td className="p-2 align-top border-r-2 border-slate-300 bg-white">
                      <div className="border-2 border-slate-200 focus-within:border-rose-400 rounded-xl p-2 h-28 flex flex-col transition-colors bg-slate-50/40">
                        <textarea
                          value={row.sleepTime}
                          onChange={(e) =>
                            handleCellChange(
                              row.id,
                              "sleepTime",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. 7.5 hrs&#10;11pm - 6:30am"
                          className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </td>

                    {/* Exercise */}
                    <td className="p-2 align-top border-r-2 border-slate-300 bg-white">
                      <div className="border-2 border-slate-200 focus-within:border-rose-400 rounded-xl p-2 h-28 flex flex-col transition-colors bg-slate-50/40">
                        <textarea
                          value={row.exercise}
                          onChange={(e) =>
                            handleCellChange(row.id, "exercise", e.target.value)
                          }
                          placeholder="e.g. 30m Run&#10;Leg day workout"
                          className="w-full h-full resize-none border-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </td>

                    {/* Habits */}
                    <td className="p-2 align-top border-r-2 border-slate-300 bg-rose-50/15">
                      <div className="border-2 border-rose-200/90 rounded-xl p-2.5 min-h-28 h-full flex flex-col justify-between bg-white">
                        {habits.length === 0 ? (
                          <div className="my-auto text-center">
                            <button
                              onClick={() => setIsHabitModalOpen(true)}
                              className="text-xs text-rose-500 hover:underline font-medium"
                            >
                              + Add habits
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5 place-items-center my-auto py-1">
                            {habits.map((habit) => {
                              const isCompleted = !!row.habits[habit.id];
                              return (
                                <button
                                  key={habit.id}
                                  type="button"
                                  onClick={() =>
                                    handleToggleHabit(row.id, habit.id)
                                  }
                                  aria-pressed={isCompleted}
                                  title={`${habit.name}: ${isCompleted ? "Completed" : "Click to mark done"}`}
                                  className="group flex flex-col items-center gap-1 focus:outline-none"
                                >
                                  <div
                                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                                      isCompleted
                                        ? `${habit.color} text-white shadow-sm scale-105`
                                        : `border-rose-400/80 bg-white text-transparent hover:scale-105 ${habit.ringColor}`
                                    }`}
                                  >
                                    <Check
                                      className={`w-5 h-5 stroke-[2.5] transition-transform ${isCompleted ? "scale-100" : "scale-0 group-hover:scale-75 group-hover:text-slate-300"}`}
                                    />
                                  </div>
                                  <span
                                    className={`text-[10px] font-medium max-w-[68px] truncate leading-tight ${isCompleted ? "text-slate-800 font-semibold" : "text-slate-400"}`}
                                  >
                                    {habit.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="p-2 align-middle text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Date Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Bar */}
          <div className="bg-slate-50 border-t-2 border-slate-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleAddRow}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-sm shadow-rose-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {rows.some((r) => r.dateStr === localDate())
                  ? "Add Next Date Row"
                  : "Add Today’s Row"}
              </span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Tip: Click any circular ring in the <strong>Habit</strong>{" "}
                column to toggle completion, or click any box to type food &
                notes.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Habit Modal */}
      {isHabitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-modal-title"
            className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-500" />
                <h2
                  id="habit-modal-title"
                  className="font-bold text-slate-900 text-base"
                >
                  Customize Your Rounded Habit Circles
                </h2>
              </div>
              <button
                onClick={() => setIsHabitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <form onSubmit={handleAddHabit} className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Add New Habit Circle
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="e.g., Meditate, 10k Steps, Skincare..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl transition flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">
                    Checkmark Color:
                  </span>
                  <div className="flex items-center gap-2">
                    {COLOR_OPTIONS.map((c, idx) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColorIdx(idx)}
                        className={`w-6 h-6 rounded-full ${c.color} flex items-center justify-center text-white transition-transform ${
                          selectedColorIdx === idx
                            ? "scale-110 ring-2 ring-offset-2 ring-slate-400"
                            : "opacity-60 hover:opacity-100"
                        }`}
                      >
                        {selectedColorIdx === idx && (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Habits ({habits.length})
                </label>
                {habits.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                    No habits configured yet. Add one above!
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {habits.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${h.color}`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </span>
                          <span className="text-sm font-medium text-slate-800">
                            {h.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveHabit(h.id, h.name)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsHabitModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
