# Finance inside My Space

Live activation verified on 12 November 2026: expense saves, receipt uploads to the original folder, fresh-session loading and refresh persistence all passed. Temporary test records and the receipt were removed.

Finance reuses the expense form, category choices, receipt upload and searchable/filterable expense history from `thayakumar/Finance-Tracker`, adapted to the planner’s rose/slate styling and mobile layout. Google sign-in, Firebase and direct browser access to the Google Sheets/Drive APIs are removed. No additional dependency is required.

## Storage and connection

Expenses use the same `VITE_GOOGLE_SCRIPT_URL`, `useWorkspace` state, device backup, revision-checked saves and bound spreadsheet as the rest of the planner. Each expense is a row in **FinanceExpenses**:

`id | date | item | amount | category | receiptName | receiptUrl | createdAt`

Receipts are uploaded by the Apps Script deployment owner to the **existing** Drive folder `1_fo4Fn8Oq-ttn1vhZAAZFUH49jIyJrXd`, taken from the supplied Finance Tracker’s `appscript-code.txt`. The frontend sends the file to the planner’s `uploadFinanceReceipt` action, receives a confirmed Drive name/link, then adds the expense to the normal planner state. A failed upload leaves the form intact and adds no expense. Uploaded receipts retain the folder’s existing access policy; the script does not change sharing permissions.

PDF/JPEG/PNG/WebP files up to 10 MB are accepted. Expenses can be recorded locally before the backend update. Receipt uploads are unavailable until the backend advertises `features.finance`; pending local expense records merge by ID after the new backend becomes available. Older clients that omit the finance collection cannot erase its rows.

The original Finance Tracker spreadsheet and its DATA tab are left untouched. Existing expenses there are not automatically imported. The user requested retaining the UI and receipt folder, using the current planner architecture for new records.

## Activate the backend

1. Open the planner’s Google Sheet → Extensions → Apps Script.
2. Replace `Code.gs` with this repository’s `google-apps-script/Code.gs` and save.
3. Select and run `authorizeFinanceReceipts` once. Approve Google’s authorization prompt using the account that owns the deployment and has access to the existing receipts folder.
4. Deploy → Manage deployments → Edit the existing Web app → New version → Deploy. Keep the existing URL and deployment settings.
5. Reload the planner. `FinanceExpenses` is created automatically; receipt uploads become available when `features.finance` is returned.

## Verification

The automated backend suite runs the actual Code.gs code against mocked SpreadsheetApp/DriveApp. It checks expense round trips, literal formula-like descriptions, preservation by older clients, folder identity and rejection of invalid uploads. The hook suite checks pending local records across a backend upgrade. Chromium exercises the form, receipt upload, history filters, reload persistence and failed-upload recovery with mocked APIs. These checks do not prove a live Apps Script deployment has been updated or authorized for Drive.

## Monthly Budget and configurable salary cycles

Live monthly planning, custom dates, ledger-derived totals and the category chart were verified on 12 November 2026, including refresh persistence and cleanup of all temporary test records.

Finance now has Expense Tracker and Monthly Budget tabs. Both use the same FinanceExpenses ledger. A shared cycle selector filters expenses by the selected inclusive start/end dates; no expense is copied to a second ledger.

The default salary day is configurable from 1–31 (initially 27). A cycle is named for the month it funds: August normally spans 27 July through 26 August. Each cycle’s exact start/end dates are editable independently, including an early salary on the 26th. Changing the default only affects new cycles; it never rewrites historical cycles. Short months clamp a selected day to the month’s last valid day. Duplicate month labels and overlapping cycle dates are rejected.

Monthly Budget includes editable income, fixed commitments, category-mapped spending budgets and account balance snapshots. It calculates expected savings, actual surplus, remaining budgets and a doughnut chart from all expense categories. Unmapped category spending stays included in total expenses and is called out in the budget section. A category cannot be assigned to multiple budgets within the same cycle. Account totals distinguish liquid accounts from total assets before debt; they do not claim to be net worth.

New cycles can copy an earlier setup. Income, commitment and budget amounts copy; account names copy with zero balances. Recorded expenses always come from the new cycle’s dates. Three editable RM300 budget groups are supplied when starting a fresh setup, matching the reference workbook’s grocery/general/buffer structure. Finance amounts are displayed in MYR (RM).

New normalized Sheets tables:

| Table | Columns |
| --- | --- |
| FinanceCycleSettings | defaultStartDay |
| FinanceCycles | id, month, start, end |
| FinanceIncome | id, cycleId, name, amount |
| FinanceCommitments | id, cycleId, name, amount |
| FinanceBudgets | id, cycleId, name, amount, categories_json |
| FinanceBalances | id, cycleId, name, amount, liquid |

Replace Code.gs and deploy a new version of the same Web app to activate `features.financePlanning`. No new URL or additional Drive authorization is needed if receipt uploads already work. Until then, monthly plans remain on the device and merge by ID when the capability becomes available. Older clients that omit monthly planning cannot erase its tables. The original BUDGET TRACKER workbook remains unchanged; historical monthly data has not been imported automatically.
