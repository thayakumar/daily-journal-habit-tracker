import type { Workspace } from "../workspace/model";
export interface Habit {
  id: string;
  name: string;
  color: string;
  lightBg: string;
  ringColor: string;
}

export interface Row {
  id: string;
  dateStr: string;
  displayDate: string;
  dayName: string;
  sleepTime: string;
  exercise: string;
  morningFood: string;
  afternoonFood: string;
  dinnerFood: string;
  snack: string;
  tasks: string;
  habits: Record<string, boolean>;
}

export interface Settings {
  showTasksColumn: string;
  [key: string]: string;
}

export interface SheetData {
  entries: Row[];
  habits: Habit[];
  settings: Settings;
  storageSchemaVersion?: number;
  features?: {
    workoutSets?: boolean;
    recurringChecks?: boolean;
    vocabulary?: boolean;
    finance?: boolean;
    financePlanning?: boolean;
    financePortfolio?: boolean;
    portfolioTimeline?: boolean;
    vehicles?: boolean;
    skincare?: boolean;
    skincareDirectPhotos?: boolean;
    legacyBudgetImport?: boolean;
    atomicJournal?: boolean;
    fastBackend?: boolean;
    fastPoll?: boolean;
    sheetsImportReady?: boolean;
  };
  workspace?: Workspace;
  workspaceRevision?: string;
  journalRevision?: string;
}

export class ScriptError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ScriptError";
    this.code = code;
  }
}

export function getApiUrl(): string {
  return (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
    ""
  );
}

function getScriptUrl(): string {
  return getApiUrl();
}

async function postToScript(payload: Record<string, unknown>): Promise<{
  workspaceRevision?: string;
  receiptUrl?: string;
  receiptName?: string;
}> {
  const url = getScriptUrl();
  if (!url) throw new Error("Google Script URL not configured");

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new Error(`Save failed with status ${response.status}`);
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("success" in result) ||
    result.success !== true
  ) {
    const error =
      result && typeof result === "object" && "error" in result
        ? String(result.error)
        : "Google Sheet did not confirm the save";
    const code =
      result && typeof result === "object" && "code" in result && result.code
        ? String(result.code)
        : undefined;
    throw new ScriptError(error, code);
  }
  return result as {
    workspaceRevision?: string;
    receiptUrl?: string;
    receiptName?: string;
  };
}

export async function saveWorkspace(
  data: Workspace,
  baseRevision: string,
): Promise<string> {
  const result = await postToScript({
    action: "saveWorkspace",
    data,
    baseRevision,
  });
  if (!result.workspaceRevision)
    throw new Error("Missing spreadsheet revision");
  return result.workspaceRevision;
}

