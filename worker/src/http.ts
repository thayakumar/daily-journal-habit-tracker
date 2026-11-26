export interface WorkerEnv {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  GOOGLE_SCRIPT_URL?: string;
  ALLOWED_ORIGINS?: string;
}

export interface ExecutionCtx {
  waitUntil(promise: Promise<unknown>): void;
}

// Always invoke global fetch unbound — Cloudflare Workers V8 throws Illegal invocation if bound to an object.
export const defaultFetch: typeof fetch = (input, init) => fetch(input, init);

export function isOriginAllowed(origin: string | null, env: WorkerEnv): boolean {
  if (!origin) return true;
  if (
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    origin === "https://thayakumar.github.io"
  ) {
    return true;
  }
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.includes("*")) return true;
  return configured.includes(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Access-Control-Allow-Origin": origin || "*",
  };
}

export function jsonResponse(
  body: unknown,
  origin: string | null,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

export function safeJsonParse<T>(
  raw: string | number | null | undefined,
  fallback: T,
): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function featuresPayload(env: WorkerEnv) {
  const hasSheets = !!env.GOOGLE_SCRIPT_URL;
  return {
    workoutSets: true,
    recurringChecks: true,
    vocabulary: true,
    finance: true,
    financePlanning: true,
    financePortfolio: true,
    portfolioTimeline: true,
    vehicles: true,
    skincare: true,
    skincareDirectPhotos: true,
    legacyBudgetImport: hasSheets,
    atomicJournal: true,
    fastBackend: true,
    fastPoll: true,
    sheetsImportReady: hasSheets,
  };
}

export async function callAppsScriptPost(
  env: WorkerEnv,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  if (!env.GOOGLE_SCRIPT_URL) {
    throw new Error("GOOGLE_SCRIPT_URL is not configured on the Worker");
  }
  const res = await fetchImpl(env.GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Google Drive script HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (data.success !== true) {
    throw new Error(String(data.error || "Google Drive upload failed"));
  }
  return data;
}
