# Per-page storage test report

## Automated checks

26 automated tests pass, including a native-table checkbox regression check. The suite executes the actual React page handlers, API client and Code.gs backend functions, with Google SpreadsheetApp represented by an in-memory test implementation. This does not constitute live Google Apps Script execution or browser visual QA.

| Page | Verified actions | Table(s) inspected in integration test |
| --- | --- | --- |
| Overview | Quick thought and shared habit checkmark | BrainDump, Entries, HabitChecks |
| Daily journal | Actual meal edit, cloud-save retry and serialized writes | Entries, HabitChecks |
| Habits | Reminder time, recurring habit, weekly checkmarks | HabitReminders, RecurringHabits, HabitChecks |
| Calendar | Event title, date and notes | Calendar |
| Personal | All four lists; task completion | PersonalTasks, ShoppingWishlist, Groceries, WatchRead |
| Fitness | Duration, target, session title and completion | FitnessPlan, FitnessSchedule, FitnessSessions |
| Meals | Planned meal and ingredient transfer | Meals, Groceries |
| Brain dump | Create and delete | BrainDump |
| Ideas | Idea title, URL and notes | Ideas |
| Settings | Workspace name, storage-mode status, persistence | Settings |

Additional tests verify migration, backup validation, recurrence/date boundaries, archive timing, URL handling, backend header protection, stale-save rejection, direct spreadsheet edits on reload and planner size beyond the old combined-cell cap.

## Actual spreadsheet migration verification

The existing spreadsheet received 15 new tabs: Overview plus 14 data tables. The migration snapshot contains 70 habit-check records, one saved meal-plan row, one fitness-plan row and seven weekly fitness-schedule rows. Other collections are currently empty. All populated cells were re-read and compared with the source snapshot; all matched. Frozen headers and native table ranges were verified through Sheets metadata. Existing journal/habit records and the legacy JSON value were preserved.

## Pending live verification

The deployed Apps Script must be upgraded using `docs/SHEETS_STORAGE.md`. Until the live endpoint returns `storageSchemaVersion: 2`, new app edits still use legacy storage and the prepared tables are only a snapshot. Production per-page write/read verification is pending that deployment. Shared Chrome control is unavailable in this environment; visual browser QA remains unverified.
