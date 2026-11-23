import { requestSkincarePhoto, uploadSkincarePhoto } from "../lib/sheets-api";
import {
  PHOTO_ACCESS_EVENT,
  hasSkinPhotoAccess,
  skinPhotoAccessKey,
} from "./access";
import type { Angle, SkinPhoto } from "./model";
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
if (typeof window !== "undefined")
  window.addEventListener(PHOTO_ACCESS_EVENT, () => {
    cache.clear();
    pending.clear();
  });
export function cacheSkinPhoto(id: string, dataUrl: string) {
  if (!hasSkinPhotoAccess()) return;
  cache.set(id, dataUrl);
  while (cache.size > 60) cache.delete(cache.keys().next().value!);
}
export function cachedSkinPhoto(id: string) {
  return hasSkinPhotoAccess() ? cache.get(id) : undefined;
}
export async function loadSkinPhoto(id: string) {
  if (!hasSkinPhotoAccess())
    throw Error("Connect photos on this device first.");
  const cached = cache.get(id);
  if (cached) return cached;
  const active = pending.get(id);
  if (active) return active;
  const key = skinPhotoAccessKey();
  const promise = requestSkincarePhoto(id)
    .then((data) => {
      if (key !== skinPhotoAccessKey())
        throw Error("Photo connection changed. Connect photos and retry.");
      const url = `data:${data.mimeType};base64,${data.base64}`;
      cacheSkinPhoto(id, url);
      return url;
    })
    .finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}
export async function prepareSkinPhoto(
  file: File,
): Promise<{
  base64: string;
  dataUrl: string;
  mimeType: string;
  name: string;
}> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw Error("Choose a JPEG, PNG or WebP photo up to 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(
        1,
        1600 / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("This browser could not prepare the photo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85),
      base64 = dataUrl.split(",")[1];
    if (!base64 || base64.length > 5592408)
      throw Error(
        "The photo is too large after resizing. Try a smaller image.",
      );
    return {
      base64,
      dataUrl,
      mimeType: "image/jpeg",
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 160) + ".jpg",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function uploadSkinPhoto(
  file: File,
  date: string,
  angle: Angle,
): Promise<SkinPhoto> {
  const prepared = await prepareSkinPhoto(file),
    photo = await uploadSkincarePhoto({ ...prepared, date, angle });
  cacheSkinPhoto(photo.fileId, prepared.dataUrl);
  return photo;
}
