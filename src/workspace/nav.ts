import type { JournalBridge } from "../App";
import { isConfigured } from "../lib/sheets-api";
import type { ClayAssetName } from "./clayAssets";
import {
  recurringDone,
  todayRecurring,
  wishlistExpired,
  type Workspace,
} from "./model";

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
  asset?: ClayAssetName;
  description: string;
}

export const NAV: readonly NavEntry[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Every room on your daily shelf.",
  },
  {
    id: "habits",
    label: "Habits",
    asset: "habits",
    description: "Daily check-ins and recurring routines.",
  },
  {
    id: "personal",
    label: "Personal",
    asset: "personal",
    description: "Errands, groceries, wishlist, and watch list.",
  },
  {
    id: "skincare",
    label: "Skincare",
    asset: "skincare",
    description: "Morning and night shelf, products, and notes.",
  },
  {
    id: "fitness",
    label: "Fitness",
    asset: "fitness",
    description: "Workouts, dated sets, and cardio sessions.",
  },
  {
    id: "finance",
    label: "Finance",
    asset: "finance",
    description: "Expenses, monthly cycles, receipts, and net worth.",
  },
  {
    id: "calendar",
    label: "Calendar",
    asset: "calendar",
    description: "Upcoming dates, holidays, and time off.",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    asset: "vehicles",
    description: "Renewals, mileage, and service logs.",
  },
  {
    id: "meals",
    label: "Meals",
    asset: "meals",
    description: "Weekly breakfast, lunch, dinner, and snacks.",
  },
  {
    id: "dump",
    label: "Brain dump",
    asset: "dump",
    description: "Unfiltered notes whenever something crosses your mind.",
  },
  {
    id: "ideas",
    label: "Ideas",
    asset: "ideas",
    description: "Saved links, references, and notes for later.",
  },
  {
    id: "vocabulary",
    label: "Vocabulary",
    asset: "vocabulary",
    description: "New words, meanings, and examples to keep.",
  },
  {
    id: "settings",
    label: "Settings & backup",
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
): string | null {
  switch (id) {
    case "habits": {
      const { done, total } = countTodayHabits(data, journal, today);
      return total ? `${done}/${total} today` : "No habits yet";
    }
    case "personal": {
      const open = countOpenPersonalItems(data, today);
      return open ? `${open} open` : "All clear";
    }
    case "skincare": {
      const count = data.skincare?.products.filter((p) => p.active).length ?? 0;
      return count ? `${count} active` : "Routine & shelf";
    }
    case "fitness": {
      const count = data.workoutSets?.length ?? 0;
      return count ? `${count} logged sets` : "Log a session";
    }
    case "finance": {
      const count = data.financeExpenses?.length ?? 0;
      return count ? `${count} expenses` : "Budget & receipts";
    }
    case "calendar": {
      const upcoming = countUpcomingCalendarItems(data, today);
      return upcoming ? `${upcoming} upcoming` : "Open calendar";
    }
    case "vehicles": {
      const count = data.vehicles?.length ?? 0;
      return count ? `${count} tracked` : "Service & renewals";
    }
    case "meals":
      return "7-day plan";
    case "dump": {
      const count = data.thoughts.length;
      return count ? `${count} notes` : "Clear mind";
    }
    case "ideas": {
      const count = data.ideas.length;
      return count ? `${count} saved` : "Shelf for later";
    }
    case "vocabulary": {
      const count = data.vocabulary?.length ?? 0;
      return count ? `${count} words` : "Pocket lexicon";
    }
    case "settings":
      return isConfigured() ? "Sheets sync" : "Local device";
    default:
      return null;
  }
}
