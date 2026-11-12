import test from "node:test";
import assert from "node:assert/strict";
import { receiptPreviewUrl } from "../src/finance/receipts.ts";
test("receipt previews stay in the Drive viewer and reject untrusted URLs", () => {
  assert.equal(
    receiptPreviewUrl(
      "https://drive.google.com/file/d/example_id-1/view?usp=drivesdk",
    ),
    "https://drive.google.com/file/d/example_id-1/preview",
  );
  assert.equal(
    receiptPreviewUrl("https://drive.google.com/open?id=example_id-1"),
    "https://drive.google.com/file/d/example_id-1/preview",
  );
  for (const value of [
    "javascript:alert(1)",
    "https://evil.test/file/d/id/view",
    "https://drive.google.com.evil.test/file/d/id/view",
    "https://drive.google.com/open?id=../../bad",
    "not a URL",
  ])
    assert.equal(receiptPreviewUrl(value), null);
});
