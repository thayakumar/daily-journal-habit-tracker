// Deploy this file as a new version of the existing bound Web app.
// Existing Entries/Habits/Settings stay compatible. New tables are the source of truth.
var TABLE_SCHEMA_VERSION = 2;
var REQUEST_CACHE = null;
var FINANCE_RECEIPTS_FOLDER_ID = "1_fo4Fn8Oq-ttn1vhZAAZFUH49jIyJrXd";
var PORTFOLIO_SCHEMAS = [
  {
    key: "accounts",
    table: "PortfolioAccounts",
    headers: [
      "id",
      "name",
      "kind",
      "liquid",
      "maskedRef",
      "vaultUrl",
      "costBasis",
      "planName",
      "trackingFrom",
    ],
    numbers: ["costBasis"],
    booleans: ["liquid"],
  },
  {
    key: "snapshots",
    table: "PortfolioSnapshots",
    headers: [
      "id",
      "accountId",
      "cycleId",
      "phase",
      "date",
      "value",
      "units",
      "price",
      "updatedAt",
    ],
    numbers: ["value", "units", "price"],
    booleans: [],
  },
  {
    key: "flows",
    table: "PortfolioFlows",
    headers: [
      "id",
      "cycleId",
      "date",
      "kind",
      "fromId",
      "toId",
      "amount",
      "budgetIncluded",
    ],
    numbers: ["amount"],
    booleans: ["budgetIncluded"],
  },
  {
    key: "loans",
    table: "PortfolioLoans",
    headers: [
      "id",
      "name",
      "principal",
      "balance",
      "apr",
      "payment",
      "rateType",
      "asOf",
      "nextDue",
      "planName",
      "startDate",
    ],
    numbers: ["principal", "balance", "apr", "payment"],
    booleans: [],
  },
  {
    key: "debtSnapshots",
    table: "PortfolioDebtSnapshots",
    headers: [
      "id",
      "loanId",
      "cycleId",
      "phase",
      "date",
      "balance",
      "updatedAt",
    ],
    numbers: ["balance"],
    booleans: [],
  },
  {
    key: "subscriptions",
    table: "PortfolioSubscriptions",
    headers: [
      "id",
      "name",
      "amount",
      "frequency",
      "nextDue",
      "active",
      "accountId",
      "manageUrl",
      "planName",
      "startDate",
    ],
    numbers: ["amount"],
    booleans: ["active"],
  },
  {
    key: "goals",
    table: "PortfolioGoals",
    headers: ["id", "name", "target", "deadline", "monthlyContribution"],
    numbers: ["target", "monthlyContribution"],
    booleans: [],
  },
  {
    key: "allocations",
    table: "PortfolioAllocations",
    headers: ["id", "goalId", "accountId", "amount"],
    numbers: ["amount"],
    booleans: [],
  },
];
var PLANNER_TABLES = {
  FinanceCycleSettings: ["defaultStartDay"],
  FinanceCycles: ["id", "month", "start", "end"],
  FinanceIncome: ["id", "cycleId", "name", "amount"],
  FinanceCommitments: ["id", "cycleId", "name", "amount"],
  FinanceBudgets: ["id", "cycleId", "name", "amount", "categories_json"],
  FinanceBalances: ["id", "cycleId", "name", "amount", "liquid"],
  FinanceExpenses: [
    "id",
    "date",
    "item",
    "amount",
    "category",
    "receiptName",
    "receiptUrl",
    "createdAt",
  ],
  Vocabulary: ["id", "word", "definition", "example", "createdAt", "updatedAt"],
  WorkoutSets: [
    "id",
    "exerciseId",
    "date",
    "exercise",
    "type",
    "setNumber",
    "weight",
    "unit",
    "reps",
    "durationMinutes",
    "distanceKm",
    "notes",
  ],
  RecurringChecks: ["id", "habitId", "date", "previousLastDone"],
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
PORTFOLIO_SCHEMAS.forEach(function (schema) {
  PLANNER_TABLES[schema.table] = schema.headers;
});
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
  var key = headers.join("|");
  if (REQUEST_CACHE && REQUEST_CACHE.headers[title] === key)
    return REQUEST_CACHE.sheets[title];
  var sheet =
    (REQUEST_CACHE && REQUEST_CACHE.sheets[title]) || ss.getSheetByName(title);
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
  if (REQUEST_CACHE) {
    REQUEST_CACHE.headers[title] = key;
    REQUEST_CACHE.sheets[title] = sheet;
  }
  return sheet;
}
function readTable(ss, title, headers) {
  var key = headers.join("|");
  if (
    REQUEST_CACHE &&
    REQUEST_CACHE.tables[title] &&
    REQUEST_CACHE.tables[title].key === key
  )
    return REQUEST_CACHE.tables[title].rows;
  var sheet =
      (REQUEST_CACHE && REQUEST_CACHE.sheets[title]) ||
      ss.getSheetByName(title),
    rows = [];
  if (sheet && sheet.getLastRow() >= 2) {
    if (!REQUEST_CACHE || REQUEST_CACHE.headers[title] !== key) {
      var actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (actual.join("|") !== key)
        throw new Error("Unexpected headers in " + title);
      if (REQUEST_CACHE) {
        REQUEST_CACHE.headers[title] = key;
        REQUEST_CACHE.sheets[title] = sheet;
      }
    }
    rows = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
      .getValues()
      .filter(function (row) {
        return row[0] !== "";
      })
      .map(function (row) {
        return row.map(plainValue);
      });
  }
  if (REQUEST_CACHE) REQUEST_CACHE.tables[title] = { key: key, rows: rows };
  return rows;
}

