import type { TursoClient } from "./turso.ts";
import {
  corsHeaders,
  featuresPayload,
  jsonResponse,
  safeJsonParse,
  type ExecutionCtx,
  type WorkerEnv,
} from "./http.ts";
import { flushPendingMedia } from "./media.ts";

export interface JournalRecord {
  entries: unknown[];
  habits: unknown[];
  showTasksColumn: boolean;
}

const DEFAULT_JOURNAL: JournalRecord = {
  entries: [],
  habits: [],
  showTasksColumn: true,
};

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function readStateRows(db: TursoClient) {
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

export async function saveJournalState(
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

export async function handlePoll(
  db: TursoClient,
  origin: string | null,
): Promise<Response> {
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

export async function handleGetAll(
  db: TursoClient,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
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

export async function handlePreviewBudgetImport(
  env: WorkerEnv,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  if (!env.GOOGLE_SCRIPT_URL) {
    return jsonResponse(
      {
        success: false,
        error:
          "Configure GOOGLE_SCRIPT_URL on the Worker to preview legacy Google Sheets budgets.",
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

export async function handleSaveWorkspace(
  payload: Record<string, unknown>,
  db: TursoClient,
  origin: string | null,
): Promise<Response> {
  const data = payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return jsonResponse(
      { success: false, error: "Invalid workspace payload" },
      origin,
      400,
    );
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

export async function handleSaveJournal(
  payload: Record<string, unknown>,
  db: TursoClient,
  origin: string | null,
): Promise<Response> {
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

export async function handleLegacyJournalWrite(
  action: "saveEntries" | "saveHabits" | "saveSetting",
  payload: Record<string, unknown>,
  db: TursoClient,
  origin: string | null,
): Promise<Response> {
  const byKey = await readStateRows(db);
  const current = byKey.get("journal")
    ? safeJsonParse<JournalRecord>(byKey.get("journal")!.value, DEFAULT_JOURNAL)
    : { ...DEFAULT_JOURNAL };
  if (action === "saveEntries" && Array.isArray(payload.data)) {
    current.entries = payload.data;
  } else if (action === "saveHabits" && Array.isArray(payload.data)) {
    current.habits = payload.data;
  } else if (action === "saveSetting" && payload.key === "showTasksColumn") {
    current.showTasksColumn = String(payload.value) === "true";
  }
  const journalRevision = await saveJournalState(db, current);
  return jsonResponse({ success: true, journalRevision }, origin);
}

export async function handleImportFromSheets(
  db: TursoClient,
  env: WorkerEnv,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
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
      {
        success: false,
        error: `Google Sheets returned HTTP ${upstream.status}`,
      },
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
      {
        success: false,
        error: sheet.error || "Invalid Google Sheets payload",
      },
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
