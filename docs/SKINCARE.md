# Skincare journal

Open **Skincare** from navigation or the Overview buttons. It contains three modules.

- **Daily tracker:** current date by default, editable past dates, daily notes, skin reaction notes, products used, custom AM/PM/Anytime habits, and front/left/right photo slots. Notes and checks save automatically through the existing planner sync. “Save this day” records a day even if the notes are blank.
- **My products:** name, brand, product type, notes, start/stop dates and active/archive status. Archiving retains links on previous diary days.
- **Photo overview:** newest tracked days first, three labelled angles, notes/reactions/products and completed step counts. Filter dates or select a consistent angle, open a photo in a popup, or return to a tracked day. More days load in groups of nine; image requests start when near the viewport.

Starter routine: morning cleanser, moisturiser and sunscreen; evening cleanser and moisturiser. Use the starter button or add custom steps. These routines are separate from general Habits. Archive unused steps without erasing recorded checks. Product and habit edits are available in popups.

## Storage

The existing planner spreadsheet has five new tables:

| Table | Records |
| --- | --- |
| SkincareJournal | One dated entry with notes, reaction and product IDs |
| SkincareProducts | Product register and archive status |
| SkincareHabits | Custom routine steps, time of day and active status |
| SkincareChecks | Dated completions linked to routine steps |
| SkincarePhotos | Date/angle/file metadata, one photo per angle per day |

Actual images live in a new private My Drive folder named **Personal Planner - Skincare Photos**. The folder ID is saved in planner Settings. SkincareUploads is an internal upload registry outside workspace replacement and revision hashing, so uploading files does not invalidate a pending journal save. Existing receipt storage and folder are unchanged.

Photo upload/read operations use the same existing planner connection as journal records, without an additional access key or device connection popup. Drive files are not made public through Drive sharing. A photo read must match both the upload registry and saved journal metadata; arbitrary Drive files cannot be read. Photo access follows access to the existing planner endpoint. Photo reads do not hold the planner write lock.

Images are loaded through the planner endpoint and cached in memory (up to 60 images), not embedded in localStorage or JSON backup. JPEG/PNG/WebP source files up to 15 MB are resized to at most 1600 px and encoded to JPEG before upload (4 MB prepared-file maximum). The resized file is the one saved in Drive; your original phone/computer file is unchanged. EXIF metadata is not copied through canvas encoding.

Replacing/removing a journal photo or deleting a journal day removes the corresponding journal links, not the old private Drive files. This preserves files referenced by older backups. Original Drive files can be managed manually. JSON backup contains notes, habits, products, checks and photo references; keep the Drive folder to retain photo access.

## Setup

Replace Code.gs in the existing planner Apps Script project, then Deploy → Manage deployments → edit the existing Web app → New version → Deploy. Keep the same deployment URL. The backend advertises `features.skincareDirectPhotos` for direct uploads. This replaces the earlier photo-key setup.

Refresh the app, open Skincare and choose a front/left/right photo to upload. There is no Connect photos popup, no key to copy and no per-device setup. The separate Drive folder is created automatically on the first upload if it does not already exist. Existing files and photo links are retained. `authorizeSkincarePhotos` remains an optional folder setup helper, but no longer generates or requires a key.

Notes, products and routine checks remain saved on the device until the backend advertises `features.skincare`. Unsupported data is omitted from older backend saves and merges by ID when upgraded. Photo upload is enabled once the direct-upload backend is deployed. Older clients omitting Skincare cannot erase its tables.

## Portfolio card information

Each of the eight Portfolio KPI cards now shows a permanently visible explanation and actual contributing accounts/loans/payments. No separate guide or extra click. Asset subcategories explain overlap, missing balances are explicit, net worth shows assets less remaining debt, and monthly obligations distinguish instalments from outstanding principal. Values and contributor lists update from current recorded data.

## Verification

Automated tests execute actual Code.gs against mocked Google Sheets/Drive. They cover journal/product/routine round trips, product references, duplicate/future day rejection, image-byte/MIME validation, three photo angles, keyless uploads and arbitrary-file rejection, archive/history retention and old-client/device upgrade behaviour.

`npm run test:skincare` exercises the actual React app and actual Code.gs against these mocked services: notes, custom routines, products, real browser canvas conversion of an image, three uploads, reload/private gallery reads, date/angle filters, a photo popup, product archiving and inline Portfolio breakdowns across five widths. No real user face photos or production data are used for tests. Live table/photo activation requires the Apps Script update above.
