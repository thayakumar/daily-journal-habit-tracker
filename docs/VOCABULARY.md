# Vocabulary

The current Vocabulary connection is live and verified. A test word, definition, example and timestamps matched independent Google Sheets reads; the temporary entry was removed and original records were preserved. Refresh the app after deployment to load the active capability.

Open Vocabulary in the sidebar and choose **Add word**. The popup asks for the word, definition and example usage. All three are required; leading/trailing spaces are removed. A duplicate word (ignoring case) directs you to edit the existing entry.

Saved words appear in a table on desktop. On phones, the same rows show the definition and example beneath each word. Search matches any of the three fields, and sorting supports newest-first or A–Z. Each row has edit and confirmed-delete controls. Cancel, Escape and the close button discard unsaved popup changes. Keyboard focus stays in the popup and returns to the trigger when it closes.

## Storage

The dedicated Vocabulary tab stores `id, word, definition, example, createdAt, updatedAt`. IDs and ISO timestamps are supplied by the app. Full backups include vocabulary records.

Deploy the latest Code.gs as a new version of the **existing** Apps Script Web app, keeping the same URL. The endpoint advertises `features.vocabulary: true` when this table is supported. Until then, words stay on the device, survive reload, and the Vocabulary page explicitly shows that status. They automatically upload once the capability is available. Existing workout, habit and planner sync continues to work.

Older clients/backups that omit vocabulary do not erase the live word table. Direct Sheet edits to existing definitions/examples are loaded through the normal table revision and reload mechanism.

## Verification

33 automated tests passed, including vocabulary table round-trip, backup validation and lossless local-to-cloud activation with an older backend. The browser script checks all nine pages at five widths (45 layout checks). It exercises the popup, focus, Escape, CRUD, duplicate detection, search, alphabetical sort and reload persistence on a phone-size Chromium viewport. Screenshots were inspected. Browser requests use a mock API, so those tests do not certify the currently deployed Apps Script's vocabulary support.
