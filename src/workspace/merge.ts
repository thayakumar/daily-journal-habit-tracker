import { emptyPlanning, type FinanceCycle, type FinancePlanning } from "../finance/planning.ts";
import {
  emptyPortfolio,
  type DebtSnapshot,
  type FinancePortfolio,
  type PortfolioSnapshot,
} from "../finance/portfolio-model.ts";
import { emptySkincare, type SkinDay, type SkincareData } from "../skincare/model.ts";
import type { Habit, Row } from "../lib/sheets-api";
import type { JournalSnapshot, MealDay, Workspace } from "./model.ts";

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeScalar<T>(base: T | undefined, local: T, remote: T): T {
  if (equal(local, remote)) return local;
  if (base !== undefined) {
    if (equal(base, local)) return remote;
    if (equal(base, remote)) return local;
  }
  return local;
}

function newestStamp<T extends { updatedAt?: string }>(local: T, remote: T): T {
  if (local.updatedAt && remote.updatedAt) {
    return remote.updatedAt > local.updatedAt ? remote : local;
  }
  return local;
}

function mergeById<T extends { id: string }>(
  baseRows: T[] | undefined,
  localRows: T[] | undefined,
  remoteRows: T[] | undefined,
  resolveBoth?: (base: T | undefined, local: T, remote: T) => T,
): T[] {
  const baseMap = new Map((baseRows ?? []).map((r) => [r.id, r]));
  const localMap = new Map((localRows ?? []).map((r) => [r.id, r]));
  const remoteMap = new Map((remoteRows ?? []).map((r) => [r.id, r]));
  const order: string[] = [];
  const seen = new Set<string>();
  for (const r of remoteRows ?? []) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      order.push(r.id);
    }
  }
  for (const r of localRows ?? []) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      order.push(r.id);
    }
  }
  const merged: T[] = [];
  for (const id of order) {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (l && r) {
      if (equal(l, r)) merged.push(l);
      else if (b && equal(b, l)) merged.push(r);
      else if (b && equal(b, r)) merged.push(l);
      else merged.push(resolveBoth ? resolveBoth(b, l, r) : l);
    } else if (l && !r) {
      if (!b || !equal(b, l)) merged.push(l);
    } else if (!l && r) {
      if (!b || !equal(b, r)) merged.push(r);
    }
  }
  return merged;
}

function mergeStringSet(
  baseList: string[] | undefined,
  localList: string[],
  remoteList: string[],
): string[] {
  const b = new Set(baseList ?? []);
  const l = new Set(localList);
  const r = new Set(remoteList);
  const all = new Set([...remoteList, ...localList]);
  const out: string[] = [];
  for (const v of all) {
    const inL = l.has(v);
    const inR = r.has(v);
    if (inL && inR) out.push(v);
    else if (inL && !b.has(v)) out.push(v);
    else if (inR && !b.has(v)) out.push(v);
  }
  return out;
}

function mergeMeals(
  base: Record<string, MealDay> | undefined,
  local: Record<string, MealDay>,
  remote: Record<string, MealDay>,
): Record<string, MealDay> {
  const dates = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const out: Record<string, MealDay> = {};
  const empty: MealDay = { breakfast: "", lunch: "", dinner: "", snack: "" };
  for (const date of dates) {
    const b = base?.[date];
    const l = local[date];
    const r = remote[date];
    if (l && r) {
      out[date] = {
        breakfast: mergeScalar(b?.breakfast, l.breakfast, r.breakfast),
        lunch: mergeScalar(b?.lunch, l.lunch, r.lunch),
        dinner: mergeScalar(b?.dinner, l.dinner, r.dinner),
        snack: mergeScalar(b?.snack, l.snack, r.snack),
      };
    } else if (l && !r) {
      if (!b || !equal(b, l)) out[date] = l;
    } else if (!l && r) {
      if (!b || !equal(b, r)) out[date] = r;
    }
    if (out[date] && equal(out[date], empty) && !local[date] && !remote[date]) {
      delete out[date];
    }
  }
  return out;
}

