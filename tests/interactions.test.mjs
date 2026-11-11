import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import {
  WorkspaceApp,
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

test("full workspace shares habit completion across overview, journal and weekly habit view", async () => {
  await render(React.createElement(WorkspaceApp));
  assert.match(text(renderer), /Today, a little more intentional/);
  const habit = buttonsWith("2L Water").at(0);
  assert.ok(habit);
  await click(habit);
  let journal = JSON.parse(store.get(JOURNAL_KEY));
  assert.equal(
    journal.rows.find((r) => r.dateStr === localDate()).habits.h1,
    true,
  );
  await act(async () =>
    renderer.root
      .findByProps({ href: "#habits", "aria-current": undefined })
      .props.onClick({ preventDefault() {} }),
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
  for (const id of ["content", "work", "prayer"]) {
    assert.equal(renderer.root.findAllByProps({ href: "#" + id }).length, 0);
  }
  assert.match(text(renderer), /Today, a little more intentional/);
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
