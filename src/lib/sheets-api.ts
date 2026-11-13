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
  };
  workspace?: Workspace;
  workspaceRevision?: string;
}

function getScriptUrl(): string {
  return import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";
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
    throw new Error(error);
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
    const response = await fetch(`${url}?action=getAll`);
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
