# Finance addition

Finance uses the existing planner Apps Script endpoint and bound spreadsheet. Its rows live in `FinanceExpenses`; receipts stay in the original Finance Tracker Drive folder. Google sign-in is removed. See [the exact connection and activation instructions](FINANCE.md). Other page tables remain unchanged. The overview now contains navigation buttons only and writes no records of its own.

---

# Per-page Google Sheets storage (backend v2)

The updated frontend works with both backend versions. Settings shows the active storage mode. A legacy backend continues to save the original JSON until its deployment is updated; creating the new tabs alone does not activate continuous per-page sync.

## Activate the updated backend

1. Open the connected spreadsheet and choose **Extensions → Apps Script**.
2. Replace `Code.gs` with the complete `google-apps-script/Code.gs` from this repository, then save.
3. Choose **Deploy → Manage deployments → Edit (pencil)** on the existing Web app deployment. Select **New version**, then **Deploy**. Retain the existing execution/access settings and `/exec` URL. Authorize if Google prompts.
4. Refresh the app. In **Settings & backup**, check for **Connected to per-page Sheet tables**. Make a small edit; the status should become **Saved to per-page Sheet tables**.

Do not create a different Web app URL unless you also update the production `VITE_GOOGLE_SCRIPT_URL` value in `.github/workflows/deploy.yml` and rebuild the frontend.

The first v2 API request migrates the latest legacy planner snapshot into the tables. The original `Settings.personalWorkspaceV1` value is retained as a migration backup. Before activation, the prepared tables are a migration snapshot; keep using the app rather than editing those tables until v2 is active.

## Page-to-table mapping

| App page | Spreadsheet tab(s) | Row structure |
| --- | --- | --- |
| Overview | Overview | Calculated record counts; no duplicate app records |
| Historical journal / habit engine | Entries | Original daily records preserved; the grid page is retired |
| Habits | Habits | Habit definitions, original columns preserved |
| Habits | HabitChecks | date, habitId, completed |
| Habits | RecurringHabits | id, name, intervalDays, lastDone, reminder |
| Habits | HabitReminders | habitId, time |
| Archived calendar | Calendar | Historical events preserved; the page is retired |
| Personal | PersonalTasks | id, text, done, created, due |
| Personal | ShoppingWishlist | id, text, done, created, due |
| Personal | Groceries | id, text, done, created, due |
| Personal | WatchRead | id, text, done, created, due |
| Fitness | FitnessPlan | id, start, weeks, weeklyTarget |
| Archived weekly menu | FitnessSchedule | Existing weekly templates retained as history |
| Fitness | FitnessSessions | date, completed |
| Fitness | WorkoutSets | One row per dated exercise set; see MOBILE_AND_WORKOUTS.md |
| Habits | RecurringChecks | id, habitId, date, previousLastDone |
| Meals | Meals | date, breakfast, lunch, dinner, snack |
| Brain dump | BrainDump | id, text, created, contentId (legacy reference) |
| Ideas | Ideas | id, title, url, note |
| Vocabulary | Vocabulary | id, word, definition, example, createdAt, updatedAt |
| Settings & backup | Settings | Key/value preferences and migration metadata |

The migrated tabs include frozen headers and native tables. ISO dates are readable and sortable. Empty collections keep their headers ready for new records. The original Entries/Habits/Settings tabs are not restyled or cleared by the connector migration.

## Sync contract

- `GET ?action=getAll` returns the original journal fields plus `storageSchemaVersion: 2`, a reconstructed `workspace`, and `workspaceRevision`.
- `POST {action:"saveWorkspace", data, baseRevision}` writes the planner to its own tables and returns a new revision. The revision includes table contents, so direct spreadsheet changes are detected even without an app timestamp change.
- A stale planner save is rejected with `CONFLICT`; local edits remain on the device. Export a backup before using **Load latest Sheet tables** to replace the local copy.
- On a normal app reload, acknowledged local data is refreshed from the tables, so direct spreadsheet edits are loaded. Unsynced local edits are protected from silent replacement.
- Journal writes update both Entries and the readable HabitChecks table. `habits_json` remains in Entries for compatibility; v2 reads HabitChecks for the checkmark state.
- A script lock serializes API requests. Headers are checked before writes; unexpected headers stop the save instead of clearing records. Keep header names unchanged.
- Compatibility writes from cached older frontends are mirrored into the new tables. Refresh old clients after upgrading.
- The combined planner no longer has a single-cell JSON size limit. Each individual cell remains subject to Google's own cell limit.
- Removed Work/Prayer/Content records remain in legacy backup-compatible data, not in active pages.

## Testing and deployment limits

`npm test` runs the real `Code.gs` in a mock SpreadsheetApp environment and drives the actual React page handlers through the API client. It covers all remaining pages, table writes/readback, reload, direct Sheet edits, conflicts, literal text handling, migration and failed cloud saves. This is integration testing, not an interactive Chrome session.

Live cloud write/read tests must run after Apps Script v2 is deployed. Repository access and Sheets editing access do not grant Apps Script deployment access. Updating this source file does not deploy the bound script automatically.

The detailed workout and recurring-completion extension requires the latest Code.gs deployment. The frontend detects its feature flags and keeps these records local until the server supports them. Other table sync continues unchanged.