function mergeStringMap(
  base: Record<string, string> | undefined,
  local: Record<string, string>,
  remote: Record<string, string>,
): Record<string, string> {
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const out: Record<string, string> = {};
  for (const k of keys) {
    const b = base?.[k];
    const l = local[k];
    const r = remote[k];
    if (l !== undefined && r !== undefined) {
      out[k] = mergeScalar(b, l, r);
    } else if (l !== undefined) {
      if (b === undefined || b !== l) out[k] = l;
    } else if (r !== undefined) {
      if (b === undefined || b !== r) out[k] = r;
    }
  }
  return out;
}

function mergePrayerChecks(
  base: Record<string, boolean[]> | undefined,
  local: Record<string, boolean[]>,
  remote: Record<string, boolean[]>,
): Record<string, boolean[]> {
  const dates = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const out: Record<string, boolean[]> = {};
  for (const date of dates) {
    const b = base?.[date];
    const l = local[date];
    const r = remote[date];
    if (l && r) {
      out[date] = [0, 1, 2, 3, 4].map((i) =>
        mergeScalar(b?.[i], !!l[i], !!r[i]),
      );
    } else if (l) {
      if (!b || !equal(b, l)) out[date] = l;
    } else if (r) {
      if (!b || !equal(b, r)) out[date] = r;
    }
  }
  return out;
}

function mergePlanning(
  base: FinancePlanning | undefined,
  local: FinancePlanning | undefined,
  remote: FinancePlanning | undefined,
): FinancePlanning {
  const b = base ?? emptyPlanning();
  const l = local ?? emptyPlanning();
  const r = remote ?? emptyPlanning();
  const mergedCycles = mergeById(base ? b.cycles : undefined, l.cycles, r.cycles);
  // Deduplicate cycles by month in case both devices created the same month cycle offline.
  const seenMonths = new Set<string>();
  const cycles: FinanceCycle[] = [];
  const droppedCycleMap = new Map<string, string>();
  for (const c of mergedCycles) {
    if (seenMonths.has(c.month)) {
      const kept = cycles.find((x) => x.month === c.month);
      if (kept) droppedCycleMap.set(c.id, kept.id);
      continue;
    }
    seenMonths.add(c.month);
    cycles.push(c);
  }
  const cycleIds = new Set(cycles.map((c) => c.id));
  const rawRows = mergeById(base ? b.rows : undefined, l.rows, r.rows).map((row) =>
    droppedCycleMap.has(row.cycleId)
      ? { ...row, cycleId: droppedCycleMap.get(row.cycleId)! }
      : row,
  );
  const rows = rawRows.filter((row) => cycleIds.has(row.cycleId));
  return {
    defaultStartDay: mergeScalar(
      base?.defaultStartDay,
      l.defaultStartDay,
      r.defaultStartDay,
    ),
    cycles,
    rows,
  };
}

function snapshotCompositeKey(s: PortfolioSnapshot): string {
  return `${s.accountId}|${s.cycleId}|${s.phase}${s.phase === "current" ? `|${s.date}` : ""}`;
}
function debtSnapshotCompositeKey(s: DebtSnapshot): string {
  return `${s.loanId}|${s.cycleId}|${s.phase}${s.phase === "current" ? `|${s.date}` : ""}`;
}

