import { emptySkincare } from "../skincare/model";
import { emptyPortfolio, isFinancePortfolio } from "../finance/portfolio-model";
import { emptyPlanning, isFinancePlanning } from "../finance/planning";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllData,
  isConfigured,
  pollRevisions,
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

const CLOUD_KEY = "personalWorkspaceV1";
const ACK_KEY = "personal-workspace.cloud-ack.v2";
const BASE_KEY = "personal-workspace.base.v1";

interface FeatureSupport {
  skin: boolean;
  vehicle: boolean;
  portfolio: boolean;
  timeline: boolean;
  planning: boolean;
  finance: boolean;
  vocabulary: boolean;
  logs: boolean;
}

const DEFAULT_SUPPORT: FeatureSupport = {
  skin: false,
  vehicle: false,
  portfolio: false,
  timeline: false,
  planning: false,
  finance: false,
  vocabulary: false,
  logs: false,
};

function mergeById<T extends { id: string }>(remoteRows: T[], localRows: T[]) {
  return [
    ...new Map([...remoteRows, ...localRows].map((r) => [r.id, r])).values(),
  ];
}

function mergeRecordMap<T extends { [K in keyof T]: { id: string }[] }>(
  empty: () => T,
  remote: T | undefined,
  local: T | undefined,
): T {
  const base = empty();
  const rObj = remote ?? base;
  const lObj = local ?? base;
  return Object.fromEntries(
    (Object.keys(base) as (keyof T)[]).map((key) => [
      key,
      mergeById(rObj[key], lObj[key]),
    ]),
  ) as T;
}

interface FeatureGate {
  pendingKey: string;
  isSupported: (s: FeatureSupport) => boolean;
  shouldPreserveLocal: (s: FeatureSupport, pending: boolean) => boolean;
  hasLocalData: (w: Workspace) => boolean;
  preserveLocal: (remote: Workspace, local: Workspace) => Workspace;
  mergeUpgrade: (remote: Workspace, local: Workspace) => Workspace;
  pendingMessage: (w: Workspace, pending: boolean) => string | null;
}

