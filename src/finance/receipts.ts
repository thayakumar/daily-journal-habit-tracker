export function receiptPreviewUrl(
  value: string,
  allowedApiUrl?: string,
): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "drive.google.com") {
      const id =
        url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ??
        url.searchParams.get("id");
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
      return `https://drive.google.com/file/d/${id}/preview`;
    }
    const env = (import.meta as { env?: Record<string, string | undefined> })
      .env;
    const api = allowedApiUrl || env?.VITE_API_URL || "";
    if (api) {
      const apiOrigin = new URL(api).origin;
      if (
        url.origin === apiOrigin &&
        url.searchParams.get("action") === "receipt" &&
        /^[A-Za-z0-9_-]+$/.test(url.searchParams.get("id") || "")
      ) {
        const preview = new URL(url.href);
        preview.searchParams.set("preview", "1");
        return preview.href;
      }
    }
    return null;
  } catch {
    return null;
  }
}