function mergePortfolio(
  base: FinancePortfolio | undefined,
  local: FinancePortfolio | undefined,
  remote: FinancePortfolio | undefined,
  cycles: FinanceCycle[],
): FinancePortfolio {
  const b = base ?? emptyPortfolio();
  const l = local ?? emptyPortfolio();
  const r = remote ?? emptyPortfolio();
  const accounts = mergeById(base ? b.accounts : undefined, l.accounts, r.accounts);
  const loans = mergeById(base ? b.loans : undefined, l.loans, r.loans);
  const goals = mergeById(base ? b.goals : undefined, l.goals, r.goals);
  const accountIds = new Set(accounts.map((a) => a.id));
  const loanIds = new Set(loans.map((x) => x.id));
  const goalIds = new Set(goals.map((g) => g.id));
  const cycleMap = new Map(cycles.map((c) => [c.id, c]));

  const validSnap = (s: { cycleId: string; phase: string; date: string }) => {
    if (s.cycleId === "") return s.phase === "current";
    const c = cycleMap.get(s.cycleId);
    if (!c) return false;
    if (s.phase === "opening") return s.date === c.start;
    if (s.phase === "closing") return s.date === c.end;
    return s.date >= c.start && s.date <= c.end;
  };

  const snapByKey = new Map<string, PortfolioSnapshot>();
  for (const s of mergeById(
    base ? b.snapshots : undefined,
    l.snapshots,
    r.snapshots,
    (_b, loc, rem) => newestStamp(loc, rem),
  )) {
    if (!accountIds.has(s.accountId) || !validSnap(s)) continue;
    const key = snapshotCompositeKey(s);
    const prev = snapByKey.get(key);
    snapByKey.set(key, prev ? newestStamp(s, prev) : s);
  }

  const debtByKey = new Map<string, DebtSnapshot>();
  for (const s of mergeById(
    base ? b.debtSnapshots : undefined,
    l.debtSnapshots,
    r.debtSnapshots,
    (_b, loc, rem) => newestStamp(loc, rem),
  )) {
    if (!loanIds.has(s.loanId) || !validSnap(s)) continue;
    const key = debtSnapshotCompositeKey(s);
    const prev = debtByKey.get(key);
    debtByKey.set(key, prev ? newestStamp(s, prev) : s);
  }

  const flows = mergeById(base ? b.flows : undefined, l.flows, r.flows).filter((f) => {
    if (f.cycleId !== "") {
      const c = cycleMap.get(f.cycleId);
      if (!c || f.date < c.start || f.date > c.end) return false;
    }
    if (f.kind === "transfer")
      return accountIds.has(f.fromId) && accountIds.has(f.toId) && f.fromId !== f.toId;
    if (f.kind === "contribution") return !f.fromId && accountIds.has(f.toId);
    return accountIds.has(f.fromId) && !f.toId;
  });

  const subscriptions = mergeById(
    base ? b.subscriptions : undefined,
    l.subscriptions,
    r.subscriptions,
  ).map((s) => (s.accountId && !accountIds.has(s.accountId) ? { ...s, accountId: "" } : s));

  const allocSeen = new Set<string>();
  const allocations = mergeById(
    base ? b.allocations : undefined,
    l.allocations,
    r.allocations,
  ).filter((a) => {
    const key = `${a.accountId}|${a.goalId}`;
    if (!accountIds.has(a.accountId) || !goalIds.has(a.goalId) || allocSeen.has(key))
      return false;
    allocSeen.add(key);
    return true;
  });

  return {
    accounts,
    snapshots: [...snapByKey.values()],
    flows,
    loans,
    debtSnapshots: [...debtByKey.values()],
    subscriptions,
    goals,
    allocations,
  };
}

function mergeSkincare(
  base: SkincareData | undefined,
  local: SkincareData | undefined,
  remote: SkincareData | undefined,
): SkincareData {
  const b = base ?? emptySkincare();
  const l = local ?? emptySkincare();
  const r = remote ?? emptySkincare();
  const products = mergeById(base ? b.products : undefined, l.products, r.products);
  const habits = mergeById(base ? b.habits : undefined, l.habits, r.habits);
  const productIds = new Set(products.map((p) => p.id));
  const habitIds = new Set(habits.map((h) => h.id));

  const rawEntries = mergeById<SkinDay>(
    base ? b.entries : undefined,
    l.entries,
    r.entries,
    (be, le, re) => {
      const winner = newestStamp(le, re);
      return {
        ...winner,
        notes: mergeScalar(be?.notes, le.notes, re.notes),
        reaction: mergeScalar(be?.reaction, le.reaction, re.reaction),
        productIds: mergeStringSet(be?.productIds, le.productIds, re.productIds),
        updatedAt:
          le.updatedAt >= re.updatedAt ? le.updatedAt : re.updatedAt,
      };
    },
  );
  const entryDates = new Set<string>();
  const entries = rawEntries
    .filter((e) => {
      if (entryDates.has(e.date)) return false;
      entryDates.add(e.date);
      return true;
    })
    .map((e) => ({
      ...e,
      productIds: [...new Set(e.productIds.filter((id) => productIds.has(id)))],
    }));

  const checkKeys = new Set<string>();
  const checks = mergeById(base ? b.checks : undefined, l.checks, r.checks).filter((c) => {
    const key = `${c.date}|${c.habitId}`;
    if (!entryDates.has(c.date) || !habitIds.has(c.habitId) || checkKeys.has(key))
      return false;
    checkKeys.add(key);
    return true;
  });

  const photoKeys = new Set<string>();
  const fileIds = new Set<string>();
  const photos = mergeById(
    base ? b.photos : undefined,
    l.photos,
    r.photos,
    (_bp, lp, rp) => newestStamp(lp, rp),
  ).filter((p) => {
    const key = `${p.date}|${p.angle}`;
    if (!entryDates.has(p.date) || photoKeys.has(key) || fileIds.has(p.fileId))
      return false;
    photoKeys.add(key);
    fileIds.add(p.fileId);
    return true;
  });

  return { entries, products, habits, checks, photos };
}

