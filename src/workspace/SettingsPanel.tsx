import { useRef, useState } from "react";
import { Cloud, Download, Upload } from "lucide-react";
import type { JournalBridge } from "../App";
import { importFromSheets, isConfigured } from "../lib/sheets-api";
import {
  downloadJson,
  isJournal,
  isWorkspace,
  JOURNAL_KEY,
  localDate,
  readJournal,
  WORKSPACE_KEY,
  type Workspace,
} from "./model";
import {
  Card,
  Field,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";

export function SettingsPanel({
  data,
  journal,
  update,
  status,
  retrySync,
  reloadCloud,
  tableStorage,
  logStorageReady,
  fastBackend,
  sheetsImportReady,
}: {
  data: Workspace;
  journal: JournalBridge | null;
  update: Update;
  status: string;
  retrySync: () => Promise<void>;
  reloadCloud: () => Promise<void>;
  tableStorage: boolean;
  logStorageReady: boolean;
  fastBackend: boolean;
  sheetsImportReady: boolean;
}) {
  const [message, setMessage] = useState("");
  const [importingSheets, setImportingSheets] = useState(false);
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
      if (backup.journal) {
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(backup.journal));
      } else {
        localStorage.removeItem(JOURNAL_KEY);
      }
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(backup.workspace));
      localStorage.setItem("journal.pending.v1", "true");
      window.dispatchEvent(new Event("journal-restored"));
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
                ? "Planner sections save to their own Sheet tables and automatically merge changes across your phone and desktop."
                : "Changes stay in this browser, on this device. Your existing GitHub Pages deployment keeps its Sheets configuration when this update is merged."}
            </p>
          </div>
        </div>
        {isConfigured() && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={secondaryClass}
              onClick={() => {
                void retrySync();
                void journal?.sync();
              }}
            >
              Retry planner sync
            </button>
            <button
              type="button"
              className={secondaryClass}
              onClick={() => {
                if (
                  confirm(
                    fastBackend
                      ? "Load the latest planner from Turso cloud and replace this device’s local copy? Export a backup first if you have unsynced edits."
                      : "Load the latest planner from Google Sheets and replace this device’s planner? Export a backup first if you have unsynced edits.",
                  )
                )
                  void reloadCloud();
              }}
            >
              {fastBackend ? "Reload from Turso" : "Load latest Sheet tables"}
            </button>
            {fastBackend && sheetsImportReady && (
              <button
                type="button"
                className={primaryClass}
                disabled={importingSheets}
                onClick={async () => {
                  if (
                    !confirm(
                      "Import all existing planner & habit records from Google Sheets into Turso? This replaces the current Turso records with your latest Google Sheet data.",
                    )
                  )
                    return;
                  setImportingSheets(true);
                  try {
                    const res = await importFromSheets();
                    await reloadCloud();
                    await journal?.refresh();
                    setMessage(
                      `Imported ${res.imported.habits} habits and ${res.imported.entries} journal days${res.imported.hasWorkspace ? " plus your full planner" : ""} from Google Sheets into Turso.`,
                    );
                  } catch (e) {
                    setMessage(
                      e instanceof Error
                        ? e.message
                        : "Could not import from Google Sheets.",
                    );
                  } finally {
                    setImportingSheets(false);
                  }
                }}
              >
                {importingSheets
                  ? "Importing from Sheets…"
                  : "Import from Google Sheets"}
              </button>
            )}
          </div>
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
            {fastBackend
              ? "Fast edge sync is active via Cloudflare Worker + Turso SQLite. Skincare photos and Finance receipts stage briefly in Turso for instant uploads, offload to Google Drive in the background, and automatically wipe from Turso once Drive confirms."
              : tableStorage
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
            type="button"
            className={primaryClass}
            onClick={() => {
              const liveJournal = journal
                ? {
                    rows: journal.rows,
                    habits: journal.habits,
                    showTasksColumn: journal.showTasksColumn,
                  }
                : readJournal();
              downloadJson(
                {
                  format: "my-space-backup",
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  workspace: data,
                  journal: liveJournal,
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
            type="button"
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
