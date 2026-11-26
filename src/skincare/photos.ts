import { requestSkincarePhoto, uploadSkincarePhoto } from "../lib/sheets-api";
import type { Angle, SkinPhoto } from "./model";

const MAX_CACHED_PHOTOS = 18;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

export function cacheSkinPhoto(id: string, dataUrl: string) {
  if (cache.has(id)) cache.delete(id);
  cache.set(id, dataUrl);
  while (cache.size > MAX_CACHED_PHOTOS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function cachedSkinPhoto(id: string) {
  const value = cache.get(id);
  if (value !== undefined) {
    cache.delete(id);
    cache.set(id, value);
  }
  return value;
}

export async function loadSkinPhoto(id: string) {
  const cached = cachedSkinPhoto(id);
  if (cached) return cached;
  const active = pending.get(id);
  if (active) return active;
  const promise = requestSkincarePhoto(id)
    .then((data) => {
      const url = `data:${data.mimeType};base64,${data.base64}`;
      cacheSkinPhoto(id, url);
      return url;
    })
    .finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function isAllowedImageFile(file: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) return true;
  if (!file.type) {
    return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  }
  return false;
}

export async function prepareSkinPhoto(file: File): Promise<{
  base64: string;
  dataUrl: string;
  mimeType: string;
  name: string;
}> {
  if (!isAllowedImageFile(file) || file.size > 15 * 1024 * 1024)
    throw Error("Choose a JPEG, PNG, WebP or iPhone HEIC photo up to 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
        throw Error(
          "This browser cannot convert HEIC photos. Export as JPEG or switch Camera Formats to Most Compatible.",
        );
      }
      throw Error("Could not read this image file. Try a JPEG or PNG photo.");
    }
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
