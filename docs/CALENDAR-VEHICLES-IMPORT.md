# Calendar, Vehicles, screenshot imports and legacy finance migration

## Calendar and Vehicles

Calendar restores the original month grid, events/holidays/leave forms and leave suggestions. Existing Calendar rows reappear automatically. Vehicle road-tax, insurance and service dates are also rendered as derived events; manage these in Vehicles, without duplicate stored Calendar rows.

Vehicles supports multiple cars/motorcycles, registration, insurer/policy reference, renewal dates, odometer and service-by-mileage/date. Log each service with date, mileage, cost, workshop and work completed; set the next service targets. Vehicle and service records use separate **Vehicles** and **VehicleServices** Sheet tables. Deleting a vehicle requires confirmation and removes its service history; deleting a service does not reverse current mileage/targets.

## Ongoing Portfolio

Accounts, loans, subscriptions, goals, account values and histories span all dates. Current balance snapshots and movements use an empty cycleId, so a salary cycle is not required. Record each current balance by as-of date; the latest dated value is used once per account. Existing cycle-bound records stay intact and remain in the same timeline.

Opening/closing snapshots retain explicit cycles for optional monthly reconciliation. The Finance cycle chooser is collapsed and labelled as optional for Portfolio. Global totals do not change when switching cycles. Date-only movements are included in reconciliation according to their date. Monthly Budget links, cycle comparisons, cycle-specific investment returns and simulator monthly headroom use the selected period.

## Bank screenshot import

Expense Tracker → Import screenshot / pasted text. Tesseract.js loads only when scanning. OCR runs in a browser worker; the image stays in-browser and is not uploaded as a receipt. Engine/language assets download from jsDelivr on first use. PNG/JPEG/WebP up to 12 MB; English text and RM amounts. Pasted transaction text is an alternative.

The review shows editable date, description, amount and category for each candidate. All rows start unselected. Unknown is the initial category; possible credits and multiple-amount lines are flagged. Select outgoing expenses only; exclude incoming payments and transfers between owned accounts. Confirm dates without a year, particularly around New Year. Rows must be dated within the chosen salary cycle, up to today, with positive amounts. Exact date/amount/normalized-description duplicates are rejected both against existing expenses and within the batch; this is a duplicate heuristic, not proof of transaction identity. Import selected rows in one workspace change, immediately updating expense history; each gets a visible Bulk import badge. The source screenshot is not saved.

## Legacy Sheet migration

Portfolio → Accounts → Preview Sheet migration reads only the configured source workbook `17CyWN68zCkijc1drXUbIFbHXs76I5ayEexWB6GpdKak`. It never edits that workbook. The backend uses the existing Apps Script spreadsheet permissions; the deploying account must have access to the source. The preview action accepts no arbitrary spreadsheet ID.

Supported source tabs: Feb, March, APR, May, Jun, Jul, Aug, Oct and Nov 2026. The parser handles the earlier undated expense layout, May's D:G timestamp layout and June onward's F:J layout. DATA is excluded. Source calculated totals are not copied as account assets, debt balances or investment returns. Categories and receipt URLs are retained for dated transactions.

Review each selected month's cycle boundaries (existing cycles are reused; new ones default to the configured payday). Enter each month's actual balance-update date, or leave it blank to skip those account values. Values from Savings Breakdown become dated current snapshots; do not invent opening/closing dates. Map account types, liquidity and optional existing account destinations. Loan instalments are commitments, not outstanding principal. Goals/debt/returns cannot be inferred from the source totals.

Undated transactions are excluded. Future/blank dates are excluded with counts; transaction dates can be corrected in the review. Preserve source dates even if they fall outside the labelled month, unless the user knows they are erroneous. When source expenses already include loan/subscription/family payments, fixed commitments default off for that month to prevent subtracting the same payments twice; review before importing both.

Deterministic source IDs and exact row/date/description/amount checks make repeated imports skip duplicates. Existing monthly rows with matching kind/name are retained. Conflicting existing cycle boundaries produce an error, never an overwrite. Changes to already-imported source records require deliberate editing in the app rather than blindly replacing app data.

Source values are never embedded in the public repo. Local source test snapshots live only in ignored work/.

## Deploy and verification

Replace Code.gs with this release, then Deploy → Manage deployments → edit existing Web app → New version → Deploy, preserving the URL. New flags: vehicles, portfolioTimeline and legacyBudgetImport. No new Drive folder or receipt flow. Devices retain unsupported Vehicle/timeline records locally; older backends receive no unsupported Portfolio payload, and local records merge by ID after upgrade. Back up before using a destructive cloud reload.

`npm test` covers domain and backend persistence/compatibility. `npm run test:new-pages` checks Calendar/Vehicle save/reload, independent Portfolio records, migration and reviewed import against real Code.gs in the spreadsheet mock, mobile/desktop overflow, and an actual rendered screenshot through the browser OCR worker. Browser tests do not modify production data. Live new-table verification requires the Apps Script deployment.
