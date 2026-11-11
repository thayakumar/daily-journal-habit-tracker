import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllData,
  isConfigured,
  saveSetting,
  saveWorkspace,
  type SheetData,
} from "../lib/sheets-api";
import {
  isWorkspace,
  readWorkspace,
  WORKSPACE_KEY,
  type Workspace,
} from "./model";

const CLOUD_KEY = "personalWorkspaceV1";
const ACK_KEY = "personal-workspace.cloud-ack.v2";
function remoteWorkspace(remote: SheetData): Workspace | null {
  const data: unknown =
    remote.storageSchemaVersion === 2
      ? remote.workspace
      : remote.settings[CLOUD_KEY]
        ? JSON.parse(remote.settings[CLOUD_KEY])
        : null;
  if (data === null) return null;
  if (!isWorkspace(data))
    throw new Error(
      "Saved planner has invalid data. Check the spreadsheet before syncing.",
    );
  return data;
}
function readAck(): { timestamp: number; revision: string } {
  try {
    return JSON.parse(
      localStorage.getItem(ACK_KEY) || '{"timestamp":0,"revision":""}',
    );
  } catch {
    return { timestamp: 0, revision: "" };
  }
}
export function useWorkspace() {
  const [data, setData] = useState(readWorkspace);
  const [status, setStatus] = useState("Saved on this device");
  const [ready, setReady] = useState(!isConfigured());
  const [tableStorage, setTableStorage] = useState(false);
  const latest = useRef(data);
  latest.current = data;
  const ack = useRef(readAck());
  const cloudTimestamp = useRef(0);
  const cloudRevision = useRef("");
  const tableMode = useRef(false);
  const saving = useRef(false);
  function acknowledge(timestamp: number, revision: string) {
    ack.current = { timestamp, revision };
    localStorage.setItem(ACK_KEY, JSON.stringify(ack.current));
  }
  function acceptRemote(remote: SheetData, force = false) {
    tableMode.current = remote.storageSchemaVersion === 2;
    setTableStorage(tableMode.current);
    cloudRevision.current = remote.workspaceRevision || "";
    const parsed = remoteWorkspace(remote);
    if (parsed) {
      cloudTimestamp.current = parsed.updatedAt;
      const dirty = latest.current.updatedAt > ack.current.timestamp;
      if (
        tableMode.current &&
        dirty &&
        ack.current.revision &&
        ack.current.revision !== cloudRevision.current &&
        !force
      )
        throw new Error(
          "Sheet data changed while this device had unsynced edits. Export a backup, then load the latest Sheet tables.",
        );
      if (force || !dirty || parsed.updatedAt > latest.current.updatedAt) {
        setData(parsed);
        acknowledge(parsed.updatedAt, cloudRevision.current);
      }
    }
    setStatus(
      tableMode.current
        ? "Connected to per-page Sheet tables"
        : "Legacy cloud storage · update Apps Script for per-page tables",
    );
    setReady(true);
  }
  const update = useCallback((change: (previous: Workspace) => Workspace) => {
    setData((previous) => ({
      ...change(previous),
      updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
    }));
  }, []);
  useEffect(() => {
    if (!isConfigured()) return;
    let cancelled = false;
    setStatus("Checking saved planner…");
    fetchAllData()
      .then((remote) => {
        if (!cancelled) acceptRemote(remote);
      })
      .catch((error) => {
        if (!cancelled)
          setStatus(
            `Device saved · ${error instanceof Error ? error.message : "cloud unavailable"}`,
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!data.updatedAt) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
    } catch {
      setStatus("Device storage full · export a backup");
      return;
    }
    if (!isConfigured()) {
      setStatus("Saved on this device");
      return;
    }
    if (!ready || data.updatedAt <= cloudTimestamp.current) return;
    setStatus("Device saved · syncing planner…");
    const timer = setTimeout(() => {
      void sync();
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, ready]);
  async function sync() {
    if (saving.current || !isConfigured()) return;
    saving.current = true;
    try {
      if (!ready) {
        acceptRemote(await fetchAllData());
        return;
      }
      let next = latest.current;
      while (next.updatedAt > cloudTimestamp.current) {
        if (tableMode.current) {
          cloudRevision.current = await saveWorkspace(
            next,
            cloudRevision.current,
          );
        } else {
          const payload = JSON.stringify(next);
          if (payload.length > 45000)
            throw new Error(
              "legacy Sheet cell limit reached; update Apps Script for table storage",
            );
          await saveSetting(CLOUD_KEY, payload);
        }
        cloudTimestamp.current = next.updatedAt;
        acknowledge(next.updatedAt, cloudRevision.current);
        next = latest.current;
      }
      setStatus(
        tableMode.current
          ? "Saved to per-page Sheet tables"
          : "Saved to legacy JSON · update Apps Script for per-page tables",
      );
    } catch (error) {
      setStatus(
        `Device saved · ${error instanceof Error ? error.message : "cloud sync failed; retry"}`,
      );
    } finally {
      saving.current = false;
    }
  }
  async function reloadCloud() {
    try {
      acceptRemote(await fetchAllData(), true);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not load Sheet tables",
      );
    }
  }
  return { data, update, status, retrySync: sync, reloadCloud, tableStorage };
}
