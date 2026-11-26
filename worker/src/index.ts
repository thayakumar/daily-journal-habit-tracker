import { TursoClient } from "./turso.ts";

export interface WorkerEnv {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_SCRIPT_URL?: string;
  ALLOWED_ORIGINS?: string;
}

export interface ExecutionCtx {
  waitUntil(promise: Promise<unknown>): void;
}

interface JournalRecord {
  entries: unknown[];
  habits: unknown[];
  showTasksColumn: boolean;
}

const DEFAULT_JOURNAL: JournalRecord = {
  entries: [],
  habits: [],
  showTasksColumn: true,
};

const SCHEMA_STATEMENTS = [
  {
    sql: `CREATE TABLE IF NOT EXISTS kv_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      revision TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  },
  {
    sql: `CREATE TABLE IF NOT EXISTS media_staging (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT '',
      angle TEXT NOT NULL DEFAULT '',
      base64 TEXT,
      drive_file_id TEXT,
      drive_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      offloaded_at TEXT NOT NULL DEFAULT ''
    )`,
  },
  {
    sql: `CREATE INDEX IF NOT EXISTS idx_media_staging_status ON media_staging (status, created_at)`,
  },
];

let schemaBootstrappedForUrl: string | null = null;

async function ensureSchema(db: TursoClient, urlKey: string) {
  if (schemaBootstrappedForUrl === urlKey) return;
  await db.batch(SCHEMA_STATEMENTS);
  schemaBootstrappedForUrl = urlKey;
}

export function resetWorkerRuntimeStateForTests() {
  schemaBootstrappedForUrl = null;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isOriginAllowed(origin: string | null, env: WorkerEnv): boolean {
  if (!origin) return true;
  if (
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    origin === "https://thayakumar.github.io"
  ) {
    return true;
  }
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.includes("*")) return true;
  return configured.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  origin: string | null,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function decodeBase64Bytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeJsonParse<T>(raw: string | number | null | undefined, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function featuresPayload(env: WorkerEnv) {
  const hasSheets = !!env.GOOGLE_SCRIPT_URL;
  return {
    workoutSets: true,
    recurringChecks: true,
    vocabulary: true,
    finance: true,
    financePlanning: true,
    financePortfolio: true,
    portfolioTimeline: true,
    vehicles: true,
    skincare: true,
    skincareDirectPhotos: true,
    legacyBudgetImport: hasSheets,
    atomicJournal: true,
    fastBackend: true,
    fastPoll: true,
    sheetsImportReady: hasSheets,
  };
}

function drivePreviewLink(driveUrl: string): string {
  const match = driveUrl.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return driveUrl;
}

async function callAppsScriptPost(
  env: WorkerEnv,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  if (!env.GOOGLE_SCRIPT_URL) {
    throw new Error("GOOGLE_SCRIPT_URL is not configured on the Worker");
  }
  const res = await fetchImpl(env.GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Google Drive script HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (data.success !== true) {
    throw new Error(String(data.error || "Google Drive upload failed"));
  }
  return data;
}

export async function offloadMediaById(
  db: TursoClient,
  env: WorkerEnv,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ offloaded: boolean; error?: string }> {
  if (!env.GOOGLE_SCRIPT_URL) {
    return { offloaded: false, error: "GOOGLE_SCRIPT_URL not configured" };
  }
  const res = await db.execute(
    `SELECT id, kind, name, mime_type, date, angle, base64, status
     FROM media_staging
     WHERE id = ?`,
    [id],
  );
  const row = res.rows[0];
  if (!row || row.status === "offloaded" || !row.base64) {
    return { offloaded: row?.status === "offloaded" };
  }

  try {
    if (row.kind === "skincare") {
      const uploaded = await callAppsScriptPost(
        env,
        {
          action: "uploadSkincarePhoto",
          fileBase64: String(row.base64),
          fileMimeType: String(row.mime_type),
          fileName: String(row.name),
          date: String(row.date || ""),
          angle: String(row.angle || "front"),
        },
        fetchImpl,
      );
      const photo = uploaded.photo as { fileId?: string } | undefined;
      if (!photo?.fileId) {
        throw new Error("Drive did not return skincare fileId");
      }
      // Wipe full base64 blob from Turso immediately once Google Drive confirms storage!
      await db.execute(
        `UPDATE media_staging
         SET drive_file_id = ?, base64 = NULL, status = 'offloaded', error = '', offloaded_at = ?
         WHERE id = ?`,
        [photo.fileId, new Date().toISOString(), id],
      );
      return { offloaded: true };
    }

    if (row.kind === "receipt") {
      const uploaded = await callAppsScriptPost(
        env,
        {
          action: "uploadFinanceReceipt",
          fileBase64: String(row.base64),
          fileName: String(row.name),
          fileMimeType: String(row.mime_type),
        },
        fetchImpl,
      );
      const driveUrl = String(uploaded.receiptUrl || "");
      if (!driveUrl) {
        throw new Error("Drive did not return receiptUrl");
      }
      // Wipe full base64 blob from Turso immediately once Google Drive confirms storage!
      await db.execute(
        `UPDATE media_staging
         SET drive_url = ?, base64 = NULL, status = 'offloaded', error = '', offloaded_at = ?
         WHERE id = ?`,
        [driveUrl, new Date().toISOString(), id],
      );
      return { offloaded: true };
    }

    return { offloaded: false, error: `Unknown media kind: ${String(row.kind)}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Offload failed";
    await db.execute(
      `UPDATE media_staging SET status = 'failed', error = ? WHERE id = ? AND status != 'offloaded'`,
      [message.slice(0, 300), id],
    );
    return { offloaded: false, error: message };
  }
}

