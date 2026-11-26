# Turso + Cloudflare Worker Fast Backend Setup

Move My Space from slow Google Apps Script spreadsheet reads (~2–6s per sync) to **Turso SQLite + Cloudflare Worker** (~30–80ms sync, live cross-device updates every 12s, and instant ~0.3s photo/receipt uploads that automatically offload to Google Drive and wipe from Turso).

## Architecture

- **Frontend:** Stays hosted on GitHub Pages (`https://thayakumar.github.io/daily-journal-habit-tracker/`).
- **Edge API (`worker/`):** Zero-dependency Cloudflare Worker (100,000 free requests/day, 0ms cold start). Holds your `TURSO_AUTH_TOKEN` safely server-side so it is never exposed in browser code.
- **Database (Turso):** Stores your workspace & habits in `kv_state` (auto-created on first request from `worker/schema.sql`).
- **Photos & Receipts (Turso → Google Drive → Wipe):**
  1. Phone uploads photo/receipt to Cloudflare Worker → stored briefly in `media_staging` (~30ms) → returns `200 OK` immediately so your screen never lags.
  2. In the background (`ctx.waitUntil`), the Worker forwards the file to your existing Google Drive Apps Script endpoint (`GOOGLE_SCRIPT_URL`), saves the permanent Drive link/file ID, and **immediately wipes `base64 = NULL` from Turso**.
  3. A built-in 15-minute Cloudflare cron trigger automatically retries any upload if Google Drive ever hiccups transiently.

---

## 5-Minute Deployment Steps

### 1. Create a Turso Database & Token
In the [Turso Dashboard](https://turso.tech) (or CLI):
```bash
turso db create my-space
turso db show --url my-space         # copy libsql://... URL
turso db tokens create my-space      # copy auth token
```
*(No need to run SQL migrations manually — the Worker auto-creates `kv_state` and `media_staging` on its first request.)*

### 2. Deploy the Cloudflare Worker (Free Tier, No Credit Card)
From your repository root:
```bash
cd worker
npx wrangler login
npx wrangler deploy
```
Copy the deployed Worker URL printed by Wrangler (for example: `https://my-space-api.<your-subdomain>.workers.dev`).

Now set your 3 server-side secrets on the Worker:
```bash
npx wrangler secret put TURSO_DATABASE_URL   # paste your libsql://... URL
npx wrangler secret put TURSO_AUTH_TOKEN     # paste your Turso auth token
npx wrangler secret put GOOGLE_SCRIPT_URL    # paste your existing Apps Script /exec Web app URL
```

Verify the Worker is healthy by opening:
`https://my-space-api.<your-subdomain>.workers.dev/?action=health`
You should see: `{"ok":true,"backend":"turso-cloudflare-worker","pendingMedia":0,"driveOffloadConfigured":true}`.

### 3. Point GitHub Pages to the Worker
1. Open GitHub repo **Settings → Secrets and variables → Actions**.
2. Add a new Repository Secret:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://my-space-api.<your-subdomain>.workers.dev`
3. Run the **Deploy to GitHub Pages** workflow (from the **Actions** tab → **Run workflow**, or merge the PR).

### 4. One-Click Migration from Google Sheets
1. Open your live app → **Settings & backup**.
2. Click **Import from Google Sheets**.
3. Your entire existing planner, habits, finance history, skincare logs, and vehicle records copy directly from Google Sheets into Turso in a few seconds!
4. Refresh on your phone and laptop — both devices now sync via Turso in ~30–80ms.