let pendingRead: Promise<SheetData> | null = null;
export async function fetchAllData(): Promise<SheetData> {
  if (pendingRead) return pendingRead;
  const url = getScriptUrl();
  if (!url) throw new Error("Google Script URL not configured");
  const request = (async () => {
    const sep = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${sep}action=getAll&_ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Fetch failed with status ${response.status}`);
    const data = await response.json();
    if (
      !Array.isArray(data.entries) ||
      !Array.isArray(data.habits) ||
      !data.settings
    )
      throw new Error(data.error || "Invalid spreadsheet response");
    return data as SheetData;
  })();
  pendingRead = request;
  try {
    return await request;
  } finally {
    if (pendingRead === request) pendingRead = null;
  }
}

export async function saveJournal(payload: {
  entries: Row[];
  habits: Habit[];
  showTasksColumn: boolean;
}): Promise<void> {
  await postToScript({
    action: "saveJournal",
    entries: payload.entries,
    habits: payload.habits,
    showTasksColumn: payload.showTasksColumn,
  });
}

export async function saveEntries(entries: Row[]): Promise<void> {
  await postToScript({ action: "saveEntries", data: entries });
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await postToScript({ action: "saveHabits", data: habits });
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await postToScript({ action: "saveSetting", key, value });
}

export async function addEntry(entry: Row): Promise<void> {
  await postToScript({ action: "addEntry", data: entry });
}

export async function updateEntry(entry: Row): Promise<void> {
  await postToScript({ action: "updateEntry", data: entry });
}

export async function deleteEntry(id: string): Promise<void> {
  await postToScript({ action: "deleteEntry", id });
}

export function isConfigured(): boolean {
  const url = getScriptUrl();
  return (
    !!url &&
    url !== "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
  );
}

export async function uploadFinanceReceipt(
  file: File,
): Promise<{ receiptUrl: string; receiptName: string }> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Receipts must be smaller than 10 MB.");
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    )
  )
    throw new Error("Use a PDF, JPG, PNG or WebP receipt.");
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the receipt."));
    reader.readAsDataURL(file);
  });
  const result = await postToScript({
    action: "uploadFinanceReceipt",
    fileBase64,
    fileName: file.name,
    fileMimeType: file.type,
  });
  if (!result.receiptUrl || !result.receiptName)
    throw new Error(
      "Receipt upload was not confirmed. Update the Apps Script connection.",
    );
  return { receiptUrl: result.receiptUrl, receiptName: result.receiptName };
}

export async function fetchLegacyBudget(): Promise<
  import("../finance/legacy-import").LegacyTab[]
> {
  const url = getScriptUrl();
  if (!url) throw new Error("Planner connection is not configured");
  const sep = url.includes("?") ? "&" : "?";
  const response = await fetch(
    `${url}${sep}action=previewBudgetImport&_ts=${Date.now()}`,
    { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.tabs))
    throw new Error(
      result.error || "Deploy the updated Apps Script to enable migration",
    );
  return result.tabs;
}

async function skincareRequest(payload: Record<string, unknown>) {
  const url = getScriptUrl();
  if (!url) throw Error("Planner connection is not configured");
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.success !== true)
    throw Error(data.error || "Skincare photo request failed");
  return data;
}
export async function uploadSkincarePhoto(input: {
  base64: string;
  mimeType: string;
  name: string;
  date: string;
  angle: import("../skincare/model").Angle;
}): Promise<import("../skincare/model").SkinPhoto> {
  const data = await skincareRequest({
    action: "uploadSkincarePhoto",
    fileBase64: input.base64,
    fileMimeType: input.mimeType,
    fileName: input.name,
    date: input.date,
    angle: input.angle,
  });
  if (!data.photo?.fileId) throw Error("Photo upload was not confirmed");
  return data.photo;
}
export async function requestSkincarePhoto(
  fileId: string,
): Promise<{ base64: string; mimeType: string }> {
  const data = await skincareRequest({
    action: "getSkincarePhoto",
    fileId,
  });
  if (
    !data.base64 ||
    !["image/jpeg", "image/png", "image/webp"].includes(data.mimeType)
  )
    throw Error("Invalid photo response");
  return data;
}

let pendingPoll: Promise<{
  workspaceRevision: string;
  journalRevision: string;
}> | null = null;

export async function pollRevisions(): Promise<{
  workspaceRevision: string;
  journalRevision: string;
}> {
  if (pendingPoll) return pendingPoll;
  const url = getScriptUrl();
  if (!url) throw new Error("API URL not configured");
  const request = (async () => {
    const sep = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${sep}action=poll&_ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Poll failed with status ${response.status}`);
    const data = (await response.json()) as {
      success?: boolean;
      workspaceRevision?: string;
      journalRevision?: string;
    };
    return {
      workspaceRevision: String(data.workspaceRevision || ""),
      journalRevision: String(data.journalRevision || ""),
    };
  })();
  pendingPoll = request;
  try {
    return await request;
  } finally {
    if (pendingPoll === request) pendingPoll = null;
  }
}

export async function importFromSheets(): Promise<{
  imported: { habits: number; entries: number; hasWorkspace: boolean };
  workspaceRevision: string;
  journalRevision: string;
}> {
  const url = getScriptUrl();
  if (!url) throw new Error("API URL not configured");
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ action: "importFromSheets" }),
  });
  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    imported?: { habits: number; entries: number; hasWorkspace: boolean };
    workspaceRevision?: string;
    journalRevision?: string;
  };
  if (!response.ok || data.success !== true || !data.imported) {
    throw new Error(data.error || "Could not import from Google Sheets");
  }
  return {
    imported: data.imported,
    workspaceRevision: String(data.workspaceRevision || ""),
    journalRevision: String(data.journalRevision || ""),
  };
}

