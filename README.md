# My Space · Daily Journal & Personal Planner

A personal workspace built around the original daily food, wellness and habit grid. The journal, coloured circles, CSV/copy controls and GitHub Pages URL are preserved.

## Pages

Overview navigation buttons · Habits (daily/recurring) · Personal lists · Fitness daily workout log · Finance expenses, receipts, monthly budgets and Portfolio · Skincare daily journal, routine and photo overview · Calendar · Vehicles · Meals · Brain dump · Ideas · Vocabulary · Settings & backup.

Overview contains large page-navigation cards. Habit/routine management is collapsed by default, with top-level add buttons opening dialogs. Meals shows responsive day cards on phones and an editable seven-day table on desktop.

Finance includes configurable salary cycles, date-filtered monthly summaries, income, commitments, spending budgets, account snapshots and category charts. See [Finance storage and activation](docs/FINANCE.md) and [Portfolio setup and calculations](docs/PORTFOLIO.md).

Work, Prayer & goals, Content planner and Daily journal pages have been removed. Historical records remain recoverable in the backup-compatible data format.

## Run and test

Requires Node.js 24.

```bash
npm ci
npm run dev
npm test
npm run build
```

The production base path is `/daily-journal-habit-tracker/`. Local browser storage works without credentials. Tests use the real React handlers, API client and Apps Script functions, with an in-memory implementation of Google's spreadsheet service.

## Storage

**Backend v2 gives each page readable spreadsheet tables**, rather than one combined JSON cell. See [the exact table mapping and activation steps](docs/SHEETS_STORAGE.md) and [test coverage](docs/TEST_REPORT.md).

The original Entries, Habits and Settings tabs are retained. Added tabs include Overview, HabitChecks, RecurringHabits, HabitReminders, Calendar, PersonalTasks, ShoppingWishlist, Groceries, WatchRead, FitnessPlan, FitnessSchedule, FitnessSessions, Meals, BrainDump and Ideas.

Browser copies use `daily-journal.v1` and `personal-workspace.v1` (along with last-synced base snapshots for 3-way cross-device merging). Full JSON backup/restore is available in Settings. Clearing browser storage removes the local copies.

## Activate per-page sync (new deployments)

The current production backend is active on v2 and has passed live Sheet write/read verification. For future deployments, updating the repository does **not** redeploy the Google Apps Script bound to your spreadsheet.

1. Open the spreadsheet → Extensions → Apps Script.
2. Replace Code.gs with [the updated backend](google-apps-script/Code.gs), then save.
3. Deploy → Manage deployments → Edit the existing Web app → New version → Deploy.
4. Keep the existing URL and execution/access settings. Refresh the app; Settings should show **Connected to per-page Sheet tables**.

Until this is done, the app remains compatible with older v2/legacy deployments. Redeploying the latest `Code.gs` activates dirty-table-only writes, atomic single-request journal saves (`saveJournal`), and `+1 day` cross-timezone date validation tolerance.

For a new installation, create Entries, Habits and Settings with the original headers documented in `docs/SHEETS_STORAGE.md`/Code.gs, deploy the bound script as a Web app, and set its `/exec` URL as `VITE_GOOGLE_SCRIPT_URL` in `.env` for local development. For GitHub Pages deployments, configure `VITE_GOOGLE_SCRIPT_URL` under repository **Settings → Secrets and variables → Actions** (secret or variable) rather than committing the live endpoint URL to git.

## Behaviour and limits

- Planner writes use a content revision to detect concurrent edits across devices. On startup, tab focus/resume, network reconnect, or a `CONFLICT` response, the app automatically pulls the latest Sheet tables, performs a 3-way merge of local and remote changes, and saves the merged result back without clobbering edits from other devices.
- Journal writes are serialized and merge per-habit checkmarks across devices before saving, using the single-request atomic `saveJournal` endpoint when supported (falling back automatically on older deployments). `HabitChecks` stores checkmarks as readable dated records; `Entries` keeps its original `habits_json` compatibility column.
- Native tables have frozen headers. Keep their header names unchanged. Empty collections keep their headers ready for new records.
- Planner data is no longer limited to one combined JSON cell in v2. Google's per-cell limits still apply to individual fields.
- Habit notifications need browser permission and the app open. They are not background push notifications.
- Fitness records multiple exercises per date, with individual weight/reps per strength set and cardio duration/distance. The weekly menu has been retired.
- Due/overdue recurring habits appear alongside daily habits. Habit customization is available directly in Habits.
- Meals uses responsive day cards on phones and a 7-day table on desktop. Historical journal meals remain preserved in Entries and backups.
- Wishlist records move to a review archive after 30 days and are not permanently deleted.
- The service worker caches only same-origin app resources, never Google Sheets responses.

## Deployment

Pull requests run tests and a production build. Pushes to main run the same checks and publish dist/ through the existing GitHub Pages workflow. Apps Script deployment is separate from frontend deployment.

See [mobile verification and daily workout storage](docs/MOBILE_AND_WORKOUTS.md) for the latest UI and backend activation details. Run `npm run test:responsive` for real Chromium viewport checks.

[Vocabulary](docs/VOCABULARY.md) provides a word/definition/example popup, searchable list, edit/delete controls and a dedicated Sheet table. Its table sync requires the latest Apps Script version; local records are retained until that update is active.

[Calendar, Vehicles, screenshot imports and Sheet migration](docs/CALENDAR-VEHICLES-IMPORT.md) covers renewal reminders, browser OCR with editable expense review, an ongoing Portfolio timeline and the legacy budget migration preview.

[Skincare setup and photo storage](docs/SKINCARE.md) explains daily notes/reactions, products, custom AM/PM habits, front/left/right photos and direct photo uploads through the planner connection. Portfolio KPI explanations and live contributor lists appear directly on each card.
