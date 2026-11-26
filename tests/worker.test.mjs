import test from "node:test";
import assert from "node:assert/strict";
import {
  handleWorkerRequest,
  flushPendingMedia,
  resetWorkerRuntimeStateForTests,
} from "../worker/src/index.ts";
import { TursoClient } from "../worker/src/turso.ts";
import { isSkincare } from "../src/skincare/model.ts";
import { createWorkspace, blankRow } from "../src/workspace/model.ts";

/**
 * In-memory Turso Hrana v2 HTTP pipeline simulator that faithfully executes
 * the Worker's exact SQL statements against in-memory kv_state & media_staging tables.
 */
function createMockTursoAndDrive() {
  const kvState = new Map();
  const mediaStaging = new Map();
  const driveFiles = new Map();
  let driveShouldFail = false;
  let sheetSnapshot = null;

  function toHranaCell(val) {
    if (val === null || val === undefined) return { type: "null" };
    if (typeof val === "number") {
      return Number.isInteger(val)
        ? { type: "integer", value: String(val) }
        : { type: "float", value: val };
    }
    return { type: "text", value: String(val) };
  }

  function decodeArg(arg) {
    if (!arg || arg.type === "null") return null;
    if (arg.type === "integer" || arg.type === "float") return Number(arg.value);
    return arg.value ?? "";
  }

  function makeResult(cols, rows, affected = 0) {
    return {
      type: "ok",
      response: {
        type: "execute",
        result: {
          cols: cols.map((name) => ({ name })),
          rows: rows.map((r) => r.map(toHranaCell)),
          affected_row_count: affected,
        },
      },
    };
  }

  function executeSql(sql, rawArgs = []) {
    const args = rawArgs.map(decodeArg);
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (/^CREATE (TABLE|INDEX) IF NOT EXISTS/i.test(normalized)) {
      return makeResult([], [], 0);
    }

    if (normalized.startsWith("SELECT COUNT(*) AS pending_media FROM media_staging")) {
      let count = 0;
      for (const row of mediaStaging.values()) {
        if (row.status !== "offloaded" && row.base64 !== null) count++;
      }
      return makeResult(["pending_media"], [[count]]);
    }

    if (normalized.startsWith("SELECT key, revision, updated_at FROM kv_state")) {
      const rows = [];
      for (const k of ["workspace", "journal"]) {
        const r = kvState.get(k);
        if (r) rows.push([r.key, r.revision, r.updated_at]);
      }
      return makeResult(["key", "revision", "updated_at"], rows);
    }

    if (normalized.startsWith("SELECT key, value, revision, updated_at FROM kv_state")) {
      const rows = [];
      for (const k of ["workspace", "journal"]) {
        const r = kvState.get(k);
        if (r) rows.push([r.key, r.value, r.revision, r.updated_at]);
      }
      return makeResult(["key", "value", "revision", "updated_at"], rows);
    }

    if (normalized === "SELECT revision FROM kv_state WHERE key = 'workspace'") {
      const r = kvState.get("workspace");
      return makeResult(["revision"], r ? [[r.revision]] : []);
    }

    if (normalized.startsWith("INSERT INTO kv_state (key, value, revision, updated_at) VALUES ('workspace'")) {
      kvState.set("workspace", {
        key: "workspace",
        value: args[0],
        revision: args[1],
        updated_at: args[2],
      });
      return makeResult([], [], 1);
    }

    if (normalized.startsWith("INSERT INTO kv_state (key, value, revision, updated_at) VALUES ('journal'")) {
      kvState.set("journal", {
        key: "journal",
        value: args[0],
        revision: args[1],
        updated_at: args[2],
      });
      return makeResult([], [], 1);
    }

    if (normalized.startsWith("UPDATE kv_state SET value = ?, revision = ?, updated_at = ? WHERE key = 'workspace' AND revision = ?")) {
      const existing = kvState.get("workspace");
      if (!existing || existing.revision !== args[3]) {
        return makeResult([], [], 0);
      }
      kvState.set("workspace", {
        key: "workspace",
        value: args[0],
        revision: args[1],
        updated_at: args[2],
      });
      return makeResult([], [], 1);
    }

    if (normalized.startsWith("INSERT INTO media_staging (id, kind, name, mime_type, date, angle, base64, status, created_at)")) {
      mediaStaging.set(args[0], {
        id: args[0],
        kind: "skincare",
        name: args[1],
        mime_type: args[2],
        date: args[3],
        angle: args[4],
        base64: args[5],
        drive_file_id: null,
        drive_url: null,
        status: "pending",
        error: "",
        created_at: args[6],
        offloaded_at: "",
      });
      return makeResult([], [], 1);
    }

    if (normalized.startsWith("INSERT INTO media_staging (id, kind, name, mime_type, base64, status, created_at)")) {
      mediaStaging.set(args[0], {
        id: args[0],
        kind: "receipt",
        name: args[1],
        mime_type: args[2],
        date: "",
        angle: "",
        base64: args[3],
        drive_file_id: null,
        drive_url: null,
        status: "pending",
        error: "",
        created_at: args[4],
        offloaded_at: "",
      });
      return makeResult([], [], 1);
    }

    if (normalized.startsWith("SELECT id, kind, name, mime_type, date, angle, base64, status FROM media_staging WHERE id = ?")) {
      const r = mediaStaging.get(args[0]);
      return makeResult(
        ["id", "kind", "name", "mime_type", "date", "angle", "base64", "status"],
        r ? [[r.id, r.kind, r.name, r.mime_type, r.date, r.angle, r.base64, r.status]] : [],
      );
    }

    if (normalized.startsWith("SELECT base64, mime_type, drive_file_id, status FROM media_staging WHERE id = ? AND kind = 'skincare'")) {
      const r = mediaStaging.get(args[0]);
      return makeResult(
        ["base64", "mime_type", "drive_file_id", "status"],
        r && r.kind === "skincare" ? [[r.base64, r.mime_type, r.drive_file_id, r.status]] : [],
      );
    }

    if (normalized.startsWith("SELECT name, mime_type, base64, drive_url, status FROM media_staging WHERE id = ? AND kind = 'receipt'")) {
      const r = mediaStaging.get(args[0]);
      return makeResult(
        ["name", "mime_type", "base64", "drive_url", "status"],
        r && r.kind === "receipt" ? [[r.name, r.mime_type, r.base64, r.drive_url, r.status]] : [],
      );
    }

    if (normalized.startsWith("UPDATE media_staging SET drive_file_id = ?, base64 = NULL, status = 'offloaded'")) {
      const r = mediaStaging.get(args[2]);
      if (r) {
        r.drive_file_id = args[0];
        r.base64 = null;
        r.status = "offloaded";
        r.error = "";
        r.offloaded_at = args[1];
      }
      return makeResult([], [], r ? 1 : 0);
    }

    if (normalized.startsWith("UPDATE media_staging SET drive_url = ?, base64 = NULL, status = 'offloaded'")) {
      const r = mediaStaging.get(args[2]);
      if (r) {
        r.drive_url = args[0];
        r.base64 = null;
        r.status = "offloaded";
        r.error = "";
        r.offloaded_at = args[1];
      }
      return makeResult([], [], r ? 1 : 0);
    }

    if (normalized.startsWith("UPDATE media_staging SET status = 'failed', error = ?")) {
      const r = mediaStaging.get(args[1]);
      if (r && r.status !== "offloaded") {
        r.status = "failed";
        r.error = args[0];
      }
      return makeResult([], [], r ? 1 : 0);
    }

    if (normalized.startsWith("SELECT id FROM media_staging WHERE status IN ('pending', 'failed')")) {
      const cutoff = String(args[0]);
      const limit = Number(args[1]);
      const ids = [...mediaStaging.values()]
        .filter((r) => (r.status === "pending" || r.status === "failed") && r.base64 !== null && r.created_at <= cutoff)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, limit)
        .map((r) => [r.id]);
      return makeResult(["id"], ids);
    }

    throw new Error(`Unhandled mock SQL: ${normalized}`);
  }

  async function mockFetch(url, options = {}) {
    const href = String(url);
    if (href.includes("/v2/pipeline")) {
      const body = JSON.parse(options.body);
      const results = [];
      for (const req of body.requests) {
        if (req.type === "execute") {
          results.push(executeSql(req.stmt.sql, req.stmt.args));
        } else {
          results.push({ type: "ok", response: { type: "close" } });
        }
      }
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (href.startsWith("https://drive-script.test/exec")) {
      if (driveShouldFail) {
        return new Response(JSON.stringify({ success: false, error: "Temporary Drive 503" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      if ((options.method || "GET") === "GET" && href.includes("action=getAll")) {
        return new Response(JSON.stringify(sheetSnapshot), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const payload = JSON.parse(options.body);
      if (payload.action === "uploadSkincarePhoto") {
        const fileId = `drive_skin_${driveFiles.size + 1}`;
        driveFiles.set(fileId, { base64: payload.fileBase64, mimeType: payload.fileMimeType });
        return new Response(
          JSON.stringify({
            success: true,
            photo: {
              id: `photo-${fileId}`,
              date: payload.date,
              angle: payload.angle,
              fileId,
              name: payload.fileName,
              mimeType: payload.fileMimeType,
              updatedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (payload.action === "getSkincarePhoto") {
        const stored = driveFiles.get(payload.fileId);
        if (!stored) {
          return new Response(JSON.stringify({ success: false, error: "Not in Drive" }), { status: 404 });
        }
        return new Response(
          JSON.stringify({ success: true, base64: stored.base64, mimeType: stored.mimeType }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (payload.action === "uploadFinanceReceipt") {
        const fileId = `drive_rcpt_${driveFiles.size + 1}`;
        driveFiles.set(fileId, { base64: payload.fileBase64, mimeType: payload.fileMimeType });
        return new Response(
          JSON.stringify({
            success: true,
            receiptUrl: `https://drive.google.com/file/d/${fileId}/view`,
            receiptName: payload.fileName,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    throw new Error(`Unexpected fetch URL in worker test: ${href}`);
  }

  return {
    kvState,
    mediaStaging,
    driveFiles,
    setDriveShouldFail: (v) => {
      driveShouldFail = v;
    },
    setSheetSnapshot: (snap) => {
      sheetSnapshot = snap;
    },
    fetch: mockFetch,
  };
}

const ENV = {
  TURSO_DATABASE_URL: "libsql://my-space-test.turso.io",
  TURSO_AUTH_TOKEN: "test-token",
  GOOGLE_SCRIPT_URL: "https://drive-script.test/exec",
  ALLOWED_ORIGINS: "https://thayakumar.github.io",
};

function makeCtx() {
  const promises = [];
  return {
    ctx: { waitUntil: (p) => promises.push(p) },
    flushBackground: () => Promise.all(promises),
  };
}

test("Worker enforces CORS allowlist and exposes fastBackend / fastPoll features", async () => {
  resetWorkerRuntimeStateForTests();
  const mock = createMockTursoAndDrive();
  const { ctx } = makeCtx();

  const blocked = await handleWorkerRequest(
    new Request("https://api.test/?action=health", {
      headers: { Origin: "https://evil.example" },
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  assert.equal(blocked.status, 403);

  const ok = await handleWorkerRequest(
    new Request("https://api.test/?action=getAll", {
      headers: { Origin: "https://thayakumar.github.io" },
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.features.fastBackend, true);
  assert.equal(body.features.fastPoll, true);
  assert.equal(body.features.atomicJournal, true);
  assert.equal(body.features.sheetsImportReady, true);
});

test("Worker saveWorkspace detects stale baseRevision with CONFLICT and updates poll revisions", async () => {
  resetWorkerRuntimeStateForTests();
  const mock = createMockTursoAndDrive();
  const { ctx } = makeCtx();

  const w1 = createWorkspace();
  w1.updatedAt = 100;
  w1.name = "First";
  const r1 = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveWorkspace", data: w1, baseRevision: "" }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const j1 = await r1.json();
  assert.equal(j1.success, true);
  assert.ok(j1.workspaceRevision);

  // Valid update with matching baseRevision succeeds
  const w2 = { ...w1, name: "Second", updatedAt: 200 };
  const r2 = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveWorkspace",
        data: w2,
        baseRevision: j1.workspaceRevision,
      }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const j2 = await r2.json();
  assert.equal(j2.success, true);
  assert.notEqual(j2.workspaceRevision, j1.workspaceRevision);

  // Stale baseRevision (j1) returns CONFLICT so 3-way merge triggers cleanly
  const r3 = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveWorkspace",
        data: { ...w1, name: "Stale Phone", updatedAt: 250 },
        baseRevision: j1.workspaceRevision,
      }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const j3 = await r3.json();
  assert.equal(j3.success, false);
  assert.equal(j3.code, "CONFLICT");

  // Poll returns the latest revision
  const poll = await (
    await handleWorkerRequest(
      new Request("https://api.test/?action=poll", {
        headers: { Origin: "https://thayakumar.github.io" },
      }),
      ENV,
      ctx,
      mock.fetch,
    )
  ).json();
  assert.equal(poll.workspaceRevision, j2.workspaceRevision);
});

test("Skincare photo stages in Turso for instant response, offloads to Google Drive, and wipes base64 from Turso", async () => {
  resetWorkerRuntimeStateForTests();
  const mock = createMockTursoAndDrive();
  const { ctx, flushBackground } = makeCtx();
  const sampleBase64 = Buffer.from("fake-jpeg-bytes").toString("base64");

  const uploadRes = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadSkincarePhoto",
        fileBase64: sampleBase64,
        fileMimeType: "image/jpeg",
        fileName: "morning.jpg",
        date: "2026-11-26",
        angle: "front",
      }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const uploaded = await uploadRes.json();
  assert.equal(uploaded.success, true);
  assert.ok(uploaded.photo.fileId.startsWith("staged_"));

  // Validate the returned SkinPhoto passes strict frontend isSkincare() validation!
  const skinValid = isSkincare({
    entries: [
      {
        id: "skin:2026-11-26",
        date: "2026-11-26",
        notes: "",
        reaction: "",
        productIds: [],
        updatedAt: uploaded.photo.updatedAt,
      },
    ],
    products: [],
    habits: [],
    checks: [],
    photos: [uploaded.photo],
  });
  assert.equal(skinValid, true, "Staged SkinPhoto must pass strict isSkincare() validation");

  // Wait for ctx.waitUntil() background Drive offload to complete
  await flushBackground();

  // Verify base64 was WIPED (NULL) from Turso media_staging after Drive confirmed!
  const stagingId = uploaded.photo.fileId.slice("staged_".length);
  const row = mock.mediaStaging.get(stagingId);
  assert.equal(row.status, "offloaded");
  assert.equal(row.base64, null, "base64 blob must be wiped from Turso after Drive offload");
  assert.ok(row.drive_file_id, "permanent drive_file_id must be recorded");

  // Verify getSkincarePhoto transparently fetches from Google Drive using the staged_ ID!
  const readRes = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getSkincarePhoto",
        fileId: uploaded.photo.fileId,
      }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const readData = await readRes.json();
  assert.equal(readData.success, true);
  assert.equal(readData.base64, sampleBase64);
});

test("Finance receipt stays readable in Turso if Drive temporarily fails, then offloads & wipes on retry", async () => {
  resetWorkerRuntimeStateForTests();
  const mock = createMockTursoAndDrive();
  mock.setDriveShouldFail(true);
  const { ctx, flushBackground } = makeCtx();
  const sampleBase64 = Buffer.from("%PDF-1.4 fake receipt").toString("base64");

  const uploadRes = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadFinanceReceipt",
        fileBase64: sampleBase64,
        fileMimeType: "application/pdf",
        fileName: "lunch.pdf",
      }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const uploaded = await uploadRes.json();
  assert.equal(uploaded.success, true);
  assert.ok(uploaded.receiptUrl.startsWith("https://api.test/?action=receipt&id="));

  await flushBackground();

  // Because Drive failed, Turso keeps the blob intact so the receipt still opens!
  const stagedRow = [...mock.mediaStaging.values()][0];
  assert.equal(stagedRow.status, "failed");
  assert.equal(stagedRow.base64, sampleBase64);

  const pendingView = await handleWorkerRequest(
    new Request(uploaded.receiptUrl),
    ENV,
    ctx,
    mock.fetch,
  );
  assert.equal(pendingView.status, 200);
  assert.equal(pendingView.headers.get("Content-Type"), "application/pdf");

  // Drive recovers -> flushPendingMedia offloads and WIPES base64 from Turso!
  mock.setDriveShouldFail(false);
  const db = new TursoClient(ENV.TURSO_DATABASE_URL, ENV.TURSO_AUTH_TOKEN, mock.fetch);
  const flushed = await flushPendingMedia(db, ENV, mock.fetch, 5, 0);
  assert.equal(flushed.offloaded, 1);
  assert.equal(stagedRow.status, "offloaded");
  assert.equal(stagedRow.base64, null);

  // Now GET ?action=receipt redirects 302 to permanent Google Drive preview!
  const driveRedirect = await handleWorkerRequest(
    new Request(`${uploaded.receiptUrl}&preview=1`),
    ENV,
    ctx,
    mock.fetch,
  );
  assert.equal(driveRedirect.status, 302);
  assert.match(
    driveRedirect.headers.get("Location") || "",
    /^https:\/\/drive\.google\.com\/file\/d\/drive_rcpt_1\/preview$/,
  );
});

test("Worker importFromSheets copies existing Google Sheets workspace and journal into Turso", async () => {
  resetWorkerRuntimeStateForTests();
  const mock = createMockTursoAndDrive();
  const { ctx } = makeCtx();

  const w = createWorkspace();
  w.name = "Migrated Space";
  w.updatedAt = 999;
  const h = { id: "h1", name: "2L Water", color: "", lightBg: "", ringColor: "" };
  const row = blankRow("2026-11-26", [h]);
  row.habits.h1 = true;

  mock.setSheetSnapshot({
    entries: [row],
    habits: [h],
    settings: { showTasksColumn: "true" },
    workspace: w,
  });

  const res = await handleWorkerRequest(
    new Request("https://api.test/", {
      method: "POST",
      headers: { Origin: "https://thayakumar.github.io", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "importFromSheets" }),
    }),
    ENV,
    ctx,
    mock.fetch,
  );
  const imported = await res.json();
  assert.equal(imported.success, true);
  assert.equal(imported.imported.habits, 1);
  assert.equal(imported.imported.entries, 1);
  assert.equal(imported.imported.hasWorkspace, true);

  const after = await (
    await handleWorkerRequest(
      new Request("https://api.test/?action=getAll", {
        headers: { Origin: "https://thayakumar.github.io" },
      }),
      ENV,
      ctx,
      mock.fetch,
    )
  ).json();
  assert.equal(after.workspace.name, "Migrated Space");
  assert.equal(after.entries[0].habits.h1, true);
});
