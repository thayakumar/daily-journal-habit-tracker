# My Space · Daily Journal & Personal Planner

A personal workspace built around the original daily food, wellness and habit grid. The journal, coloured circles, CSV/copy controls and GitHub Pages URL are preserved.

## Pages

Overview · Daily journal · Habits (daily/recurring) · Calendar · Personal lists · Fitness · Meals · Brain dump · Ideas · Settings & backup.

Work, Prayer & goals and Content planner pages have been removed. Historical records remain recoverable in the backup-compatible data format.

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

Browser copies use `daily-journal.v1` and `personal-workspace.v1`. Full JSON backup/restore is available in Settings. Clearing browser storage removes the local copies.

## Activate per-page sync

Updating the repository does **not** redeploy the Google Apps Script bound to your spreadsheet.

1. Open the spreadsheet → Extensions → Apps Script.
2. Replace Code.gs with [the updated backend](google-apps-script/Code.gs), then save.
3. Deploy → Manage deployments → Edit the existing Web app → New version → Deploy.
4. Keep the existing URL and execution/access settings. Refresh the app; Settings should show **Connected to per-page Sheet tables**.

Until this is done, the app remains compatible with the old backend and explicitly reports legacy JSON storage. Prepared tabs are a migration snapshot until activation. The first v2 request migrates the latest legacy snapshot automatically and retains the old JSON as a backup.

For a new installation, create Entries, Habits and Settings with the original headers documented in `docs/SHEETS_STORAGE.md`/Code.gs, deploy the bound script as a Web app, and set its `/exec` URL as `VITE_GOOGLE_SCRIPT_URL` in `.env` and the GitHub repository Actions secret. GitHub Actions supplies that value during the frontend build.

## Behaviour and limits

- Planner writes use a content revision to detect stale saves. Direct spreadsheet edits are loaded on the next normal app reload or through **Load latest Sheet tables**. Export unsynced local edits before replacing the local copy.
- Journal writes are serialized and retain pending local changes after failures. HabitChecks stores checkmarks as readable dated records; Entries keeps its original habits_json compatibility column.
- Native tables have frozen headers. Keep their header names unchanged. Empty collections keep their headers ready for new records.
- Planner data is no longer limited to one combined JSON cell in v2. Google's per-cell limits still apply to individual fields.
- Habit notifications need browser permission and the app open. They are not background push notifications.
- Calendar holidays are entered manually; leave suggestions assume a Saturday–Sunday weekend.
- Fitness sessions are editable templates. Planned meals and the journal's actual meals remain separate.
- Wishlist records move to a review archive after 30 days and are not permanently deleted.
- The service worker caches only same-origin app resources, never Google Sheets responses.

## Deployment

Pull requests run tests and a production build. Pushes to main run the same checks and publish dist/ through the existing GitHub Pages workflow. Apps Script deployment is separate from frontend deployment.
