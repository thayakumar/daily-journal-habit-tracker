import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  Dumbbell,
  Flower2,
  Heart,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  Sprout,
  Upload,
  Utensils,
  X,
} from "lucide-react";
import Journal, { type JournalBridge } from "../App";
import { isConfigured } from "../lib/sheets-api";
import { Habits } from "./Habits";
import { CalendarPanel } from "./Calendar";
import { Fitness, Meals } from "./Wellness";
import { BrainDump, Ideas } from "./Creativity";
import { useWorkspace } from "./useWorkspace";
import {
  downloadJson,
  isJournal,
  isWorkspace,
  JOURNAL_KEY,
  localDate,
  readJournal,
  recurrenceDue,
  uid,
  weekDates,
  WORKSPACE_KEY,
  type Workspace,
} from "./model";
import {
  Card,
  Circle,
  Empty,
  Field,
  ListPanel,
  inputClass,
  primaryClass,
  secondaryClass,
  type Update,
} from "./ui";

const NAV = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "A little clarity for your day.",
  },
  {
    id: "journal",
    label: "Daily journal",
    icon: BookOpen,
    description: "Your familiar daily matrix.",
  },
  {
    id: "habits",
    label: "Habits",
    icon: Sprout,
    description: "Small steps, a little more often.",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    description: "Make room for what matters.",
  },
  {
    id: "personal",
    label: "Personal",
    icon: Heart,
    description: "The everyday things, all together.",
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: Dumbbell,
    description: "Show up for yourself.",
  },
  {
    id: "meals",
    label: "Meals",
    icon: Utensils,
    description: "A little planning goes a long way.",
  },
  {
    id: "dump",
    label: "Brain dump",
    icon: MessageCircle,
    description: "Think it. Drop it. Breathe.",
  },
  {
    id: "ideas",
    label: "Ideas",
    icon: Lightbulb,
    description: "Keep the things that spark something.",
  },
  {
    id: "settings",
    label: "Settings & backup",
    icon: Settings,
    description: "Your space, your data.",
  },
] as const;
type Tab = (typeof NAV)[number]["id"];
function currentTab(): Tab {
  const id = window.location.hash.slice(1);
  return NAV.some((n) => n.id === id) ? (id as Tab) : "overview";
}
function useToday() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
export default function WorkspaceApp() {
  const { data, update, status, retrySync, reloadCloud, tableStorage } =
    useWorkspace();
  const [tab, setTab] = useState<Tab>(currentTab);
  const [menu, setMenu] = useState(false);
  const [journal, setJournal] = useState<JournalBridge | null>(null);
  const today = useToday();
  const heading = NAV.find((n) => n.id === tab)!;
  const onJournalReady = useCallback(
    (next: JournalBridge) => setJournal(next),
    [],
  );
  const reminderSource = useRef({ data, journal });
  reminderSource.current = { data, journal };
  const notified = useRef(new Set<string>());
  const navigate = useCallback((next: Tab) => {
    window.location.hash = next;
    setTab(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    const change = () => {
      setTab(currentTab());
      setMenu(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted")
        return;
      const now = new Date();
      const date = localDate(now);
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const { data: state, journal: j } = reminderSource.current;
      for (const h of j?.habits ?? []) {
        const key = `${date}:${h.id}:${time}`;
        if (
          state.reminders[h.id] === time &&
          !notified.current.has(key) &&
          !j?.rows.find((r) => r.dateStr === date)?.habits[h.id]
        ) {
          notified.current.add(key);
          try {
            new Notification("A little reminder", { body: h.name, tag: key });
          } catch {
            /* Some mobile browsers only support push notifications. */
          }
        }
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-rose-100 selection:text-rose-900">
      {menu && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <a
          href="#overview"
          onClick={() => navigate("overview")}
          className="flex items-center gap-3 px-6 pb-6 pt-7"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-md shadow-rose-500/15">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="block max-w-36 truncate text-lg font-bold tracking-tight text-slate-900">
              {data.name}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">
              A little more you
            </span>
          </div>
        </a>
        <div className="px-6 pb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Your everyday space
        </div>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 pb-4"
        >
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.id);
              }}
              aria-current={tab === n.id ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${n.id === "settings" ? "!mt-5 border-t border-slate-100" : ""} ${tab === n.id ? "bg-rose-50 text-rose-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
            >
              <n.icon
                className={`h-[17px] w-[17px] ${tab === n.id ? "text-rose-500" : "text-slate-400"}`}
              />
              {n.label}
              {tab === n.id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </a>
          ))}
        </nav>
        <div className="m-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 p-4">
          <Flower2 className="mb-2 h-5 w-5 text-rose-400" />
          <p className="text-xs font-semibold text-slate-700">
            Progress, at your pace.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            A small step today is still a step.
          </p>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="border-b border-slate-200 bg-white/95 px-4 py-4 sm:px-7">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-500 lg:hidden"
                aria-label="Open navigation"
                onClick={() => setMenu(true)}
              >
                {menu ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="hidden sm:inline">{data.name}</span>
                <ChevronRight className="hidden h-3 w-3 sm:block" />
                <span className="font-medium text-slate-700">
                  {heading.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-400 md:inline">
                {new Date(`${today}T12:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                onClick={() => navigate("settings")}
                className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-700"
                title={status}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>
                  {isConfigured()
                    ? tableStorage
                      ? "Per-page tables"
                      : "Legacy sync"
                    : "Device storage"}
                </span>
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                {data.name.trim().slice(0, 1).toUpperCase() || "M"}
              </div>
            </div>
          </div>
        </header>
        {tab !== "journal" && (
          <main
            id="main-content"
            className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9"
          >
            <div className="mb-7">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-rose-500">
                <heading.icon className="h-3.5 w-3.5" />
                {tab === "overview"
                  ? "Make a little space"
                  : "Your personal planner"}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {tab === "overview"
                  ? "Today, a little more intentional."
                  : heading.label}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {heading.description}
              </p>
            </div>
            {tab === "overview" && (
              <Overview
                data={data}
                update={update}
                today={today}
                journal={journal}
                navigate={navigate}
              />
            )}
            {tab === "habits" && (
              <Habits
                data={data}
                update={update}
                journal={journal}
                today={today}
                openJournal={() => navigate("journal")}
              />
            )}
            {tab === "calendar" && (
              <CalendarPanel data={data} update={update} today={today} />
            )}
            {tab === "personal" && (
              <div className="grid items-start gap-5 xl:grid-cols-2">
                <ListPanel
                  kind="personal"
                  title="Personal to-do list"
                  subtitle="Appointments, errands and things just for you."
                  data={data}
                  update={update}
                  today={today}
                />
                <ListPanel
                  kind="wishlist"
                  title="Shopping wishlist"
                  subtitle="Park a want here. After 30 days it moves to the review archive, so you can decide whether it still matters."
                  data={data}
                  update={update}
                  today={today}
                />
                <ListPanel
                  kind="grocery"
                  title="Groceries"
                  subtitle="Your next trip, a little more organised."
                  data={data}
                  update={update}
                  today={today}
                />
                <ListPanel
                  kind="watch"
                  title="Watch & read"
                  subtitle="Movies, shows and books worth making time for."
                  data={data}
                  update={update}
                  today={today}
                />
              </div>
            )}
            {tab === "fitness" && (
              <Fitness data={data} update={update} today={today} />
            )}
            {tab === "meals" && (
              <Meals data={data} update={update} today={today} />
            )}
            {tab === "dump" && <BrainDump data={data} update={update} />}
            {tab === "ideas" && <Ideas data={data} update={update} />}
            {tab === "settings" && (
              <SettingsPanel
                data={data}
                update={update}
                status={status}
                retrySync={retrySync}
                reloadCloud={reloadCloud}
                tableStorage={tableStorage}
              />
            )}
          </main>
        )}
        <div hidden={tab !== "journal"}>
          <Journal onReady={onJournalReady} />
        </div>
        <footer className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-[11px] text-slate-400 sm:px-7">
          <span>
            Built around your daily journal. Made for the rest of your life.
          </span>
          <button
            className="hover:text-rose-500"
            onClick={() => navigate("settings")}
          >
            Your data & backups <ArrowRight className="ml-1 inline h-3 w-3" />
          </button>
        </footer>
      </div>
    </div>
  );
}
function Overview({
  data,
  update,
  today,
  journal,
  navigate,
}: {
  data: Workspace;
  update: Update;
  today: string;
  journal: JournalBridge | null;
  navigate: (tab: Tab) => void;
}) {
  const [thought, setThought] = useState("");
  const [captured, setCaptured] = useState(false);
  const row = journal?.rows.find((r) => r.dateStr === today);
  const done = journal?.habits.filter((h) => row?.habits[h.id]).length ?? 0;
  const total = journal?.habits.length ?? 0;
  const tasks = data.items
    .filter((i) => i.kind === "personal" && !i.done)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const due = data.recurring.filter((h) => recurrenceDue(h, today) <= 0);
  const events = data.events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const weeklySessions = data.fitness.completed.filter((d) =>
    weekDates(today).includes(d),
  ).length;
  const stats = [
    {
      label: "Habits today",
      value: `${done}/${total}`,
      detail: total
        ? `${Math.round((done / total) * 100)}% of your daily rhythm`
        : "Add your first daily habit",
      icon: Sprout,
      colour: "text-rose-500 bg-rose-50",
      tab: "habits" as Tab,
    },
    {
      label: "Open to-dos",
      value: tasks.length,
      detail: `${tasks.filter((i) => i.due && i.due <= today).length} due today or earlier`,
      icon: ListTodo,
      colour: "text-sky-500 bg-sky-50",
      tab: "personal" as Tab,
    },
    {
      label: "Sessions this week",
      value: `${weeklySessions}/${data.fitness.target}`,
      detail: "A little stronger, at your pace",
      icon: Dumbbell,
      colour: "text-emerald-500 bg-emerald-50",
      tab: "fitness" as Tab,
    },
  ];
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 via-orange-50/70 to-white p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-5 -top-14 h-52 w-52 rounded-full border-[28px] border-rose-100/50" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-500">
            <Sparkles className="h-3 w-3" />
            Your life, a little lighter
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Plan the important things.
            <br />
            Leave room for the good things.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Your meals, habits, goals and bright ideas—together in a space that
            grows with you.
          </p>
          <button
            className={`${primaryClass} mt-5`}
            onClick={() => navigate("journal")}
          >
            <Plus className="h-4 w-4" />
            Open daily journal
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.tab)}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {s.label}
              </span>
              <span className={`rounded-xl p-2 ${s.colour}`}>
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {s.value}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">{s.detail}</p>
          </button>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <Card
            title="Your daily rhythm"
            subtitle="A small promise to yourself."
            action={
              <button
                className="flex items-center gap-1 text-xs font-semibold text-rose-500"
                onClick={() => navigate("habits")}
              >
                See your week
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          >
            {journal?.habits.length ? (
              <div className="flex flex-wrap gap-x-7 gap-y-5">
                {journal.habits.map((h) => {
                  const checked = !!row?.habits[h.id];
                  return (
                    <button
                      key={h.id}
                      aria-pressed={checked}
                      onClick={() => journal.toggleDay(today, h.id)}
                      className="flex w-20 flex-col items-center gap-2"
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${checked ? `${h.color} text-white shadow-sm` : "border-slate-200 bg-white text-slate-300 hover:border-rose-300"}`}
                      >
                        <Check className="h-5 w-5" />
                      </span>
                      <span className="max-w-full truncate text-xs text-slate-500">
                        {h.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Empty>Your daily habits will appear here.</Empty>
            )}
            {due.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                <button
                  onClick={() => navigate("habits")}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span>
                    {due.length} recurring{" "}
                    {due.length === 1 ? "habit needs" : "habits need"} a little
                    attention
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              </div>
            )}
          </Card>
          <Card
            title="Next on your list"
            subtitle="Keep the next step simple."
            action={
              <button
                className="text-xs font-semibold text-rose-500"
                onClick={() => navigate("personal")}
              >
                All tasks →
              </button>
            }
          >
            {tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {tasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <Circle
                      checked={false}
                      label={`Complete ${t.text}`}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          items: s.items.map((i) =>
                            i.id === t.id ? { ...i, done: true } : i,
                          ),
                        }))
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm text-slate-700">
                        {t.text}
                      </p>
                      <p className="mt-1 text-[10px] capitalize text-slate-400">
                        {t.kind}
                        {t.due && ` · ${t.due}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                Nothing pressing. Add a task in Personal when you’re ready.
              </Empty>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card
            title="Catch a thought"
            subtitle="Get it out of your head and into your space."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!thought.trim()) return;
                update((s) => ({
                  ...s,
                  thoughts: [
                    ...s.thoughts,
                    {
                      id: uid(),
                      text: thought.trim(),
                      created: new Date().toISOString(),
                    },
                  ],
                }));
                setThought("");
                setCaptured(true);
              }}
            >
              <textarea
                aria-label="Quick thought"
                rows={3}
                className={`${inputClass} !bg-slate-50/50`}
                placeholder="An idea, a reminder, a random thought…"
                value={thought}
                onChange={(e) => {
                  setThought(e.target.value);
                  setCaptured(false);
                }}
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <span role="status" className="text-[11px] text-slate-400">
                  {captured
                    ? "Saved to your brain dump ✓"
                    : "No need to organise it yet."}
                </span>
                <button className={primaryClass} disabled={!thought.trim()}>
                  Save thought
                </button>
              </div>
            </form>
          </Card>
          <Card
            title="Coming up"
            subtitle="A little look ahead."
            action={
              <button
                className="text-xs font-semibold text-rose-500"
                onClick={() => navigate("calendar")}
              >
                Calendar →
              </button>
            }
          >
            {events.length ? (
              <div className="space-y-4">
                {events.map((e) => (
                  <div key={e.id} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                      <span className="text-sm font-bold leading-none">
                        {e.date.slice(8)}
                      </span>
                      <span className="mt-0.5 text-[8px] uppercase">
                        {new Date(`${e.date}T12:00`).toLocaleDateString("en", {
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div>
                      <p className="break-words text-sm font-medium text-slate-700">
                        {e.title}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-400">
                        {e.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Make a plan to look forward to.</Empty>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
function SettingsPanel({
  data,
  update,
  status,
  retrySync,
  reloadCloud,
  tableStorage,
}: {
  data: Workspace;
  update: Update;
  status: string;
  retrySync: () => Promise<void>;
  reloadCloud: () => Promise<void>;
  tableStorage: boolean;
}) {
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function restore(file: File) {
    try {
      if (file.size > 10_000_000)
        throw new Error("Backup is too large (maximum 10 MB).");
      const backup: unknown = JSON.parse(await file.text());
      if (
        !backup ||
        typeof backup !== "object" ||
        !("workspace" in backup) ||
        !("journal" in backup) ||
        !isWorkspace(backup.workspace) ||
        (backup.journal !== null && !isJournal(backup.journal))
      )
        throw new Error("This file is not a valid My Space backup.");
      if (
        !confirm(
          "Restore this backup? It will replace the planner and journal on this device. If Sheets is connected, the planner will sync automatically; the journal will remain local until you press its Sync button. Export your current backup first if you want to keep both.",
        )
      )
        return;
      // Persist validated records before notifying the mounted journal.
      if (backup.journal)
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(backup.journal));
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(backup.workspace));
      if (backup.journal) {
        localStorage.setItem("journal.pending.v1", "true");
        window.dispatchEvent(new Event("journal-restored"));
      }
      const restored = backup.workspace;
      update(() => restored);
      setMessage(
        "Backup restored. Your journal is saved locally; use Sync in Daily journal to send it to Sheets.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not restore this backup.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card
        title="Make yourself at home"
        subtitle="A small name for a space that’s yours."
      >
        <Field label="Workspace name">
          <input
            maxLength={40}
            className={inputClass}
            value={data.name}
            onChange={(e) => update((s) => ({ ...s, name: e.target.value }))}
          />
        </Field>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          All sections are ready to use. Start with the daily journal you know,
          then add the routines and plans that matter to you.
        </p>
      </Card>
      <Card
        title="Storage & sync"
        subtitle="Your existing journal and Google Sheets connection are preserved."
      >
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p role="status" className="text-sm font-medium text-slate-700">
              {status}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {isConfigured()
                ? "Planner sections save to their own Sheet tables after the Apps Script update. Journal records continue to use Entries and Habits. The sync status above identifies the active storage mode."
                : "Changes stay in this browser, on this device. Your existing GitHub Pages deployment keeps its Sheets configuration when this update is merged."}
            </p>
          </div>
        </div>
        {isConfigured() && (
          <button
            className={`${secondaryClass} mt-4`}
            onClick={() => {
              void retrySync();
            }}
          >
            Retry planner sync
          </button>
        )}
        {isConfigured() && (
          <button
            className={`${secondaryClass} mt-3`}
            onClick={() => {
              if (
                confirm(
                  "Load the latest planner from Google Sheets and replace this device’s planner? Export a backup first if you have unsynced edits.",
                )
              )
                void reloadCloud();
            }}
          >
            Load latest Sheet tables
          </button>
        )}
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-700">
            Where your data is stored
          </p>
          <p className="mt-2">
            On this browser: localStorage keys <code>daily-journal.v1</code> and{" "}
            <code>personal-workspace.v1</code>.
          </p>
          <p className="mt-2">
            {tableStorage
              ? "Live per-page storage is active. Each planner section reads and writes its corresponding Sheet table."
              : "The deployed Apps Script still uses legacy JSON. The new per-page tables become live after the backend update is deployed."}
          </p>
          <p className="mt-2">
            Journal: Entries. Habits: Habits, HabitChecks, RecurringHabits,
            HabitReminders. Calendar: Calendar. Personal: PersonalTasks,
            ShoppingWishlist, Groceries, WatchRead. Fitness: FitnessPlan,
            FitnessSchedule, FitnessSessions. Meals: Meals. Brain dump:
            BrainDump. Ideas: Ideas. Preferences: Settings.
          </p>
          <p className="mt-2">
            Only a successful sync confirms that a browser edit has reached the
            Sheet. A configured connection alone does not confirm a saved copy.
          </p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Keep a backup before clearing browser data or changing devices.
          Journal sync and planner sync have separate status indicators. Legacy
          JSON storage has a per-cell size limit; per-page table storage removes
          that combined planner limit.
        </p>
      </Card>
      <Card
        title="Keep a copy"
        subtitle="One backup includes the journal, daily habits and every planner section."
      >
        <div className="flex flex-wrap gap-3">
          <button
            className={primaryClass}
            onClick={() => {
              downloadJson(
                {
                  format: "my-space-backup",
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  workspace: data,
                  journal: readJournal(),
                },
                `my-space-${localDate()}.json`,
              );
              setMessage("Backup exported. Keep the JSON file somewhere safe.");
            }}
          >
            <Download className="h-4 w-4" />
            Export full backup
          </button>
          <button
            className={secondaryClass}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void restore(file);
            }}
          />
        </div>
        {message && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
          >
            {message}
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          For a spreadsheet-friendly copy of daily entries, use CSV or Copy in
          Daily journal.
        </p>
      </Card>
      <Card
        title="A few useful details"
        subtitle="Simple controls, so you know what to expect."
      >
        <ul className="space-y-3 text-sm leading-relaxed text-slate-500">
          <li>
            Habit reminders need notification permission and the app open.
          </li>
          <li>
            Calendar holidays are the dates you add. Leave ideas assume a
            Saturday–Sunday weekend.
          </li>
          <li>
            The fitness schedule is an editable starting template. It does not
            generate a personalised training plan.
          </li>
        </ul>
      </Card>
    </div>
  );
}