const FEATURE_GATES: readonly FeatureGate[] = [
  {
    pendingKey: "personal-workspace.skincare-pending.v1",
    isSupported: (s) => s.skin,
    shouldPreserveLocal: (s) => !s.skin,
    hasLocalData: (w) =>
      !!w.skincare && Object.values(w.skincare).some((rows) => rows.length > 0),
    preserveLocal: (r, l) => ({
      ...r,
      skincare: l.skincare ?? emptySkincare(),
    }),
    mergeUpgrade: (r, l) => ({
      ...r,
      skincare: mergeRecordMap(emptySkincare, r.skincare, l.skincare),
    }),
    pendingMessage: (_w, pending) =>
      pending ? "Skincare saved on this device · connection update needed" : null,
  },
  {
    pendingKey: "personal-workspace.vehicles-pending.v1",
    isSupported: (s) => s.vehicle,
    shouldPreserveLocal: (s) => !s.vehicle,
    hasLocalData: (w) =>
      (w.vehicles?.length ?? 0) + (w.vehicleServices?.length ?? 0) > 0,
    preserveLocal: (r, l) => ({
      ...r,
      vehicles: l.vehicles ?? [],
      vehicleServices: l.vehicleServices ?? [],
    }),
    mergeUpgrade: (r, l) => ({
      ...r,
      vehicles: mergeById(r.vehicles ?? [], l.vehicles ?? []),
      vehicleServices: mergeById(
        r.vehicleServices ?? [],
        l.vehicleServices ?? [],
      ),
    }),
    pendingMessage: (_w, pending) =>
      pending ? "Vehicles saved on this device · connection update needed" : null,
  },
  {
    pendingKey: "personal-workspace.portfolio-pending.v1",
    isSupported: (s) => s.portfolio && s.timeline,
    shouldPreserveLocal: (s, pending) =>
      !s.portfolio || (!s.timeline && pending),
    hasLocalData: (w) =>
      !!w.financePortfolio &&
      Object.values(w.financePortfolio).some((rows) => rows.length > 0),
    preserveLocal: (r, l) => ({
      ...r,
      financePortfolio: l.financePortfolio ?? emptyPortfolio(),
    }),
    mergeUpgrade: (r, l) => ({
      ...r,
      financePortfolio: mergeRecordMap(
        emptyPortfolio,
        r.financePortfolio,
        l.financePortfolio,
      ),
    }),
    pendingMessage: (_w, pending) =>
      pending ? "Portfolio saved on this device · connection update needed" : null,
  },
  {
    pendingKey: "personal-workspace.finance-planning-pending.v1",
    isSupported: (s) => s.planning,
    shouldPreserveLocal: (s) => !s.planning,
    hasLocalData: (w) =>
      !!w.financePlanning &&
      (w.financePlanning.defaultStartDay !== 27 ||
        w.financePlanning.cycles.length > 0 ||
        w.financePlanning.rows.length > 0),
    preserveLocal: (r, l) => ({
      ...r,
      financePlanning: l.financePlanning ?? emptyPlanning(),
    }),
    mergeUpgrade: (r, l) => ({
      ...r,
      financePlanning: {
        defaultStartDay: l.financePlanning?.defaultStartDay ?? 27,
        cycles: mergeById(
          r.financePlanning?.cycles ?? [],
          l.financePlanning?.cycles ?? [],
        ),
        rows: mergeById(
          r.financePlanning?.rows ?? [],
          l.financePlanning?.rows ?? [],
        ),
      },
    }),
    pendingMessage: (_w, pending) =>
      pending
        ? "Monthly plans saved on this device · connection update needed"
        : null,
  },
  {
    pendingKey: "personal-workspace.finance-pending.v1",
    isSupported: (s) => s.finance,
    shouldPreserveLocal: (s) => !s.finance,
    hasLocalData: (w) => (w.financeExpenses?.length ?? 0) > 0,
    preserveLocal: (r, l) => ({
      ...r,
      financeExpenses: l.financeExpenses ?? [],
    }),
    mergeUpgrade: (r, l) => ({
      ...r,
      financeExpenses: mergeById(
        r.financeExpenses ?? [],
        l.financeExpenses ?? [],
      ),
    }),
    pendingMessage: (w) =>
      (w.financeExpenses?.length ?? 0) > 0
        ? "Finance saved on this device · connection update needed"
        : null,
  },
  {
    pendingKey: "personal-workspace.vocabulary-pending.v1",
    isSupported: (s) => s.vocabulary,
    shouldPreserveLocal: (s) => !s.vocabulary,
    hasLocalData: (w) => (w.vocabulary?.length ?? 0) > 0,
    preserveLocal: (r, l) => ({ ...r, vocabulary: l.vocabulary ?? [] }),
    mergeUpgrade: (r, l) => ({
      ...r,
      vocabulary: mergeById(r.vocabulary ?? [], l.vocabulary ?? []),
    }),
    pendingMessage: (w) =>
      (w.vocabulary?.length ?? 0) > 0
        ? "Vocabulary saved on this device · connection update needed"
        : null,
  },
  {
    pendingKey: "personal-workspace.logs-pending.v1",
    isSupported: (s) => s.logs,
    shouldPreserveLocal: (s) => !s.logs,
    hasLocalData: (w) =>
      (w.workoutSets?.length ?? 0) > 0 || (w.recurringChecks?.length ?? 0) > 0,
    preserveLocal: (r, l) => ({
      ...r,
      workoutSets: l.workoutSets ?? [],
      recurringChecks: l.recurringChecks ?? [],
    }),
    mergeUpgrade: (r, l) => ({
      ...r,
      workoutSets: mergeById(r.workoutSets ?? [], l.workoutSets ?? []),
      recurringChecks: mergeById(
        r.recurringChecks ?? [],
        l.recurringChecks ?? [],
      ),
    }),
    pendingMessage: () => null,
  },
];

function clearSupportedPendingFlags(support: FeatureSupport) {
  try {
    for (const gate of FEATURE_GATES) {
      if (gate.isSupported(support)) {
        localStorage.removeItem(gate.pendingKey);
      }
    }
  } catch {
    /* Ignore storage errors when clearing stale pending flags. */
  }
}

function markUnsupportedPendingFlags(data: Workspace, support: FeatureSupport) {
  for (const gate of FEATURE_GATES) {
    if (!gate.isSupported(support) && gate.hasLocalData(data)) {
      localStorage.setItem(gate.pendingKey, "true");
    }
  }
}

