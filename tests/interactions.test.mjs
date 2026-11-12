import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import {
  WorkspaceApp,
  Finance,
  ExpenseForm,
  Journal,
  BrainDump,
  ListPanel,
  useWorkspace,
} from "../work/test-build/components.js";
import {
  blankRow,
  createWorkspace,
  JOURNAL_KEY,
  localDate,
  WORKSPACE_KEY,
} from "../src/workspace/model.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let store, renderer;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (node) => JSON.stringify(node.toJSON());
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const events = new EventTarget();
  globalThis.window = Object.assign(events, {
    location: { hash: "" },
    scrollTo() {},
  });
  globalThis.confirm = () => true;
  globalThis.alert = () => {};
  globalThis.__TEST_SCRIPT_URL__ = "";
});
afterEach(async () => {
  if (renderer) {
    await act(async () => renderer.unmount());
    renderer = null;
  }
});
async function render(component) {
  await act(async () => {
    renderer = create(component);
  });
  return renderer;
}
async function click(node) {
  await act(async () => node.props.onClick({ preventDefault() {} }));
}
async function change(node, value) {
  await act(async () => node.props.onChange({ target: { value } }));
}
const nodeText = (node) =>
  typeof node === "string" ? node : node.children?.map(nodeText).join("") || "";
const buttonsWith = (value) =>
  renderer.root
    .findAllByType("button")
    .filter((b) => nodeText(b).includes(value));

test("overview navigates to habits and shares completion with weekly history", async () => {
  await render(React.createElement(WorkspaceApp));
  assert.ok(renderer.root.findByProps({ "aria-label": "Open a page" }));
  assert.equal(renderer.root.findAllByType("textarea").length, 0);
  await click(
    renderer.root
      .findByProps({ "aria-label": "Open a page" })
      .findAllByType("button")
      .find((b) => nodeText(b) === "Habits"),
  );
  const habit = renderer.root.findByProps({ "aria-label": "2L Water today" });
  assert.ok(habit);
  await click(habit);
  let journal = JSON.parse(store.get(JOURNAL_KEY));
  assert.equal(
    journal.rows.find((r) => r.dateStr === localDate()).habits.h1,
    true,
  );
  const todayCircle = renderer.root.findByProps({
    "aria-label": `2L Water on ${localDate()}`,
  });
  assert.equal(todayCircle.props["aria-pressed"], true);
  await click(todayCircle);
  journal = JSON.parse(store.get(JOURNAL_KEY));
  assert.equal(
    journal.rows.find((r) => r.dateStr === localDate()).habits.h1,
    false,
  );
});

test("brain dump saves thoughts without content planner actions", async () => {
  let state = createWorkspace();
  const update = (fn) => {
    state = fn(state);
  };
  await render(React.createElement(BrainDump, { data: state, update }));
  await change(
    renderer.root.findByProps({ "aria-label": "New thought" }),
    "A thought to keep",
  );
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  assert.equal(state.thoughts[0].text, "A thought to keep");
  await act(async () =>
    renderer.update(React.createElement(BrainDump, { data: state, update })),
  );
  assert.equal(buttonsWith("Send to content").length, 0);
  assert.equal(state.content.length, 0);
});

test("removed pages and old deep links do not expose removed features", async () => {
  window.location.hash = "#content";
  await render(React.createElement(WorkspaceApp));
  for (const id of ["content", "work", "prayer", "calendar", "journal"]) {
    assert.equal(renderer.root.findAllByProps({ href: "#" + id }).length, 0);
  }
  assert.ok(renderer.root.findByProps({ "aria-label": "Open a page" }));
  assert.equal(buttonsWith("Content in motion").length, 0);
});

