import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace, isWorkspace } from "../src/workspace/model.ts";
import {
  emptySkincare,
  isSkincare,
  putSkinDay,
  starterSkinHabits,
  skinDateError,
} from "../src/skincare/model.ts";
import { createBackend } from "./apps-script-mock.mjs";
const date = "2026-11-20";
const product = {
  id: "moisturiser",
  name: "Moisturiser",
  brand: "Brand",
  type: "Moisturiser",
  notes: "Small amount",
  started: date,
  stopped: "",
  active: true,
};
function skin() {
  let p = emptySkincare();
  p.products = [product];
  p.habits = starterSkinHabits().map((h) => ({
    ...h,
    createdAt: date + "T12:00Z",
  }));
  p = putSkinDay(p, date, {
    notes: "=literal note",
    reaction: "Comfortable",
    productIds: [product.id],
  });
  p.checks = [{ id: "check", date, habitId: p.habits[0].id, done: true }];
  return p;
}
function save(b, data) {
  return b.post({
    action: "saveWorkspace",
    data,
    baseRevision: b.get().workspaceRevision,
  });
}
const jpg = Buffer.from([
  255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 0, 0, 0, 0,
]).toString("base64");
test("daily notes, product links and custom routines use separate readable tables and survive older clients", () => {
  const w = createWorkspace();
  w.skincare = skin();
  w.updatedAt = 1;
  assert.ok(isWorkspace(w));
  const b = createBackend(w),
    r = b.get();
  assert.equal(r.features.skincare, true);
  assert.deepEqual(r.workspace.skincare, w.skincare);
  for (const name of [
    "SkincareJournal",
    "SkincareProducts",
    "SkincareHabits",
    "SkincareChecks",
    "SkincarePhotos",
  ])
    assert.ok(b.sheets.has(name));
  assert.equal(b.sheets.get("SkincareJournal").grid[1][2], "=literal note");
  const old = structuredClone(r.workspace);
  delete old.skincare;
  old.updatedAt = 2;
  assert.equal(save(b, old).success, true);
  assert.deepEqual(b.get().workspace.skincare, w.skincare);
});
test("invalid product links, duplicate dates/checks, future dates and invalid products cannot replace saved data", () => {
  const w = createWorkspace();
  w.skincare = skin();
  w.updatedAt = 1;
  const b = createBackend(w);
  for (const mutate of [
    (p) => p.entries[0].productIds.push("missing"),
    (p) => p.entries.push({ ...p.entries[0], id: "duplicate" }),
    (p) => p.checks.push({ ...p.checks[0], id: "duplicate" }),
    (p) => (p.products[0].stopped = "2020-01-01"),
  ]) {
    const bad = structuredClone(w);
    mutate(bad.skincare);
    assert.equal(isWorkspace(bad), false);
    assert.equal(save(b, bad).success, false);
    assert.deepEqual(b.get().workspace.skincare, w.skincare);
  }
  const future = putSkinDay(w.skincare, "2099-01-01");
  assert.match(skinDateError(future, date), /today/);
  assert.equal(save(b, { ...w, skincare: future }).success, false);
  assert.equal(isSkincare(null), false);
  assert.equal(
    isSkincare({
      ...w.skincare,
      photos: [
        {
          id: "x",
          date,
          angle: "front",
          fileId: "bad",
          name: "x",
          mimeType: "text/html",
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    false,
  );
});
test("private photo upload validates image bytes, registers ownership and round-trips all three angles", () => {
  const w = createWorkspace();
  w.updatedAt = 1;
  w.skincare = skin();
  const b = createBackend(w);
  b.get();
  for (const angle of ["front", "left", "right"]) {
    const response = b.post({
      action: "uploadSkincarePhoto",
      date,
      angle,
      fileName: "face.jpg",
      fileMimeType: "image/jpeg",
      fileBase64: jpg,
    });
    assert.equal(response.success, true, response.error);
    assert.equal(b.receipts.at(-1).folderId, "skin-folder");
    w.skincare.photos.push(response.photo);
  }
  w.updatedAt = 2;
  assert.equal(save(b, w).success, true);
  assert.equal(b.get().workspace.skincare.photos.length, 3);
  for (const photo of w.skincare.photos) {
    const image = b.post({
      action: "getSkincarePhoto",
      fileId: photo.fileId,
    });
    assert.equal(image.success, true, image.error);
    assert.equal(image.base64, jpg);
    assert.equal(image.mimeType, "image/jpeg");
  }
  const before = b.receipts.length;
  for (const patch of [
    { angle: "back" },
    { fileMimeType: "image/svg+xml" },
    { fileBase64: Buffer.from("<html>not an image</html>").toString("base64") },
    { date: "2099-01-01" },
  ])
    assert.equal(
      b.post({
        action: "uploadSkincarePhoto",
        date,
        angle: "front",
        fileName: "file.jpg",
        fileMimeType: "image/jpeg",
        fileBase64: jpg,
        ...patch,
      }).success,
      false,
    );
  assert.equal(b.receipts.length, before);
  assert.equal(
    b.post({
      action: "getSkincarePhoto",
      fileId: "arbitrary-private-id",
    }).success,
    false,
  );
  const bad = structuredClone(w);
  bad.skincare.photos[0].fileId = "arbitrary-private-id";
  assert.equal(save(b, bad).success, false);
  assert.deepEqual(b.get().workspace.skincare.photos, w.skincare.photos);
});
test("archiving products and habits keeps history and removing a photo link does not delete the Drive original", () => {
  const w = createWorkspace();
  w.skincare = skin();
  w.updatedAt = 1;
  const b = createBackend(w);
  b.get();
  const photo = b.post({
    action: "uploadSkincarePhoto",
    date,
    angle: "front",
    fileName: "a.jpg",
    fileMimeType: "image/jpeg",
    fileBase64: jpg,
  }).photo;
  w.skincare.photos = [photo];
  assert.equal(save(b, w).success, true);
  const next = structuredClone(b.get().workspace);
  next.skincare.products[0].active = false;
  next.skincare.habits[0].active = false;
  next.skincare.photos = [];
  assert.equal(save(b, next).success, true);
  assert.equal(b.get().workspace.skincare.entries[0].productIds[0], product.id);
  assert.equal(b.get().workspace.skincare.checks[0].done, true);
  assert.equal(b.receipts.length, 1);
  assert.equal(
    b.post({
      action: "getSkincarePhoto",
      fileId: photo.fileId,
    }).success,
    false,
  );
});

test("direct photo uploads work without a key but arbitrary Drive files remain inaccessible", () => {
  const w = createWorkspace();
  w.skincare = skin();
  w.updatedAt = 1;
  const b = createBackend(w);
  b.get();
  b.scriptProperties.clear();
  const uploaded = b.post({
    action: "uploadSkincarePhoto",
    date,
    angle: "front",
    fileName: "direct.jpg",
    fileMimeType: "image/jpeg",
    fileBase64: jpg,
  });
  assert.equal(uploaded.success, true, uploaded.error);
  w.skincare.photos = [uploaded.photo];
  assert.equal(save(b, w).success, true);
  assert.equal(
    b.post({ action: "getSkincarePhoto", fileId: uploaded.photo.fileId })
      .success,
    true,
  );
  assert.equal(
    b.post({ action: "getSkincarePhoto", fileId: "other-private-file" })
      .success,
    false,
  );
  assert.equal(b.get().features.skincareDirectPhotos, true);
  assert.equal(b.context.authorizeSkincarePhotos(), "skin-folder");
});
