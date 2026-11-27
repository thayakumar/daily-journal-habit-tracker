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
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card compact title="Workspace & sync">
          <div className="space-y-4">
            <Field label="Workspace name">
              <input
                maxLength={40}
                className={inputClass}
                value={data.name}
                onChange={(e) =>
                  update((s) => ({ ...s, name: e.target.value }))
                }
              />
            </Field>
            <div className="flex items-start gap-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3.5">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-[#6E6358]" />
              <div className="min-w-0">
                <p role="status" className="text-xs font-semibold text-[#24201D] sm:text-sm">
                  {status}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#5C5248]">
                  {isConfigured()
                    ? "Changes sync automatically across your phone and desktop."
                    : "Changes stay in this browser on this device."}
                </p>
              </div>
            </div>
            {isConfigured() && (
              <div className="flex flex-wrap gap-2">
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
          </div>
        </Card>

        <Card
          compact
          title="Backups & data"
          subtitle="One JSON file includes habits, journal, finance, skincare, and every room."
        >
          <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
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
                setMessage(
                  "Backup exported. Keep the JSON file somewhere safe.",
                );
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
              className="mt-3 rounded-xl bg-[#FAF7F2] p-3 text-xs font-medium text-[#4C433B]"
            >
              {message}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-[#6E6358]">
            Keep a backup before clearing browser data or switching devices.
          </p>
        </Card>
      </div>

      {/* Collapsible Architecture & Tips Accordions */}
      <details className="clay-card rounded-2xl">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#473F38] sm:text-sm">
          Where your data is stored
        </summary>
        <div className="space-y-2 border-t border-[#EFE8DC] px-4 py-3.5 text-xs leading-relaxed text-[#5C5248]">
          <p>
            On this browser: localStorage keys <code>daily-journal.v1</code> and{" "}
            <code>personal-workspace.v1</code>.
          </p>
          <p>
            {fastBackend
              ? "Fast edge sync is active via Cloudflare Worker + Turso SQLite. Skincare photos and Finance receipts stage briefly in Turso for instant uploads, offload to Google Drive in the background, and automatically wipe from Turso once Drive confirms."
              : tableStorage
                ? logStorageReady
                  ? "Per-page storage, including dated workout sets and routine completion history, is active."
                  : "Existing per-page sync is active. Detailed workout sets and routine completion history stay on this device until the latest connection update is deployed."
                : "The deployed Apps Script still uses legacy JSON. The new per-page tables become live after the backend update is deployed."}
          </p>
          <p>
            Habits: Habits, HabitChecks, RecurringHabits, RecurringChecks and
            HabitReminders. Historical journal records: Entries. Personal:
            PersonalTasks, ShoppingWishlist, Groceries, WatchRead. Fitness:
            FitnessPlan, FitnessSessions and WorkoutSets. Meals: Meals. Brain
            dump: BrainDump. Ideas: Ideas. Preferences: Settings.
          </p>
        </div>
      </details>

      <details className="clay-card rounded-2xl">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#473F38] sm:text-sm">
          How reminders &amp; logs work
        </summary>
        <ul className="space-y-2 border-t border-[#EFE8DC] px-4 py-3.5 text-xs leading-relaxed text-[#5C5248]">
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
      </details>
    </div>
  );
}