test("tasks support dates, completion and recovery in the completed filter", async () => {
  let state = createWorkspace();
  const update = (fn) => {
    state = fn(state);
  };
  const props = () => ({
    kind: "work",
    title: "Work",
    subtitle: "",
    data: state,
    update,
    today: localDate(),
  });
  await render(React.createElement(ListPanel, props()));
  await change(
    renderer.root.findByProps({ "aria-label": "New work item" }),
    "Finish proposal",
  );
  await change(
    renderer.root.findByProps({ "aria-label": "Due date" }),
    "2026-11-20",
  );
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  assert.equal(state.items[0].due, "2026-11-20");
  await act(async () =>
    renderer.update(React.createElement(ListPanel, props())),
  );
  await click(
    renderer.root.findByProps({
      "aria-label": "Mark Finish proposal complete",
    }),
  );
  assert.equal(state.items[0].done, true);
  await act(async () =>
    renderer.update(React.createElement(ListPanel, props())),
  );
  await click(buttonsWith("done")[0]);
  assert.match(text(renderer), /Finish proposal/);
});

test("workspace edits persist immediately and survive a remount", async () => {
  let api;
  function Harness() {
    api = useWorkspace();
    return null;
  }
  await render(React.createElement(Harness));
  await act(async () => api.update((s) => ({ ...s, name: "My new space" })));
  assert.equal(JSON.parse(store.get(WORKSPACE_KEY)).name, "My new space");
  await act(async () => renderer.unmount());
  renderer = null;
  await render(React.createElement(Harness));
  assert.equal(api.data.name, "My new space");
});

test("failed cloud load never overwrites remote planner with local defaults", async () => {
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  let posts = 0;
  let api;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") posts++;
    throw new Error("offline");
  };
  function Harness() {
    api = useWorkspace();
    return null;
  }
  await render(React.createElement(Harness));
  await act(async () => api.update((s) => ({ ...s, name: "Offline edit" })));
  await act(async () => sleep(1300));
  assert.equal(posts, 0);
  assert.equal(JSON.parse(store.get(WORKSPACE_KEY)).name, "Offline edit");
});

test("journal keeps unsynced local changes on startup and awaits an explicit sync", async () => {
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  const today = localDate();
  const local = {
    rows: [{ ...blankRow(today), morningFood: "Local breakfast" }],
    habits: [],
    showTasksColumn: true,
  };
  store.set(JOURNAL_KEY, JSON.stringify(local));
  store.set("journal.pending.v1", "true");
  let posts = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") posts++;
    return {
      ok: true,
      json: async () => ({
        entries: [{ ...blankRow(today), morningFood: "Old cloud breakfast" }],
        habits: [],
        settings: {},
      }),
    };
  };
  let bridge;
  await render(
    React.createElement(Journal, {
      onReady: (next) => {
        bridge = next;
      },
    }),
  );
  assert.equal(bridge.rows[0].morningFood, "Local breakfast");
  await act(async () => sleep(1100));
  assert.equal(posts, 0);
});

test("journal toggles persist to Sheets without side effects in React state updaters", async () => {
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  const today = localDate();
  const habit = {
    id: "h1",
    name: "Water",
    color: "bg-sky-500 border-sky-500",
    lightBg: "",
    ringColor: "",
  };
  const posts = [];
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") {
      posts.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ success: true }) };
    }
    return {
      ok: true,
      json: async () => ({
        entries: [blankRow(today)],
        habits: [habit],
        settings: {},
      }),
    };
  };
  let bridge;
  await render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(Journal, {
        onReady: (next) => {
          bridge = next;
        },
      }),
    ),
  );
  await act(async () => bridge.toggleDay(today, "h1"));
  await act(async () => sleep(1100));
  assert.equal(posts.filter((p) => p.action === "saveEntries").length, 1);
  assert.equal(
    posts.find((p) => p.action === "saveEntries").data[0].habits.h1,
    true,
  );
  assert.equal(store.get("journal.pending.v1"), undefined);
});

test("journal retains pending local data when the server does not acknowledge a save", async () => {
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  const today = localDate();
  globalThis.fetch = async (_url, options) =>
    options?.method === "POST"
      ? { ok: true, json: async () => ({ error: "Write failed" }) }
      : {
          ok: true,
          json: async () => ({
            entries: [blankRow(today)],
            habits: [
              {
                id: "h1",
                name: "Water",
                color: "",
                lightBg: "",
                ringColor: "",
              },
            ],
            settings: {},
          }),
        };
  let bridge;
  await render(
    React.createElement(Journal, {
      onReady: (next) => {
        bridge = next;
      },
    }),
  );
  await act(async () => bridge.toggleDay(today, "h1"));
  await act(async () => sleep(1100));
  assert.equal(store.get("journal.pending.v1"), "true");
  assert.equal(JSON.parse(store.get(JOURNAL_KEY)).rows[0].habits.h1, true);
});