export async function flushPendingMedia(
  db: TursoClient,
  env: WorkerEnv,
  fetchImpl: typeof fetch = fetch,
  limit = 5,
  minAgeMs = 0,
): Promise<{ checked: number; offloaded: number; failed: number }> {
  if (!env.GOOGLE_SCRIPT_URL) return { checked: 0, offloaded: 0, failed: 0 };
  const cutoff = new Date(Date.now() - minAgeMs).toISOString();
  const res = await db.execute(
    `SELECT id FROM media_staging
     WHERE status IN ('pending', 'failed')
       AND base64 IS NOT NULL
       AND created_at <= ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [cutoff, limit],
  );
  let offloaded = 0;
  let failed = 0;
  for (const row of res.rows) {
    const id = String(row.id);
    const out = await offloadMediaById(db, env, id, fetchImpl);
    if (out.offloaded) offloaded++;
    else failed++;
  }
  return { checked: res.rows.length, offloaded, failed };
}

async function readStateRows(db: TursoClient) {
  const res = await db.execute(
    `SELECT key, value, revision, updated_at FROM kv_state WHERE key IN ('workspace', 'journal')`,
  );
  const byKey = new Map<
    string,
    { value: string; revision: string; updatedAt: number }
  >();
  for (const row of res.rows) {
    byKey.set(String(row.key), {
      value: String(row.value ?? ""),
      revision: String(row.revision ?? ""),
      updatedAt: Number(row.updated_at ?? 0),
    });
  }
  return byKey;
}

async function handleGet(
  request: Request,
  url: URL,
  db: TursoClient,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const action = url.searchParams.get("action") || "health";

  if (action === "health") {
    const counts = await db.execute(
      `SELECT COUNT(*) AS pending_media FROM media_staging WHERE status != 'offloaded' AND base64 IS NOT NULL`,
    );
    return jsonResponse(
      {
        ok: true,
        backend: "turso-cloudflare-worker",
        pendingMedia: Number(counts.rows[0]?.pending_media ?? 0),
        driveOffloadConfigured: !!env.GOOGLE_SCRIPT_URL,
      },
      origin,
    );
  }

  if (action === "poll") {
    const res = await db.execute(
      `SELECT key, revision, updated_at FROM kv_state WHERE key IN ('workspace', 'journal')`,
    );
    let workspaceRevision = "";
    let journalRevision = "";
    for (const row of res.rows) {
      if (row.key === "workspace") workspaceRevision = String(row.revision || "");
      if (row.key === "journal") journalRevision = String(row.revision || "");
    }
    return jsonResponse(
      {
        success: true,
        workspaceRevision,
        journalRevision,
      },
      origin,
    );
  }

  if (action === "getAll") {
    const byKey = await readStateRows(db);
    const wsRow = byKey.get("workspace");
    const jRow = byKey.get("journal");
    const journal = jRow
      ? safeJsonParse<JournalRecord>(jRow.value, DEFAULT_JOURNAL)
      : DEFAULT_JOURNAL;
    const workspace = wsRow
      ? safeJsonParse<Record<string, unknown> | null>(wsRow.value, null)
      : undefined;

    // Opportunistically flush any media older than 30s that failed a prior Drive upload.
    if (env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        flushPendingMedia(db, env, fetchImpl, 3, 30_000).catch(() => {}),
      );
    }

    return jsonResponse(
      {
        entries: Array.isArray(journal.entries) ? journal.entries : [],
        habits: Array.isArray(journal.habits) ? journal.habits : [],
        settings: {
          showTasksColumn: String(journal.showTasksColumn !== false),
        },
        storageSchemaVersion: 2,
        features: featuresPayload(env),
        workspace: workspace ?? undefined,
        workspaceRevision: wsRow?.revision || "",
        journalRevision: jRow?.revision || "",
      },
      origin,
    );
  }

  if (action === "previewBudgetImport") {
    if (!env.GOOGLE_SCRIPT_URL) {
      return jsonResponse(
        {
          success: false,
          error: "Configure GOOGLE_SCRIPT_URL on the Worker to preview legacy Google Sheets budgets.",
        },
        origin,
        400,
      );
    }
    const sep = env.GOOGLE_SCRIPT_URL.includes("?") ? "&" : "?";
    const upstream = await fetchImpl(
      `${env.GOOGLE_SCRIPT_URL}${sep}action=previewBudgetImport&_ts=${Date.now()}`,
      { cache: "no-store" },
    );
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...corsHeaders(origin),
      },
    });
  }

  if (action === "receipt") {
    const id = (url.searchParams.get("id") || "").trim();
    const preview = url.searchParams.get("preview") === "1";
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return new Response("Invalid receipt ID", { status: 400 });
    }
    const res = await db.execute(
      `SELECT name, mime_type, base64, drive_url, status FROM media_staging WHERE id = ? AND kind = 'receipt'`,
      [id],
    );
    const row = res.rows[0];
    if (!row) {
      return new Response("Receipt not found", { status: 404 });
    }
    if (row.drive_url) {
      const target = preview
        ? drivePreviewLink(String(row.drive_url))
        : String(row.drive_url);
      return Response.redirect(target, 302);
    }
    if (!row.base64) {
      return new Response("Receipt content unavailable", { status: 404 });
    }
    const bytes = decodeBase64Bytes(String(row.base64));
    const safeName = String(row.name || "receipt").replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": String(row.mime_type || "application/octet-stream"),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  return jsonResponse({ success: false, error: `Unknown action: ${action}` }, origin, 400);
}

async function saveJournalState(
  db: TursoClient,
  next: JournalRecord,
): Promise<string> {
  const serialized = JSON.stringify(next);
  const revision = await sha256Hex(serialized);
  const now = Date.now();
  await db.execute(
    `INSERT INTO kv_state (key, value, revision, updated_at)
     VALUES ('journal', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       revision = excluded.revision,
       updated_at = excluded.updated_at`,
    [serialized, revision, now],
  );
  return revision;
}

async function handlePost(
  request: Request,
  url: URL,
  db: TursoClient,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, origin, 400);
  }

  const action = String(payload.action || "");

  if (action === "saveWorkspace") {
    const data = payload.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return jsonResponse({ success: false, error: "Invalid workspace payload" }, origin, 400);
    }
    const baseRevision = String(payload.baseRevision || "");
    const serialized = JSON.stringify(data);
    const nextRevision = await sha256Hex(serialized);
    const now = Date.now();

    const existing = await db.execute(
      `SELECT revision FROM kv_state WHERE key = 'workspace'`,
    );
    const currentRev = existing.rows[0]?.revision
      ? String(existing.rows[0].revision)
      : "";

    if (!currentRev) {
      await db.execute(
        `INSERT INTO kv_state (key, value, revision, updated_at)
         VALUES ('workspace', ?, ?, ?)`,
        [serialized, nextRevision, now],
      );
      return jsonResponse(
        { success: true, workspaceRevision: nextRevision },
        origin,
      );
    }

    if (baseRevision && baseRevision !== currentRev) {
      return jsonResponse(
        {
          success: false,
          code: "CONFLICT",
          error:
            "Another device updated your workspace. Merging the latest changes…",
          workspaceRevision: currentRev,
        },
        origin,
      );
    }

    // Atomic CAS update so simultaneous writes from two devices never silently clobber.
    const updateRes = await db.execute(
      `UPDATE kv_state
       SET value = ?, revision = ?, updated_at = ?
       WHERE key = 'workspace' AND revision = ?`,
      [serialized, nextRevision, now, currentRev],
    );
    if (updateRes.affectedRowCount === 0) {
      return jsonResponse(
        {
          success: false,
          code: "CONFLICT",
          error: "Concurrent save detected. Retrying merge…",
        },
        origin,
      );
    }

    return jsonResponse(
      { success: true, workspaceRevision: nextRevision },
      origin,
    );
  }

  if (action === "saveJournal") {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const habits = Array.isArray(payload.habits) ? payload.habits : [];
    const showTasksColumn = payload.showTasksColumn !== false;
    const journalRevision = await saveJournalState(db, {
      entries,
      habits,
      showTasksColumn,
    });
    return jsonResponse({ success: true, journalRevision }, origin);
  }

  if (
    action === "saveEntries" ||
    action === "saveHabits" ||
    action === "saveSetting"
  ) {
    const byKey = await readStateRows(db);
    const current = byKey.get("journal")
      ? safeJsonParse<JournalRecord>(byKey.get("journal")!.value, DEFAULT_JOURNAL)
      : { ...DEFAULT_JOURNAL };
    if (action === "saveEntries" && Array.isArray(payload.data)) {
      current.entries = payload.data;
    } else if (action === "saveHabits" && Array.isArray(payload.data)) {
      current.habits = payload.data;
    } else if (
      action === "saveSetting" &&
      payload.key === "showTasksColumn"
    ) {
      current.showTasksColumn = String(payload.value) === "true";
    }
    const journalRevision = await saveJournalState(db, current);
    return jsonResponse({ success: true, journalRevision }, origin);
  }

  if (action === "uploadSkincarePhoto") {
    const date = String(payload.date || "");
    const angle = String(payload.angle || "");
    const fileMimeType = String(payload.fileMimeType || "");
    const fileBase64 = String(payload.fileBase64 || "");
    const fileName = String(payload.fileName || "skincare.jpg").slice(0, 180);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !["front", "left", "right"].includes(angle)
    ) {
      return jsonResponse(
        { success: false, error: "Invalid skincare photo date or angle" },
        origin,
        400,
      );
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(fileMimeType) ||
      !fileBase64 ||
      fileBase64.length > 5_600_000
    ) {
      return jsonResponse(
        { success: false, error: "Invalid or oversized skincare photo" },
        origin,
        400,
      );
    }

    const stagingId = crypto.randomUUID().replace(/-/g, "");
    const updatedAt = new Date().toISOString();
    const photoId = `skinphoto:${stagingId}`;
    const stagedFileId = `staged_${stagingId}`;

    // Fast ~30ms write into Turso staging so the phone UI unlocks immediately!
    await db.execute(
      `INSERT INTO media_staging (id, kind, name, mime_type, date, angle, base64, status, created_at)
       VALUES (?, 'skincare', ?, ?, ?, ?, ?, 'pending', ?)`,
      [stagingId, fileName, fileMimeType, date, angle, fileBase64, updatedAt],
    );

    // Offload to Google Drive in the background and immediately wipe base64 from Turso once confirmed.
    if (env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        offloadMediaById(db, env, stagingId, fetchImpl).catch(() => {}),
      );
    }

    return jsonResponse(
      {
        success: true,
        photo: {
          id: photoId,
          date,
          angle,
          fileId: stagedFileId,
          name: fileName,
          mimeType: fileMimeType,
          updatedAt,
        },
      },
      origin,
    );
  }

  if (action === "getSkincarePhoto") {
    const fileId = String(payload.fileId || "").trim();
    if (!fileId) {
      return jsonResponse({ success: false, error: "Missing fileId" }, origin, 400);
    }

    if (fileId.startsWith("staged_")) {
      const stagingId = fileId.slice("staged_".length);
      const res = await db.execute(
        `SELECT base64, mime_type, drive_file_id, status FROM media_staging WHERE id = ? AND kind = 'skincare'`,
        [stagingId],
      );
      const row = res.rows[0];
      if (!row) {
        return jsonResponse({ success: false, error: "Photo not found" }, origin, 404);
      }
      if (row.base64) {
        return jsonResponse(
          {
            success: true,
            base64: String(row.base64),
            mimeType: String(row.mime_type || "image/jpeg"),
          },
          origin,
        );
      }
      if (row.drive_file_id) {
        const fromDrive = await callAppsScriptPost(
          env,
          { action: "getSkincarePhoto", fileId: String(row.drive_file_id) },
          fetchImpl,
        );
        return jsonResponse(fromDrive, origin);
      }
      return jsonResponse(
        { success: false, error: "Photo content unavailable" },
        origin,
        404,
      );
    }

    // Legacy or already-direct Google Drive fileId
    const fromDrive = await callAppsScriptPost(
      env,
      { action: "getSkincarePhoto", fileId },
      fetchImpl,
    );
    return jsonResponse(fromDrive, origin);
  }

  if (action === "uploadFinanceReceipt") {
    const fileBase64 = String(payload.fileBase64 || "");
    const fileName = String(payload.fileName || "receipt").slice(0, 180);
    const fileMimeType = String(payload.fileMimeType || "");

    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        fileMimeType,
      ) ||
      !fileBase64 ||
      fileBase64.length > 14_000_000
    ) {
      return jsonResponse(
        { success: false, error: "Use a PDF, JPG, PNG or WebP receipt under 10 MB." },
        origin,
        400,
      );
    }

    const stagingId = crypto.randomUUID().replace(/-/g, "");
    const createdAt = new Date().toISOString();

    await db.execute(
      `INSERT INTO media_staging (id, kind, name, mime_type, base64, status, created_at)
       VALUES (?, 'receipt', ?, ?, ?, 'pending', ?)`,
      [stagingId, fileName, fileMimeType, fileBase64, createdAt],
    );

    if (env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        offloadMediaById(db, env, stagingId, fetchImpl).catch(() => {}),
      );
    }

    const receiptUrl = `${url.origin}/?action=receipt&id=${stagingId}`;
    return jsonResponse(
      {
        success: true,
        receiptUrl,
        receiptName: fileName,
      },
      origin,
    );
  }

  if (action === "flushMedia") {
    const stats = await flushPendingMedia(db, env, fetchImpl, 20, 0);
    return jsonResponse({ success: true, ...stats }, origin);
  }

  if (action === "importFromSheets") {
    if (!env.GOOGLE_SCRIPT_URL) {
      return jsonResponse(
        {
          success: false,
          error: "GOOGLE_SCRIPT_URL is not configured on the Cloudflare Worker.",
        },
        origin,
        400,
      );
    }
    const sep = env.GOOGLE_SCRIPT_URL.includes("?") ? "&" : "?";
    const upstream = await fetchImpl(
      `${env.GOOGLE_SCRIPT_URL}${sep}action=getAll&_ts=${Date.now()}`,
      { cache: "no-store" },
    );
    if (!upstream.ok) {
      return jsonResponse(
        { success: false, error: `Google Sheets returned HTTP ${upstream.status}` },
        origin,
        502,
      );
    }
    const sheet = (await upstream.json()) as {
      entries?: unknown[];
      habits?: unknown[];
      settings?: { showTasksColumn?: string };
      workspace?: Record<string, unknown>;
      error?: string;
    };
    if (!Array.isArray(sheet.entries) || !Array.isArray(sheet.habits)) {
      return jsonResponse(
        { success: false, error: sheet.error || "Invalid Google Sheets payload" },
        origin,
        502,
      );
    }
    const journal: JournalRecord = {
      entries: sheet.entries,
      habits: sheet.habits,
      showTasksColumn: sheet.settings?.showTasksColumn !== "false",
    };
    const journalRevision = await saveJournalState(db, journal);

    let workspaceRevision = "";
    if (sheet.workspace && typeof sheet.workspace === "object") {
      const serialized = JSON.stringify(sheet.workspace);
      workspaceRevision = await sha256Hex(serialized);
      await db.execute(
        `INSERT INTO kv_state (key, value, revision, updated_at)
         VALUES ('workspace', ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           revision = excluded.revision,
           updated_at = excluded.updated_at`,
        [serialized, workspaceRevision, Date.now()],
      );
    }

    return jsonResponse(
      {
        success: true,
        imported: {
          habits: journal.habits.length,
          entries: journal.entries.length,
          hasWorkspace: !!sheet.workspace,
        },
        workspaceRevision,
        journalRevision,
      },
      origin,
    );
  }

  return jsonResponse({ success: false, error: `Unknown action: ${action}` }, origin, 400);
}

export async function handleWorkerRequest(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse({ success: false, error: "Origin not allowed" }, null, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const db = new TursoClient(
      env.TURSO_DATABASE_URL,
      env.TURSO_AUTH_TOKEN,
      fetchImpl,
    );
    await ensureSchema(db, env.TURSO_DATABASE_URL);
    const url = new URL(request.url);

    if (request.method === "GET") {
      return await handleGet(request, url, db, env, ctx, origin, fetchImpl);
    }
    if (request.method === "POST") {
      return await handlePost(request, url, db, env, ctx, origin, fetchImpl);
    }
    return jsonResponse({ success: false, error: "Method not allowed" }, origin, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker error";
    return jsonResponse({ success: false, error: message }, origin, 500);
  }
}

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionCtx) {
    return handleWorkerRequest(request, env, ctx);
  },
  scheduled(_event: unknown, env: WorkerEnv, ctx: ExecutionCtx) {
    if (!env.TURSO_DATABASE_URL || !env.GOOGLE_SCRIPT_URL) return;
    const db = new TursoClient(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
    ctx.waitUntil(
      ensureSchema(db, env.TURSO_DATABASE_URL)
        .then(() => flushPendingMedia(db, env, fetch, 20, 0))
        .catch(() => {}),
    );
  },
};
