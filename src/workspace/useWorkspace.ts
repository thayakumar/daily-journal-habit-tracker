import { emptySkincare } from "../skincare/model";
import { emptyPortfolio, isFinancePortfolio } from "../finance/portfolio-model";
import { emptyPlanning, isFinancePlanning } from "../finance/planning";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllData,
  isConfigured,
  saveSetting,
  saveWorkspace,
  ScriptError,
  type SheetData,
} from "../lib/sheets-api";
import {
  diagnoseWorkspace,
  isWorkspace,
  readWorkspace,
  repairWorkspace,
  WORKSPACE_KEY,
  type Workspace,
} from "./model";
import { mergeWorkspaces, workspaceContentEqual } from "./merge";

export type SyncState = "local" | "syncing" | "synced" | "offline" | "error";

const VEHICLE_PENDING_KEY = "personal-workspace.vehicles-pending.v1";
const SKIN_PENDING_KEY = "personal-workspace.skincare-pending.v1";
const CLOUD_KEY = "personalWorkspaceV1";
const PORTFOLIO_PENDING_KEY = "personal-workspace.portfolio-pending.v1";
const PLAN_PENDING_KEY = "personal-workspace.finance-planning-pending.v1";
const FINANCE_PENDING_KEY = "personal-workspace.finance-pending.v1";
const VOCAB_PENDING_KEY = "personal-workspace.vocabulary-pending.v1";
const LOG_PENDING_KEY = "personal-workspace.logs-pending.v1";
const ACK_KEY = "personal-workspace.cloud-ack.v2";
const BASE_KEY = "personal-workspace.base.v1";