function syncedStatusMessage(
  data: Workspace,
  support: FeatureSupport,
  tableMode: boolean,
): string {
  for (const gate of FEATURE_GATES) {
    if (!gate.isSupported(support)) {
      const pending = localStorage.getItem(gate.pendingKey) === "true";
      const msg = gate.pendingMessage(data, pending);
      if (msg) return msg;
    }
  }
  if (!tableMode) {
    return "Saved to legacy JSON · update Apps Script for per-page tables";
  }
  if (
    !support.logs &&
    (data.workoutSets?.length ?? 0) + (data.recurringChecks?.length ?? 0) > 0
  ) {
    return "Workout and routine history saved locally · deploy the updated Apps Script";
  }
  return "Saved to per-page Sheet tables";
}

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
  const [initialLoading, setInitialLoading] = useState(() => isConfigured());
  const [status, setStatus] = useState("Saved on this device");
  const [syncState, setSyncState] = useState<SyncState>(() =>
    isConfigured() ? "syncing" : "local",
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
  const [ready, setReady] = useState(() => !isConfigured());
  const [tableStorage, setTableStorage] = useState(false);
  const [logStorageReady, setLogStorageReady] = useState(false);
  const [skincareStorageReady, setSkincareStorageReady] = useState(false);
  const [skincarePhotosReady, setSkincarePhotosReady] = useState(false);
  const [vehicleStorageReady, setVehicleStorageReady] = useState(false);
  const [migrationReady, setMigrationReady] = useState(false);
  const [fastBackend, setFastBackend] = useState(false);
  const [fastPoll, setFastPoll] = useState(false);
  const [sheetsImportReady, setSheetsImportReady] = useState(false);
  const [portfolioStorageReady, setPortfolioStorageReady] = useState(false);
  const [planningStorageReady, setPlanningStorageReady] = useState(false);
  const [financeStorageReady, setFinanceStorageReady] = useState(false);
  const [vocabularyStorageReady, setVocabularyStorageReady] = useState(false);

  const [initialBase] = useState(readBase);
  const [initialAck] = useState(readAck);
  const support = useRef<FeatureSupport>({ ...DEFAULT_SUPPORT });
  const latest = useRef(data);
  const baseRef = useRef<Workspace | null>(initialBase);
  const ack = useRef(initialAck);
  const cloudTimestamp = useRef(0);
  const cloudRevision = useRef("");
  const tableMode = useRef(false);
  const saving = useRef(false);
  const pulling = useRef(false);
  const lastPullAt = useRef(0);
  const readyRef = useRef(ready);

  useEffect(() => {
    latest.current = data;
  }, [data]);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const acknowledge = useCallback(
    (timestamp: number, revision: string, syncedSnapshot?: Workspace) => {
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
    },
    [],
  );

  const applyFeatureDefaults = useCallback(
    (
      remoteInput: Workspace,
      force: boolean,
    ): {
      workspace: Workspace;
      hasFeatureUpgradeMerge: boolean;
    } => {
      const s = support.current;
      const local = latest.current;
      let parsed = remoteInput;
      const pendingMap = new Map<string, boolean>();
      let hasFeatureUpgradeMerge = false;

      for (const gate of FEATURE_GATES) {
        const pending = localStorage.getItem(gate.pendingKey) === "true";
        pendingMap.set(gate.pendingKey, pending);
        if (!force && gate.shouldPreserveLocal(s, pending)) {
          parsed = gate.preserveLocal(parsed, local);
        }
        if (!force && gate.isSupported(s) && pending) {
          hasFeatureUpgradeMerge = true;
        }
      }

      if (hasFeatureUpgradeMerge) {
        for (const gate of FEATURE_GATES) {
          if (gate.isSupported(s) && pendingMap.get(gate.pendingKey)) {
            parsed = gate.mergeUpgrade(parsed, local);
          }
        }
        parsed = {
          ...parsed,
          updatedAt: Math.max(
            Date.now(),
            local.updatedAt + 1,
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
    },
    [],
  );

  const acceptRemote = useCallback(
    (remote: SheetData, force = false) => {
      tableMode.current = remote.storageSchemaVersion === 2;
      setTableStorage(tableMode.current);
      cloudRevision.current = remote.workspaceRevision || "";

      const nextSupport: FeatureSupport = {
        logs:
          remote.features?.workoutSets === true &&
          remote.features?.recurringChecks === true,
        portfolio: remote.features?.financePortfolio === true,
        timeline: remote.features?.portfolioTimeline === true,
        planning: remote.features?.financePlanning === true,
        finance: remote.features?.finance === true,
        vocabulary: remote.features?.vocabulary === true,
        vehicle: remote.features?.vehicles === true,
        skin: remote.features?.skincare === true,
      };
      support.current = nextSupport;
      setLogStorageReady(nextSupport.logs);
      setPortfolioStorageReady(nextSupport.portfolio && nextSupport.timeline);
      setPlanningStorageReady(nextSupport.planning);
      setFinanceStorageReady(nextSupport.finance);
      setVocabularyStorageReady(nextSupport.vocabulary);
      setMigrationReady(remote.features?.legacyBudgetImport === true);
      setVehicleStorageReady(nextSupport.vehicle);
      setSkincareStorageReady(nextSupport.skin);
      setSkincarePhotosReady(remote.features?.skincareDirectPhotos === true);
      setFastBackend(remote.features?.fastBackend === true);
      setFastPoll(remote.features?.fastPoll === true);
      setSheetsImportReady(remote.features?.sheetsImportReady === true);

      const { workspace: rawParsed, warnings } = remoteWorkspace(remote);
      const connectedStatus = warnings.length
        ? `Connected · repaired ${warnings.join(", ")} rows`
        : tableMode.current
          ? "Connected to per-page Sheet tables"
          : "Legacy cloud storage · update Apps Script for per-page tables";

      if (rawParsed) {
        const cloudDate = rawParsed.updatedAt ?? 0;
        const { workspace: parsed, hasFeatureUpgradeMerge } =
          applyFeatureDefaults(rawParsed, force);
        if (hasFeatureUpgradeMerge) {
          if (workspaceContentEqual(parsed, rawParsed)) {
            clearSupportedPendingFlags(nextSupport);
            cloudTimestamp.current = cloudDate;
            latest.current = rawParsed;
            setData(rawParsed);
            acknowledge(rawParsed.updatedAt, cloudRevision.current, rawParsed);
            setSyncState("synced");
            setSyncError(null);
            setStatus(connectedStatus);
            readyRef.current = true;
            setReady(true);
            return;
          }
          cloudTimestamp.current = cloudDate;
          baseRef.current = rawParsed;
          writeBase(rawParsed);
          latest.current = parsed;
          setData(parsed);
          readyRef.current = true;
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
          setStatus(connectedStatus);
          readyRef.current = true;
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
        readyRef.current = true;
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
      readyRef.current = true;
      setReady(true);
    },
    [acknowledge, applyFeatureDefaults],
  );

  const update = useCallback((change: (previous: Workspace) => Workspace) => {
    const previous = latest.current;
    const next = {
      ...change(previous),
      updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
    };
    latest.current = next;
    setData(next);
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
    [acceptRemote],
  );

  const sync = useCallback(async () => {
    if (saving.current || !isConfigured()) return;
    saving.current = true;
    setSyncState("syncing");
    try {
      if (!readyRef.current) {
        acceptRemote(await fetchAllData(), false);
        if (
          !readyRef.current &&
          latest.current.updatedAt <= cloudTimestamp.current
        ) {
          return;
        }
      }
      let next = latest.current;
      let conflictAttempts = 0;
      while (next.updatedAt > cloudTimestamp.current) {
        if (tableMode.current) {
          const supported = { ...next };
          if (!support.current.timeline) delete supported.financePortfolio;
          if (!support.current.skin) delete supported.skincare;
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
        clearSupportedPendingFlags(support.current);
        next = latest.current;
      }
      setSyncState("synced");
      setSyncError(null);
      setStatus(
        syncedStatusMessage(latest.current, support.current, tableMode.current),
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
  }, [acceptRemote, acknowledge, applyFeatureDefaults]);

  useEffect(() => {
    if (!isConfigured()) return;
    void pullCloud("mount");
  }, [pullCloud]);

  useEffect(() => {
    if (!isConfigured() || typeof window === "undefined") return;
    const onVisible = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
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
    if (!isConfigured() || !fastPoll || !ready) return;
    const timer = setInterval(() => {
      if (
        (typeof document !== "undefined" &&
          document.visibilityState === "hidden") ||
        saving.current ||
        pulling.current
      ) {
        return;
      }
      void pollRevisions()
        .then((rev) => {
          if (
            rev.workspaceRevision &&
            rev.workspaceRevision !== cloudRevision.current
          ) {
            void pullCloud("online");
          }
        })
        .catch(() => {
          /* Ignore transient poll errors; full sync handles offline state. */
        });
    }, 12_000);
    return () => clearInterval(timer);
  }, [fastPoll, ready, pullCloud]);

  useEffect(() => {
    if (!data.updatedAt) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
      if (ready) {
        markUnsupportedPendingFlags(data, support.current);
      }
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
  }, [data, ready, sync]);

  const reloadCloud = useCallback(async () => {
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
  }, [acceptRemote]);

  const pullManual = useCallback(() => pullCloud("manual"), [pullCloud]);

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
    pullCloud: pullManual,
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
    fastBackend,
    sheetsImportReady,
  };
}