test("edits during an in-flight journal save are serialized into a second snapshot", async () => {
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  const today = localDate();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const entries = [];
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") {
      const p = JSON.parse(options.body);
      if (p.action === "saveEntries") {
        entries.push(p.data);
        if (entries.length === 1) await gate;
      }
      return { ok: true, json: async () => ({ success: true }) };
    }
    return {
      ok: true,
      json: async () => ({
        entries: [blankRow(today)],
        habits: [
          { id: "h1", name: "Water", color: "", lightBg: "", ringColor: "" },
        ],
        settings: {},
      }),
    };
  };
  let bridge;
  await render(
    React.createElement(Journal, {
      onReady: (next) => {
        bridge = next;
      },
    }),
  );
  await act(async () => bridge.toggleDay(today, "h1"));
  await act(async () => sleep(1100));
  assert.equal(entries.length, 1);
  await act(async () => bridge.toggleDay(today, "h1"));
  await act(async () => {
    release();
    await sleep(20);
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[1][0].habits.h1, false);
  assert.equal(store.get("journal.pending.v1"), undefined);
});

test("workout logs survive an older backend and upload when detailed-log support is activated", async () => {
  const { createBackend } = await import("./apps-script-mock.mjs");
  const backend = createBackend(createWorkspace());
  let upgraded = false;
  let api;
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    json: async () => {
      if (options?.method === "POST") {
        const payload = JSON.parse(options.body);
        if (!upgraded && payload.action === "saveWorkspace") {
          delete payload.data.workoutSets;
          delete payload.data.recurringChecks;
        }
        return backend.post(payload);
      }
      const value = backend.get();
      if (!upgraded) {
        delete value.features;
        delete value.workspace.workoutSets;
        delete value.workspace.recurringChecks;
      }
      return value;
    },
  });
  function Harness() {
    api = useWorkspace();
    return null;
  }
  await render(React.createElement(Harness));
  await act(async () =>
    api.update((s) => ({
      ...s,
      workoutSets: [
        {
          id: "set-local",
          exerciseId: "ex-local",
          date: localDate(),
          exercise: "Dumbbell lifts",
          type: "strength",
          setNumber: 1,
          weight: "10",
          unit: "kg",
          reps: "12",
          durationMinutes: "",
          distanceKm: "",
          notes: "",
        },
      ],
    })),
  );
  await act(async () => sleep(1300));
  assert.equal(api.data.workoutSets.length, 1);
  assert.match(api.status, /saved locally/);
  await act(async () => renderer.unmount());
  renderer = null;
  await render(React.createElement(Harness));
  assert.equal(api.data.workoutSets.length, 1);
  await act(async () => renderer.unmount());
  renderer = null;
  upgraded = true;
  await render(React.createElement(Harness));
  await act(async () => sleep(1300));
  assert.equal(api.logStorageReady, true);
  assert.equal(backend.get().workspace.workoutSets.length, 1);
});

test("initial habit and planner reads share one cloud request", async () => {
  const { createBackend } = await import("./apps-script-mock.mjs");
  const backend = createBackend(createWorkspace());
  let reads = 0;
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  globalThis.fetch = async (_url, options) => {
    if (!options?.method) reads++;
    return {
      ok: true,
      json: async () =>
        options?.method === "POST"
          ? backend.post(JSON.parse(options.body))
          : backend.get(),
    };
  };
  await render(React.createElement(WorkspaceApp));
  assert.equal(reads, 1);
});

