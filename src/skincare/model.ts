export const ANGLES = ["front", "left", "right"] as const;
export type Angle = (typeof ANGLES)[number];
export type Period = "AM" | "PM" | "Anytime";
export interface SkinDay {
  id: string;
  date: string;
  notes: string;
  reaction: string;
  productIds: string[];
  updatedAt: string;
}
export interface SkinProduct {
  id: string;
  name: string;
  brand: string;
  type: string;
  notes: string;
  started: string;
  stopped: string;
  active: boolean;
}
export interface SkinHabit {
  id: string;
  name: string;
  period: Period;
  active: boolean;
  createdAt: string;
}
export interface SkinCheck {
  id: string;
  date: string;
  habitId: string;
  done: boolean;
}
export interface SkinPhoto {
  id: string;
  date: string;
  angle: Angle;
  fileId: string;
  name: string;
  mimeType: string;
  updatedAt: string;
}
export interface SkincareData {
  entries: SkinDay[];
  products: SkinProduct[];
  habits: SkinHabit[];
  checks: SkinCheck[];
  photos: SkinPhoto[];
}
export const emptySkincare = (): SkincareData => ({
  entries: [],
  products: [],
  habits: [],
  checks: [],
  photos: [],
});
export function validSkinDate(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v + "T12:00Z").toISOString().slice(0, 10) === v
  );
}
const text = (v: unknown, max = 10000): v is string =>
  typeof v === "string" && v.length <= max;
const stamp = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
export function isSkincare(value: unknown): value is SkincareData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as SkincareData,
    keys = Object.keys(emptySkincare()),
    keySet = new Set(keys);
  if (Object.keys(p).some((k) => !keySet.has(k))) return false;
  for (const k of keys as (keyof SkincareData)[]) {
    if (
      !Array.isArray(p[k]) ||
      new Set(p[k].map((r) => r?.id)).size !== p[k].length ||
      p[k].some((r) => !r || typeof r !== "object" || !text(r.id, 200) || !r.id)
    )
      return false;
  }
  const unique = (arr: string[]) => new Set(arr).size === arr.length;
  if (
    !p.products.every(
      (r) =>
        text(r.name, 200) &&
        !!r.name.trim() &&
        text(r.brand, 200) &&
        text(r.type, 100) &&
        text(r.notes) &&
        (!r.started || validSkinDate(r.started)) &&
        text(r.started) &&
        (!r.stopped || validSkinDate(r.stopped)) &&
        text(r.stopped) &&
        (!r.started || !r.stopped || r.stopped >= r.started) &&
        typeof r.active === "boolean",
    )
  )
    return false;
  if (
    !p.habits.every(
      (r) =>
        text(r.name, 200) &&
        !!r.name.trim() &&
        ["AM", "PM", "Anytime"].includes(r.period) &&
        typeof r.active === "boolean" &&
        stamp(r.createdAt),
    )
  )
    return false;
  if (
    !unique(p.entries.map((r) => r.date)) ||
    !p.entries.every(
      (r) =>
        r.id === "skin:" + r.date &&
        validSkinDate(r.date) &&
        text(r.notes) &&
        text(r.reaction) &&
        stamp(r.updatedAt) &&
        Array.isArray(r.productIds) &&
        unique(r.productIds) &&
        r.productIds.every((id) => p.products.some((pr) => pr.id === id)),
    )
  )
    return false;
  if (
    !unique(p.checks.map((r) => r.date + "|" + r.habitId)) ||
    !p.checks.every(
      (r) =>
        validSkinDate(r.date) &&
        p.entries.some((e) => e.date === r.date) &&
        p.habits.some((h) => h.id === r.habitId) &&
        typeof r.done === "boolean",
    )
  )
    return false;
  if (
    !unique(p.photos.map((r) => r.date + "|" + r.angle)) ||
    !unique(p.photos.map((r) => r.fileId)) ||
    !p.photos.every(
      (r) =>
        validSkinDate(r.date) &&
        p.entries.some((e) => e.date === r.date) &&
        ANGLES.includes(r.angle) &&
        text(r.fileId, 200) &&
        /^[\w-]{5,200}$/.test(r.fileId) &&
        text(r.name, 200) &&
        ["image/jpeg", "image/png", "image/webp"].includes(r.mimeType) &&
        stamp(r.updatedAt),
    )
  )
    return false;
  return true;
}
export function skinDateError(p: SkincareData, today: string) {
  return p.entries.some((e) => e.date > today)
    ? "Choose a journal date up to today."
    : "";
}
export function putSkinDay(
  p: SkincareData,
  date: string,
  patch: Partial<Pick<SkinDay, "notes" | "reaction" | "productIds">> = {},
): SkincareData {
  const old = p.entries.find((e) => e.date === date);
  const entry: SkinDay = {
    id: "skin:" + date,
    date,
    notes: "",
    reaction: "",
    productIds: [],
    ...old,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...p,
    entries: [...p.entries.filter((e) => e.date !== date), entry],
  };
}
export function starterSkinHabits(): SkinHabit[] {
  return (["AM", "PM"] as const).flatMap((period) =>
    (period === "AM"
      ? ["Cleanser", "Moisturiser", "Sunscreen"]
      : ["Cleanser", "Moisturiser"]
    ).map((name) => ({
      id: "skin-starter:" + period + ":" + name.toLowerCase(),
      name,
      period,
      active: true,
      createdAt: new Date().toISOString(),
    })),
  );
}
export function skinCompletion(p: SkincareData, date: string) {
  const eligible = p.habits.filter(
    (h) => h.active && h.createdAt.slice(0, 10) <= date,
  );
  const done = eligible.filter((h) =>
    p.checks.some((c) => c.date === date && c.habitId === h.id && c.done),
  ).length;
  return { done, total: eligible.length };
}