function remoteWorkspace(remote: SheetData): {
  workspace: Workspace | null;
  warnings: string[];
} {
  const data: unknown =
    remote.storageSchemaVersion === 2
      ? remote.workspace
      : remote.settings[CLOUD_KEY]
        ? JSON.parse(remote.settings[CLOUD_KEY])
        : null;
  if (data === null) return { workspace: null, warnings: [] };
  if (isWorkspace(data)) return { workspace: data, warnings: [] };
  const repaired = repairWorkspace(data);
  if (repaired) return repaired;
  const issues = diagnoseWorkspace(data);
  throw new Error(
    `Saved planner has invalid data (${issues.join(", ")}). Check the spreadsheet before syncing.`,
  );
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

function readBase(): Workspace | null {
  try {
    const raw = localStorage.getItem(BASE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWorkspace(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeBase(workspace: Workspace) {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(workspace));
  } catch {
    /* Non-critical if storage is near quota. */
  }
}

function isConflictError(error: unknown): boolean {
  if (error instanceof ScriptError && error.code === "CONFLICT") return true;
  if (error instanceof Error) {
    return /CONFLICT|Sheet data changed/i.test(error.message);
  }
  return false;
}

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return true;
  if (error instanceof Error) {
    return /Failed to fetch|NetworkError|Load failed|offline|network/i.test(
      error.message,
    );
  }
  return false;
}

export function useWorkspace() {
  const [data, setData] = useState(readWorkspace);
  const [initialLoading, setInitialLoading] = useState(isConfigured());
  const [status, setStatus] = useState("Saved on this device");
  const [syncState, setSyncState] = useState<SyncState>(
    isConfigured() ? "syncing" : "local",
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
  const [ready, setReady] = useState(!isConfigured());
  const [tableStorage, setTableStorage] = useState(false);
  const [logStorageReady, setLogStorageReady] = useState(false);
  const skinSupport = useRef(false);
  const [skincareStorageReady, setSkincareStorageReady] = useState(false);
  const [skincarePhotosReady, setSkincarePhotosReady] = useState(false);
  const vehicleSupport = useRef(false);
  const [vehicleStorageReady, setVehicleStorageReady] = useState(false);
  const [migrationReady, setMigrationReady] = useState(false);
  const logSupport = useRef(false);
  const portfolioSupport = useRef(false);
  const timelineSupport = useRef(false);
  const [portfolioStorageReady, setPortfolioStorageReady] = useState(false);
  const planningSupport = useRef(false);
  const [planningStorageReady, setPlanningStorageReady] = useState(false);
  const financeSupport = useRef(false);
  const [financeStorageReady, setFinanceStorageReady] = useState(false);
  const vocabularySupport = useRef(false);
  const [vocabularyStorageReady, setVocabularyStorageReady] = useState(false);
  const latest = useRef(data);
  latest.current = data;
  const baseRef = useRef<Workspace | null>(readBase());
  const ack = useRef(readAck());
  const cloudTimestamp = useRef(0);
  const cloudRevision = useRef("");
  const tableMode = useRef(false);
  const saving = useRef(false);
  const pulling = useRef(false);
  const lastPullAt = useRef(0);

  function acknowledge(
    timestamp: number,
    revision: string,
    syncedSnapshot?: Workspace,
  ) {
    ack.current = { timestamp, revision };
    try {
      localStorage.setItem(ACK_KEY, JSON.stringify(ack.current));
    } catch {
      /* Ignore storage quota errors for metadata. */
    }
    if (syncedSnapshot) {
      baseRef.current = syncedSnapshot;
      writeBase(syncedSnapshot);
    }
    setLastSyncedAt(Date.now());
  }

  function applyFeatureDefaults(
    parsed: Workspace,
    force: boolean,
  ): {
    workspace: Workspace;
    hasFeatureUpgradeMerge: boolean;
  } {
    const pendingSkin = localStorage.getItem(SKIN_PENDING_KEY) === "true";
    if (!skinSupport.current && !force)
      parsed = {
        ...parsed,
        skincare: latest.current.skincare ?? emptySkincare(),
      };
    const pendingVehicles =
      localStorage.getItem(VEHICLE_PENDING_KEY) === "true";
    if (!vehicleSupport.current && !force)
      parsed = {
        ...parsed,
        vehicles: latest.current.vehicles ?? [],
        vehicleServices: latest.current.vehicleServices ?? [],
      };
    const pendingLogs = localStorage.getItem(LOG_PENDING_KEY) === "true";
    const pendingPortfolio =
      localStorage.getItem(PORTFOLIO_PENDING_KEY) === "true";
    if (
      (!portfolioSupport.current ||
        (!timelineSupport.current && pendingPortfolio)) &&
      !force
    )
      parsed = {
        ...parsed,
        financePortfolio: latest.current.financePortfolio ?? emptyPortfolio(),
      };
    const pendingPlan = localStorage.getItem(PLAN_PENDING_KEY) === "true";
    if (!planningSupport.current && !force)
      parsed = {
        ...parsed,
        financePlanning: latest.current.financePlanning ?? emptyPlanning(),
      };
    const pendingFinance = localStorage.getItem(FINANCE_PENDING_KEY) === "true";
    if (!financeSupport.current && !force)
      parsed = {
        ...parsed,
        financeExpenses: latest.current.financeExpenses ?? [],
      };
    const pendingVocabulary =
      localStorage.getItem(VOCAB_PENDING_KEY) === "true";
    if (!vocabularySupport.current && !force)
      parsed = { ...parsed, vocabulary: latest.current.vocabulary ?? [] };
    if (!logSupport.current && !force) {
      parsed = {
        ...parsed,
        workoutSets: latest.current.workoutSets ?? [],
        recurringChecks: latest.current.recurringChecks ?? [],
      };
    }

    const hasFeatureUpgradeMerge =
      !force &&
      ((skinSupport.current && pendingSkin) ||
        (vehicleSupport.current && pendingVehicles) ||
        (logSupport.current && pendingLogs) ||
        (vocabularySupport.current && pendingVocabulary) ||
        (financeSupport.current && pendingFinance) ||
        (planningSupport.current && pendingPlan) ||
        (portfolioSupport.current &&
          timelineSupport.current &&
          pendingPortfolio));

    if (hasFeatureUpgradeMerge) {
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
        skincare:
          skinSupport.current && pendingSkin
            ? (Object.fromEntries(
                Object.keys(emptySkincare()).map((key) => [
                  key,
                  merge<{ id: string }>(
                    (parsed.skincare ?? emptySkincare())[
                      key as keyof ReturnType<typeof emptySkincare>
                    ],
                    (latest.current.skincare ?? emptySkincare())[
                      key as keyof ReturnType<typeof emptySkincare>
                    ],
                  ),
                ]),
              ) as unknown as ReturnType<typeof emptySkincare>)
            : parsed.skincare,
        vehicles:
          vehicleSupport.current && pendingVehicles
            ? merge(parsed.vehicles ?? [], latest.current.vehicles ?? [])
            : parsed.vehicles,
        vehicleServices:
          vehicleSupport.current && pendingVehicles
            ? merge(
                parsed.vehicleServices ?? [],
                latest.current.vehicleServices ?? [],
              )
            : parsed.vehicleServices,
        financePortfolio:
          portfolioSupport.current &&
          timelineSupport.current &&
          pendingPortfolio
            ? (Object.fromEntries(
                Object.keys(emptyPortfolio()).map((key) => [
                  key,
                  merge<{ id: string }>(
                    (parsed.financePortfolio ?? emptyPortfolio())[
                      key as keyof ReturnType<typeof emptyPortfolio>
                    ],
                    (latest.current.financePortfolio ?? emptyPortfolio())[
                      key as keyof ReturnType<typeof emptyPortfolio>
                    ],
                  ),
                ]),
              ) as unknown as ReturnType<typeof emptyPortfolio>)
            : parsed.financePortfolio,
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
          (parsed.updatedAt ?? 0) + 1,
        ),
      };
      if (!isWorkspace(parsed))
        throw new Error(
          "Device records conflict with the Sheet. Export a backup before loading the latest tables.",
        );
      if (
        parsed.financePortfolio &&
        !isFinancePortfolio(parsed.financePortfolio)
      )
        throw new Error(
          "Portfolio records conflict with the Sheet. Export a backup before loading the latest tables.",
        );
      if (parsed.financePlanning && !isFinancePlanning(parsed.financePlanning))
        throw new Error(
          "Monthly plans conflict with the Sheet. Export a backup before loading the latest tables.",
        );
    }
    return { workspace: parsed, hasFeatureUpgradeMerge };
  }

  function acceptRemote(remote: SheetData, force = false) {
    tableMode.current = remote.storageSchemaVersion === 2;
    setTableStorage(tableMode.current);
    cloudRevision.current = remote.workspaceRevision || "";
    logSupport.current =
      remote.features?.workoutSets === true &&
      remote.features?.recurringChecks === true;
    setLogStorageReady(logSupport.current);
    portfolioSupport.current = remote.features?.financePortfolio === true;
    timelineSupport.current = remote.features?.portfolioTimeline === true;
    setPortfolioStorageReady(
      portfolioSupport.current && timelineSupport.current,
    );
    planningSupport.current = remote.features?.financePlanning === true;
    setPlanningStorageReady(planningSupport.current);
    financeSupport.current = remote.features?.finance === true;
    setFinanceStorageReady(financeSupport.current);
    vocabularySupport.current = remote.features?.vocabulary === true;
    setVocabularyStorageReady(vocabularySupport.current);
    setMigrationReady(remote.features?.legacyBudgetImport === true);
    vehicleSupport.current = remote.features?.vehicles === true;
    setVehicleStorageReady(vehicleSupport.current);
    skinSupport.current = remote.features?.skincare === true;
    setSkincareStorageReady(skinSupport.current);
    setSkincarePhotosReady(remote.features?.skincareDirectPhotos === true);

    const { workspace: rawParsed, warnings } = remoteWorkspace(remote);
    if (rawParsed) {
      const cloudDate = rawParsed.updatedAt ?? 0;
      const { workspace: parsed, hasFeatureUpgradeMerge } = applyFeatureDefaults(
        rawParsed,
        force,
      );
      if (hasFeatureUpgradeMerge) {
        cloudTimestamp.current = cloudDate;
        baseRef.current = rawParsed;
        writeBase(rawParsed);
        latest.current = parsed;
        setData(parsed);
        setReady(true);
        setSyncState("syncing");
        setSyncError(null);
        setStatus("Uploading device records…");
        return;
      }

      cloudTimestamp.current = cloudDate;
      const dirty = latest.current.updatedAt > ack.current.timestamp;
      if (force || !dirty) {
        latest.current = parsed;
        setData(parsed);
        acknowledge(parsed.updatedAt, cloudRevision.current, rawParsed);
        setSyncState("synced");
        setSyncError(null);
        setStatus(
          warnings.length
            ? `Connected · repaired ${warnings.join(", ")} rows`
            : tableMode.current
              ? "Connected to per-page Sheet tables"
              : "Legacy cloud storage · update Apps Script for per-page tables",
        );
        setReady(true);
        return;
      }

      // Device has unsynced edits: perform a 3-way merge against the last synced base so neither device loses edits.
      const merged = mergeWorkspaces(baseRef.current, latest.current, parsed);
      const safeMerged = isWorkspace(merged)
        ? merged
        : (repairWorkspace(merged)?.workspace ?? merged);
      baseRef.current = rawParsed;
      writeBase(rawParsed);

      if (workspaceContentEqual(safeMerged, parsed)) {
        latest.current = parsed;
        setData(parsed);
        acknowledge(parsed.updatedAt, cloudRevision.current, rawParsed);
        setSyncState("synced");
        setSyncError(null);
        setStatus(
          tableMode.current
            ? "Connected to per-page Sheet tables"
            : "Legacy cloud storage · update Apps Script for per-page tables",
        );
      } else {
        latest.current = safeMerged;
        setData(safeMerged);
        setSyncState("syncing");
        setSyncError(null);
        setStatus("Merged changes from both devices · syncing…");
      }
      setReady(true);
      return;
    }

    setSyncState("synced");
    setSyncError(null);
    setStatus(
      tableMode.current
        ? "Connected to per-page Sheet tables"
        : "Legacy cloud storage · update Apps Script for per-page tables",
    );
    setReady(true);
  }

  const update = useCallback((change: (previous: Workspace) => Workspace) => {
    setData((previous) => {
      const next = {
        ...change(previous),
        updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
      };
      latest.current = next;
      return next;
    });
  }, []);

  const pullCloud = useCallback(
    async (reason: "mount" | "visible" | "focus" | "online" | "manual") => {
      if (!isConfigured() || saving.current || pulling.current) return;
      if (
        (reason === "visible" || reason === "focus") &&
        Date.now() - lastPullAt.current < 8000
      ) {
        return;
      }
      pulling.current = true;
      lastPullAt.current = Date.now();
      if (reason === "mount") {
        setStatus("Checking saved planner…");
        setSyncState("syncing");
      }
      try {
        const remote = await fetchAllData();
        acceptRemote(remote, false);
      } catch (error) {
        const offline = isOfflineError(error);
        const msg =
          error instanceof Error ? error.message : "cloud unavailable";
        setSyncState(offline ? "offline" : "error");
        setSyncError(offline ? "Offline · saved on this device" : msg);
        setStatus(`Device saved · ${msg}`);
      } finally {
        pulling.current = false;
        if (reason === "mount") setInitialLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isConfigured()) return;
    void pullCloud("mount");
  }, [pullCloud]);

  useEffect(() => {
    if (!isConfigured() || typeof window === "undefined") return;
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void pullCloud("visible");
      }
    };
    const onFocus = () => {
      void pullCloud("focus");
    };
    const onOnline = () => {
      void pullCloud("online");
    };
    const onOffline = () => {
      setSyncState("offline");
      setSyncError("Offline · changes are saved on this device");
      setStatus("Offline · saved on this device");
    };
    const canDoc =
      typeof document !== "undefined" &&
      typeof document.addEventListener === "function";
    const canWin = typeof window.addEventListener === "function";
    if (canDoc) document.addEventListener("visibilitychange", onVisible);
    if (canWin) {
      window.addEventListener("focus", onFocus);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }
    return () => {
      if (canDoc) document.removeEventListener("visibilitychange", onVisible);
      if (canWin) {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      }
    };
  }, [pullCloud]);

  useEffect(() => {
    if (!data.updatedAt) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
      if (
        !skinSupport.current &&
        data.skincare &&
        Object.values(data.skincare).some((rows) => rows.length)
      )
        localStorage.setItem(SKIN_PENDING_KEY, "true");
      if (
        !vehicleSupport.current &&
        (data.vehicles?.length ?? 0) + (data.vehicleServices?.length ?? 0) > 0
      )
        localStorage.setItem(VEHICLE_PENDING_KEY, "true");
      if (
        (!portfolioSupport.current || !timelineSupport.current) &&
        data.financePortfolio &&
        Object.values(data.financePortfolio).some((rows) => rows.length)
      )
        localStorage.setItem(PORTFOLIO_PENDING_KEY, "true");
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
      setSyncState("error");
      setSyncError("Device storage full · export a backup");
      setStatus("Device storage full · export a backup");
      return;
    }
    if (!isConfigured()) {
      setSyncState("local");
      setSyncError(null);
      setStatus("Saved on this device");
      return;
    }
    if (!ready || data.updatedAt <= cloudTimestamp.current) return;
    setSyncState("syncing");
    setStatus("Device saved · syncing planner…");
    const timer = setTimeout(() => {
      void sync();
    }, 900);
    return () => clearTimeout(timer);
  }, [data, ready]);

  async function sync() {
    if (saving.current || !isConfigured()) return;
    saving.current = true;
    setSyncState("syncing");
    try {
      if (!ready) {
        acceptRemote(await fetchAllData(), false);
        if (!ready && latest.current.updatedAt <= cloudTimestamp.current) {
          return;
        }
      }
      let next = latest.current;
      let conflictAttempts = 0;
      while (next.updatedAt > cloudTimestamp.current) {
        if (tableMode.current) {
          const supported = { ...next };
          if (!timelineSupport.current) delete supported.financePortfolio;
          if (!skinSupport.current) delete supported.skincare;
          try {
            cloudRevision.current = await saveWorkspace(
              supported,
              cloudRevision.current,
            );
            conflictAttempts = 0;
          } catch (error) {
            if (isConflictError(error) && conflictAttempts < 3) {
              conflictAttempts++;
              setStatus("Merging updates from another device…");
              const fresh = await fetchAllData();
              cloudRevision.current = fresh.workspaceRevision || "";
              const { workspace: remoteW } = remoteWorkspace(fresh);
              if (remoteW) {
                const { workspace: adjustedRemote } = applyFeatureDefaults(
                  remoteW,
                  false,
                );
                const merged = mergeWorkspaces(
                  baseRef.current,
                  latest.current,
                  adjustedRemote,
                );
                const safeMerged = isWorkspace(merged)
                  ? merged
                  : (repairWorkspace(merged)?.workspace ?? merged);
                baseRef.current = remoteW;
                writeBase(remoteW);
                if (workspaceContentEqual(safeMerged, adjustedRemote)) {
                  latest.current = adjustedRemote;
                  setData(adjustedRemote);
                  cloudTimestamp.current = adjustedRemote.updatedAt;
                  acknowledge(
                    adjustedRemote.updatedAt,
                    cloudRevision.current,
                    remoteW,
                  );
                  next = latest.current;
                  continue;
                }
                latest.current = safeMerged;
                setData(safeMerged);
                try {
                  localStorage.setItem(
                    WORKSPACE_KEY,
                    JSON.stringify(safeMerged),
                  );
                } catch {
                  /* Ignore storage quota errors. */
                }
                next = safeMerged;
                continue;
              }
            }
            throw error;
          }
        } else {
          const payload = JSON.stringify(next);
          if (payload.length > 45000)
            throw new Error(
              "legacy Sheet cell limit reached; update Apps Script for table storage",
            );
          await saveSetting(CLOUD_KEY, payload);
        }
        cloudTimestamp.current = next.updatedAt;
        acknowledge(next.updatedAt, cloudRevision.current, next);
        if (skinSupport.current) localStorage.removeItem(SKIN_PENDING_KEY);
        if (vehicleSupport.current)
          localStorage.removeItem(VEHICLE_PENDING_KEY);
        if (portfolioSupport.current && timelineSupport.current)
          localStorage.removeItem(PORTFOLIO_PENDING_KEY);
        if (planningSupport.current) localStorage.removeItem(PLAN_PENDING_KEY);
        if (financeSupport.current)
          localStorage.removeItem(FINANCE_PENDING_KEY);
        if (logSupport.current) localStorage.removeItem(LOG_PENDING_KEY);
        if (vocabularySupport.current)
          localStorage.removeItem(VOCAB_PENDING_KEY);
        next = latest.current;
      }
      setSyncState("synced");
      setSyncError(null);
      setStatus(
        !skinSupport.current &&
          localStorage.getItem(SKIN_PENDING_KEY) === "true"
          ? "Skincare saved on this device · connection update needed"
          : !vehicleSupport.current &&
              localStorage.getItem(VEHICLE_PENDING_KEY) === "true"
            ? "Vehicles saved on this device · connection update needed"
            : (!portfolioSupport.current || !timelineSupport.current) &&
                localStorage.getItem(PORTFOLIO_PENDING_KEY) === "true"
              ? "Portfolio saved on this device · connection update needed"
              : !planningSupport.current &&
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
      const offline = isOfflineError(error);
      const msg =
        error instanceof Error ? error.message : "cloud sync failed; retry";
      setSyncState(offline ? "offline" : "error");
      setSyncError(offline ? "Offline · changes saved on this device" : msg);
      setStatus(`Device saved · ${msg}`);
    } finally {
      saving.current = false;
    }
  }

  async function reloadCloud() {
    setSyncState("syncing");
    try {
      acceptRemote(await fetchAllData(), true);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Could not load Sheet tables";
      setSyncState(isOfflineError(error) ? "offline" : "error");
      setSyncError(msg);
      setStatus(msg);
    }
  }

  return {
    data,
    initialLoading,
    update,
    status,
    syncState,
    syncError,
    lastSyncedAt,
    retrySync: sync,
    flushSync: sync,
    pullCloud: () => pullCloud("manual"),
    reloadCloud,
    tableStorage,
    logStorageReady,
    vocabularyStorageReady,
    financeStorageReady,
    planningStorageReady,
    portfolioStorageReady,
    vehicleStorageReady,
    skincareStorageReady,
    skincarePhotosReady,
    migrationReady,
  };
}
