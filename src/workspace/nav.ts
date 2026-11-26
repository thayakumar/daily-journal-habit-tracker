import type { JournalBridge } from "../App";
import { isConfigured } from "../lib/sheets-api";
import type { ClayAssetName } from "./clayAssets";
import {
  recurringDone,
  todayRecurring,
  wishlistExpired,
  type Workspace,
} from "./model";

export type NavGroupId = "daily" | "wellbeing" | "life" | "mind" | "system";

export interface NavEntry {
  id:
    | "overview"
    | "habits"
    | "personal"
    | "skincare"
    | "fitness"
    | "finance"
    | "calendar"
    | "vehicles"
    | "meals"
    | "dump"
    | "ideas"
    | "vocabulary"
    | "settings";
  label: string;
  group: NavGroupId;
  asset?: ClayAssetName;
  description: string;
}

export const NAV_GROUPS: readonly { id: NavGroupId; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "wellbeing", label: "Wellbeing" },
  { id: "life", label: "Life & money" },
  { id: "mind", label: "Mind" },
] as const;

export const NAV: readonly NavEntry[] = [
  {
    id: "overview",
    label: "Overview",
    group: "daily",
    description: "Every room on your daily shelf.",
  },
  {
    id: "habits",
    label: "Habits",
    group: "daily",
    asset: "habits",
    description: "Daily check-ins and recurring routines.",
  },
  {
    id: "personal",
    label: "Personal",
    group: "daily",
    asset: "personal",
    description: "Errands, groceries, wishlist, and watch list.",
  },
  {
    id: "skincare",
    label: "Skincare",
    group: "wellbeing",
    asset: "skincare",
    description: "Morning and night shelf, products, and notes.",
  },
  {
    id: "fitness",
    label: "Fitness",
    group: "wellbeing",
    asset: "fitness",
    description: "Workouts, dated sets, and cardio sessions.",
  },
  {
    id: "finance",
    label: "Finance",
    group: "life",
    asset: "finance",
    description: "Expenses, monthly cycles, receipts, and net worth.",
  },
  {
    id: "calendar",
    label: "Calendar",
    group: "life",
    asset: "calendar",
    description: "Upcoming dates, holidays, and time off.",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    group: "life",
    asset: "vehicles",
    description: "Renewals, mileage, and service logs.",
  },
  {
    id: "meals",
    label: "Meals",
    group: "daily",
    asset: "meals",
    description: "Weekly breakfast, lunch, dinner, and snacks.",
  },
  {
    id: "dump",
    label: "Brain dump",
    group: "mind",
    asset: "dump",
    description: "Unfiltered notes whenever something crosses your mind.",
  },
  {
    id: "ideas",
    label: "Ideas",
    group: "mind",
    asset: "ideas",
    description: "Saved links, references, and notes for later.",
  },
  {
    id: "vocabulary",
    label: "Vocabulary",
    group: "mind",
    asset: "vocabulary",
    description: "New words, meanings, and examples to keep.",
  },
  {
    id: "settings",
    label: "Settings & backup",
    group: "system",
    asset: "settings",
    description: "Workspace name, sync status, and JSON backups.",
  },
] as const;

export type Tab = NavEntry["id"];

export function currentTab(): Tab {
  const id = window.location.hash.slice(1);
  return NAV.some((n) => n.id === id) ? (id as Tab) : "overview";
}

export function countTodayHabits(
  data: Workspace,
  journal: JournalBridge | null,
  today: string,
) {
  const row = journal?.rows.find((r) => r.dateStr === today);
  const daily = journal?.habits ?? [];
  const recurring = todayRecurring(data, today);
  const doneDaily = daily.filter((h) => !!row?.habits[h.id]).length;
  const doneRecurring = recurring.filter((h) =>
    recurringDone(data, h.id, today),
  ).length;
  return {
    done: doneDaily + doneRecurring,
    total: daily.length + recurring.length,
  };
}

export function countOpenPersonalItems(data: Workspace, today: string): number {
  return data.items.filter(
    (i) =>
      ["personal", "grocery", "wishlist", "watch"].includes(i.kind) &&
      !i.done &&
      !wishlistExpired(i, today),
  ).length;
}

export function countUpcomingCalendarItems(
  data: Workspace,
  today: string,
): number {
  const manual = data.events.filter((e) => e.date >= today).length;
  const vehicleRenewals = (data.vehicles ?? []).reduce((sum, v) => {
    return (
      sum +
      (v.roadTaxDue && v.roadTaxDue >= today ? 1 : 0) +
      (v.insuranceDue && v.insuranceDue >= today ? 1 : 0) +
      (v.serviceDue && v.serviceDue >= today ? 1 : 0)
    );
  }, 0);
  return manual + vehicleRenewals;
}

export function roomMeta(
  id: Tab,
  data: Workspace,
  journal: JournalBridge | null,
  today: string,
): { label: string; tone: "neutral" | "accent" | "sage" } | null {
  switch (id) {
    case "habits": {
      const { done, total } = countTodayHabits(data, journal, today);
      if (!total) return { label: "No habits yet", tone: "neutral" };
      return {
        label: `${done}/${total} today`,
        tone: done === total ? "sage" : "accent",
      };
    }
    case "personal": {
      const open = countOpenPersonalItems(data, today);
      return open
        ? { label: `${open} open`, tone: "accent" }
        : { label: "All clear", tone: "sage" };
    }
    case "skincare": {
      const count = data.skincare?.products.filter((p) => p.active).length ?? 0;
      return count
        ? { label: `${count} active`, tone: "sage" }
        : { label: "Routine & shelf", tone: "neutral" };
    }
    case "fitness": {
      const count = data.workoutSets?.length ?? 0;
      return count
        ? { label: `${count} logged sets`, tone: "sage" }
        : { label: "Log a session", tone: "neutral" };
    }
    case "finance": {
      const count = data.financeExpenses?.length ?? 0;
      return count
        ? { label: `${count} expenses`, tone: "neutral" }
        : { label: "Budget & receipts", tone: "neutral" };
    }
    case "calendar": {
      const upcoming = countUpcomingCalendarItems(data, today);
      return upcoming
        ? { label: `${upcoming} upcoming`, tone: "accent" }
        : { label: "Open calendar", tone: "neutral" };
    }
    case "vehicles": {
      const count = data.vehicles?.length ?? 0;
      return count
        ? { label: `${count} tracked`, tone: "neutral" }
        : { label: "Service & renewals", tone: "neutral" };
    }
    case "meals":
      return { label: "7-day plan", tone: "neutral" };
    case "dump": {
      const count = data.thoughts.length;
      return count
        ? { label: `${count} notes`, tone: "neutral" }
        : { label: "Clear mind", tone: "sage" };
    }
    case "ideas": {
      const count = data.ideas.length;
      return count
        ? { label: `${count} saved`, tone: "neutral" }
        : { label: "Shelf for later", tone: "neutral" };
    }
    case "vocabulary": {
      const count = data.vocabulary?.length ?? 0;
      return count
        ? { label: `${count} words`, tone: "neutral" }
        : { label: "Pocket lexicon", tone: "neutral" };
    }
    case "settings":
      return isConfigured()
        ? { label: "Cloud sync", tone: "sage" }
        : { label: "Local device", tone: "neutral" };
    default:
      return null;
  }
}