function writeTable(ss, title, headers, rows) {
  if (REQUEST_CACHE) delete REQUEST_CACHE.tables[title];
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
  if (REQUEST_CACHE && REQUEST_CACHE.settings) return REQUEST_CACHE.settings;
  var sheet = ensureSheet(ss, "Settings", ["key", "value"]);
  var settings = {};
  if (sheet.getLastRow() > 1)
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 2)
      .getValues()
      .forEach(function (row) {
        if (row[0]) settings[row[0]] = stringValue(row[1]);
      });
  if (REQUEST_CACHE) REQUEST_CACHE.settings = settings;
  return settings;
}
function putSetting(ss, key, value) {
  if (REQUEST_CACHE) REQUEST_CACHE.settings = null;
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
function numericCell(value, integer) {
  if (value === "") return "";
  var n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n)))
    throw new Error(
      "Workout measurements must be non-negative numbers; reps must be whole numbers.",
    );
  return n;
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
  tables.WorkoutSets = (w.workoutSets || []).map(function (r) {
    return [
      r.id,
      r.exerciseId,
      r.date,
      r.exercise,
      r.type,
      r.setNumber,
      numericCell(r.weight),
      r.unit,
      numericCell(r.reps, true),
      numericCell(r.durationMinutes),
      numericCell(r.distanceKm),
      r.notes,
    ];
  });
  tables.RecurringChecks = (w.recurringChecks || []).map(function (r) {
    return [r.id, r.habitId, r.date, r.previousLastDone];
  });
  var planning = w.financePlanning || {
    defaultStartDay: 27,
    cycles: [],
    rows: [],
  };
  validateFinancePlanning(planning);
  tables.FinanceCycleSettings = [[planning.defaultStartDay]];
  tables.FinanceCycles = planning.cycles.map(function (c) {
    return [c.id, c.month, c.start, c.end];
  });
  [
    ["income", "FinanceIncome"],
    ["commitment", "FinanceCommitments"],
    ["budget", "FinanceBudgets"],
    ["balance", "FinanceBalances"],
  ].forEach(function (pair) {
    tables[pair[1]] = planning.rows
      .filter(function (r) {
        return r.kind === pair[0];
      })
      .map(function (r) {
        var row = [r.id, r.cycleId, r.name, r.amount];
        if (r.kind === "budget") row.push(JSON.stringify(r.categories));
        if (r.kind === "balance") row.push(r.liquid);
        return row;
      });
  });
  tables.FinanceExpenses = (w.financeExpenses || []).map(function (r) {
    if (!Number.isFinite(r.amount) || r.amount < 0)
      throw new Error("Invalid expense amount");
    return [
      r.id,
      r.date,
      r.item,
      r.amount,
      r.category,
      r.receiptName,
      r.receiptUrl,
      r.createdAt,
    ];
  });
  tables.Vocabulary = (w.vocabulary || []).map(function (r) {
    return [r.id, r.word, r.definition, r.example, r.createdAt, r.updatedAt];
  });
  var portfolio =
    w.financePortfolio === undefined
      ? emptyPortfolioData()
      : w.financePortfolio;
  validatePortfolioData(portfolio, planning.cycles);
  PORTFOLIO_SCHEMAS.forEach(function (schema) {
    tables[schema.table] = portfolio[schema.key].map(function (row) {
      return schema.headers.map(function (key) {
        return row[key];
      });
    });
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
  // Older clients/backups must not erase newer detailed logs they do not know about.
  if (
    w.workoutSets === undefined ||
    w.recurringChecks === undefined ||
    w.vocabulary === undefined ||
    w.financeExpenses === undefined ||
    w.financePlanning === undefined ||
    w.financePortfolio === undefined
  ) {
    var existingLogs = readPlanner(ss, settingsOf(ss));
    w = JSON.parse(JSON.stringify(w));
    if (w.financePortfolio === undefined)
      w.financePortfolio = existingLogs.financePortfolio;
    if (w.financePlanning === undefined)
      w.financePlanning = existingLogs.financePlanning;
    if (w.financeExpenses === undefined)
      w.financeExpenses = existingLogs.financeExpenses;
    if (w.vocabulary === undefined) w.vocabulary = existingLogs.vocabulary;
    if (w.workoutSets === undefined) w.workoutSets = existingLogs.workoutSets;
    if (w.recurringChecks === undefined)
      w.recurringChecks = existingLogs.recurringChecks;
  }
  var tables = plannerToTables(w);
  Object.keys(PLANNER_TABLES).forEach(function (name) {
    ensureSheet(ss, name, PLANNER_TABLES[name]);
  });
  Object.keys(PLANNER_TABLES).forEach(function (name) {
    if (name === "PortfolioAccounts" && tables[name].length)
      ss.getSheetByName(name)
        .getRange(2, 5, tables[name].length, 1)
        .setNumberFormat("@");
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
    financeExpenses: [],
    vocabulary: [],
    workoutSets: [],
    recurringChecks: [],
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
  w.workoutSets = readTable(ss, "WorkoutSets", PLANNER_TABLES.WorkoutSets).map(
    function (r) {
      return {
        id: stringValue(r[0]),
        exerciseId: stringValue(r[1]),
        date: dateValue(r[2]),
        exercise: stringValue(r[3]),
        type: stringValue(r[4]),
        setNumber: Number(r[5]),
        weight: stringValue(r[6]),
        unit: stringValue(r[7]),
        reps: stringValue(r[8]),
        durationMinutes: stringValue(r[9]),
        distanceKm: stringValue(r[10]),
        notes: stringValue(r[11]),
      };
    },
  );
  w.recurringChecks = readTable(
    ss,
    "RecurringChecks",
    PLANNER_TABLES.RecurringChecks,
  ).map(function (r) {
    return {
      id: stringValue(r[0]),
      habitId: stringValue(r[1]),
      date: dateValue(r[2]),
      previousLastDone: dateValue(r[3]),
    };
  });
  w.vocabulary = readTable(ss, "Vocabulary", PLANNER_TABLES.Vocabulary).map(
    function (r) {
      return {
        id: stringValue(r[0]),
        word: stringValue(r[1]),
        definition: stringValue(r[2]),
        example: stringValue(r[3]),
        createdAt: stringValue(r[4]),
        updatedAt: stringValue(r[5]),
      };
    },
  );
  w.financeExpenses = readTable(
    ss,
    "FinanceExpenses",
    PLANNER_TABLES.FinanceExpenses,
  ).map(function (r) {
    return {
      id: stringValue(r[0]),
      date: dateValue(r[1]),
      item: stringValue(r[2]),
      amount: Number(r[3]) || 0,
      category: stringValue(r[4]),
      receiptName: stringValue(r[5]),
      receiptUrl: stringValue(r[6]),
      createdAt: stringValue(r[7]),
    };
  });
  var settingsRow = readTable(
    ss,
    "FinanceCycleSettings",
    PLANNER_TABLES.FinanceCycleSettings,
  )[0];
  w.financePlanning = {
    defaultStartDay: settingsRow ? Number(settingsRow[0]) : 27,
    cycles: [],
    rows: [],
  };
  w.financePlanning.cycles = readTable(
    ss,
    "FinanceCycles",
    PLANNER_TABLES.FinanceCycles,
  ).map(function (r) {
    return {
      id: stringValue(r[0]),
      month: dateValue(r[1]).slice(0, 7),
      start: dateValue(r[2]),
      end: dateValue(r[3]),
    };
  });
  [
    ["income", "FinanceIncome"],
    ["commitment", "FinanceCommitments"],
    ["budget", "FinanceBudgets"],
    ["balance", "FinanceBalances"],
  ].forEach(function (pair) {
    readTable(ss, pair[1], PLANNER_TABLES[pair[1]]).forEach(function (r) {
      w.financePlanning.rows.push({
        id: stringValue(r[0]),
        cycleId: stringValue(r[1]),
        kind: pair[0],
        name: stringValue(r[2]),
        amount: Number(r[3]) || 0,
        categories: pair[0] === "budget" ? parseJson(r[4], []) : [],
        liquid: pair[0] === "balance" ? boolValue(r[4]) : false,
      });
    });
  });
  w.financePortfolio = emptyPortfolioData();
  PORTFOLIO_SCHEMAS.forEach(function (schema) {
    w.financePortfolio[schema.key] = readTable(
      ss,
      schema.table,
      schema.headers,
    ).map(function (row) {
      var record = {};
      schema.headers.forEach(function (key, i) {
        var v = row[i];
        record[key] =
          schema.numbers.indexOf(key) >= 0
            ? Number(v) || 0
            : schema.booleans.indexOf(key) >= 0
              ? boolValue(v)
              : [
                    "date",
                    "asOf",
                    "nextDue",
                    "deadline",
                    "trackingFrom",
                    "startDate",
                  ].indexOf(key) >= 0
                ? dateValue(v)
                : key === "updatedAt" && v instanceof Date
                  ? v.toISOString()
                  : stringValue(v);
      });
      if (schema.key === "accounts" && record.maskedRef)
        record.maskedRef = record.maskedRef.padStart(4, "0");
      return record;
    });
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
    features: {
      workoutSets: true,
      recurringChecks: true,
      vocabulary: true,
      finance: true,
      financePlanning: true,
      financePortfolio: true,
    },
    workspace: readPlanner(ss, settings),
    workspaceRevision: plannerRevision(ss),
  };
}
function withLock(operation) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    REQUEST_CACHE = { tables: {}, headers: {}, sheets: {}, settings: null };
    return jsonResult(operation(SpreadsheetApp.getActiveSpreadsheet()));
  } catch (error) {
    return jsonResult({
      success: false,
      error: stringValue(error.message || error),
    });
  } finally {
    REQUEST_CACHE = null;
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
    if (action === "uploadFinanceReceipt") {
      if (
        typeof payload.fileBase64 !== "string" ||
        !payload.fileBase64 ||
        payload.fileBase64.length > 13981016 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.fileBase64)
      )
        throw new Error("Invalid receipt file (maximum 10 MB)");
      if (
        ["image/jpeg", "image/png", "image/webp", "application/pdf"].indexOf(
          payload.fileMimeType,
        ) < 0
      )
        throw new Error("Unsupported receipt format");
      var filename = stringValue(payload.fileName)
        .replace(/[\\/]/g, "_")
        .slice(0, 200);
      if (!filename) throw new Error("Receipt filename is required");
      var bytes = Utilities.base64Decode(payload.fileBase64);
      if (bytes.length > 10485760) throw new Error("Receipt exceeds 10 MB");
      var folder = DriveApp.getFolderById(FINANCE_RECEIPTS_FOLDER_ID);
      var file = folder.createFile(
        Utilities.newBlob(bytes, payload.fileMimeType, filename),
      );
      return {
        success: true,
        receiptName: file.getName(),
        receiptUrl: file.getUrl(),
      };
    }
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
      // Keep direct edits to normalized checks when appending/deleting a different entry.
      var savedChecks = readTable(ss, "HabitChecks", HABIT_CHECK_HEADERS);
      entries.forEach(function (entry) {
        entry.habits = {};
        savedChecks
          .filter(function (row) {
            return dateValue(row[0]) === entry.dateStr;
          })
          .forEach(function (row) {
            entry.habits[stringValue(row[1])] = boolValue(row[2]);
          });
      });
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

// Run once in the Apps Script editor to authorize access to your existing receipts folder.
function authorizeFinanceReceipts() {
  return DriveApp.getFolderById(FINANCE_RECEIPTS_FOLDER_ID).getName();
}

function validateFinancePlanning(p) {
  if (
    !p ||
    !Number.isInteger(p.defaultStartDay) ||
    p.defaultStartDay < 1 ||
    p.defaultStartDay > 31 ||
    !Array.isArray(p.cycles) ||
    !Array.isArray(p.rows)
  )
    throw new Error("Invalid monthly planning data");
  var validDate = function (v) {
    return (
      typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !isNaN(Date.parse(v)) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v
    );
  };
  var ids = {},
    months = {};
  p.cycles.forEach(function (c) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      ids[c.id] ||
      months[c.month] ||
      !/^\d{4}-\d{2}$/.test(c.month) ||
      !validDate(c.month + "-01") ||
      !validDate(c.start) ||
      !validDate(c.end) ||
      c.start > c.end
    )
      throw new Error("Invalid or duplicate salary cycle");
    ids[c.id] = true;
    months[c.month] = true;
  });
  p.cycles.forEach(function (c, i) {
    p.cycles.slice(i + 1).forEach(function (other) {
      if (c.start <= other.end && c.end >= other.start)
        throw new Error("Salary cycles overlap");
    });
  });
  var rowIds = {},
    budgetCategories = {};
  p.rows.forEach(function (r) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id ||
      rowIds[r.id] ||
      !ids[r.cycleId] ||
      ["income", "commitment", "budget", "balance"].indexOf(r.kind) < 0 ||
      typeof r.name !== "string" ||
      !Number.isFinite(r.amount) ||
      r.amount < 0 ||
      !Array.isArray(r.categories) ||
      r.categories.some(function (c) {
        return typeof c !== "string";
      }) ||
      typeof r.liquid !== "boolean"
    )
      throw new Error("Invalid monthly plan row");
    rowIds[r.id] = true;
    if (r.kind === "budget")
      r.categories.forEach(function (category) {
        var key = r.cycleId + "|" + category;
        if (budgetCategories[key])
          throw new Error("Category belongs to more than one budget");
        budgetCategories[key] = true;
      });
  });
}