/**
 * Performs a deterministic 3-way merge of two diverged Workspaces against their last
 * common synced `base` snapshot. Preserves non-conflicting additions/edits from both
 * devices and enforces cross-table referential invariants so the merged workspace is valid.
 */
export function mergeWorkspaces(
  base: Workspace | null,
  local: Workspace,
  remote: Workspace,
): Workspace {
  const b = base ?? undefined;
  const financePlanning = mergePlanning(
    b?.financePlanning,
    local.financePlanning,
    remote.financePlanning,
  );
  const financePortfolio = mergePortfolio(
    b?.financePortfolio,
    local.financePortfolio,
    remote.financePortfolio,
    financePlanning.cycles,
  );
  const vehicles = mergeById(b?.vehicles, local.vehicles, remote.vehicles);
  const vehicleIdSet = new Set(vehicles.map((v) => v.id));
  const rawServices = mergeById(
    b?.vehicleServices,
    local.vehicleServices,
    remote.vehicleServices,
  );
  // If local added a new service for a vehicle that remote deleted, resurrect that vehicle so no service is lost.
  const localVehicleById = new Map((local.vehicles ?? []).map((v) => [v.id, v]));
  for (const s of rawServices) {
    if (!vehicleIdSet.has(s.vehicleId)) {
      const localV = localVehicleById.get(s.vehicleId);
      if (localV) {
        vehicles.push(localV);
        vehicleIdSet.add(localV.id);
      }
    }
  }
  const vehicleServices = rawServices.filter((s) => vehicleIdSet.has(s.vehicleId));

  return {
    version: 1,
    updatedAt: Math.max(Date.now(), local.updatedAt + 1, remote.updatedAt + 1),
    name: mergeScalar(b?.name, local.name, remote.name),
    items: mergeById(b?.items, local.items, remote.items),
    recurring: mergeById(b?.recurring, local.recurring, remote.recurring),
    events: mergeById(b?.events, local.events, remote.events),
    thoughts: mergeById(b?.thoughts, local.thoughts, remote.thoughts),
    ideas: mergeById(b?.ideas, local.ideas, remote.ideas),
    content: mergeById(b?.content, local.content, remote.content),
    meals: mergeMeals(b?.meals, local.meals, remote.meals),
    reminders: mergeStringMap(b?.reminders, local.reminders, remote.reminders),
    prayer: {
      names: mergeScalar(b?.prayer.names, local.prayer.names, remote.prayer.names),
      times: mergeScalar(b?.prayer.times, local.prayer.times, remote.prayer.times),
      checks: mergePrayerChecks(b?.prayer.checks, local.prayer.checks, remote.prayer.checks),
    },
    fitness: {
      start: mergeScalar(b?.fitness.start, local.fitness.start, remote.fitness.start),
      weeks: mergeScalar(b?.fitness.weeks, local.fitness.weeks, remote.fitness.weeks),
      target: mergeScalar(b?.fitness.target, local.fitness.target, remote.fitness.target),
      schedule: [0, 1, 2, 3, 4, 5, 6].map((i) => ({
        title: mergeScalar(
          b?.fitness.schedule[i]?.title,
          local.fitness.schedule[i]?.title ?? "",
          remote.fitness.schedule[i]?.title ?? "",
        ),
        exercises: mergeScalar(
          b?.fitness.schedule[i]?.exercises,
          local.fitness.schedule[i]?.exercises ?? "",
          remote.fitness.schedule[i]?.exercises ?? "",
        ),
      })),
      completed: mergeStringSet(
        b?.fitness.completed,
        local.fitness.completed,
        remote.fitness.completed,
      ),
    },
    workoutSets: mergeById(b?.workoutSets, local.workoutSets, remote.workoutSets),
    recurringChecks: mergeById(
      b?.recurringChecks,
      local.recurringChecks,
      remote.recurringChecks,
    ),
    vocabulary: mergeById(
      b?.vocabulary,
      local.vocabulary,
      remote.vocabulary,
      (_bv, lv, rv) => newestStamp(lv, rv),
    ),
    financeExpenses: mergeById(
      b?.financeExpenses,
      local.financeExpenses,
      remote.financeExpenses,
    ),
    financePlanning,
    financePortfolio,
    vehicles,
    vehicleServices,
    skincare: mergeSkincare(b?.skincare, local.skincare, remote.skincare),
  };
}

