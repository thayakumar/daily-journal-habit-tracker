# Mobile layout and dated workout logs

## Current pages

Overview, Habits, Personal, Fitness, Meals, Brain dump, Ideas and Settings & backup.

Calendar and Daily journal are retired from navigation and deep links. Their existing spreadsheet data is preserved. The journal's data engine continues to maintain daily habit checkmarks in Entries/HabitChecks; its grid is no longer rendered.

## Habits

- Add, rename, recolour and remove daily habits directly in Habits.
- Today's habits combines daily habits with recurring routines whose due date is today or earlier.
- Completing a recurring routine records its completion date and starts the next interval. Undo restores the previous last-completed date.
- Completed routines remain visible for that day. Future routines remain in the recurring list until they become due.
- Daily checkmarks and colour/name changes reflect on Overview and weekly history.

## Fitness

The weekly menu is replaced by a dated exercise log. Select any day up to today, then record as many exercises as needed.

Strength entries accept exercise name, number of sets, weight, kg/lb, reps and notes. Each set is an independent row and can have a different weight or rep count. Sets can be added or deleted individually.

Cardio entries accept exercise name, duration in minutes, optional distance in km and notes. Treadmill incline or machine settings can be recorded in notes.

Workout history opens the corresponding day's entries. Training-day totals count unique dates with logged exercises or a retained completion marker. The weekly target remains editable; old programme/schedule records are retained as historical data.

## New Google Sheets tables

- **WorkoutSets:** id, exerciseId, date, exercise, type, setNumber, weight, unit, reps, durationMinutes, distanceKm, notes. Measurements are numeric cells; empty optional measurements remain blank.
- **RecurringChecks:** id, habitId, date, previousLastDone.

Deploy the latest Code.gs as a new version of the existing Apps Script Web app to enable these tables in the live API. Keep the same deployment URL. The API advertises `features.workoutSets` and `features.recurringChecks`.

Until that update is active, new detailed logs are retained on the device and the app explicitly reports that they are not yet syncing to Sheets. They survive reload and automatically upload when support becomes available. Full backups include them. Existing page/table sync continues to work.

## Responsive verification

Run `npm run test:responsive`. The script uses Playwright with the installed Chromium binary (`CHROMIUM_PATH` can override `/usr/bin/chromium`) and starts a temporary Vite test server. It uses a mock Sheets API to avoid touching personal records.

The check covers all eight pages at 320, 375, 390, 768 and 1440 pixels (40 layout checks), checking document overflow and clipped form controls. Phone-size interaction checks cover navigation, habit customization, due-routine completion, multiple exercises, variable weight/reps, cardio measurements, different dates and reload persistence. Screenshots and the JSON report are written to ignored work/ files.

These are actual Chromium viewport tests, not physical-device or Safari certification.
