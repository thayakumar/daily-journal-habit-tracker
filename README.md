# My Space · Daily Journal & Personal Planner

An expanded personal workspace built on the original Daily Journal & Habit Tracker. The rose-and-slate design, coloured habit circles, editable journal grid, CSV export, and Google Sheets integration are retained.

## What’s included

- **Overview** — today’s habit checkmarks, open tasks, weekly fitness progress, upcoming events, and quick thought capture.
- **Daily journal** — the original food, sleep, exercise, notes, and habits matrix. Data is shared with the overview and weekly habit view.
- **Habits** — weekly checkmarks, optional daily reminder times, and recurring routines with due-date countdowns.
- **Calendar** — events, manually entered public holidays, and leave planning. Tuesday/Thursday holidays suggest adjacent leave days, assuming Saturday–Sunday weekends.
- **Work** — task checklists, due dates, and completed-task history.
- **Personal** — personal tasks, groceries, a watch/read list, and a shopping wishlist. Wishlist items move to a review archive after 30 days and remain recoverable.
- **Prayer & goals** — five daily prayer checkmarks, manually entered prayer times, monthly totals, and monthly goals.
- **Fitness** — editable seven-day exercise schedule, exercises/sets/reps, programme duration and countdown, milestones, weekly targets, and completion tracking. The starting schedule is a template, not an AI-generated personal training plan.
- **Meals** — editable meal plans by week and ingredient entry that feeds the grocery checklist. Planned meals and the journal’s actual meals are separate.
- **Brain dump** — timestamped chat-style notes with a one-click action to create a content idea without duplicating it.
- **Ideas** — save notes and HTTP(S) reference links, or move an idea into the brain dump.
- **Content planner** — editable Idea → Draft → Scheduled → Published stages, platform, planned date, draft text, and search. It does not publish to social networks.
- **Settings & backup** — workspace name, storage/sync status, validated full JSON backup and restore.

## Run locally

Requires **Node.js 24** and npm.

```bash
npm ci
npm run dev
```

Open the Vite URL, including `/daily-journal-habit-tracker/` when necessary. The app works without credentials using local browser storage. No new server, paid API, or package service is required at runtime.

```bash
npm test       # date/data validation and React interaction/sync tests
npm run build # TypeScript checks + GitHub Pages production bundle
```

## Google Sheets setup

The existing deployment keeps using the repository’s `VITE_GOOGLE_SCRIPT_URL` GitHub Actions secret. No sheet-column changes or Apps Script redeployment are required for the new planner sections.

For a new connection:

1. Open your existing Google Sheet.
2. Go to **Extensions → Apps Script** and use `google-apps-script/Code.gs`.
3. Deploy as a **Web app**, executing as yourself, with the access needed by your existing app.
4. Copy `.env.example` to `.env` and set `VITE_GOOGLE_SCRIPT_URL` to the deployment URL.
5. For GitHub Pages, set that same value as the repository’s `VITE_GOOGLE_SCRIPT_URL` Actions secret.

The spreadsheet needs these existing sheets and header columns:

- **Entries:** `id, dateStr, displayDate, dayName, sleepTime, exercise, morningFood, afternoonFood, dinnerFood, snack, tasks, habits_json`
- **Habits:** `id, name, colorClass, lightBgClass, ringColorClass`
- **Settings:** key/value columns, including `showTasksColumn`.

New planner data uses the `personalWorkspaceV1` key in **Settings**. It does not change the original journal schema. Planner JSON exceeding 45,000 characters stays local rather than exceeding Google Sheets’ per-cell limit; the app shows this in Settings. Export a backup if you reach that limit.

## Storage and recovery

- Journal and planner edits persist in this browser’s local storage. Refreshing or changing tabs keeps your data.
- When configured, the planner compares its `updatedAt` timestamp with the saved Sheet value on load; the newer snapshot wins. Simultaneous multi-device editing is not merged field by field.
- The journal loads from Sheets when there are no pending local changes. Cloud saves are debounced and serialized. Edits made during a save are included in a subsequent snapshot.
- If journal sync fails, the local copy remains marked as pending. On the next visit, it is kept instead of replaced by an older Sheet copy. Use **Sync** in Daily journal to reconnect. Replacing a remote journal with a pending local/restored copy requires confirmation.
- Full backup exports include the journal, habit definitions, and all planner sections. Restore validates the file and asks before replacing data. A restored journal remains local until explicitly synced; the restored planner resumes normal sync.
- Clearing browser storage removes the local copy. Export a backup before changing browsers or devices when Sheets is not connected.
- Notifications require browser support, permission, and the app to remain open. They are not background push notifications.
- The service worker caches only same-origin app resources, never Google Sheets responses. Offline loading is available after visiting online.

## Deployment

The existing GitHub Pages workflow runs tests and builds before deploying `dist/` on a push to `main`. Pull requests run the same validation without deployment. The original `/daily-journal-habit-tracker/` URL is retained.

## Tech stack

React · TypeScript · Vite · Tailwind CSS · Lucide · Google Sheets / Apps Script