test("vocabulary stays local on an older backend and uploads after its feature flag activates", async () => {
  const { createBackend } = await import("./apps-script-mock.mjs");
  const b = createBackend(createWorkspace());
  let upgraded = false;
  let api;
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    json: async () => {
      if (options?.method === "POST") {
        const p = JSON.parse(options.body);
        if (!upgraded && p.action === "saveWorkspace") delete p.data.vocabulary;
        return b.post(p);
      }
      const d = b.get();
      if (!upgraded) {
        delete d.features.vocabulary;
        delete d.workspace.vocabulary;
      }
      return d;
    },
  });
  function Harness() {
    api = useWorkspace();
    return null;
  }
  await render(React.createElement(Harness));
  const entry = {
    id: "local-word",
    word: "Serendipity",
    definition: "Good luck by chance.",
    example: "A happy serendipity.",
    createdAt: "2026-11-12T01:00:00Z",
    updatedAt: "2026-11-12T01:00:00Z",
  };
  await act(async () => api.update((s) => ({ ...s, vocabulary: [entry] })));
  await act(async () => sleep(1300));
  assert.equal(api.data.vocabulary.length, 1);
  assert.match(api.status, /Vocabulary saved on this device/);
  assert.equal(b.get().workspace.vocabulary.length, 0);
  await act(async () => renderer.unmount());
  renderer = null;
  await render(React.createElement(Harness));
  assert.equal(api.data.vocabulary[0].word, "Serendipity");
  await act(async () => renderer.unmount());
  renderer = null;
  upgraded = true;
  await render(React.createElement(Harness));
  await act(async () => sleep(1300));
  assert.equal(api.vocabularyStorageReady, true);
  assert.equal(b.get().workspace.vocabulary[0].id, "local-word");
});

test("finance stays local on an older backend and uploads after its feature flag activates", async () => {
  const { createBackend } = await import("./apps-script-mock.mjs");
  const b = createBackend(createWorkspace());
  let upgraded = false;
  let api;
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    json: async () => {
      if (options?.method === "POST") {
        const p = JSON.parse(options.body);
        if (!upgraded && p.action === "saveWorkspace")
          delete p.data.financeExpenses;
        return b.post(p);
      }
      const d = b.get();
      if (!upgraded) {
        delete d.features.finance;
        delete d.workspace.financeExpenses;
      }
      return d;
    },
  });
  function Harness() {
    api = useWorkspace();
    return null;
  }
  await render(React.createElement(Harness));
  const entry = {
    id: "local-expense",
    date: "2026-11-12",
    item: "Lunch",
    amount: 12.5,
    category: "Food",
    receiptName: "",
    receiptUrl: "",
    createdAt: "2026-11-12T01:00:00Z",
  };
  await act(async () =>
    api.update((s) => ({ ...s, financeExpenses: [entry] })),
  );
  await act(async () => sleep(1300));
  assert.equal(api.data.financeExpenses.length, 1);
  assert.match(api.status, /Finance saved on this device/);
  assert.equal(b.get().workspace.financeExpenses.length, 0);
  await act(async () => renderer.unmount());
  renderer = null;
  await render(React.createElement(Harness));
  assert.equal(api.data.financeExpenses[0].item, "Lunch");
  await act(async () => renderer.unmount());
  renderer = null;
  upgraded = true;
  await render(React.createElement(Harness));
  await act(async () => sleep(1300));
  assert.equal(api.financeStorageReady, true);
  assert.equal(b.get().workspace.financeExpenses[0].id, "local-expense");
});

test("monthly plans stay local on the current backend and merge after planning support activates", async () => {
  const { createBackend } = await import("./apps-script-mock.mjs");
  const b = createBackend(createWorkspace());
  let upgraded = false;
  let api;
  globalThis.__TEST_SCRIPT_URL__ = "https://sheet.test/exec";
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    json: async () => {
      if (options?.method === "POST") {
        const p = JSON.parse(options.body);
        if (!upgraded && p.action === "saveWorkspace")
          delete p.data.financePlanning;
        return b.post(p);
      }
      const d = b.get();
      if (!upgraded) {
        delete d.features.financePlanning;
        delete d.workspace.financePlanning;
      }
      return d;
    },
  });
  function Harness() {
    api = useWorkspace();
    return null;
  }
  await render(React.createElement(Harness));
  await act(async () =>
    api.update((s) => ({
      ...s,
      financePlanning: { defaultStartDay: 26, cycles: [], rows: [] },
    })),
  );
  await act(async () => sleep(1300));
  assert.match(api.status, /Monthly plans saved on this device/);
  await act(async () => renderer.unmount());
  renderer = null;
  await render(React.createElement(Harness));
  assert.equal(api.data.financePlanning.defaultStartDay, 26);
  await act(async () =>
    api.update((s) => ({
      ...s,
      financePlanning: {
        ...s.financePlanning,
        cycles: [
          {
            id: "aug",
            month: "2026-08",
            start: "2026-07-26",
            end: "2026-08-25",
          },
        ],
      },
    })),
  );
  await act(async () => sleep(1300));
  assert.equal(b.get().workspace.financePlanning.cycles.length, 0);
  await act(async () => renderer.unmount());
  renderer = null;
  upgraded = true;
  await render(React.createElement(Harness));
  await act(async () => sleep(1300));
  assert.equal(api.planningStorageReady, true);
  assert.equal(b.get().workspace.financePlanning.defaultStartDay, 26);
  assert.equal(b.get().workspace.financePlanning.cycles[0].id, "aug");
});

