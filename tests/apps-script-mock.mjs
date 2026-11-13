import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
export function createBackend(
  workspace,
  journal = { entries: [], habits: [] },
) {
  const sheets = new Map();
  const metrics = { reads: 0, bodyReads: {} };
  let lockHeld = false;
  const receipts = [];
  class Range {
    constructor(sheet, row, col, height = 1, width = 1) {
      Object.assign(this, { sheet, row, col, height, width });
    }
    getValues() {
      metrics.reads++;
      if (this.row === 2)
        metrics.bodyReads[this.sheet.name] =
          (metrics.bodyReads[this.sheet.name] ?? 0) + 1;
      return Array.from({ length: this.height }, (_, r) =>
        Array.from(
          { length: this.width },
          (_, c) => this.sheet.grid[this.row + r - 1]?.[this.col + c - 1] ?? "",
        ),
      );
    }
    setValues(rows) {
      if (
        rows.length !== this.height ||
        rows.some((r) => r.length !== this.width)
      )
        throw new Error("Range shape mismatch");
      rows.forEach((row, r) =>
        row.forEach((v, c) => {
          if (!this.sheet.grid[this.row + r - 1])
            this.sheet.grid[this.row + r - 1] = [];
          this.sheet.grid[this.row + r - 1][this.col + c - 1] =
            typeof v === "string" && v.startsWith("'") ? v.slice(1) : v;
        }),
      );
      return this;
    }
    setValue(value) {
      return this.setValues([[value]]);
    }
    setNumberFormat() {
      return this;
    }
    setFontWeight() {
      return this;
    }
    setBackground() {
      return this;
    }
  }
  class Sheet {
    constructor(name) {
      this.name = name;
      this.grid = [];
      this.maxRows = 1000;
    }
    getRange(...args) {
      return new Range(this, ...args);
    }
    getLastRow() {
      for (let i = this.grid.length - 1; i >= 0; i--)
        if (this.grid[i]?.some((v) => v !== "" && v !== undefined))
          return i + 1;
      return 0;
    }
    getMaxRows() {
      return this.maxRows;
    }
    insertRowsAfter(_start, count) {
      this.maxRows += count;
    }
    insertRowsBefore(start, count) {
      this.grid.splice(
        start - 1,
        0,
        ...Array.from({ length: count }, () => []),
      );
      this.maxRows += count;
    }
    setFrozenRows() {}
    getDataRange() {
      return this.getRange(
        1,
        1,
        Math.max(1, this.getLastRow()),
        Math.max(1, ...this.grid.map((r) => r.length)),
      );
    }
    appendRow(row) {
      this.getRange(this.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    }
  }
  const ss = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet(name) {
      const sheet = new Sheet(name);
      sheets.set(name, sheet);
      return sheet;
    },
    getSpreadsheetTimeZone: () => "Asia/Kuala_Lumpur",
  };
  const context = vm.createContext({
    Date,
    JSON,
    Math,
    Number,
    Object,
    String,
    Array,
    Error,
    RegExp,
    DriveApp: {
      getFolderById: (folderId) => ({
        createFile: (blob) => {
          const receipt = {
            folderId,
            ...blob,
            url: `https://drive.google.com/file/d/receipt-${receipts.length + 1}/view`,
          };
          receipts.push(receipt);
          return { getName: () => receipt.name, getUrl: () => receipt.url };
        },
      }),
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (body) => ({
        body,
        setMimeType() {
          return this;
        },
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock() {
          if (lockHeld) throw Error("Concurrent access");
          lockHeld = true;
        },
        releaseLock() {
          lockHeld = false;
        },
      }),
    },
    Utilities: {
      base64Decode: (value) => Array.from(Buffer.from(value, "base64")),
      newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name }),
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_algorithm, value) =>
        crypto.createHash("sha256").update(value).digest(),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString("base64url"),
      formatDate: (date, timezone = "UTC") =>
        new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date),
    },
  });
  vm.runInContext(
    fs.readFileSync(
      new URL("../google-apps-script/Code.gs", import.meta.url),
      "utf8",
    ),
    context,
  );
  ss.insertSheet("Settings").grid = [
    ["key", "value"],
    ["showTasksColumn", "true"],
    ...(workspace ? [["personalWorkspaceV1", JSON.stringify(workspace)]] : []),
  ];
  ss.insertSheet("Entries").grid = [
    Array.from(context.ENTRY_HEADERS),
    ...journal.entries.map((r) => [
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
      JSON.stringify(r.habits),
    ]),
  ];
  ss.insertSheet("Habits").grid = [
    Array.from(context.HABIT_HEADERS),
    ...journal.habits.map((h) => [
      h.id,
      h.name,
      h.color,
      h.lightBg,
      h.ringColor,
    ]),
  ];
  function get() {
    return JSON.parse(context.doGet({ parameter: { action: "getAll" } }).body);
  }
  function post(body) {
    return JSON.parse(
      context.doPost({ postData: { contents: JSON.stringify(body) } }).body,
    );
  }
  return {
    ss,
    sheets,
    metrics,
    context,
    receipts,
    get,
    post,
    fetch: async (_url, options) => ({
      ok: true,
      json: async () =>
        options?.method === "POST" ? post(JSON.parse(options.body)) : get(),
    }),
  };
}
