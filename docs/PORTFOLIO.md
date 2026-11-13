# Finance Portfolio

Portfolio is the third module inside Finance. It shares the existing salary-cycle selector, planner workspace, backup, Apps Script endpoint and spreadsheet. No bank connection, live quote service, new authentication flow or runtime dependency is added. Enter valuations in MYR (RM).

## Accounts and monthly balances

Register bank accounts, cash, wallets, physical gold, investments (including separate Versa Gold / TNG Gold accounts) and other assets. The dashboard counts each account once using its latest dated valuation and subtracts the latest dated loan balances. It shows recorded net worth, total assets, bank balances, liquid funds, gold, investments and monthly obligations. Missing valuations are called out; recorded totals are not presented as a complete live bank feed.

Account references accept only the last four digits. Password-manager HTTPS links are supported; passwords, PINs, OTPs, full account numbers and secret-bearing URL parameters are not supported. Portfolio validation rejects unknown fields such as a password property. Existing sharing settings are unchanged.

Keep opening, current and closing snapshots separately. Opening/closing dates match the selected cycle boundaries; future actual balances are rejected. Physical gold uses quantity in grams multiplied by an entered value per gram. A new account's tracking date controls historical reconciliation, with explicitly entered historical snapshots taking precedence.

Monthly Budget's linked balance controls open Portfolio → Accounts, where the phase is explicit. Recording a snapshot refreshes the linked monthly row. Link an existing monthly balance when registering an account, or import unlinked monthly rows with an explicit phase. Review account types after importing. Duplicate labels are rejected rather than silently merged. Historical workbook sheets are not imported automatically.

Use **Use previous closing as opening** to carry confirmed values into the selected cycle without overwriting existing openings. New-cycle copies retain Portfolio links and recalculate current/future scheduled commitments; account values need their own opening records rather than a guessed carry-forward.

## Transfers and investment performance

Record internal transfers, external contributions, withdrawals and fees separately from ordinary spending. Mark external movements already included in income/commitments/expenses so reconciliation can avoid double counting. Transfers between your own accounts do not increase net worth.

For each investment or gold account:

`result = closing value − opening value − money added + money withdrawn`

Fees remain part of investment performance. The result is incomplete until both balance phases are recorded. The cost-basis comparison is a simple reference, not a tax calculation.

## Loans and subscriptions

Loans record original principal, current outstanding principal, as-of date, annual rate, reducing/flat method, instalment, start date and next payment due. Estimates include payoff date, remaining interest and an extra-payment comparison. Flat interest uses original principal; reducing interest uses the remaining balance. Estimates assume constant monthly terms and exclude lender fees and settlement-specific adjustments. Payments that cannot clear interest are flagged. Update outstanding balances manually or use cycle loan snapshots.

Subscriptions record amount, frequency, start date, renewal date, payment account, active state and a management link. Monthly equivalents help compare costs; syncing commitments uses actual due dates within the salary cycle, with month-end anchors preserved. Stable row links prevent repeated syncs creating duplicates. Link any existing manual commitment explicitly. Historical commitments are not recalculated using today's settings.

## Goals and simulator

Goals have a target, deadline, monthly contribution and account allocations. New allocations cannot exceed available recorded balances. After a loss, allocations scale proportionally, with deterministic cent allocation so several goals cannot claim the same money. Goal estimates show progress, the amount needed each month and projected completion.

The simulator compares cash purchases and loans using a funding account, reserve floor, deposit, rate, term and goal. It shows cash remaining, interest, instalment, recurring headroom, reserve shortfall, estimated loan finish and goal timing. Known Portfolio commitments are included in headroom without modifying the budget. Instalments are assumed to start next month; goal contributions resume after the loan ends. Simulations never write financial records. They compare entered assumptions and do not constitute a lender approval. Fees, changing rates and asset resale value are outside the estimate.

## Closing comparison

The selected cycle compares planned savings and logged surplus from Monthly Budget with actual opening-to-closing net-worth movement. It separately identifies investment results, debt balance reduction and external movements. Paid-off loans do not require perpetual zero snapshots in later cycles. Missing snapshots leave the comparison incomplete.

The remaining difference is labelled **Unreconciled**, not investment loss. It can include unlogged income, borrowing, fees, transfers recorded as expenses, or a commitment also entered in the expense log.

## Storage and deployment

Eight new tables store readable rows:

| Table | Purpose |
| --- | --- |
| PortfolioAccounts | Account register, masked references and vault links |
| PortfolioSnapshots | Opening/current/closing asset valuations |
| PortfolioFlows | Transfers, contributions, withdrawals and fees |
| PortfolioLoans | Loan terms and dated principal balances |
| PortfolioDebtSnapshots | Cycle-specific loan balances |
| PortfolioSubscriptions | Renewals and billing details |
| PortfolioGoals | Targets, deadlines and contribution plans |
| PortfolioAllocations | Account-to-goal earmarks |

Replace `google-apps-script/Code.gs` in the existing planner project, then deploy a **New version** of the existing Web app with the same URL. Existing receipt authorization remains sufficient. Tables are created automatically and the endpoint advertises `features.financePortfolio`.

Until that deployment, Portfolio records remain on the device and merge by ID once the capability is active. Older clients that omit Portfolio cannot erase its tables. Request-local read caching reduces repeated Sheet calls and resets for each request; writes invalidate the relevant cache, and stale revision checks remain active.

## Verification

Tests execute the actual Code.gs against mocked Google services. They cover table round trips, account masking, backward compatibility, upgrade retention, dated valuations, corrected returns, debt effects, goal allocation/rounding, loan estimates, renewal scheduling, historical preservation and read caching. Browser tests cover all six sections at five widths and exercise account/balance/gold/movement/loan/subscription/goal entry, over-allocation rejection, monthly links, reloads, and simulation without writes. Live new-table verification requires the Apps Script deployment.
