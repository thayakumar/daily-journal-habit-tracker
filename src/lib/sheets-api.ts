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
}

function getScriptUrl(): string {
  return import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
}

async function postToScript(payload: Record<string, unknown>): Promise<void> {
  const url = getScriptUrl();
  if (!url) throw new Error('Google Script URL not configured');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Script returned ${response.status}`);
  }
}

export async function fetchAllData(): Promise<SheetData> {
  const url = getScriptUrl();
  if (!url) throw new Error('Google Script URL not configured');

  const response = await fetch(`${url}?action=getAll`, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  return response.json();
}

export async function saveEntries(entries: Row[]): Promise<void> {
  await postToScript({ action: 'saveEntries', data: entries });
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await postToScript({ action: 'saveHabits', data: habits });
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await postToScript({ action: 'saveSetting', key, value });
}

export async function addEntry(entry: Row): Promise<void> {
  await postToScript({ action: 'addEntry', data: entry });
}

export async function updateEntry(entry: Row): Promise<void> {
  await postToScript({ action: 'updateEntry', data: entry });
}

export async function deleteEntry(id: string): Promise<void> {
  await postToScript({ action: 'deleteEntry', id });
}

export function isConfigured(): boolean {
  const url = getScriptUrl();
  return !!url && url !== 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
}
