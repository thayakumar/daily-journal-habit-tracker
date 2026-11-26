-- Turso (libSQL / SQLite) schema for My Space edge API.
-- Automatically bootstrapped by the Cloudflare Worker on first request.

CREATE TABLE IF NOT EXISTS kv_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  revision TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Temporary fast-upload staging for Skincare photos & Finance receipts.
-- Files are written here in ~30ms for instant phone responsiveness, then
-- offloaded to Google Drive via ctx.waitUntil() and immediately wiped
-- (base64 = NULL) once Drive confirms the permanent fileId / URL.
CREATE TABLE IF NOT EXISTS media_staging (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- 'skincare' | 'receipt'
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  angle TEXT NOT NULL DEFAULT '',
  base64 TEXT,                   -- wiped to NULL immediately after Drive confirms
  drive_file_id TEXT,
  drive_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'offloaded' | 'failed'
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  offloaded_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_media_staging_status ON media_staging (status, created_at);