test("finance defaults to today's cycle and inserts a new expense immediately even with active history filters", async () => {
  const today = localDate();
  const { cycleDates, activeMonth, shiftMonth } = await import(
    "../src/finance/planning.ts"
  );
  const month = activeMonth(today, 27);
  const state = createWorkspace();
  state.financePlanning = {
    defaultStartDay: 27,
    cycles: [
      { id: "current", month, ...cycleDates(month, 27) },
      {
        id: "future",
        month: shiftMonth(month, 1),
        ...cycleDates(shiftMonth(month, 1), 27),
      },
    ],
    rows: [],
  };
  let latest;
  function Harness() {
    const [data, setData] = React.useState(state);
    latest = data;
    return React.createElement(Finance, {
      data,
      update: (fn) => setData(fn),
      receiptReady: true,
      planningReady: true,
      onSync() {},
    });
  }
  await render(React.createElement(Harness));
  assert.equal(
    renderer.root.findByProps({ "aria-label": "Salary cycle" }).props.value,
    "current",
  );
  assert.ok(!text(renderer).includes("All expenses"));
  await change(
    renderer.root.findByProps({ "aria-label": "Search expenses" }),
    "hidden search",
  );
  await change(
    renderer.root.findByProps({ "aria-label": "Filter expense category" }),
    "Groceries",
  );
  await act(async () =>
    renderer.root.findByType(ExpenseForm).props.onSave({
      date: today,
      item: "Instant coffee",
      amount: 5,
      category: "Food",
    }),
  );
  assert.ok(text(renderer).includes("Instant coffee"));
  assert.equal(
    renderer.root.findByProps({ "aria-label": "Search expenses" }).props.value,
    "",
  );
  assert.equal(
    renderer.root.findByProps({ "aria-label": "Filter expense category" }).props
      .value,
    "All",
  );
  assert.equal(latest.financeExpenses.length, 1);
  await assert.rejects(
    async () =>
      await act(async () =>
        renderer.root.findByType(ExpenseForm).props.onSave({
          date: "2000-01-01",
          item: "Wrong cycle",
          amount: 5,
          category: "Food",
        }),
      ),
    /within the selected/,
  );
  assert.equal(latest.financeExpenses.length, 1);
});

test("the first expense creates the current salary cycle instead of an unfiltered ledger view", async () => {
  const today = localDate();
  let latest;
  function Harness() {
    const [data, setData] = React.useState(createWorkspace());
    latest = data;
    return React.createElement(Finance, {
      data,
      update: (fn) => setData(fn),
      receiptReady: true,
      planningReady: true,
      onSync() {},
    });
  }
  await render(React.createElement(Harness));
  assert.match(
    renderer.root.findByProps({ "aria-label": "Salary cycle" }).props.value,
    /^auto-/,
  );
  await act(async () =>
    renderer.root.findByType(ExpenseForm).props.onSave({
      date: today,
      item: "First record",
      amount: 2,
      category: "Food",
    }),
  );
  assert.equal(latest.financePlanning.cycles.length, 1);
  assert.equal(latest.financePlanning.rows.length, 3);
  assert.ok(text(renderer).includes("First record"));
});