function mergeHabitChecks(
  base: Record<string, boolean> | undefined,
  local: Record<string, boolean>,
  remote: Record<string, boolean>,
): Record<string, boolean> {
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    const b = base?.[k];
    const l = local[k];
    const r = remote[k];
    if (l !== undefined && r !== undefined) {
      out[k] = mergeScalar(b, l, r);
    } else if (l !== undefined) {
      if (b === undefined || b !== l) out[k] = l;
    } else if (r !== undefined) {
      if (b === undefined || b !== r) out[k] = r;
    }
  }
  return out;
}

function mergeJournalRow(base: Row | undefined, local: Row, remote: Row): Row {
  return {
    id: remote.id || local.id,
    dateStr: local.dateStr || remote.dateStr,
    displayDate: mergeScalar(base?.displayDate, local.displayDate, remote.displayDate),
    dayName: mergeScalar(base?.dayName, local.dayName, remote.dayName),
    sleepTime: mergeScalar(base?.sleepTime, local.sleepTime, remote.sleepTime),
    exercise: mergeScalar(base?.exercise, local.exercise, remote.exercise),
    morningFood: mergeScalar(base?.morningFood, local.morningFood, remote.morningFood),
    afternoonFood: mergeScalar(base?.afternoonFood, local.afternoonFood, remote.afternoonFood),
    dinnerFood: mergeScalar(base?.dinnerFood, local.dinnerFood, remote.dinnerFood),
    snack: mergeScalar(base?.snack, local.snack, remote.snack),
    tasks: mergeScalar(base?.tasks, local.tasks, remote.tasks),
    habits: mergeHabitChecks(base?.habits, local.habits, remote.habits),
  };
}

/**
 * Performs a 3-way merge of JournalSnapshot (Habits + daily Rows), merging each
 * habit checkmark independently per `(dateStr, habitId)` so concurrent phone & desktop
 * checkmarks never overwrite each other.
 */
export function mergeJournal(
  base: JournalSnapshot | null,
  local: JournalSnapshot,
  remote: JournalSnapshot,
): JournalSnapshot {
  const habits: Habit[] = mergeById(base?.habits, local.habits, remote.habits);
  const baseByDate = new Map((base?.rows ?? []).map((r) => [r.dateStr, r]));
  const localByDate = new Map(local.rows.map((r) => [r.dateStr, r]));
  const remoteByDate = new Map(remote.rows.map((r) => [r.dateStr, r]));
  const dates: string[] = [];
  const seen = new Set<string>();
  for (const r of remote.rows) {
    if (!seen.has(r.dateStr)) {
      seen.add(r.dateStr);
      dates.push(r.dateStr);
    }
  }
  for (const r of local.rows) {
    if (!seen.has(r.dateStr)) {
      seen.add(r.dateStr);
      dates.push(r.dateStr);
    }
  }
  const rows: Row[] = [];
  for (const date of dates) {
    const b = baseByDate.get(date);
    const l = localByDate.get(date);
    const r = remoteByDate.get(date);
    if (l && r) {
      rows.push(equal(l, r) ? l : mergeJournalRow(b, l, r));
    } else if (l && !r) {
      if (!b || !equal(b, l)) rows.push(l);
    } else if (!l && r) {
      if (!b || !equal(b, r)) rows.push(r);
    }
  }
  rows.sort((a, z) => a.dateStr.localeCompare(z.dateStr));
  return {
    habits,
    rows,
    showTasksColumn: mergeScalar(
      base?.showTasksColumn,
      local.showTasksColumn,
      remote.showTasksColumn,
    ),
  };
}

export function workspaceContentEqual(a: Workspace, b: Workspace): boolean {
  return equal({ ...a, updatedAt: 0 }, { ...b, updatedAt: 0 });
}

export function journalContentEqual(a: JournalSnapshot, b: JournalSnapshot): boolean {
  return equal(a, b);
}
