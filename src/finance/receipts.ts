export function receiptPreviewUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com")
      return null;
    const id =
      url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ??
      url.searchParams.get("id");
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    return null;
  }
}
