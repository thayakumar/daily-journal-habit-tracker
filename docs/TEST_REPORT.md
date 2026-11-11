# Latest mobile, habit and workout verification

30 automated model/React/backend tests pass. Tests cover dated multi-set exercises, independent weights/reps, recurring due dates and undo, customization, persistence and upgrade from an older backend without losing local logs.

Real Chromium checks pass on all eight active pages at 320, 375, 390, 768 and 1440 pixels: 40 layout checks with no document-wide horizontal overflow or clipped inputs. Phone interactions verify multiple exercises, treadmill time/distance, per-set edits, date isolation, reload persistence, habit creation/rename/colour and due-routine completion. Screenshots were inspected. The API is mocked for these browser checks; physical iOS/Safari devices were not tested.

The detailed-log backend is now active: the live endpoint advertises both workoutSets and recurringChecks. Live API tests wrote four labelled workout-set records across two dates and one recurring-completion record. Independent Google Sheets reads confirmed numeric weights (10 and 12.5), different reps (12 and 10), cardio duration (20 minutes), distance (2.5 km), date isolation and matching routine completion dates. All test records were removed. A fresh API read confirmed that the original workspace (excluding updatedAt), journal entries and habit definitions were restored, and independent Sheet reads found no remaining test markers. The new detailed logs are now live-verified; refresh the app to load the active capabilities.

---

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

## Live backend and Google Sheets verification

The owner deployed Apps Script v2. The supplied deployment URL differed from the old frontend configuration; the production build configuration now points to the supplied v2 endpoint.

Labelled temporary records were written through the real deployed Apps Script API, read back through that API, and independently compared cell by cell using the connected Google Sheets service. All 14 data tables matched: PersonalTasks, ShoppingWishlist, Groceries, WatchRead, Calendar, RecurringHabits, HabitReminders, Meals, FitnessPlan, FitnessSchedule, FitnessSessions, BrainDump, Ideas and HabitChecks. A temporary journal entry was also verified in Entries, and the workspace name was verified in Settings.

The test covered personal-list completion, event dates and notes, recurrence interval, reminder time, all four planned meals, fitness target and schedule, a completed session, thought text, idea URL/notes and a dated habit checkmark. Overview reports the new storage as active.

All temporary records were removed. The temporary name, weekly target and schedule title were restored. A fresh API read confirmed the original planner data (excluding the expected updatedAt timestamp), all eight journal entries and all ten habit definitions were restored. Independent Sheet reads found no remaining test markers in the inspected tables.

## Verification limits

The React integration tests exercise actual page handlers and the API client with a mock SpreadsheetApp environment. The live tests exercise the real deployed API and independently read the actual Google Sheet. Shared Chrome control is unavailable in this environment; interactive browser behaviour and visual layout remain unverified.
