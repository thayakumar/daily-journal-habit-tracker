import type { TursoClient } from "./turso.ts";
import {
  callAppsScriptPost,
  defaultFetch,
  jsonResponse,
  type ExecutionCtx,
  type WorkerEnv,
} from "./http.ts";

function decodeBase64Bytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function drivePreviewLink(driveUrl: string): string {
  const match = driveUrl.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return driveUrl;
}

export async function offloadMediaById(
  db: TursoClient,
  env: WorkerEnv,
  id: string,
  fetchImpl: typeof fetch = defaultFetch,
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

    return {
      offloaded: false,
      error: `Unknown media kind: ${String(row.kind)}`,
    };
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
  fetchImpl: typeof fetch = defaultFetch,
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

export async function handleGetReceipt(
  url: URL,
  db: TursoClient,
): Promise<Response> {
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
  const safeName = String(row.name || "receipt").replace(
    /[^A-Za-z0-9._-]/g,
    "_",
  );
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": String(row.mime_type || "application/octet-stream"),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function handleUploadSkincarePhoto(
  payload: Record<string, unknown>,
  db: TursoClient,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
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

export async function handleGetSkincarePhoto(
  payload: Record<string, unknown>,
  db: TursoClient,
  env: WorkerEnv,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const fileId = String(payload.fileId || "").trim();
  if (!fileId) {
    return jsonResponse(
      { success: false, error: "Missing fileId" },
      origin,
      400,
    );
  }

  if (fileId.startsWith("staged_")) {
    const stagingId = fileId.slice("staged_".length);
    const res = await db.execute(
      `SELECT base64, mime_type, drive_file_id, status FROM media_staging WHERE id = ? AND kind = 'skincare'`,
      [stagingId],
    );
    const row = res.rows[0];
    if (!row) {
      return jsonResponse(
        { success: false, error: "Photo not found" },
        origin,
        404,
      );
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

export async function handleUploadFinanceReceipt(
  payload: Record<string, unknown>,
  url: URL,
  db: TursoClient,
  env: WorkerEnv,
  ctx: ExecutionCtx,
  origin: string | null,
  fetchImpl: typeof fetch,
): Promise<Response> {
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
      {
        success: false,
        error: "Use a PDF, JPG, PNG or WebP receipt under 10 MB.",
      },
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
