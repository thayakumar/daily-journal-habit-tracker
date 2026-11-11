// Deploy this file as a new version of the existing bound Web app.
// Existing Entries/Habits/Settings stay compatible. New tables are the source of truth.
var TABLE_SCHEMA_VERSION = 2;
var PLANNER_TABLES = {
  PersonalTasks: ["id", "text", "done", "created", "due"],
  ShoppingWishlist: ["id", "text", "done", "created", "due"],
  Groceries: ["id", "text", "done", "created", "due"],
  WatchRead: ["id", "text", "done", "created", "due"],
  Calendar: ["id", "title", "date", "type", "note"],
  RecurringHabits: ["id", "name", "intervalDays", "lastDone", "reminder"],
  HabitReminders: ["habitId", "time"],
  Meals: ["date", "breakfast", "lunch", "dinner", "snack"],
  FitnessPlan: ["id", "start", "weeks", "weeklyTarget"],
  FitnessSchedule: ["day", "title", "exercises"],
  FitnessSessions: ["date", "completed"],
  BrainDump: ["id", "text", "created", "contentId"],
  Ideas: ["id", "title", "url", "note"],
};
var HABIT_CHECK_HEADERS = ["date", "habitId", "completed"];
var ENTRY_HEADERS = [
  "id",
  "dateStr",
  "displayDate",
  "dayName",
  "sleepTime",
  "exercise",
  "morningFood",
  "afternoonFood",
  "dinnerFood",
  "snack",
  "tasks",
  "habits_json",
];
var HABIT_HEADERS = [
  "id",
  "name",
  "colorClass",
  "lightBgClass",
  "ringColorClass",
];
function jsonResult(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function stringValue(value) {
  return value == null ? "" : String(value);
}
function boolValue(value) {
  return value === true || String(value).toLowerCase() === "true";
}
function dateValue(value) {
  return value instanceof Date
    ? Utilities.formatDate(
        value,
        SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(),
        "yyyy-MM-dd",
      )
    : stringValue(value);
}
function plainValue(value) {
  return value instanceof Date ? dateValue(value) : value;
}
function safeCell(value) {
  // setValues interprets '=' as a formula; user input is always literal text.
  return typeof value === "string" && /^[=']/.test(value) ? "'" + value : value;
}
function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}
function ensureSheet(ss, title, headers) {
  var sheet = ss.getSheetByName(title);
  if (!sheet) sheet = ss.insertSheet(title);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#f1f5f9");
  }
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (actual.join("|") !== headers.join("|"))
    throw new Error(
      "Unexpected headers in " + title + ". No data was replaced.",
    );
  return sheet;
}
function readTable(ss, title, headers) {
  var sheet = ss.getSheetByName(title);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (actual.join("|") !== headers.join("|"))
    throw new Error("Unexpected headers in " + title);
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues()
    .filter(function (row) {
      return row[0] !== "";
    })
    .map(function (row) {
      return row.map(plainValue);
    });
}
function writeTable(ss, title, headers, rows) {
  var sheet = ensureSheet(ss, title, headers);
  if (
    rows.some(function (row) {
      return row.length !== headers.length;
    })
  )
    throw new Error("Invalid row width in " + title);
  if (sheet.getMaxRows() < rows.length + 1)
    sheet.insertRowsBefore(
      sheet.getMaxRows(),
      rows.length + 1 - sheet.getMaxRows(),
    );
  // Native BOOLEAN table columns fill empty rows with FALSE. Count record IDs, not checkbox formatting.
  var occupied =
    sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
      : [];
  var lastRecord = 0;
  occupied.forEach(function (row, index) {
    if (row[0] !== "") lastRecord = index + 1;
  });
  var count = Math.max(lastRecord, rows.length);
  if (count > 0) {
    var padded = rows.map(function (row) {
      return row.map(safeCell);
    });
    while (padded.length < count)
      padded.push(
        headers.map(function () {
          return "";
        }),
      );
    sheet.getRange(2, 1, count, headers.length).setValues(padded);
  }
}
function settingsOf(ss) {
  var sheet = ensureSheet(ss, "Settings", ["key", "value"]);
  var settings = {};
  if (sheet.getLastRow() > 1)
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 2)
      .getValues()
      .forEach(function (row) {
        if (row[0]) settings[row[0]] = stringValue(row[1]);
      });
  return settings;
}
function putSetting(ss, key, value) {
  var sheet = ensureSheet(ss, "Settings", ["key", "value"]);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++)
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(safeCell(value));
      return;
    }
  sheet.appendRow([key, safeCell(value)]);
}
function validateWorkspace(w) {
  if (
    !w ||
    w.version !== 1 ||
    typeof w.name !== "string" ||
    !Number.isFinite(w.updatedAt) ||
    !w.fitness ||
    !Array.isArray(w.fitness.schedule) ||
    w.fitness.schedule.length !== 7 ||
    !Array.isArray(w.fitness.completed) ||
    !w.meals ||
    !w.reminders
  )
    throw new Error("Invalid planner data");
  ["items", "recurring", "events", "thoughts", "ideas"].forEach(function (key) {
    if (!Array.isArray(w[key]))
      throw new Error("Invalid planner collection: " + key);
  });
  if (
    !Number.isInteger(w.fitness.weeks) ||
    w.fitness.weeks < 1 ||
    !Number.isInteger(w.fitness.target) ||
    w.fitness.target < 1 ||
    w.fitness.target > 7
  )
    throw new Error("Invalid fitness plan");
}
function plannerToTables(w) {
  validateWorkspace(w);
  var tables = {};
  [
    ["PersonalTasks", "personal"],
    ["ShoppingWishlist", "wishlist"],
    ["Groceries", "grocery"],
    ["WatchRead", "watch"],
  ].forEach(function (pair) {
    tables[pair[0]] = w.items
      .filter(function (i) {
        return i.kind === pair[1];
      })
      .map(function (i) {
        return [i.id, i.text, !!i.done, i.created, i.due || ""];
      });
  });
  tables.Calendar = w.events.map(function (i) {
    return [i.id, i.title, i.date, i.type, i.note];
  });
  tables.RecurringHabits = w.recurring.map(function (i) {
    return [i.id, i.name, i.interval, i.lastDone, i.reminder || ""];
  });
  tables.HabitReminders = Object.keys(w.reminders).map(function (id) {
    return [id, w.reminders[id]];
  });
  tables.Meals = Object.keys(w.meals)
    .sort()
    .map(function (date) {
      var m = w.meals[date];
      return [date, m.breakfast, m.lunch, m.dinner, m.snack];
    });
  tables.FitnessPlan = [
    ["main", w.fitness.start, w.fitness.weeks, w.fitness.target],
  ];
  tables.FitnessSchedule = w.fitness.schedule.map(function (d, index) {
    return [index + 1, d.title, d.exercises];
  });
  tables.FitnessSessions = w.fitness.completed.map(function (date) {
    return [date, true];
  });
  tables.BrainDump = w.thoughts.map(function (i) {
    return [i.id, i.text, i.created, i.contentId || ""];
  });
  tables.Ideas = w.ideas.map(function (i) {
    return [i.id, i.title, i.url, i.note];
  });
  // Validate all tables before writing any of them.
  Object.keys(PLANNER_TABLES).forEach(function (name) {
    tables[name].forEach(function (row) {
      if (
        row.length !== PLANNER_TABLES[name].length ||
        row.some(function (v) {
          return v === undefined || v === null || typeof v === "object";
        })
      )
        throw new Error("Invalid value in " + name);
    });
  });
  return tables;
}
function writePlanner(ss, w) {
  var tables = plannerToTables(w);
  Object.keys(PLANNER_TABLES).forEach(function (name) {
    ensureSheet(ss, name, PLANNER_TABLES[name]);
  });
  Object.keys(PLANNER_TABLES).forEach(function (name) {
    writeTable(ss, name, PLANNER_TABLES[name], tables[name]);
  });
  putSetting(ss, "workspaceName", w.name);
  putSetting(ss, "workspaceTablesUpdatedAt", String(w.updatedAt));
  putSetting(ss, "workspaceTablesVersion", String(TABLE_SCHEMA_VERSION));
  // Preserve records from removed pages, without using one-cell JSON as live storage.
  var extras = JSON.stringify({
    items: w.items.filter(function (i) {
      return i.kind === "work" || i.kind === "goal";
    }),
    content: w.content || [],
    prayer: w.prayer || {
      names: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
      times: ["", "", "", "", ""],
      checks: {},
    },
  });
  if (extras.length <= 45000) putSetting(ss, "workspaceLegacyExtras", extras);
}
function readPlanner(ss, settings) {
  var legacy = parseJson(settings.personalWorkspaceV1 || "{}", {});
  var extras = parseJson(settings.workspaceLegacyExtras || "{}", {});
  var w = {
    version: 1,
    updatedAt: Number(
      settings.workspaceTablesUpdatedAt || legacy.updatedAt || 0,
    ),
    name: settings.workspaceName || legacy.name || "My Space",
    items:
      extras.items ||
      (legacy.items || []).filter(function (i) {
        return i.kind === "work" || i.kind === "goal";
      }),
    recurring: [],
    events: [],
    thoughts: [],
    ideas: [],
    content: extras.content || legacy.content || [],
    prayer: extras.prayer ||
      legacy.prayer || {
        names: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
        times: ["", "", "", "", ""],
        checks: {},
      },
    meals: {},
    reminders: {},
    fitness: {
      start: dateValue(new Date()),
      weeks: 12,
      target: 4,
      schedule: [],
      completed: [],
    },
  };
  [
    ["PersonalTasks", "personal"],
    ["ShoppingWishlist", "wishlist"],
    ["Groceries", "grocery"],
    ["WatchRead", "watch"],
  ].forEach(function (pair) {
    readTable(ss, pair[0], PLANNER_TABLES[pair[0]]).forEach(function (r) {
      w.items.push({
        id: stringValue(r[0]),
        kind: pair[1],
        text: stringValue(r[1]),
        done: boolValue(r[2]),
        created: dateValue(r[3]),
        due: dateValue(r[4]),
      });
    });
  });
  w.events = readTable(ss, "Calendar", PLANNER_TABLES.Calendar).map(
    function (r) {
      return {
        id: stringValue(r[0]),
        title: stringValue(r[1]),
        date: dateValue(r[2]),
        type: stringValue(r[3]),
        note: stringValue(r[4]),
      };
    },
  );
  w.recurring = readTable(
    ss,
    "RecurringHabits",
    PLANNER_TABLES.RecurringHabits,
  ).map(function (r) {
    return {
      id: stringValue(r[0]),
      name: stringValue(r[1]),
      interval: Number(r[2]),
      lastDone: dateValue(r[3]),
      reminder: stringValue(r[4]),
    };
  });
  readTable(ss, "HabitReminders", PLANNER_TABLES.HabitReminders).forEach(
    function (r) {
      w.reminders[stringValue(r[0])] = stringValue(r[1]);
    },
  );
  readTable(ss, "Meals", PLANNER_TABLES.Meals).forEach(function (r) {
    w.meals[dateValue(r[0])] = {
      breakfast: stringValue(r[1]),
      lunch: stringValue(r[2]),
      dinner: stringValue(r[3]),
      snack: stringValue(r[4]),
    };
  });
  var plan = readTable(ss, "FitnessPlan", PLANNER_TABLES.FitnessPlan)[0];
  if (plan) {
    w.fitness.start = dateValue(plan[1]);
    w.fitness.weeks = Number(plan[2]);
    w.fitness.target = Number(plan[3]);
  }
  var schedule = readTable(
    ss,
    "FitnessSchedule",
    PLANNER_TABLES.FitnessSchedule,
  );
  for (var d = 1; d <= 7; d++) {
    var row = schedule.filter(function (r) {
      return Number(r[0]) === d;
    })[0];
    w.fitness.schedule.push({
      title: row ? stringValue(row[1]) : "",
      exercises: row ? stringValue(row[2]) : "",
    });
  }
  w.fitness.completed = readTable(
    ss,
    "FitnessSessions",
    PLANNER_TABLES.FitnessSessions,
  )
    .filter(function (r) {
      return boolValue(r[1]);
    })
    .map(function (r) {
      return dateValue(r[0]);
    });
  w.thoughts = readTable(ss, "BrainDump", PLANNER_TABLES.BrainDump).map(
    function (r) {
      var t = {
        id: stringValue(r[0]),
        text: stringValue(r[1]),
        created: stringValue(r[2]),
      };
      if (r[3]) t.contentId = stringValue(r[3]);
      return t;
    },
  );
  w.ideas = readTable(ss, "Ideas", PLANNER_TABLES.Ideas).map(function (r) {
    return {
      id: stringValue(r[0]),
      title: stringValue(r[1]),
      url: stringValue(r[2]),
      note: stringValue(r[3]),
    };
  });
  return w;
}
function plannerRevision(ss) {
  var values = Object.keys(PLANNER_TABLES).map(function (name) {
    return [name, readTable(ss, name, PLANNER_TABLES[name])];
  });
  values.push(["workspaceName", settingsOf(ss).workspaceName || ""]);
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify(values),
    ),
  );
}
function journalRows(ss) {
  return readTable(ss, "Entries", ENTRY_HEADERS).map(function (r) {
    return {
      id: stringValue(r[0]),
      dateStr: dateValue(r[1]),
      displayDate: stringValue(r[2]),
      dayName: stringValue(r[3]),
      sleepTime: stringValue(r[4]),
      exercise: stringValue(r[5]),
      morningFood: stringValue(r[6]),
      afternoonFood: stringValue(r[7]),
      dinnerFood: stringValue(r[8]),
      snack: stringValue(r[9]),
      tasks: stringValue(r[10]),
      habits: parseJson(r[11], {}),
    };
  });
}
function writeHabitChecks(ss, entries) {
  var rows = [];
  entries.forEach(function (e) {
    Object.keys(e.habits || {}).forEach(function (id) {
      rows.push([e.dateStr, id, !!e.habits[id]]);
    });
  });
  writeTable(ss, "HabitChecks", HABIT_CHECK_HEADERS, rows);
}
function ensureMigration(ss) {
  var settings = settingsOf(ss);
  Object.keys(PLANNER_TABLES).forEach(function (name) {
    ensureSheet(ss, name, PLANNER_TABLES[name]);
  });
  ensureSheet(ss, "HabitChecks", HABIT_CHECK_HEADERS);
  if (Number(settings.workspaceTablesVersion) !== TABLE_SCHEMA_VERSION) {
    var old = parseJson(settings.personalWorkspaceV1 || "null", null);
    if (old) writePlanner(ss, old);
    writeHabitChecks(ss, journalRows(ss));
    putSetting(ss, "workspaceTablesVersion", String(TABLE_SCHEMA_VERSION));
  }
}
function getAll(ss) {
  ensureMigration(ss);
  var entries = journalRows(ss);
  var checks = readTable(ss, "HabitChecks", HABIT_CHECK_HEADERS);
  // HabitChecks is readable row-based storage; edits here are reflected on the next load.
  entries.forEach(function (e) {
    e.habits = {};
    checks
      .filter(function (r) {
        return dateValue(r[0]) === e.dateStr;
      })
      .forEach(function (r) {
        e.habits[stringValue(r[1])] = boolValue(r[2]);
      });
  });
  var habits = readTable(ss, "Habits", HABIT_HEADERS).map(function (r) {
    return {
      id: stringValue(r[0]),
      name: stringValue(r[1]),
      color: stringValue(r[2]),
      lightBg: stringValue(r[3]),
      ringColor: stringValue(r[4]),
    };
  });
  var settings = settingsOf(ss);
  return {
    entries: entries,
    habits: habits,
    settings: settings,
    storageSchemaVersion: TABLE_SCHEMA_VERSION,
    workspace: readPlanner(ss, settings),
    workspaceRevision: plannerRevision(ss),
  };
}
function withLock(operation) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return jsonResult(operation(SpreadsheetApp.getActiveSpreadsheet()));
  } catch (error) {
    return jsonResult({
      success: false,
      error: stringValue(error.message || error),
    });
  } finally {
    lock.releaseLock();
  }
}
function doGet(e) {
  return withLock(function (ss) {
    if (e.parameter.action !== "getAll") throw new Error("Unknown action");
    return getAll(ss);
  });
}
function doPost(e) {
  return withLock(function (ss) {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    ensureMigration(ss);
    if (action === "saveWorkspace") {
      if (payload.baseRevision !== plannerRevision(ss))
        return {
          success: false,
          code: "CONFLICT",
          error:
            "Sheet data changed. Export your local backup, then load the latest Sheet tables before editing again.",
        };
      writePlanner(ss, payload.data);
      SpreadsheetApp.flush();
      return {
        success: true,
        storageSchemaVersion: TABLE_SCHEMA_VERSION,
        workspaceRevision: plannerRevision(ss),
      };
    }
    if (action === "saveEntries") {
      var rows = payload.data.map(function (e) {
        return [
          e.id,
          e.dateStr,
          e.displayDate,
          e.dayName,
          e.sleepTime,
          e.exercise,
          e.morningFood,
          e.afternoonFood,
          e.dinnerFood,
          e.snack,
          e.tasks,
          JSON.stringify(e.habits || {}),
        ];
      });
      writeTable(ss, "Entries", ENTRY_HEADERS, rows);
      writeHabitChecks(ss, payload.data);
    } else if (action === "saveHabits") {
      writeTable(
        ss,
        "Habits",
        HABIT_HEADERS,
        payload.data.map(function (h) {
          return [h.id, h.name, h.color, h.lightBg, h.ringColor];
        }),
      );
    } else if (action === "saveSetting") {
      if (payload.key === "personalWorkspaceV1") {
        // Compatibility for cached older frontends. Mirror their writes into real tables.
        var w = JSON.parse(payload.value);
        if (w.updatedAt < Number(settingsOf(ss).workspaceTablesUpdatedAt || 0))
          throw new Error("A newer planner is saved. Refresh the app.");
        writePlanner(ss, w);
      }
      putSetting(ss, payload.key, payload.value);
    } else if (
      action === "addEntry" ||
      action === "updateEntry" ||
      action === "deleteEntry"
    ) {
      var entries = journalRows(ss);
      if (action === "addEntry") {
        if (
          entries.some(function (r) {
            return r.id === payload.data.id;
          })
        )
          throw new Error("Duplicate entry ID");
        entries.push(payload.data);
      }
      if (action === "updateEntry")
        entries = entries.map(function (r) {
          return r.id === payload.data.id ? payload.data : r;
        });
      if (action === "deleteEntry")
        entries = entries.filter(function (r) {
          return r.id !== payload.id;
        });
      writeTable(
        ss,
        "Entries",
        ENTRY_HEADERS,
        entries.map(function (r) {
          return [
            r.id,
            r.dateStr,
            r.displayDate,
            r.dayName,
            r.sleepTime,
            r.exercise,
            r.morningFood,
            r.afternoonFood,
            r.dinnerFood,
            r.snack,
            r.tasks,
            JSON.stringify(r.habits || {}),
          ];
        }),
      );
      writeHabitChecks(ss, entries);
    } else {
      throw new Error("Unknown action");
    }
    return { success: true };
  });
}
