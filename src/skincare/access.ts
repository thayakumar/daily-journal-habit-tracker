const KEY = "skincare.photo-access.v1";
export const PHOTO_ACCESS_EVENT = "skincare-photo-access-changed";
export function skinPhotoAccessKey() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}
export function hasSkinPhotoAccess() {
  return !!skinPhotoAccessKey();
}
export function setSkinPhotoAccess(key: string) {
  localStorage.setItem(KEY, key.trim());
  window.dispatchEvent(new Event(PHOTO_ACCESS_EVENT));
}
export function forgetSkinPhotoAccess() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(PHOTO_ACCESS_EVENT));
}
