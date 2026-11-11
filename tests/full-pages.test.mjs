import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { WorkspaceApp } from "../work/test-build/components.js";
import { createBackend } from "./apps-script-mock.mjs";
import {
  blankRow,
  createWorkspace,
  localDate,
} from "../src/workspace/model.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function setup() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.window = Object.assign(new EventTarget(), {
    location: { hash: "" },
    scrollTo() {},
  });
  globalThis.confirm = () => true;
  globalThis.alert = () => {};
  const today = localDate();
  const w = createWorkspace();
  w.updatedAt = 1;
  const backend = createBackend(w, {
    entries: [blankRow(today)],
    habits: [
      {
        id: "qa-water",
        name: "Water",
        color: "bg-sky-500 border-sky-500",
        lightBg: "bg-sky-50",
        ringColor: "",
      },
    ],
  });
  globalThis.__TEST_SCRIPT_URL__ = "https://backend.test/exec";
  globalThis.fetch = backend.fetch;
  return { backend, today, store };
}
const text = (n) =>
  typeof n === "string" ? n : n.children?.map(text).join("") || "";
function formFor(node) {
  let parent = node;
  while (parent && parent.type !== "form") parent = parent.parent;
  if (!parent) throw Error("No form");
  return parent;
}

test("every remaining page writes its own table through the actual Apps Script code and reloads correctly", async () => {
  const { backend, today, store } = setup();
  let app;
  const click = async (node) =>
    act(async () => node.props.onClick({ preventDefault() {} }));
  const change = async (node, value) =>
    act(async () => node.props.onChange({ target: { value } }));
  const submit = async (node) =>
    act(async () => formFor(node).props.onSubmit({ preventDefault() {} }));
  const settle = async () => act(async () => wait(1300));
  const button = (value) =>
    app.root.findAllByType("button").find((n) => text(n).includes(value));
  const navigate = async (id) => {
    const link = app.root
      .findAllByProps({ href: "#" + id })
      .find((n) => n.type === "a");
    await click(link);
  };
  try {
    await act(async () => {
      app = create(React.createElement(WorkspaceApp));
    });
    // Overview: one quick thought and a shared journal habit circle.
    await change(
      app.root.findByProps({ "aria-label": "Quick thought" }),
      "QA overview thought",
    );
    await submit(app.root.findByProps({ "aria-label": "Quick thought" }));
    await click(button("Water"));
    await settle();
    assert.equal(
      backend.sheets.get("BrainDump").grid[1][1],
      "QA overview thought",
    );
    assert.equal(backend.get().entries[0].habits["qa-water"], true);
    assert.equal(backend.sheets.get("HabitChecks").grid[1][2], true);
    // Journal: edit a meal in the original grid.
    await navigate("journal");
    const journalText = app.root.findAllByType("textarea")[0];
    await change(journalText, "QA actual breakfast");
    await settle();
    assert.equal(backend.get().entries[0].morningFood, "QA actual breakfast");
    // Habits: timed reminder and recurring interval.
    await navigate("habits");
    await change(
      app.root.findByProps({ "aria-label": "Reminder for Water" }),
      "09:15",
    );
    await change(
      app.root.findByProps({ placeholder: "Change bedsheets" }),
      "QA recurring",
    );
    await submit(app.root.findByProps({ placeholder: "Change bedsheets" }));
    await settle();
    assert.equal(backend.sheets.get("HabitReminders").grid[1][1], "09:15");
    assert.equal(
      backend.sheets.get("RecurringHabits").grid[1][1],
      "QA recurring",
    );
    // Calendar: event, note and selected date.
    await navigate("calendar");
    const eventTitle = app.root.findByProps({
      placeholder: "What’s happening?",
    });
    await change(eventTitle, "QA calendar");
    await change(
      app.root.findByProps({ placeholder: "Anything to remember…" }),
      "QA calendar note",
    );
    await submit(app.root.findByProps({ placeholder: "What’s happening?" }));
    await settle();
    assert.equal(backend.sheets.get("Calendar").grid[1][1], "QA calendar");
    assert.equal(backend.sheets.get("Calendar").grid[1][2], today);
    // Personal: all four independent lists.
    await navigate("personal");
    for (const [title, table] of [
      ["Personal to-do list", "PersonalTasks"],
      ["Shopping wishlist", "ShoppingWishlist"],
      ["Groceries", "Groceries"],
      ["Watch & read", "WatchRead"],
    ]) {
      const label = "New " + title.toLowerCase() + " item";
      await change(
        app.root.findByProps({ "aria-label": label }),
        "QA " + table,
      );
      await submit(app.root.findByProps({ "aria-label": label }));
    }
    await settle();
    for (const table of [
      "PersonalTasks",
      "ShoppingWishlist",
      "Groceries",
      "WatchRead",
    ])
      assert.equal(backend.sheets.get(table).grid[1][1], "QA " + table);
    await click(
      app.root.findByProps({ "aria-label": "Mark QA PersonalTasks complete" }),
    );
    await settle();
    assert.equal(backend.sheets.get("PersonalTasks").grid[1][2], true);
    // Fitness: programme settings, editable weekly session and today's completion.
    await navigate("fitness");
    const numbers = app.root
      .findAllByType("input")
      .filter((n) => n.props.type === "number");
    await change(numbers[0], "10");
    await change(numbers[1], "3");
    const fitnessInput = app.root
      .findAllByType("input")
      .find((n) => n.props.value === "Strength A");
    await change(fitnessInput, "QA strength");
    await click(button("Mark today complete"));
    await settle();
    assert.equal(backend.sheets.get("FitnessPlan").grid[1][2], 10);
    assert.equal(backend.sheets.get("FitnessPlan").grid[1][3], 3);
    assert.equal(
      backend.sheets.get("FitnessSchedule").grid[1][1],
      "QA strength",
    );
    assert.equal(backend.sheets.get("FitnessSessions").grid[1][0], today);
    // Meals: date-specific row and grocery handoff.
    await navigate("meals");
    await change(
      app.root.findByProps({ "aria-label": "breakfast for " + today }),
      "QA planned breakfast",
    );
    await change(
      app.root.findByProps({ "aria-label": "Ingredients, one per line" }),
      "QA eggs\nQA oats",
    );
    await submit(
      app.root.findByProps({ "aria-label": "Ingredients, one per line" }),
    );
    await settle();
    assert.equal(
      backend.get().workspace.meals[today].breakfast,
      "QA planned breakfast",
    );
    assert.ok(
      backend.sheets.get("Groceries").grid.some((r) => r[1] === "QA eggs"),
    );
    // Brain dump: note creation and deletion both persist.
    await navigate("dump");
    await change(
      app.root.findByProps({ "aria-label": "New thought" }),
      "QA brain dump",
    );
    await submit(app.root.findByProps({ "aria-label": "New thought" }));
    await settle();
    assert.ok(
      backend.sheets
        .get("BrainDump")
        .grid.some((r) => r[1] === "QA brain dump"),
    );
    await click(
      app.root.findAllByProps({ "aria-label": "Delete thought" }).at(-1),
    );
    await settle();
    assert.ok(
      !backend.get().workspace.thoughts.some((t) => t.text === "QA brain dump"),
    );
    // Ideas: title, reference link and notes.
    await navigate("ideas");
    await change(
      app.root.findByProps({ placeholder: "Something worth coming back to" }),
      "QA idea",
    );
    await change(
      app.root.findByProps({ placeholder: "https://…" }),
      "https://example.com/qa",
    );
    await change(
      app.root.findByProps({ placeholder: "Why did this catch your eye?" }),
      "QA idea note",
    );
    await submit(
      app.root.findByProps({ placeholder: "Something worth coming back to" }),
    );
    await settle();
    assert.equal(backend.sheets.get("Ideas").grid[1][1], "QA idea");
    assert.equal(
      backend.sheets.get("Ideas").grid[1][2],
      "https://example.com/qa",
    );
    // Settings: name persists as a setting, not a JSON blob; storage status is accurate.
    await navigate("settings");
    const name = app.root
      .findAllByType("input")
      .find((n) => n.props.maxLength === 40);
    await change(name, "QA workspace");
    await settle();
    assert.equal(backend.get().workspace.name, "QA workspace");
    assert.match(
      JSON.stringify(app.toJSON()),
      /Saved to per-page Sheet tables/,
    );
    // Direct Sheet edit must appear after an app remount even with unchanged updatedAt.
    const mealRow = backend.sheets
      .get("Meals")
      .grid.find((r) => r[0] === today);
    mealRow[1] = "Direct Sheet breakfast";
    await act(async () => app.unmount());
    app = null;
    await act(async () => {
      app = create(React.createElement(WorkspaceApp));
    });
    await navigate("meals");
    assert.equal(
      app.root.findByProps({ "aria-label": "breakfast for " + today }).props
        .value,
      "Direct Sheet breakfast",
    );
    assert.equal(
      JSON.parse(store.get("personal-workspace.v1")).name,
      "QA workspace",
    );
  } finally {
    if (app) await act(async () => app.unmount());
  }
});
