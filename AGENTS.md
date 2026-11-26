# AGENTS.md — My Space (Daily Journal & Habit Tracker)

## Architecture Overview

My Space is a personal offline-first PWA workspace built with **React 19 + TypeScript + Vite + Tailwind CSS v4** (deployed on GitHub Pages) backed by a **Cloudflare Worker + Turso SQLite** edge API (`worker/`), with an optional Google Apps Script + Google Drive bridge (`google-apps-script/Code.gs`) for long-term media storage and legacy sheet imports.

### Directory Map
- `src/main.tsx` — Entrypoint mounting `WorkspaceApp`.
- `src/App.tsx` — Daily journal & habit state hook (`useJournal`) and legacy `Journal` wrapper component.
- `src/lib/sheets-api.ts` — HTTP client for the Worker/Turso API (`VITE_API_URL`) with Apps Script fallback (`VITE_GOOGLE_SCRIPT_URL`).
- `src/workspace/` — App shell, navigation, sync engine (`useWorkspace.ts`), 3-way merge (`merge.ts`), data models (`model.ts`, `vehicle-model.ts`), shared Clay Shelf UI primitives & `RoomErrorBoundary` (`ui.tsx`), plus rooms (`Overview.tsx`, `SettingsPanel.tsx`, `Habits.tsx`, `Calendar.tsx`, `Wellness.tsx`, `Fitness.tsx`, `Creativity.tsx`, `Vehicles.tsx`, `Vocabulary.tsx`).
- `src/skincare/` — Skincare tracker (`Skincare.tsx`, `SkinOverviewTab.tsx`, `SkinProductsTab.tsx`, `SkinPhotoTile.tsx`, `model.ts`, `photos.ts`).
- `src/finance/` — Personal finance rooms (`Finance.tsx`, `MonthlyBudget.tsx`, `Portfolio.tsx`, `portfolio/`, `components/`, `planning.ts`, `portfolio-model.ts`, `receipts.ts`, `statement-import.ts`, `legacy-import.ts`).
- `worker/src/` — Zero-dependency Cloudflare Worker edge API (`index.ts` router/cron, `state.ts` KV & Sheets import, `media.ts` Turso→Drive staging & offload, `turso.ts` HTTP SQL client, `types.ts`).
- `tests/` — Node built-in test runner unit & DOM interaction tests (`npm test`).
- `scripts/` — Playwright end-to-end verification scripts (`test:new-pages`, `test:skincare`, `test:portfolio`, `test:responsive`, `check-expense-edit.mjs`).

## Key Conventions & Contracts
1. **Zero-import runtime modules tested directly by Node ESM:** `src/finance/receipts.ts` is imported directly by `tests/receipts.test.mjs` without Vite bundling — keep it free of extensionless relative imports.
2. **Test export contracts:**
   - `tests/components.ts` imports `WorkspaceApp`, `Journal`, `BrainDump`, `Ideas`, `ListPanel`, `useWorkspace`, `Finance`, and `ExpenseForm`.
   - `tests/worker.test.mjs` imports `handleWorkerRequest`, `flushPendingMedia`, `resetWorkerRuntimeStateForTests` from `worker/src/index.ts` and `TursoClient` from `worker/src/turso.ts`.
3. **React 19 purity:** Never read or write `ref.current` during render or inside `setState` updater callbacks. Sync refs inside `useEffect`.
4. **TypeScript strictness:** `tsconfig.app.json` runs with `"strict": true`. Run both `npm run build` and `npx tsc -p worker/tsconfig.json --noEmit` to type-check frontend and Worker.
5. **Cloudflare Workers `fetch` binding:** Never invoke `fetch` as a method on an object (`this.fetchImpl(...)` throws `Illegal invocation` in V8). Always invoke unbound.
6. **File size discipline:** Keep UI components and modules well below 1,000 lines by splitting tabs, dialogs, and domain logic into focused submodules.

## Common Commands
```bash
npm run dev                              # Start local Vite dev server
npm run lint                             # ESLint check
npm run build                            # Strict TypeScript check (tsc -b) + Vite production build
npx tsc -p worker/tsconfig.json --noEmit # Type-check Cloudflare Worker
npm test                                 # Node unit + DOM + Worker tests
npm run test:new-pages                   # Playwright E2E: new rooms & CRUD
npm run test:skincare                    # Playwright E2E: skincare + portfolio overview
npm run test:portfolio                   # Playwright E2E: portfolio accounts/loans/goals/simulator
npm run test:responsive                  # Playwright E2E: mobile/tablet/desktop viewports
node scripts/check-expense-edit.mjs      # Playwright E2E: expense editing & receipts
```
