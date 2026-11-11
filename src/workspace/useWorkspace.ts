import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllData, isConfigured, saveSetting } from "../lib/sheets-api";
import {
  isWorkspace,
  readWorkspace,
  WORKSPACE_KEY,
  type Workspace,
} from "./model";

const CLOUD_KEY = "personalWorkspaceV1";
export function useWorkspace() {
  const [data, setData] = useState(readWorkspace);
  const [status, setStatus] = useState("Saved on this device");
  const [ready, setReady] = useState(!isConfigured());
  const latest = useRef(data);
  const cloudTimestamp = useRef(0);
  const saving = useRef(false);
  latest.current = data;
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
        if (cancelled) return;
        const raw = remote.settings[CLOUD_KEY];
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (!isWorkspace(parsed))
            throw new Error("Unsupported saved planner");
          cloudTimestamp.current = parsed.updatedAt;
          if (parsed.updatedAt > latest.current.updatedAt) setData(parsed);
        }
        setStatus("Planner connected");
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("Device saved · cloud unavailable");
        // Do not overwrite remote data when it could not be read. Retry explicitly.
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
    // sync reads latest.current; only one write is allowed at a time.
  }, [data, ready]);
  async function sync() {
    if (saving.current || !isConfigured()) return;
    saving.current = true;
    try {
      if (!ready) {
        const remote = await fetchAllData();
        const raw = remote.settings[CLOUD_KEY];
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (!isWorkspace(parsed))
            throw new Error("Unsupported saved planner");
          if (parsed.updatedAt > latest.current.updatedAt) {
            setData(parsed);
            cloudTimestamp.current = parsed.updatedAt;
            setReady(true);
            setStatus("Planner synced");
            return;
          }
        }
        setReady(true);
      }
      let next = latest.current;
      while (next.updatedAt > cloudTimestamp.current) {
        const payload = JSON.stringify(next);
        if (payload.length > 45_000) {
          setStatus(
            "Device saved · planner exceeds Sheet cell limit; export a backup",
          );
          return;
        }
        await saveSetting(CLOUD_KEY, payload);
        cloudTimestamp.current = next.updatedAt;
        next = latest.current;
      }
      setStatus("Planner synced to Sheets");
    } catch {
      setStatus("Device saved · cloud sync failed; retry");
    } finally {
      saving.current = false;
    }
  }
  return { data, update, status, retrySync: sync };
}
