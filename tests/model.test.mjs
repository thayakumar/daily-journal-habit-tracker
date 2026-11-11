import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  blankRow,
  createWorkspace,
  daysBetween,
  isJournal,
  isWorkspace,
  localDate,
  readWorkspace,
  recurrenceDue,
  safeUrl,
  weekDates,
  wishlistExpired,
  WORKSPACE_KEY,
} from "../src/workspace/model.ts";

test("weekly views cross month/year boundaries and begin on Monday", () => {
  assert.deepEqual(weekDates("2027-01-03"), [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ]);
  assert.equal(weekDates("2026-11-09")[0], "2026-11-09");
});
test("date arithmetic handles leap years and local daylight-saving boundaries", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-03-14", 1), "2027-03-15");
  assert.equal(daysBetween("2027-03-13", "2027-03-15"), 2);
  assert.equal(localDate(new Date(2026, 10, 11, 0, 1)), "2026-11-11");
});
test("recurring routines become due at their interval and overdue afterwards", () => {
  const h = { lastDone: "2026-11-01", interval: 7 };
  assert.equal(recurrenceDue(h, "2026-11-07"), 1);
  assert.equal(recurrenceDue(h, "2026-11-08"), 0);
  assert.equal(recurrenceDue(h, "2026-11-10"), -2);
});
test("wishlist archives at 30 days without affecting other personal lists", () => {
  const item = { kind: "wishlist", created: "2026-10-12" };
  assert.equal(wishlistExpired(item, "2026-11-10"), false);
  assert.equal(wishlistExpired(item, "2026-11-11"), true);
  assert.equal(
    wishlistExpired({ ...item, kind: "grocery" }, "2026-11-11"),
    false,
  );
});
test("backup validation accepts full records and rejects malformed nested data", () => {
  const data = createWorkspace();
  assert.equal(isWorkspace(JSON.parse(JSON.stringify(data))), true);
  assert.equal(
    isWorkspace({
      ...data,
      prayer: { ...data.prayer, checks: { "2026-11-11": [true] } },
    }),
    false,
  );
  assert.equal(
    isWorkspace({
      ...data,
      content: [
        {
          id: "x",
          title: "Test",
          platform: "",
          date: "",
          stage: "Unknown",
          note: "",
        },
      ],
    }),
    false,
  );
  assert.equal(isWorkspace({ ...data, meals: { "2026-11-11": null } }), false);
  assert.equal(
    isWorkspace({ ...data, fitness: { ...data.fitness, weeks: -1 } }),
    false,
  );
  assert.equal(
    isWorkspace({ ...data, fitness: { ...data.fitness, start: "2026-02-31" } }),
    false,
  );
  assert.equal(
    isWorkspace({
      ...data,
      recurring: [
        {
          id: "x",
          name: "Plants",
          lastDone: "2026-11-11",
          interval: 0,
          reminder: "",
        },
      ],
    }),
    false,
  );
  assert.equal(isWorkspace({ version: 1 }), false);
});
test("journal backups preserve existing row schema including habit checks", () => {
  const row = blankRow("2026-11-11");
  const journal = {
    rows: [{ ...row, habits: { h1: true } }],
    habits: [],
    showTasksColumn: true,
  };
  assert.equal(isJournal(journal), true);
  assert.equal(
    isJournal({ ...journal, rows: [{ ...row, habits: [] }] }),
    false,
  );
  assert.equal(
    isJournal({ ...journal, rows: [{ ...row, dateStr: "bad" }] }),
    false,
  );
});
test("ideas only open HTTP(S) URLs", () => {
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "not a link",
  ])
    assert.equal(safeUrl(bad), null);
});
test("saved workspace round-trips and corrupt storage falls back without deleting it", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null };
  const saved = { ...createWorkspace(), name: "My Planner", updatedAt: 1 };
  store.set(WORKSPACE_KEY, JSON.stringify(saved));
  assert.deepEqual(readWorkspace(), saved);
  store.set(WORKSPACE_KEY, "{broken");
  assert.equal(isWorkspace(readWorkspace()), true);
  assert.equal(store.get(WORKSPACE_KEY), "{broken");
});
