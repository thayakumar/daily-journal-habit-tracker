# Turso + Cloudflare Worker Fast Backend Setup (No Terminal Needed)

Move My Space from slow Google Apps Script spreadsheet reads (~2–6s per sync) to **Turso SQLite + Cloudflare Worker** (~30–80ms sync, live cross-device updates every 12s, and instant ~0.3s photo/receipt uploads that automatically offload to Google Drive and wipe from Turso).

## Architecture

- **Frontend:** Stays hosted on GitHub Pages (`https://thayakumar.github.io/daily-journal-habit-tracker/`).
- **Edge API (`worker/`):** Zero-dependency Cloudflare Worker (100,000 free requests/day, 0ms cold start) deployed automatically by GitHub Actions. Holds `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `GOOGLE_SCRIPT_URL` safely server-side.
- **Database (Turso):** Stores your workspace & habits in `kv_state` (`my-space` database).
- **Photos & Receipts (Turso → Google Drive → Wipe):**
  1. Phone uploads photo/receipt to Cloudflare Worker → stored briefly in `media_staging` (~30ms) → returns `200 OK` immediately so your screen never lags.
  2. In the background (`ctx.waitUntil`), the Worker forwards the file to your existing Google Drive Apps Script endpoint, saves the permanent Drive link/file ID, and **immediately wipes `base64 = NULL` from Turso**.
  3. A built-in 15-minute Cloudflare cron trigger automatically retries any upload if Google Drive ever hiccups transiently.

---

## Zero-Terminal Setup (GitHub Actions Deploys Everything Automatically)

### 1. Create a Free Cloudflare Account & Workers API Token
1. Sign up free at https://dash.cloudflare.com/sign-up (no credit card needed).
2. In the left sidebar, click **Compute (Workers) → Workers & Pages** once so Cloudflare activates your free `*.workers.dev` subdomain.
3. Open https://dash.cloudflare.com/profile/api-tokens → click **Create Token**.
4. Next to **Edit Cloudflare Workers**, click **Use template**.
5. Under **Account Resources** select your account, under **Zone Resources** select **All zones**, click **Continue to summary → Create Token**, and **Copy** the token.

### 2. Paste the Token into GitHub Actions Secrets
1. Open your GitHub repo **Settings → Secrets and variables → Actions**:
   `https://github.com/thayakumar/daily-journal-habit-tracker/settings/secrets/actions`
2. Click **New repository secret**:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Secret:** paste the token you copied above.
   - *(Note: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `VITE_GOOGLE_SCRIPT_URL` are already saved in GitHub Secrets!)*

### 3. Deploy Automatically
Merge the PR (or click **Actions → Deploy to GitHub Pages → Run workflow**). GitHub Actions will automatically:
- Deploy `worker/` to Cloudflare Workers (`my-space-api.<your-subdomain>.workers.dev`)
- Push `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `GOOGLE_SCRIPT_URL` securely to Cloudflare
- Build & deploy GitHub Pages pointed at your live Worker URL automatically!

### 4. One-Click Migration from Google Sheets
1. Open your live app → **Settings & backup**.
2. Click **Import from Google Sheets** once.
3. All your existing planner data, habits, finance records, skincare logs, and vehicles copy straight from Google Sheets into Turso!
