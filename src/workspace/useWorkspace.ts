import { emptyPlanning, isFinancePlanning } from "../finance/planning";
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
const PLAN_PENDING_KEY = "personal-workspace.finance-planning-pending.v1";
const FINANCE_PENDING_KEY = "personal-workspace.finance-pending.v1";
const VOCAB_PENDING_KEY = "personal-workspace.vocabulary-pending.v1";
const LOG_PENDING_KEY = "personal-workspace.logs-pending.v1";
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
  const [logStorageReady, setLogStorageReady] = useState(false);
  const logSupport = useRef(false);
  const planningSupport = useRef(false);
  const [planningStorageReady, setPlanningStorageReady] = useState(false);
  const financeSupport = useRef(false);
  const [financeStorageReady, setFinanceStorageReady] = useState(false);
  const vocabularySupport = useRef(false);
  const [vocabularyStorageReady, setVocabularyStorageReady] = useState(false);
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
    logSupport.current =
      remote.features?.workoutSets === true &&
      remote.features?.recurringChecks === true;
    setLogStorageReady(logSupport.current);
    planningSupport.current = remote.features?.financePlanning === true;
    setPlanningStorageReady(planningSupport.current);
    financeSupport.current = remote.features?.finance === true;
    setFinanceStorageReady(financeSupport.current);
    vocabularySupport.current = remote.features?.vocabulary === true;
    setVocabularyStorageReady(vocabularySupport.current);
    let parsed = remoteWorkspace(remote);
    const cloudDate = parsed?.updatedAt ?? 0;
    const pendingLogs = localStorage.getItem(LOG_PENDING_KEY) === "true";
    const pendingPlan = localStorage.getItem(PLAN_PENDING_KEY) === "true";
    if (parsed && !planningSupport.current && !force)
      parsed = {
        ...parsed,
        financePlanning: latest.current.financePlanning ?? emptyPlanning(),
      };
    const pendingFinance = localStorage.getItem(FINANCE_PENDING_KEY) === "true";
    if (parsed && !financeSupport.current && !force)
      parsed = {
        ...parsed,
        financeExpenses: latest.current.financeExpenses ?? [],
      };
    const pendingVocabulary =
      localStorage.getItem(VOCAB_PENDING_KEY) === "true";
    if (parsed && !vocabularySupport.current && !force)
      parsed = { ...parsed, vocabulary: latest.current.vocabulary ?? [] };
    if (parsed && !logSupport.current && !force) {
      parsed = {
        ...parsed,
        workoutSets: latest.current.workoutSets ?? [],
        recurringChecks: latest.current.recurringChecks ?? [],
      };
    }
    if (
      parsed &&
      ((logSupport.current && pendingLogs) ||
        (vocabularySupport.current && pendingVocabulary) ||
        (financeSupport.current && pendingFinance) ||
        (planningSupport.current && pendingPlan)) &&
      !force
    ) {
      const merge = <T extends { id: string }>(
        remoteRows: T[],
        localRows: T[],
      ) => [
        ...new Map(
          [...remoteRows, ...localRows].map((r) => [r.id, r]),
        ).values(),
      ];
      parsed = {
        ...parsed,
        workoutSets:
          logSupport.current && pendingLogs
            ? merge(parsed.workoutSets ?? [], latest.current.workoutSets ?? [])
            : parsed.workoutSets,
        recurringChecks:
          logSupport.current && pendingLogs
            ? merge(
                parsed.recurringChecks ?? [],
                latest.current.recurringChecks ?? [],
              )
            : parsed.recurringChecks,
        financePlanning:
          planningSupport.current && pendingPlan
            ? {
                defaultStartDay:
                  latest.current.financePlanning?.defaultStartDay ?? 27,
                cycles: merge(
                  parsed.financePlanning?.cycles ?? [],
                  latest.current.financePlanning?.cycles ?? [],
                ),
                rows: merge(
                  parsed.financePlanning?.rows ?? [],
                  latest.current.financePlanning?.rows ?? [],
                ),
              }
            : parsed.financePlanning,
        financeExpenses:
          financeSupport.current && pendingFinance
            ? merge(
                parsed.financeExpenses ?? [],
                latest.current.financeExpenses ?? [],
              )
            : parsed.financeExpenses,
        vocabulary:
          vocabularySupport.current && pendingVocabulary
            ? merge(parsed.vocabulary ?? [], latest.current.vocabulary ?? [])
            : parsed.vocabulary,
        updatedAt: Math.max(
          Date.now(),
          latest.current.updatedAt + 1,
          cloudDate + 1,
        ),
      };
      if (parsed.financePlanning && !isFinancePlanning(parsed.financePlanning))
        throw new Error(
          "Monthly plans conflict with the Sheet. Export a backup before loading the latest tables.",
        );
      cloudTimestamp.current = cloudDate;
      setData(parsed);
      setReady(true);
      setStatus("Uploading device records…");
      return;
    }
    if (parsed) {
      cloudTimestamp.current = cloudDate;
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
      if (
        !planningSupport.current &&
        data.financePlanning &&
        (data.financePlanning.defaultStartDay !== 27 ||
          data.financePlanning.cycles.length ||
          data.financePlanning.rows.length)
      )
        localStorage.setItem(PLAN_PENDING_KEY, "true");
      if (!financeSupport.current && (data.financeExpenses?.length ?? 0) > 0)
        localStorage.setItem(FINANCE_PENDING_KEY, "true");
      if (!vocabularySupport.current && (data.vocabulary?.length ?? 0) > 0)
        localStorage.setItem(VOCAB_PENDING_KEY, "true");
      if (
        !logSupport.current &&
        ((data.workoutSets?.length ?? 0) > 0 ||
          (data.recurringChecks?.length ?? 0) > 0)
      )
        localStorage.setItem(LOG_PENDING_KEY, "true");
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
        if (planningSupport.current) localStorage.removeItem(PLAN_PENDING_KEY);
        if (financeSupport.current)
          localStorage.removeItem(FINANCE_PENDING_KEY);
        if (logSupport.current) localStorage.removeItem(LOG_PENDING_KEY);
        if (vocabularySupport.current)
          localStorage.removeItem(VOCAB_PENDING_KEY);
        next = latest.current;
      }
      setStatus(
        !planningSupport.current &&
          localStorage.getItem(PLAN_PENDING_KEY) === "true"
          ? "Monthly plans saved on this device · connection update needed"
          : !financeSupport.current &&
              (latest.current.financeExpenses?.length ?? 0) > 0
            ? "Finance saved on this device · connection update needed"
            : !vocabularySupport.current &&
                (latest.current.vocabulary?.length ?? 0) > 0
              ? "Vocabulary saved on this device · connection update needed"
              : tableMode.current
                ? logSupport.current ||
                  !(
                    (latest.current.workoutSets?.length ?? 0) +
                    (latest.current.recurringChecks?.length ?? 0)
                  )
                  ? "Saved to per-page Sheet tables"
                  : "Workout and routine history saved locally · deploy the updated Apps Script"
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
  return {
    data,
    update,
    status,
    retrySync: sync,
    reloadCloud,
    tableStorage,
    logStorageReady,
    vocabularyStorageReady,
    financeStorageReady,
    planningStorageReady,
  };
}
