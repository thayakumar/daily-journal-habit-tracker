import { TursoClient } from "./turso.ts";
import {
  corsHeaders,
  defaultFetch,
  isOriginAllowed,
  jsonResponse,
  type ExecutionCtx,
  type WorkerEnv,
} from "./http.ts";
import {
  flushPendingMedia,
  handleGetReceipt,
  handleGetSkincarePhoto,
  handleUploadFinanceReceipt,
  handleUploadSkincarePhoto,
  offloadMediaById,
} from "./media.ts";
import {
  handleGetAll,
  handleImportFromSheets,
  handleLegacyJournalWrite,
  handlePoll,
  handlePreviewBudgetImport,
  handleSaveJournal,
  handleSaveWorkspace,
} from "./state.ts";

export type { WorkerEnv, ExecutionCtx };
export { flushPendingMedia, offloadMediaById };

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

async function handleGet(
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
  if (action === "poll") return handlePoll(db, origin);
  if (action === "getAll") return handleGetAll(db, env, ctx, origin, fetchImpl);
  if (action === "previewBudgetImport") {
    return handlePreviewBudgetImport(env, origin, fetchImpl);
  }
  if (action === "receipt") return handleGetReceipt(url, db);

  return jsonResponse(
    { success: false, error: `Unknown action: ${action}` },
    origin,
    400,
  );
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
    return jsonResponse(
      { success: false, error: "Invalid JSON body" },
      origin,
      400,
    );
  }

  const action = String(payload.action || "");
  if (action === "saveWorkspace") return handleSaveWorkspace(payload, db, origin);
  if (action === "saveJournal") return handleSaveJournal(payload, db, origin);
  if (
    action === "saveEntries" ||
    action === "saveHabits" ||
    action === "saveSetting"
  ) {
    return handleLegacyJournalWrite(action, payload, db, origin);
  }
  if (action === "uploadSkincarePhoto") {
    return handleUploadSkincarePhoto(payload, db, env, ctx, origin, fetchImpl);
  }
  if (action === "getSkincarePhoto") {
    return handleGetSkincarePhoto(payload, db, env, origin, fetchImpl);
  }
  if (action === "uploadFinanceReceipt") {
    return handleUploadFinanceReceipt(
      payload,
      url,
      db,
      env,
      ctx,
      origin,
      fetchImpl,
    );
  }
  if (action === "flushMedia") {
    const stats = await flushPendingMedia(db, env, fetchImpl, 20, 0);
    return jsonResponse({ success: true, ...stats }, origin);
  }
  if (action === "importFromSheets") {
    return handleImportFromSheets(db, env, origin, fetchImpl);
  }

  return jsonResponse(
    { success: false, error: `Unknown action: ${action}` },
    origin,
    400,
  );
}

export async function handleWorkerRequest(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  fetchImpl: typeof fetch = defaultFetch,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isOriginAllowed(origin, env)) {
    return jsonResponse(
      { success: false, error: "Origin not allowed" },
      null,
      403,
    );
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
      return await handleGet(url, db, env, ctx, origin, fetchImpl);
    }
    if (request.method === "POST") {
      return await handlePost(request, url, db, env, ctx, origin, fetchImpl);
    }
    return jsonResponse(
      { success: false, error: "Method not allowed" },
      origin,
      405,
    );
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
        .then(() => flushPendingMedia(db, env, defaultFetch, 20, 0))
        .catch(() => {}),
    );
  },
};
