import type { Habit, Row } from "../lib/sheets-api";

export const WORKSPACE_KEY = "personal-workspace.v1";
export const JOURNAL_KEY = "daily-journal.v1";
export const DAY_MS = 86_400_000;
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localDate(value);
}
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS,
  );
}
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  const monday = addDays(date, -(day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function uid(): string {
  return crypto.randomUUID();
}
export function blankRow(date: string): Row {
  return {
    id: uid(),
    dateStr: date,
    displayDate: `${date.slice(8)}/${date.slice(5, 7)}`,
    dayName: new Date(`${date}T12:00:00`).toLocaleDateString("en", {
      weekday: "short",
    }),
    sleepTime: "",
    exercise: "",
    morningFood: "",
    afternoonFood: "",
    dinnerFood: "",
    snack: "",
    tasks: "",
    habits: {},
  };
}
export interface JournalSnapshot {
  rows: Row[];
  habits: Habit[];
  showTasksColumn: boolean;
}
export type ItemKind =
  | "work"
  | "personal"
  | "grocery"
  | "wishlist"
  | "watch"
  | "goal";
export interface ListItem {
  id: string;
  kind: ItemKind;
  text: string;
  done: boolean;
  created: string;
  due: string;
  month?: string;
}
export interface RecurringHabit {
  id: string;
  name: string;
  interval: number;
  lastDone: string;
  reminder: string;
}
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "event" | "holiday" | "leave";
  note: string;
}
export interface Thought {
  id: string;
  text: string;
  created: string;
  contentId?: string;
}
export interface Idea {
  id: string;
  title: string;
  url: string;
  note: string;
}
export type ContentStage = "Idea" | "Draft" | "Scheduled" | "Published";
export const CONTENT_STAGES: ContentStage[] = [
  "Idea",
  "Draft",
  "Scheduled",
  "Published",
];
export interface ContentItem {
  id: string;
  title: string;
  platform: string;
  date: string;
  stage: ContentStage;
  note: string;
}
export interface MealDay {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}
export interface WorkoutDay {
  title: string;
  exercises: string;
}
export interface WorkoutSet {
  id: string;
  exerciseId: string;
  date: string;
  exercise: string;
  type: "strength" | "cardio";
  setNumber: number;
  weight: string;
  unit: "kg" | "lb";
  reps: string;
  durationMinutes: string;
  distanceKm: string;
  notes: string;
}
export interface RecurringCheck {
  id: string;
  habitId: string;
  date: string;
  previousLastDone: string;
}
export interface VocabularyEntry {
  id: string;
  word: string;
  definition: string;
  example: string;
  createdAt: string;
  updatedAt: string;
}
export interface FinanceExpense {
  id: string;
  date: string;
  item: string;
  amount: number;
  category: string;
  receiptName: string;
  receiptUrl: string;
  createdAt: string;
}
export interface Workspace {
  financeExpenses?: FinanceExpense[];
  vocabulary?: VocabularyEntry[];
  workoutSets?: WorkoutSet[];
  recurringChecks?: RecurringCheck[];
  version: 1;
  updatedAt: number;
  name: string;
  items: ListItem[];
  recurring: RecurringHabit[];
  events: CalendarEvent[];
  thoughts: Thought[];
  ideas: Idea[];
  content: ContentItem[];
  meals: Record<string, MealDay>;
  prayer: {
    names: string[];
    times: string[];
    checks: Record<string, boolean[]>;
  };
  fitness: {
    start: string;
    weeks: number;
    target: number;
    schedule: WorkoutDay[];
    completed: string[];
  };
  reminders: Record<string, string>;
}
export function createWorkspace(): Workspace {
  return {
    financeExpenses: [],
    vocabulary: [],
    workoutSets: [],
    recurringChecks: [],
    version: 1,
    updatedAt: 0,
    name: "My Space",
    items: [],
    recurring: [],
    events: [],
    thoughts: [],
    ideas: [],
    content: [],
    meals: {},
    reminders: {},
    prayer: {
      names: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
      times: ["", "", "", "", ""],
      checks: {},
    },
    fitness: {
      start: localDate(),
      weeks: 12,
      target: 4,
      completed: [],
      schedule: [
        {
          title: "Strength A",
          exercises: "Add your exercises, sets and reps here.",
        },
        { title: "Cardio", exercises: "" },
        { title: "Strength B", exercises: "" },
        { title: "Swimming", exercises: "" },
        { title: "Strength C", exercises: "" },
        { title: "Easy cardio", exercises: "" },
        { title: "Rest", exercises: "" },
      ],
    },
  };
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string";
}
function date(value: unknown): value is string {
  return (
    text(value) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00`)) &&
    localDate(new Date(`${value}T12:00:00`)) === value
  );
}
function records(
  value: unknown,
  valid: (row: Record<string, unknown>) => boolean,
): boolean {
  return (
    Array.isArray(value) && value.every((row) => object(row) && valid(row))
  );
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}
function mapOf(value: unknown, valid: (value: unknown) => boolean): boolean {
  return object(value) && Object.values(value).every(valid);
}
export function isWorkspace(value: unknown): value is Workspace {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Number.isFinite(value.updatedAt) ||
    !text(value.name)
  )
    return false;
  const p = value.prayer,
    f = value.fitness;
  return (
    (value.financeExpenses === undefined ||
      records(
        value.financeExpenses,
        (r) =>
          [
            "id",
            "date",
            "item",
            "category",
            "receiptName",
            "receiptUrl",
            "createdAt",
          ].every((k) => text(r[k])) &&
          Number.isFinite(r.amount) &&
          Number(r.amount) >= 0 &&
          Number.isFinite(Date.parse(String(r.createdAt))),
      )) &&
    (value.vocabulary === undefined ||
      records(
        value.vocabulary,
        (r) =>
          [
            "id",
            "word",
            "definition",
            "example",
            "createdAt",
            "updatedAt",
          ].every((k) => text(r[k])) &&
          Number.isFinite(Date.parse(String(r.createdAt))) &&
          Number.isFinite(Date.parse(String(r.updatedAt))),
      )) &&
    (value.workoutSets === undefined ||
      records(
        value.workoutSets,
        (r) =>
          [
            "id",
            "exerciseId",
            "exercise",
            "weight",
            "reps",
            "durationMinutes",
            "distanceKm",
            "notes",
          ].every((k) => text(r[k])) &&
          date(r.date) &&
          ["strength", "cardio"].includes(String(r.type)) &&
          ["kg", "lb"].includes(String(r.unit)) &&
          Number.isInteger(r.setNumber) &&
          Number(r.setNumber) > 0 &&
          ["weight", "reps", "durationMinutes", "distanceKm"].every(
            (k) =>
              r[k] === "" ||
              (Number.isFinite(Number(r[k])) && Number(r[k]) >= 0),
          ),
      )) &&
    (value.recurringChecks === undefined ||
      records(
        value.recurringChecks,
        (r) =>
          text(r.id) &&
          text(r.habitId) &&
          date(r.date) &&
          date(r.previousLastDone),
      )) &&
    records(
      value.items,
      (r) =>
        text(r.id) &&
        ["work", "personal", "grocery", "wishlist", "watch", "goal"].includes(
          String(r.kind),
        ) &&
        text(r.text) &&
        typeof r.done === "boolean" &&
        date(r.created) &&
        (r.due === "" || date(r.due)) &&
        (r.month === undefined ||
          (text(r.month) && /^\d{4}-\d{2}$/.test(r.month))),
    ) &&
    records(
      value.recurring,
      (r) =>
        text(r.id) &&
        text(r.name) &&
        Number.isInteger(r.interval) &&
        Number(r.interval) >= 1 &&
        Number(r.interval) <= 3650 &&
        date(r.lastDone) &&
        text(r.reminder),
    ) &&
    records(
      value.events,
      (r) =>
        text(r.id) &&
        text(r.title) &&
        date(r.date) &&
        ["event", "holiday", "leave"].includes(String(r.type)) &&
        text(r.note),
    ) &&
    records(
      value.thoughts,
      (r) =>
        text(r.id) &&
        text(r.text) &&
        text(r.created) &&
        Number.isFinite(Date.parse(r.created)) &&
        (r.contentId === undefined || text(r.contentId)),
    ) &&
    records(
      value.ideas,
      (r) => text(r.id) && text(r.title) && text(r.url) && text(r.note),
    ) &&
    records(
      value.content,
      (r) =>
        text(r.id) &&
        text(r.title) &&
        text(r.platform) &&
        (r.date === "" || date(r.date)) &&
        CONTENT_STAGES.includes(r.stage as ContentStage) &&
        text(r.note),
    ) &&
    mapOf(
      value.meals,
      (m) =>
        object(m) &&
        ["breakfast", "lunch", "dinner", "snack"].every((k) => text(m[k])),
    ) &&
    mapOf(value.reminders, text) &&
    object(p) &&
    strings(p.names) &&
    p.names.length === 5 &&
    strings(p.times) &&
    p.times.length === 5 &&
    mapOf(
      p.checks,
      (c) =>
        Array.isArray(c) &&
        c.length === 5 &&
        c.every((v) => typeof v === "boolean"),
    ) &&
    object(f) &&
    date(f.start) &&
    Number.isInteger(f.weeks) &&
    Number(f.weeks) >= 1 &&
    Number(f.weeks) <= 104 &&
    Number.isInteger(f.target) &&
    Number(f.target) >= 1 &&
    Number(f.target) <= 7 &&
    records(f.schedule, (r) => text(r.title) && text(r.exercises)) &&
    Array.isArray(f.schedule) &&
    f.schedule.length === 7 &&
    Array.isArray(f.completed) &&
    f.completed.every(date)
  );
}
export function isJournal(value: unknown): value is JournalSnapshot {
  return (
    object(value) &&
    typeof value.showTasksColumn === "boolean" &&
    records(value.habits, (r) =>
      ["id", "name", "color", "lightBg", "ringColor"].every((k) => text(r[k])),
    ) &&
    records(
      value.rows,
      (r) =>
        [
          "id",
          "displayDate",
          "dayName",
          "sleepTime",
          "exercise",
          "morningFood",
          "afternoonFood",
          "dinnerFood",
          "snack",
          "tasks",
        ].every((k) => text(r[k])) &&
        date(r.dateStr) &&
        mapOf(r.habits, (v) => typeof v === "boolean"),
    )
  );
}
export function readJournal(): JournalSnapshot | null {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(JOURNAL_KEY) || "null",
    );
    return isJournal(data) ? data : null;
  } catch {
    return null;
  }
}
export function readWorkspace(): Workspace {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(WORKSPACE_KEY) || "null",
    );
    if (isWorkspace(data)) return data;
  } catch {
    /* Keep damaged storage untouched until a new edit. */
  }
  return createWorkspace();
}
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function wishlistExpired(item: ListItem, today: string): boolean {
  return item.kind === "wishlist" && daysBetween(item.created, today) >= 30;
}
export function recurrenceDue(habit: RecurringHabit, today: string): number {
  return daysBetween(today, addDays(habit.lastDone, habit.interval));
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function recurringDone(
  data: Workspace,
  habitId: string,
  today: string,
): boolean {
  return (
    (data.recurringChecks ?? []).some(
      (c) => c.habitId === habitId && c.date === today,
    ) || data.recurring.some((h) => h.id === habitId && h.lastDone === today)
  );
}
export function todayRecurring(
  data: Workspace,
  today: string,
): RecurringHabit[] {
  return data.recurring.filter(
    (h) => recurrenceDue(h, today) <= 0 || recurringDone(data, h.id, today),
  );
}
export function toggleRecurring(
  data: Workspace,
  habitId: string,
  today: string,
  checkId: string,
): Workspace {
  const habit = data.recurring.find((h) => h.id === habitId);
  if (!habit) return data;
  const check = (data.recurringChecks ?? []).find(
    (c) => c.habitId === habitId && c.date === today,
  );
  if (check)
    return {
      ...data,
      recurring: data.recurring.map((h) =>
        h.id === habitId ? { ...h, lastDone: check.previousLastDone } : h,
      ),
      recurringChecks: (data.recurringChecks ?? []).filter(
        (c) => c.id !== check.id,
      ),
    };
  if (habit.lastDone === today) return data;
  return {
    ...data,
    recurring: data.recurring.map((h) =>
      h.id === habitId ? { ...h, lastDone: today } : h,
    ),
    recurringChecks: [
      ...(data.recurringChecks ?? []),
      { id: checkId, habitId, date: today, previousLastDone: habit.lastDone },
    ],
  };
}
export function workoutDates(data: Workspace): string[] {
  return [
    ...new Set([
      ...data.fitness.completed,
      ...(data.workoutSets ?? []).map((s) => s.date),
    ]),
  ];
}