function emptyPortfolioData() {
  var p = {};
  PORTFOLIO_SCHEMAS.forEach(function (schema) {
    p[schema.key] = [];
  });
  return p;
}
function validatePortfolioData(p, cycles) {
  if (
    !p ||
    typeof p !== "object" ||
    Object.keys(p).some(function (key) {
      return !PORTFOLIO_SCHEMAS.some(function (s) {
        return s.key === key;
      });
    })
  )
    throw new Error("Invalid portfolio data");
  var validDate = function (v) {
    return (
      typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !isNaN(Date.parse(v)) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v
    );
  };
  var safeUrl = function (v) {
    if (!v) return true;
    try {
      return (
        /^https:\/\/[^\s/@]+(?:[/?#][^\s]*)?$/.test(v) &&
        !/[?&#](password|passcode|pin|otp|secret|token|access_token)=/i.test(
          decodeURIComponent(v),
        )
      );
    } catch (_) {
      return false;
    }
  };
  PORTFOLIO_SCHEMAS.forEach(function (schema) {
    if (!Array.isArray(p[schema.key]))
      throw new Error("Missing portfolio collection: " + schema.key);
    var ids = {};
    p[schema.key].forEach(function (r) {
      if (
        !r ||
        typeof r.id !== "string" ||
        !r.id ||
        ids[r.id] ||
        Object.keys(r).some(function (key) {
          return schema.headers.indexOf(key) < 0;
        }) ||
        schema.headers.some(function (key) {
          return !(key in r);
        })
      )
        throw new Error("Invalid portfolio record in " + schema.key);
      ids[r.id] = true;
      schema.headers.forEach(function (key) {
        var v = r[key];
        if (
          schema.numbers.indexOf(key) >= 0
            ? !Number.isFinite(v) || v < 0
            : schema.booleans.indexOf(key) >= 0
              ? typeof v !== "boolean"
              : typeof v !== "string"
        )
          throw new Error("Invalid portfolio field: " + key);
      });
      if ("name" in r && !r.name.trim())
        throw new Error("Portfolio names are required");
      [
        "date",
        "asOf",
        "nextDue",
        "deadline",
        "trackingFrom",
        "startDate",
      ].forEach(function (key) {
        if (key in r && !validDate(r[key]))
          throw new Error("Invalid portfolio date");
      });
      if ("updatedAt" in r && isNaN(Date.parse(r.updatedAt)))
        throw new Error("Invalid portfolio timestamp");
    });
  });
  var account = function (id) {
    return p.accounts.some(function (a) {
      return a.id === id;
    });
  };
  var loan = function (id) {
    return p.loans.some(function (a) {
      return a.id === id;
    });
  };
  p.accounts.forEach(function (a) {
    if (
      ["bank", "cash", "wallet", "gold", "investment", "other"].indexOf(
        a.kind,
      ) < 0 ||
      !/^(\d{4})?$/.test(a.maskedRef) ||
      !safeUrl(a.vaultUrl)
    )
      throw new Error(
        "Use a masked bank reference and a password-manager link only",
      );
  });
  p.loans.forEach(function (l) {
    if (
      ["flat", "reducing"].indexOf(l.rateType) < 0 ||
      l.apr > 1000 ||
      (l.rateType === "flat" && l.principal < l.balance)
    )
      throw new Error("Invalid loan terms");
  });
  var today = Utilities.formatDate(
    new Date(),
    SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(),
    "yyyy-MM-dd",
  );
  if (
    p.loans.some(function (l) {
      return l.asOf > today || l.startDate > l.asOf;
    })
  )
    throw new Error("Future loan balances are not actual balances");
  var phases = {};
  [p.snapshots, p.debtSnapshots].forEach(function (rows, index) {
    rows.forEach(function (r) {
      var c = cycles.find(function (c) {
        return c.id === r.cycleId;
      });
      var key =
        index +
        "|" +
        (index ? r.loanId : r.accountId) +
        "|" +
        r.cycleId +
        "|" +
        r.phase +
        (r.phase === "current" ? "|" + r.date : "");
      if (
        phases[key] ||
        !c ||
        ["opening", "current", "closing"].indexOf(r.phase) < 0 ||
        (index ? !loan(r.loanId) : !account(r.accountId)) ||
        r.date < c.start ||
        r.date > c.end ||
        r.date > today ||
        (r.phase === "opening" && r.date !== c.start) ||
        (r.phase === "closing" && r.date !== c.end)
      )
        throw new Error("Invalid, duplicate or future portfolio balance");
      phases[key] = true;
    });
  });
  p.flows.forEach(function (f) {
    var c = cycles.find(function (c) {
      return c.id === f.cycleId;
    });
    if (
      !c ||
      f.date < c.start ||
      f.date > c.end ||
      f.date > today ||
      f.amount <= 0 ||
      !(
        (f.kind === "transfer" &&
          account(f.fromId) &&
          account(f.toId) &&
          f.fromId !== f.toId) ||
        (f.kind === "contribution" && !f.fromId && account(f.toId)) ||
        (["withdrawal", "fee"].indexOf(f.kind) >= 0 &&
          account(f.fromId) &&
          !f.toId)
      )
    )
      throw new Error("Invalid money movement");
  });
  p.subscriptions.forEach(function (s) {
    if (
      ["weekly", "monthly", "quarterly", "yearly"].indexOf(s.frequency) < 0 ||
      (s.accountId && !account(s.accountId)) ||
      !safeUrl(s.manageUrl)
    )
      throw new Error("Invalid subscription");
  });
  p.goals.forEach(function (g) {
    if (g.target <= 0) throw new Error("Goal targets must be positive");
  });
  var allocations = {};
  p.allocations.forEach(function (a) {
    var key = a.accountId + "|" + a.goalId;
    if (
      allocations[key] ||
      !account(a.accountId) ||
      !p.goals.some(function (g) {
        return g.id === a.goalId;
      })
    )
      throw new Error("Invalid or duplicate goal allocation");
    allocations[key] = true;
  });
}
