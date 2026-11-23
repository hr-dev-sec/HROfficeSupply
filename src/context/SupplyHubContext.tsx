import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  AppNotification,
  AuditLogEntry,
  CompanySettings,
  ForecastMonthKey,
  HrEmployee,
  HrSection,
  ItemRequest,
  MasterData,
  MonthlyReport,
  OpnameLine,
  OpnameSession,
  OverheadInventoryItem,
  PartPrefix,
  ReportCheckRow,
  ReportInventoryRow,
  ReportType,
  RollingForecastRow,
  RollingForecastSubmission,
  SignatureGroup,
  SignatureTemplate,
  StockTransaction,
  SupplyHubStore,
  SupplyItem,
  SupplyType,
  SystemDocument,
  User,
  WorkflowStage,
} from '../types';
import { SUPABASE_PROJECT_HOST } from '../lib/supabaseClient';
import { supplyHubRepository } from '../repositories';
import type { DatabaseHealthReport, SyncResult } from '../repositories/types';
import { deleteDocumentFromStorage, uploadDataUrlToStorage } from '../services/mediaStorageService';
import { computeDocHash, formatPeriodLong, formatPeriodShort, getNextPeriod, getPrevPeriod } from '../utils/format';
import { useLanguage } from './LanguageContext';
import { useToast } from './ToastContext';

export interface SupabaseSyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error';
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface SupplyHubContextValue {
  store: SupplyHubStore;
  isSupabaseConnected: boolean;
  supabaseHost: string;
  syncStatus: SupabaseSyncStatus;
  lastHealthReport: DatabaseHealthReport | null;
  testSupabaseConnection: () => Promise<DatabaseHealthReport>;
  syncAllToSupabase: () => Promise<SyncResult>;
  replaceSupabaseFromLocal: () => Promise<SyncResult>;
  refreshFromSupabase: () => Promise<boolean>;
  // Reset & Backup
  resetDemoData: (actor?: User) => void;
  exportBackupJson: () => string;
  importBackupJson: (raw: string, actor: User) => void;
  // Users & Re-organisasi
  upsertUser: (
    user: User,
    actor: User,
    options?: { syncReorg?: boolean }
  ) => { ok: boolean; error?: string };
  reassignUserSlots: (
    fromUserId: string,
    toUserId: string,
    deactivateOutgoing: boolean,
    actor: User
  ) => { ok: boolean; updatedTemplates: number; updatedReports: number; error?: string };
  deleteUser: (userId: string, actor: User) => { ok: boolean; error?: string };
  updateUserSavedSignature: (userId: string, dataUrl: string, actor: User) => void;
  // Master Data & Settings
  updateMasterData: (next: MasterData, actor: User) => void;
  updateSettings: (next: CompanySettings, actor: User) => void;
  // Supply Items
  upsertItem: (item: Omit<SupplyItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, actor: User) => SupplyItem;
  bulkUpdateItems: (ids: string[], patch: Partial<Pick<SupplyItem, 'location' | 'minStock'>>, actor: User) => void;
  toggleArchiveItem: (id: string, archived: boolean, actor: User) => void;
  duplicateItem: (id: string, actor: User) => SupplyItem | null;
  importItemsBatch: (
    rows: Array<Omit<SupplyItem, 'id' | 'createdAt' | 'updatedAt' | 'archived'>>,
    actor: User
  ) => number;
  getRecommendedMinStock: (itemId: string) => number;
  // Transactions
  recordTransactions: (
    entries: Array<{ itemId: string; type: 'TERIMA' | 'PAKAI'; qty: number; date: string; note: string }>,
    actor: User
  ) => { ok: boolean; error?: string };
  // Stock Opname
  createOpnameSession: (
    period: string,
    jenis: SupplyType,
    lines: OpnameLine[],
    submitToSM: boolean,
    actor: User
  ) => OpnameSession;
  reviewOpnameSession: (sessionId: string, approve: boolean, actor: User, rejectionNote?: string) => void;
  // Reports & Signatures
  createMonthlyReport: (
    jenis: ReportType,
    period: string,
    placeDateText: string,
    templateId: string | undefined,
    actor: User
  ) => MonthlyReport;
  updateReportPlaceDate: (reportId: string, placeDateText: string, actor: User) => void;
  updateReportCheckRow: (
    reportId: string,
    itemId: string,
    patch: Partial<Pick<ReportCheckRow, 'stokAwal' | 'terima' | 'pakai' | 'minStock' | 'notes'>>,
    actor: User,
    confirmResetSignatures?: boolean
  ) => { requiresSignatureResetConfirm?: boolean };
  duplicateReportToNextMonth: (reportId: string, actor: User) => MonthlyReport | null;
  signReportSlot: (
    reportId: string,
    groupId: string,
    slotId: string,
    signatureDataUrl: string,
    actor: User
  ) => { ok: boolean; error?: string };
  rejectReport: (reportId: string, note: string, actor: User) => void;
  applyTemplateToReport: (reportId: string, templateId: string, actor: User) => void;
  upsertSignatureTemplate: (tpl: SignatureTemplate, actor: User) => void;
  deleteSignatureTemplate: (tplId: string, actor: User) => void;
  sendReminderNotification: (reportId: string, actor: User) => void;
  // Inventaris Overhead
  getNextPartId: (prefix: PartPrefix) => string;
  upsertInventoryItem: (
    item: Omit<OverheadInventoryItem, 'id' | 'partId' | 'mutations' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      partId?: string;
    },
    actor: User
  ) => OverheadInventoryItem;
  recordInventoryMutation: (
    inventoryId: string,
    type: 'IN' | 'OUT' | 'KONDISI',
    qty: number,
    condition: 'BAGUS' | 'RUSAK',
    note: string,
    actor: User
  ) => void;
  // Database Karyawan HR & Pengambilan Barang
  upsertEmployee: (
    emp: Omit<HrEmployee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    actor: User
  ) => { ok: boolean; employee?: HrEmployee; error?: string };
  deleteEmployee: (id: string, actor: User) => void;
  importEmployeesBatch: (
    rows: Array<{ nik: string; name: string; section: HrSection; jabatan: string }>,
    actor: User
  ) => { added: number; updated: number };
  createItemRequest: (req: Omit<ItemRequest, 'id' | 'status'>, actor?: User) => ItemRequest;
  processItemRequest: (
    reqId: string,
    approve: boolean,
    actor: User,
    rejectionNote?: string
  ) => { ok: boolean; error?: string };
  setActiveForecastMonth: (month: ForecastMonthKey, actor: User) => void;
  updateForecastRow: (
    rowId: string,
    patch: {
      rmStock?: number | null;
      monthQty?: { month: ForecastMonthKey; qty: number | undefined };
      estPemakaian?: string;
      keterangan?: string;
    },
    actor?: User
  ) => void;
  addForecastRow: (
    input: {
      jenis: string;
      codeItem: string;
      itemName: string;
      itemDescription: string;
      uom: string;
      rmStock: number | null;
      estPemakaian?: string;
      keterangan?: string;
    },
    actor: User
  ) => RollingForecastRow;
  syncForecastStockFromMaster: (actor: User) => number;
  copyForecastMonth: (fromMonth: ForecastMonthKey, toMonth: ForecastMonthKey, actor: User) => number;
  prefillCriticalForecast: (month: ForecastMonthKey, actor: User) => number;
  submitMonthlyForecast: (
    month: ForecastMonthKey,
    note: string,
    actor: User
  ) => RollingForecastSubmission;
  // Arsip & Upload Dokumen Terintegrasi Database
  addDocument: (
    doc: Omit<SystemDocument, 'uploadedByUserId' | 'uploadedByName' | 'uploadedAt' | 'updatedAt'>,
    actor: User
  ) => SystemDocument;
  updateDocument: (
    docId: string,
    patch: Partial<Pick<SystemDocument, 'title' | 'category' | 'period' | 'linkedModule' | 'linkedReportId' | 'notes'>>,
    actor: User
  ) => void;
  deleteDocument: (docId: string, actor: User) => void;
  // Notifications & Audit
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  logAction: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
}

const SupplyHubContext = createContext<SupplyHubContextValue | undefined>(undefined);

function computeStageFromGroups(groups: SignatureGroup[]): WorkflowStage {
  const dilaporkan = groups.find((g) => g.stage === 'DILAPORKAN');
  const dicheck = groups.find((g) => g.stage === 'DICHECK');
  const mengetahui = groups.find((g) => g.stage === 'MENGETAHUI');

  const isGroupDone = (g?: SignatureGroup) =>
    !g || g.slots.length === 0 || g.slots.every((s) => s.status === 'SIGNED');

  if (!isGroupDone(dilaporkan)) return 'DRAFT';
  if (!isGroupDone(dicheck)) return 'DICHECK';
  if (!isGroupDone(mengetahui)) return 'MENGETAHUI';
  return 'FINAL';
}

export const SupplyHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tr } = useLanguage();
  const { toast } = useToast();
  const [store, setStore] = useState<SupplyHubStore>(() => supplyHubRepository.loadStore());
  const storeRef = useRef<SupplyHubStore>(store);
  storeRef.current = store;

  const isSupabaseConnected = Boolean(supplyHubRepository.isRemoteEnabled?.());
  const supabaseHost = SUPABASE_PROJECT_HOST;

  const [syncStatus, setSyncStatus] = useState<SupabaseSyncStatus>({
    state: isSupabaseConnected ? 'synced' : 'idle',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  });
  const [lastHealthReport, setLastHealthReport] = useState<DatabaseHealthReport | null>(null);

  const syncChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSyncCountRef = useRef(0);
  const lastLocalWriteAtRef = useRef(0);
  const trRef = useRef(tr);
  trRef.current = tr;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const enqueueRemoteTask = useCallback(
    (task: () => Promise<SyncResult>) => {
      if (!isSupabaseConnected) return;
      pendingSyncCountRef.current += 1;
      setSyncStatus((prev) => ({
        ...prev,
        state: 'syncing',
        pendingCount: pendingSyncCountRef.current,
      }));

      syncChainRef.current = syncChainRef.current
        .then(async () => {
          let result = await task();
          if (!result.ok) {
            // Retry otomatis 1x setelah 1,5 detik jika gangguan jaringan sesaat
            await new Promise((resolve) => setTimeout(resolve, 1500));
            result = await task();
          }

          pendingSyncCountRef.current = Math.max(0, pendingSyncCountRef.current - 1);
          const nowIso = new Date().toISOString();

          if (result.ok) {
            lastLocalWriteAtRef.current = Date.now();
            setSyncStatus({
              state: pendingSyncCountRef.current > 0 ? 'syncing' : 'synced',
              pendingCount: pendingSyncCountRef.current,
              lastSyncedAt: nowIso,
              lastError: null,
            });
          } else {
            const errMsg = result.error || 'Unknown database sync error';
            setSyncStatus((prev) => ({
              state: 'error',
              pendingCount: pendingSyncCountRef.current,
              lastSyncedAt: prev.lastSyncedAt,
              lastError: errMsg,
            }));
            toastRef.current(
              trRef.current(
                'Sinkronisasi otomatis ke database gagal',
                'Automatic database sync failed'
              ),
              'error',
              errMsg
            );
          }
        })
        .catch((err) => {
          pendingSyncCountRef.current = Math.max(0, pendingSyncCountRef.current - 1);
          const errMsg = err instanceof Error ? err.message : 'Unexpected sync error';
          setSyncStatus((prev) => ({
            state: 'error',
            pendingCount: pendingSyncCountRef.current,
            lastSyncedAt: prev.lastSyncedAt,
            lastError: errMsg,
          }));
        });
    },
    [isSupabaseConnected]
  );

  const refreshFromSupabase = useCallback(async (): Promise<boolean> => {
    if (!supplyHubRepository.hydrateFromRemote || !isSupabaseConnected) return false;
    const remoteStore = await supplyHubRepository.hydrateFromRemote();
    if (remoteStore) {
      storeRef.current = remoteStore;
      setStore(remoteStore);
      setSyncStatus((prev) => ({
        ...prev,
        state: pendingSyncCountRef.current > 0 ? 'syncing' : 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      }));
      return true;
    }
    return false;
  }, [isSupabaseConnected]);

  // Initial hydrate from Supabase
  useEffect(() => {
    if (!supplyHubRepository.hydrateFromRemote || !isSupabaseConnected) return;
    let active = true;
    supplyHubRepository.hydrateFromRemote().then((remoteStore) => {
      if (active && remoteStore && pendingSyncCountRef.current === 0) {
        storeRef.current = remoteStore;
        setStore(remoteStore);
        setSyncStatus((prev) => ({
          ...prev,
          state: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
        }));
      }
    });
    return () => {
      active = false;
    };
  }, [isSupabaseConnected]);

  // Realtime multi-tab / multi-device subscription (debounced, skips self-echoes)
  useEffect(() => {
    if (!supplyHubRepository.subscribeToRemoteChanges || !isSupabaseConnected) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = supplyHubRepository.subscribeToRemoteChanges(() => {
      // Abaikan pantulan perubahan dari sesi lokal sendiri atau saat penulisan sedang berjalan
      if (pendingSyncCountRef.current > 0) return;
      if (Date.now() - lastLocalWriteAtRef.current < 2000) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pendingSyncCountRef.current === 0 && Date.now() - lastLocalWriteAtRef.current >= 2000) {
          void refreshFromSupabase();
        }
      }, 650);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [isSupabaseConnected, refreshFromSupabase]);

  // Cegah penutupan tab mendadak tepat saat transaksi penulisan database masih berlangsung
  useEffect(() => {
    if (!isSupabaseConnected) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSyncCountRef.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSupabaseConnected]);

  const commit = useCallback(
    (updater: (prev: SupplyHubStore) => SupplyHubStore) => {
      const prev = storeRef.current;
      const next = updater(prev);
      if (next === prev) return;
      storeRef.current = next;
      supplyHubRepository.saveStore(next);
      setStore(next);
      if (supplyHubRepository.syncStoreDelta && isSupabaseConnected) {
        enqueueRemoteTask(() => supplyHubRepository.syncStoreDelta!(prev, next));
      }
    },
    [enqueueRemoteTask, isSupabaseConnected]
  );

  const syncAllToSupabase = useCallback(async (): Promise<SyncResult> => {
    if (!supplyHubRepository.pushFullStoreToRemote || !isSupabaseConnected) {
      return {
        ok: false,
        error: 'Koneksi Supabase belum aktif. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada environment.',
      };
    }
    // Tunggu antrean penulisan delta yang sedang berjalan selesai lebih dulu
    await syncChainRef.current;
    const result = await supplyHubRepository.pushFullStoreToRemote(storeRef.current);
    if (result.ok) {
      lastLocalWriteAtRef.current = Date.now();
      const refreshed = supplyHubRepository.loadStore();
      storeRef.current = refreshed;
      setStore(refreshed);
      setSyncStatus({
        state: 'synced',
        pendingCount: pendingSyncCountRef.current,
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
    } else {
      setSyncStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: result.error || 'Sync failed',
      }));
    }
    return result;
  }, [isSupabaseConnected]);

  const replaceSupabaseFromLocal = useCallback(async (): Promise<SyncResult> => {
    const fn = supplyHubRepository.replaceFullStoreOnRemote || supplyHubRepository.pushFullStoreToRemote;
    if (!fn || !isSupabaseConnected) {
      return {
        ok: false,
        error: 'Koneksi Supabase belum aktif. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada environment.',
      };
    }
    await syncChainRef.current;
    const result = await fn.call(supplyHubRepository, storeRef.current);
    if (result.ok) {
      lastLocalWriteAtRef.current = Date.now();
      const refreshed = supplyHubRepository.loadStore();
      storeRef.current = refreshed;
      setStore(refreshed);
      setSyncStatus({
        state: 'synced',
        pendingCount: pendingSyncCountRef.current,
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
    } else {
      setSyncStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: result.error || 'Mirror sync failed',
      }));
    }
    return result;
  }, [isSupabaseConnected]);

  const testSupabaseConnection = useCallback(async (): Promise<DatabaseHealthReport> => {
    if (!supplyHubRepository.testConnection) {
      const offlineReport: DatabaseHealthReport = {
        checkedAt: new Date().toISOString(),
        connected: false,
        projectHost: '',
        latencyMs: 0,
        canWrite: false,
        writeError: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum dikonfigurasi.',
        tables: [],
        buckets: [],
        summary: { tablesOk: 0, tablesTotal: 19, bucketsOk: 0, bucketsTotal: 2 },
      };
      setLastHealthReport(offlineReport);
      return offlineReport;
    }
    const report = await supplyHubRepository.testConnection(storeRef.current);
    setLastHealthReport(report);
    if (report.connected && report.canWrite && report.summary.tablesOk === report.summary.tablesTotal) {
      setSyncStatus((prev) => ({
        ...prev,
        state: pendingSyncCountRef.current > 0 ? 'syncing' : 'synced',
        lastSyncedAt: report.checkedAt,
        lastError: null,
      }));
    } else if (!report.connected || !report.canWrite) {
      setSyncStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: report.writeError || 'Database health check failed',
      }));
    }
    return report;
  }, []);

  const makeAudit = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry => ({
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  });

  const logAction = useCallback(
    (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
      commit((prev) => ({
        ...prev,
        auditLogs: [makeAudit(entry), ...prev.auditLogs].slice(0, 500),
      }));
    },
    [commit]
  );

  const resetDemoData = useCallback(
    (actor?: User) => {
      const fresh = supplyHubRepository.resetDemoData();
      if (actor) {
        fresh.auditLogs = [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'RESET',
            objectType: 'Sistem',
            objectLabel: 'Reset Data Demo',
          }),
          ...fresh.auditLogs,
        ];
        supplyHubRepository.saveStore(fresh);
      }
      storeRef.current = fresh;
      setStore(fresh);
      if (isSupabaseConnected) {
        const remotePush =
          supplyHubRepository.replaceFullStoreOnRemote || supplyHubRepository.pushFullStoreToRemote;
        if (remotePush) {
          enqueueRemoteTask(() => remotePush.call(supplyHubRepository, fresh));
        }
      }
    },
    [enqueueRemoteTask, isSupabaseConnected]
  );

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(storeRef.current, null, 2);
  }, []);

  const importBackupJson = useCallback(
    (raw: string, actor: User) => {
      const imported = supplyHubRepository.importJson(raw);
      imported.auditLogs = [
        makeAudit({
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          action: 'IMPORT',
          objectType: 'Backup JSON',
          objectLabel: 'Restore Data Sistem',
        }),
        ...imported.auditLogs,
      ];
      supplyHubRepository.saveStore(imported);
      storeRef.current = imported;
      setStore(imported);
      if (isSupabaseConnected) {
        const remotePush =
          supplyHubRepository.replaceFullStoreOnRemote || supplyHubRepository.pushFullStoreToRemote;
        if (remotePush) {
          enqueueRemoteTask(() => remotePush.call(supplyHubRepository, imported));
        }
      }
    },
    [enqueueRemoteTask, isSupabaseConnected]
  );

  const upsertUser = useCallback(
    (
      user: User,
      actor: User,
      options?: { syncReorg?: boolean }
    ): { ok: boolean; error?: string } => {
      const normUsername = user.username.trim().toLowerCase();
      const normEmail = user.email.trim().toLowerCase();
      if (!normUsername || !user.name.trim()) {
        return { ok: false, error: 'Nama lengkap dan username wajib diisi.' };
      }

      const duplicateUsername = store.users.find(
        (u) => u.id !== user.id && u.username.toLowerCase() === normUsername
      );
      if (duplicateUsername) {
        return { ok: false, error: `Username "${user.username}" sudah digunakan oleh ${duplicateUsername.name}.` };
      }

      const duplicateEmail = store.users.find(
        (u) => u.id !== user.id && u.email.toLowerCase() === normEmail
      );
      if (duplicateEmail) {
        return { ok: false, error: `Email "${user.email}" sudah digunakan oleh ${duplicateEmail.name}.` };
      }

      const existing = store.users.find((u) => u.id === user.id);
      if (existing && existing.role === 'SUPER_ADMIN' && (!user.active || user.role !== 'SUPER_ADMIN')) {
        const otherActiveSuperAdmins = store.users.filter(
          (u) => u.id !== existing.id && u.role === 'SUPER_ADMIN' && u.active
        );
        if (otherActiveSuperAdmins.length === 0) {
          return {
            ok: false,
            error: 'Minimal harus ada 1 akun Super Admin yang aktif di sistem.',
          };
        }
      }

      const shouldSyncReorg = Boolean(existing && (options?.syncReorg ?? true));
      const cleanUser: User = {
        ...user,
        username: user.username.trim(),
        email: user.email.trim(),
        name: user.name.trim(),
        jabatan: user.jabatan.trim(),
        seksi: user.seksi.trim(),
        avatarInitials: (user.avatarInitials || user.name.slice(0, 2)).trim().toUpperCase().slice(0, 2),
      };

      commit((prev) => {
        const exists = prev.users.some((u) => u.id === cleanUser.id);
        const users = exists
          ? prev.users.map((u) => (u.id === cleanUser.id ? cleanUser : u))
          : [...prev.users, cleanUser];

        let templates = prev.templates;
        let reports = prev.reports;

        if (shouldSyncReorg) {
          templates = prev.templates.map((tpl) => ({
            ...tpl,
            groups: tpl.groups.map((grp) => ({
              ...grp,
              slots: grp.slots.map((slot) =>
                slot.allowedUserId === cleanUser.id
                  ? { ...slot, name: cleanUser.name, jabatan: cleanUser.jabatan }
                  : slot
              ),
            })),
          }));

          reports = prev.reports.map((rep) => {
            if (rep.locked) return rep;
            let touched = false;
            const nextGroups = rep.signatureGroups.map((grp) => ({
              ...grp,
              slots: grp.slots.map((slot) => {
                if (slot.allowedUserId === cleanUser.id && slot.status === 'PENDING') {
                  touched = true;
                  return { ...slot, name: cleanUser.name, jabatan: cleanUser.jabatan };
                }
                return slot;
              }),
            }));
            return touched
              ? { ...rep, signatureGroups: nextGroups, updatedAt: new Date().toISOString() }
              : rep;
          });
        }

        return {
          ...prev,
          users,
          templates,
          reports,
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: exists ? 'UPDATE' : 'CREATE',
              objectType: shouldSyncReorg ? 'Pengguna & Re-organisasi' : 'Pengguna',
              objectLabel: `${cleanUser.name} (${cleanUser.username})`,
              oldValue: existing ? `${existing.name} · ${existing.jabatan} · ${existing.seksi} (${existing.role})` : undefined,
              newValue: `${cleanUser.name} · ${cleanUser.jabatan} · ${cleanUser.seksi} (${cleanUser.role})`,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return { ok: true };
    },
    [commit, store.users]
  );

  const reassignUserSlots = useCallback(
    (
      fromUserId: string,
      toUserId: string,
      deactivateOutgoing: boolean,
      actor: User
    ): { ok: boolean; updatedTemplates: number; updatedReports: number; error?: string } => {
      if (fromUserId === toUserId) {
        return { ok: false, updatedTemplates: 0, updatedReports: 0, error: 'Akun asal dan akun pengganti harus berbeda.' };
      }
      const fromUser = store.users.find((u) => u.id === fromUserId);
      const toUser = store.users.find((u) => u.id === toUserId);
      if (!fromUser || !toUser) {
        return { ok: false, updatedTemplates: 0, updatedReports: 0, error: 'Akun tidak ditemukan.' };
      }
      if (!toUser.active) {
        return { ok: false, updatedTemplates: 0, updatedReports: 0, error: 'Akun pengganti harus berstatus Aktif.' };
      }
      if (deactivateOutgoing && fromUser.id === actor.id) {
        return { ok: false, updatedTemplates: 0, updatedReports: 0, error: 'Tidak dapat menonaktifkan akun yang sedang Anda gunakan.' };
      }

      let updatedTemplates = 0;
      let updatedReports = 0;

      store.templates.forEach((tpl) => {
        if (tpl.groups.some((g) => g.slots.some((s) => s.allowedUserId === fromUserId))) {
          updatedTemplates += 1;
        }
      });
      store.reports.forEach((rep) => {
        if (
          !rep.locked &&
          rep.signatureGroups.some((g) =>
            g.slots.some((s) => s.allowedUserId === fromUserId && s.status === 'PENDING')
          )
        ) {
          updatedReports += 1;
        }
      });

      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        users: deactivateOutgoing
          ? prev.users.map((u) => (u.id === fromUserId ? { ...u, active: false } : u))
          : prev.users,
        templates: prev.templates.map((tpl) => ({
          ...tpl,
          groups: tpl.groups.map((grp) => ({
            ...grp,
            slots: grp.slots.map((slot) =>
              slot.allowedUserId === fromUserId
                ? {
                    ...slot,
                    allowedUserId: toUser.id,
                    name: toUser.name,
                    jabatan: toUser.jabatan,
                  }
                : slot
            ),
          })),
        })),
        reports: prev.reports.map((rep) => {
          if (rep.locked) return rep;
          let touched = false;
          const nextGroups = rep.signatureGroups.map((grp) => ({
            ...grp,
            slots: grp.slots.map((slot) => {
              if (slot.allowedUserId === fromUserId && slot.status === 'PENDING') {
                touched = true;
                return {
                  ...slot,
                  allowedUserId: toUser.id,
                  name: toUser.name,
                  jabatan: toUser.jabatan,
                };
              }
              return slot;
            }),
          }));
          return touched ? { ...rep, signatureGroups: nextGroups, updatedAt: now } : rep;
        }),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Serah Terima Jabatan (Re-organisasi)',
            objectLabel: `${fromUser.name} → ${toUser.name}`,
            oldValue: `${fromUser.name} (${fromUser.jabatan})`,
            newValue: `${toUser.name} (${toUser.jabatan}) · ${updatedTemplates} template, ${updatedReports} draft`,
          }),
          ...prev.auditLogs,
        ],
      }));

      return { ok: true, updatedTemplates, updatedReports };
    },
    [commit, store.reports, store.templates, store.users]
  );

  const deleteUser = useCallback(
    (userId: string, actor: User): { ok: boolean; error?: string } => {
      if (userId === actor.id) {
        return { ok: false, error: 'Anda tidak dapat menghapus akun yang sedang digunakan untuk login.' };
      }
      const target = store.users.find((u) => u.id === userId);
      if (!target) {
        return { ok: false, error: 'Akun tidak ditemukan.' };
      }
      if (target.role === 'SUPER_ADMIN') {
        const remainingSuper = store.users.filter(
          (u) => u.id !== userId && u.role === 'SUPER_ADMIN' && u.active
        );
        if (remainingSuper.length === 0) {
          return { ok: false, error: 'Tidak dapat menghapus satu-satunya akun Super Admin aktif.' };
        }
      }
      const usedInTemplate = store.templates.some((t) =>
        t.groups.some((g) => g.slots.some((s) => s.allowedUserId === userId))
      );
      if (usedInTemplate) {
        return {
          ok: false,
          error:
            'Akun masih terdaftar pada Template Tanda Tangan. Gunakan fitur "Serah Terima Jabatan" terlebih dahulu atau nonaktifkan akun.',
        };
      }

      commit((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'DELETE',
            objectType: 'Pengguna',
            objectLabel: `${target.name} (${target.username})`,
          }),
          ...prev.auditLogs,
        ],
      }));

      return { ok: true };
    },
    [commit, store.templates, store.users]
  );

  const updateUserSavedSignature = useCallback(
    (userId: string, dataUrl: string, actor: User) => {
      const applySignature = (finalUrl: string) => {
        commit((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, savedSignatureDataUrl: finalUrl || undefined } : u
          ),
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'UPDATE',
              objectType: 'Tanda Tangan Profil',
              objectLabel: actor.name,
            }),
            ...prev.auditLogs,
          ],
        }));
      };

      if (dataUrl && dataUrl.startsWith('data:') && isSupabaseConnected) {
        void uploadDataUrlToStorage(dataUrl, 'signatures', userId).then(applySignature);
      } else {
        applySignature(dataUrl);
      }
    },
    [commit, isSupabaseConnected]
  );

  const updateMasterData = useCallback(
    (next: MasterData, actor: User) => {
      commit((prev) => ({
        ...prev,
        masterData: next,
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Master Data',
            objectLabel: 'Kategori / UOM / Lokasi',
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const updateSettings = useCallback(
    (next: CompanySettings, actor: User) => {
      commit((prev) => ({
        ...prev,
        settings: next,
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Pengaturan',
            objectLabel: 'Kop Dokumen & Petunjuk',
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const upsertItem = useCallback(
    (
      itemInput: Omit<SupplyItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
      actor: User
    ): SupplyItem => {
      const now = new Date().toISOString();
      const existing = itemInput.id ? store.items.find((i) => i.id === itemInput.id) : undefined;
      const saved: SupplyItem = existing
        ? { ...existing, ...itemInput, id: existing.id, updatedAt: now }
        : {
            ...itemInput,
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: now,
            updatedAt: now,
          };

      commit((prev) => ({
        ...prev,
        items: existing
          ? prev.items.map((i) => (i.id === saved.id ? saved : i))
          : [saved, ...prev.items],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: existing ? 'UPDATE' : 'CREATE',
            objectType: 'Master Item',
            objectLabel: `${saved.codeItem || '-'} ${saved.itemName}`,
            oldValue: existing ? `Stok: ${existing.currentStock}, Min: ${existing.minStock}` : undefined,
            newValue: `Stok: ${saved.currentStock}, Min: ${saved.minStock}`,
          }),
          ...prev.auditLogs,
        ],
      }));
      return saved;
    },
    [commit, store.items]
  );

  const bulkUpdateItems = useCallback(
    (ids: string[], patch: Partial<Pick<SupplyItem, 'location' | 'minStock'>>, actor: User) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        items: prev.items.map((i) => (ids.includes(i.id) ? { ...i, ...patch, updatedAt: now } : i)),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Edit Massal Item',
            objectLabel: `${ids.length} item`,
            newValue: JSON.stringify(patch),
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const toggleArchiveItem = useCallback(
    (id: string, archived: boolean, actor: User) => {
      const target = store.items.find((i) => i.id === id);
      commit((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === id ? { ...i, archived, updatedAt: new Date().toISOString() } : i
        ),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: archived ? 'ARCHIVE' : 'RESTORE',
            objectType: 'Master Item',
            objectLabel: target ? target.itemName : id,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit, store.items]
  );

  const duplicateItem = useCallback(
    (id: string, actor: User): SupplyItem | null => {
      const src = store.items.find((i) => i.id === id);
      if (!src) return null;
      return upsertItem(
        {
          ...src,
          id: undefined,
          itemName: `${src.itemName} (Salinan)`,
          codeItem: src.codeItem ? `${src.codeItem}-COPY` : '',
        },
        actor
      );
    },
    [store.items, upsertItem]
  );

  const importItemsBatch = useCallback(
    (rows: Array<Omit<SupplyItem, 'id' | 'createdAt' | 'updatedAt' | 'archived'>>, actor: User) => {
      const now = new Date().toISOString();
      const created: SupplyItem[] = rows.map((r, i) => ({
        ...r,
        id: `item-imp-${Date.now()}-${i}`,
        archived: false,
        createdAt: now,
        updatedAt: now,
      }));
      commit((prev) => ({
        ...prev,
        items: [...created, ...prev.items],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'IMPORT',
            objectType: 'Master Item (Excel)',
            objectLabel: `${created.length} item diimpor`,
          }),
          ...prev.auditLogs,
        ],
      }));
      return created.length;
    },
    [commit]
  );

  const getRecommendedMinStock = useCallback(
    (itemId: string): number => {
      const pakaiTxs = store.transactions.filter(
        (t) => t.itemId === itemId && t.type === 'PAKAI'
      );
      if (pakaiTxs.length === 0) {
        const item = store.items.find((i) => i.id === itemId);
        return item ? Math.max(1, item.minStock) : 1;
      }
      const periods = new Set(pakaiTxs.map((t) => t.period));
      const totalPakai = pakaiTxs.reduce((sum, t) => sum + t.qty, 0);
      const avgMonthly = totalPakai / Math.max(1, periods.size);
      return Math.max(1, Math.ceil(avgMonthly * 1.2));
    },
    [store.items, store.transactions]
  );

  const recordTransactions = useCallback(
    (
      entries: Array<{ itemId: string; type: 'TERIMA' | 'PAKAI'; qty: number; date: string; note: string }>,
      actor: User
    ): { ok: boolean; error?: string } => {
      if (entries.length === 0) return { ok: false, error: 'Belum ada item yang dipilih.' };

      // Simulate net stock per item to validate PAKAI doesn't exceed stock
      const stockMap = new Map<string, number>();
      store.items.forEach((i) => stockMap.set(i.id, i.currentStock));

      for (const e of entries) {
        if (e.qty <= 0) return { ok: false, error: 'Jumlah transaksi harus lebih dari 0.' };
        const curr = stockMap.get(e.itemId) ?? 0;
        const item = store.items.find((i) => i.id === e.itemId);
        if (!item) return { ok: false, error: 'Item tidak ditemukan.' };
        if (e.type === 'PAKAI') {
          if (curr < e.qty) {
            return {
              ok: false,
              error: `Stok "${item.itemName}" tidak mencukupi (tersedia ${curr} ${item.uom}, diminta ${e.qty} ${item.uom}).`,
            };
          }
          stockMap.set(e.itemId, curr - e.qty);
        } else {
          stockMap.set(e.itemId, curr + e.qty);
        }
      }

      const now = new Date().toISOString();
      const newTxs: StockTransaction[] = entries.map((e, idx) => {
        const item = store.items.find((i) => i.id === e.itemId)!;
        return {
          id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          itemId: item.id,
          jenis: item.jenis,
          codeItem: item.codeItem,
          itemName: item.itemName,
          uom: item.uom,
          type: e.type,
          qty: e.qty,
          date: e.date,
          period: e.date.slice(0, 7),
          recordedByUserId: actor.id,
          recordedByName: actor.name,
          note: e.note || (e.type === 'TERIMA' ? 'Penerimaan barang' : 'Pemakaian operasional'),
          createdAt: now,
        };
      });

      commit((prev) => {
        const updatedItems = prev.items.map((item) => {
          const nextQty = stockMap.get(item.id);
          return nextQty !== undefined && nextQty !== item.currentStock
            ? { ...item, currentStock: nextQty, updatedAt: now }
            : item;
        });

        const criticalNotifs: AppNotification[] = [];
        for (const item of updatedItems) {
          const oldItem = prev.items.find((x) => x.id === item.id);
          if (
            oldItem &&
            oldItem.currentStock > item.minStock &&
            item.currentStock <= item.minStock
          ) {
            criticalNotifs.push({
              id: `notif-crit-${Date.now()}-${item.id}`,
              title: 'Stok Mencapai Batas Minimum',
              message: `${item.itemName} tersisa ${item.currentStock} ${item.uom} (Min: ${item.minStock}).`,
              type: 'STOK_KRITIS',
              targetRoles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER'],
              linkTo: '/app/requests',
              read: false,
              createdAt: now,
            });
          }
        }

        return {
          ...prev,
          items: updatedItems,
          transactions: [...newTxs, ...prev.transactions],
          notifications: [...criticalNotifs, ...prev.notifications],
          auditLogs: [
            ...newTxs.map((t) =>
              makeAudit({
                userId: actor.id,
                userName: actor.name,
                userRole: actor.role,
                action: 'CREATE',
                objectType: `Transaksi ${t.type}`,
                objectLabel: `${t.itemName} (${t.qty} ${t.uom})`,
                newValue: t.note,
              })
            ),
            ...prev.auditLogs,
          ].slice(0, 500),
        };
      });

      return { ok: true };
    },
    [commit, store.items]
  );

  const createOpnameSession = useCallback(
    (
      period: string,
      jenis: SupplyType,
      lines: OpnameLine[],
      submitToSM: boolean,
      actor: User
    ): OpnameSession => {
      const now = new Date().toISOString();
      const session: OpnameSession = {
        id: `opn-${Date.now()}`,
        period,
        jenis,
        createdAt: now,
        createdByUserId: actor.id,
        createdByName: actor.name,
        status: submitToSM ? 'MENUNGGU_SM' : 'DRAFT',
        lines,
      };

      commit((prev) => ({
        ...prev,
        opnames: [session, ...prev.opnames],
        notifications: submitToSM
          ? [
              {
                id: `notif-opn-${Date.now()}`,
                title: 'Stock Opname Menunggu Persetujuan SM',
                message: `Stock Opname ${jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'} periode ${formatPeriodLong(period)} diajukan oleh ${actor.name}.`,
                type: 'OPNAME',
                targetRoles: ['SECTION_MANAGER', 'SUPER_ADMIN'],
                linkTo: '/app/opname',
                read: false,
                createdAt: now,
              },
              ...prev.notifications,
            ]
          : prev.notifications,
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'CREATE',
            objectType: 'Stock Opname',
            objectLabel: `${jenis} ${period}`,
            newValue: submitToSM ? 'Diajukan ke Section Manager' : 'Disimpan sebagai Draft',
          }),
          ...prev.auditLogs,
        ],
      }));
      return session;
    },
    [commit]
  );

  const reviewOpnameSession = useCallback(
    (sessionId: string, approve: boolean, actor: User, rejectionNote?: string) => {
      const now = new Date().toISOString();
      commit((prev) => {
        const target = prev.opnames.find((o) => o.id === sessionId);
        if (!target) return prev;

        let nextItems = prev.items;
        const adjTxs: StockTransaction[] = [];

        if (approve) {
          const mapPhys = new Map<string, number>();
          target.lines.forEach((l) => {
            mapPhys.set(l.itemId, l.physicalStock);
            if (l.diff !== 0) {
              adjTxs.push({
                id: `tx-adj-${Date.now()}-${l.itemId}`,
                itemId: l.itemId,
                jenis: target.jenis,
                codeItem: l.codeItem,
                itemName: l.itemName,
                uom: l.uom,
                type: 'OPNAME_ADJ',
                qty: l.diff,
                date: now.slice(0, 10),
                period: target.period,
                recordedByUserId: actor.id,
                recordedByName: actor.name,
                note: `Penyesuaian Opname: ${l.reason || 'Selisih hitung fisik'}`,
                createdAt: now,
              });
            }
          });
          nextItems = prev.items.map((item) => {
            const p = mapPhys.get(item.id);
            return p !== undefined ? { ...item, currentStock: p, updatedAt: now } : item;
          });
        }

        return {
          ...prev,
          items: nextItems,
          transactions: [...adjTxs, ...prev.transactions],
          opnames: prev.opnames.map((o) =>
            o.id === sessionId
              ? {
                  ...o,
                  status: approve ? 'DISETUJUI' : 'DITOLAK',
                  approvedByUserId: actor.id,
                  approvedByName: actor.name,
                  approvedAt: now,
                  rejectionNote: approve ? undefined : rejectionNote || 'Perlu hitung ulang fisik',
                }
              : o
          ),
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: approve ? 'APPROVE' : 'REJECT',
              objectType: 'Stock Opname',
              objectLabel: `${target.jenis} ${target.period}`,
              newValue: approve ? 'Disetujui & stok disesuaikan' : rejectionNote,
            }),
            ...prev.auditLogs,
          ],
        };
      });
    },
    [commit]
  );

  const createMonthlyReport = useCallback(
    (
      jenis: ReportType,
      period: string,
      placeDateText: string,
      templateId: string | undefined,
      actor: User
    ): MonthlyReport => {
      const now = new Date().toISOString();
      const tpl =
        store.templates.find((t) => t.id === templateId) ||
        store.templates.find((t) => t.jenis === jenis && t.isDefault) ||
        store.templates[0];

      const signatureGroups: SignatureGroup[] = tpl.groups.map((g) => ({
        id: g.id,
        label: g.label,
        stage: g.stage,
        order: g.order,
        slots: g.slots.map((s) => ({
          id: s.id,
          name: s.name,
          jabatan: s.jabatan,
          allowedUserId: s.allowedUserId,
          order: s.order,
          status: 'PENDING',
        })),
      }));

      const prevPeriod = getPrevPeriod(period);
      const prevFinalReport = store.reports.find(
        (r) => r.jenis === jenis && r.period === prevPeriod && r.status === 'FINAL'
      );

      let checkRows: ReportCheckRow[] | undefined;
      let inventoryRows: ReportInventoryRow[] | undefined;

      if (jenis === 'INVENTARIS_OVERHEAD') {
        inventoryRows = store.inventories.map((inv) => ({
          inventoryId: inv.id,
          kategori: inv.kategori,
          partId: inv.partId,
          itemName: inv.itemName,
          qty: inv.qty,
          uom: inv.uom,
          location: inv.location,
          condition: inv.condition,
          notes: inv.notes,
        }));
      } else {
        const itemsOfType = store.items.filter((i) => !i.archived && i.jenis === jenis);
        checkRows = itemsOfType.map((item) => {
          const prevRow = prevFinalReport?.checkRows?.find((pr) => pr.itemId === item.id);
          const periodTxs = store.transactions.filter(
            (t) => t.itemId === item.id && t.period === period
          );
          const terima = periodTxs
            .filter((t) => t.type === 'TERIMA')
            .reduce((s, t) => s + t.qty, 0);
          const pakai = periodTxs
            .filter((t) => t.type === 'PAKAI')
            .reduce((s, t) => s + t.qty, 0);
          const stokAwal = prevRow ? prevRow.stockAkhir : Math.max(0, item.currentStock - terima + pakai);
          return {
            itemId: item.id,
            kategori: item.kategori,
            codeItem: item.codeItem,
            itemName: item.itemName,
            uom: item.uom,
            stokAwal,
            terima,
            pakai,
            stockAkhir: stokAwal + terima - pakai,
            minStock: item.minStock,
            location: item.location,
            notes: item.notes,
          };
        });
      }

      const prefixCode =
        jenis === 'OFFICE_SUPPLIES' ? 'OS' : jenis === 'OVERHEAD_GOODS' ? 'OG' : 'INV';
      const existingDocIds = new Set(store.reports.map((r) => r.documentId));
      let seq = store.reports.length + 1;
      let documentId = `DOC-HR-${prefixCode}-${period.replace('-', '')}-${String(seq).padStart(2, '0')}`;
      while (existingDocIds.has(documentId)) {
        seq += 1;
        documentId = `DOC-HR-${prefixCode}-${period.replace('-', '')}-${String(seq).padStart(2, '0')}`;
      }
      const title =
        jenis === 'OFFICE_SUPPLIES'
          ? 'LIST PENGECHEKAN BARANG OFFICE SUPPLIES'
          : jenis === 'OVERHEAD_GOODS'
          ? 'LIST PENGECHEKAN BARANG OVERHEAD GOODS'
          : 'LIST INVENTARIS OVERHEAD';

      const newReport: MonthlyReport = {
        id: `rep-${jenis.toLowerCase()}-${period}-${Date.now()}`,
        documentId,
        docHash: computeDocHash(JSON.stringify({ documentId, period, checkRows, inventoryRows })),
        jenis,
        title,
        period,
        periodLabel:
          jenis === 'INVENTARIS_OVERHEAD' ? formatPeriodLong(period) : formatPeriodShort(period),
        department:
          jenis === 'INVENTARIS_OVERHEAD' ? 'Human Resource' : store.settings.department,
        section: store.settings.section,
        placeDateText,
        status: 'DRAFT',
        checkRows,
        inventoryRows,
        signatureGroups,
        templateId: tpl.id,
        locked: false,
        version: 1,
        versions: [
          {
            version: 1,
            savedAt: now,
            savedBy: actor.name,
            note: 'Draf laporan dibuat',
          },
        ],
        rejectionHistory: [],
        createdAt: now,
        updatedAt: now,
      };

      commit((prev) => ({
        ...prev,
        reports: [newReport, ...prev.reports],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'CREATE',
            objectType: 'Laporan Bulanan',
            objectLabel: `${newReport.documentId} (${newReport.periodLabel})`,
          }),
          ...prev.auditLogs,
        ],
      }));

      return newReport;
    },
    [commit, store.inventories, store.items, store.reports, store.settings, store.templates, store.transactions]
  );

  const updateReportPlaceDate = useCallback(
    (reportId: string, placeDateText: string, actor: User) => {
      commit((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId && !r.locked
            ? { ...r, placeDateText, updatedAt: new Date().toISOString() }
            : r
        ),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Laporan Bulanan',
            objectLabel: reportId,
            newValue: `Tempat/Tanggal: ${placeDateText}`,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const updateReportCheckRow = useCallback(
    (
      reportId: string,
      itemId: string,
      patch: Partial<Pick<ReportCheckRow, 'stokAwal' | 'terima' | 'pakai' | 'minStock' | 'notes'>>,
      actor: User,
      confirmResetSignatures = false
    ): { requiresSignatureResetConfirm?: boolean } => {
      const rep = store.reports.find((r) => r.id === reportId);
      if (!rep || rep.locked || !rep.checkRows) return {};

      const hasAnySignature = rep.signatureGroups.some((g) =>
        g.slots.some((s) => s.status === 'SIGNED')
      );
      if (hasAnySignature && !confirmResetSignatures) {
        return { requiresSignatureResetConfirm: true };
      }

      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        reports: prev.reports.map((r) => {
          if (r.id !== reportId || !r.checkRows) return r;
          const nextRows = r.checkRows.map((row) => {
            if (row.itemId !== itemId) return row;
            const merged = { ...row, ...patch };
            merged.stockAkhir = merged.stokAwal + merged.terima - merged.pakai;
            return merged;
          });
          const nextGroups: SignatureGroup[] = hasAnySignature
            ? r.signatureGroups.map((g) => ({
                ...g,
                slots: g.slots.map((s) => ({
                  ...s,
                  status: 'PENDING',
                  signedByUserId: undefined,
                  signedByName: undefined,
                  signedAt: undefined,
                  signatureImageUrl: undefined,
                })),
              }))
            : r.signatureGroups;
          return {
            ...r,
            checkRows: nextRows,
            signatureGroups: nextGroups,
            status: hasAnySignature ? 'DRAFT' : r.status,
            version: r.version + 1,
            versions: [
              {
                version: r.version + 1,
                savedAt: now,
                savedBy: actor.name,
                note: hasAnySignature
                  ? 'Perubahan data pasca tanda tangan (tanda tangan direset)'
                  : 'Pembaruan baris laporan',
              },
              ...r.versions,
            ],
            docHash: computeDocHash(JSON.stringify({ id: r.documentId, nextRows })),
            updatedAt: now,
          };
        }),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Baris Laporan',
            objectLabel: `${rep.documentId}`,
            newValue: hasAnySignature ? 'Data diubah & tanda tangan direset' : 'Data baris diperbarui',
          }),
          ...prev.auditLogs,
        ],
      }));
      return {};
    },
    [commit, store.reports]
  );

  const duplicateReportToNextMonth = useCallback(
    (reportId: string, actor: User): MonthlyReport | null => {
      const src = store.reports.find((r) => r.id === reportId);
      if (!src) return null;
      const nextPeriod = getNextPeriod(src.period);
      return createMonthlyReport(
        src.jenis,
        nextPeriod,
        `${store.settings.locationCity}, 05 ${formatPeriodLong(getNextPeriod(nextPeriod))}`,
        src.templateId,
        actor
      );
    },
    [createMonthlyReport, store.reports, store.settings.locationCity]
  );

  const signReportSlot = useCallback(
    (
      reportId: string,
      groupId: string,
      slotId: string,
      signatureDataUrl: string,
      actor: User
    ): { ok: boolean; error?: string } => {
      const report = store.reports.find((r) => r.id === reportId);
      if (!report) return { ok: false, error: 'Laporan tidak ditemukan.' };
      if (report.locked) return { ok: false, error: 'Laporan sudah Final dan terkunci.' };

      const group = report.signatureGroups.find((g) => g.id === groupId);
      const slot = group?.slots.find((s) => s.id === slotId);
      if (!group || !slot) return { ok: false, error: 'Slot tanda tangan tidak ditemukan.' };

      if (actor.role !== 'SUPER_ADMIN' && slot.allowedUserId !== actor.id) {
        return {
          ok: false,
          error: `Slot ini dikhususkan untuk ${slot.name} (${slot.jabatan}).`,
        };
      }

      // Enforce stage order: DILAPORKAN -> DICHECK -> MENGETAHUI
      const dilGroup = report.signatureGroups.find((g) => g.stage === 'DILAPORKAN');
      const dicGroup = report.signatureGroups.find((g) => g.stage === 'DICHECK');
      const dilDone = !dilGroup || dilGroup.slots.every((s) => s.status === 'SIGNED');
      const dicDone = !dicGroup || dicGroup.slots.every((s) => s.status === 'SIGNED');

      if (group.stage === 'DICHECK' && !dilDone) {
        return { ok: false, error: 'Tahap "Dilaporkan oleh" harus ditandatangani terlebih dahulu.' };
      }
      if (group.stage === 'MENGETAHUI' && (!dilDone || !dicDone)) {
        return { ok: false, error: 'Seluruh slot pada tahap "Dicheck oleh" harus selesai terlebih dahulu.' };
      }

      const now = new Date().toISOString();
      commit((prev) => {
        const nextReports = prev.reports.map((r) => {
          if (r.id !== reportId) return r;
          const nextGroups = r.signatureGroups.map((g) =>
            g.id !== groupId
              ? g
              : {
                  ...g,
                  slots: g.slots.map((s) =>
                    s.id !== slotId
                      ? s
                      : {
                          ...s,
                          status: 'SIGNED' as const,
                          signedByUserId: actor.id,
                          signedByName: actor.name,
                          signedAt: now,
                          signatureImageUrl: signatureDataUrl,
                        }
                  ),
                }
          );
          const nextStage = computeStageFromGroups(nextGroups);
          const isFinal = nextStage === 'FINAL';
          const hashSource = JSON.stringify({
            documentId: r.documentId,
            period: r.period,
            rows: r.checkRows || r.inventoryRows,
            signatures: nextGroups.map((g) =>
              g.slots.map((s) => ({ id: s.id, at: s.signedAt, by: s.signedByName }))
            ),
          });
          return {
            ...r,
            signatureGroups: nextGroups,
            status: nextStage,
            locked: isFinal,
            docHash: computeDocHash(hashSource),
            updatedAt: now,
          };
        });

        const updatedReport = nextReports.find((r) => r.id === reportId)!;
        const newNotifs: AppNotification[] = [];
        if (updatedReport.status === 'FINAL') {
          newNotifs.push({
            id: `notif-fin-${Date.now()}`,
            title: 'Laporan Resmi Final & Terkunci',
            message: `${updatedReport.documentId} (${updatedReport.periodLabel}) telah lengkap ditandatangani dan terkunci sebagai arsip resmi HR Dept.`,
            type: 'LAPORAN',
            targetRoles: ['STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER', 'SUPER_ADMIN'],
            linkTo: '/app/reports',
            read: false,
            createdAt: now,
          });
        } else {
          // Notify next pending signers
          const nextPendingStage = updatedReport.status;
          const nextGroup = updatedReport.signatureGroups.find((g) => g.stage === nextPendingStage);
          nextGroup?.slots
            .filter((s) => s.status === 'PENDING')
            .forEach((s) => {
              newNotifs.push({
                id: `notif-next-${Date.now()}-${s.id}`,
                title: `Menunggu Tanda Tangan (${nextGroup.label.replace(',', '')})`,
                message: `${updatedReport.title} periode ${updatedReport.periodLabel} siap ditandatangani.`,
                type: 'TANDA_TANGAN',
                targetUserId: s.allowedUserId,
                linkTo: '/app/signatures',
                read: false,
                createdAt: now,
              });
            });
        }

        return {
          ...prev,
          reports: nextReports,
          notifications: [...newNotifs, ...prev.notifications],
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'SIGN',
              objectType: 'Tanda Tangan Digital',
              objectLabel: `${updatedReport.documentId} — ${group.label} ${slot.name}`,
              oldValue: report.status,
              newValue: updatedReport.status,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return { ok: true };
    },
    [commit, store.reports]
  );

  const rejectReport = useCallback(
    (reportId: string, note: string, actor: User) => {
      const now = new Date().toISOString();
      commit((prev) => {
        const rep = prev.reports.find((r) => r.id === reportId);
        if (!rep || rep.locked) return prev;

        return {
          ...prev,
          reports: prev.reports.map((r) => {
            if (r.id !== reportId) return r;
            const resetGroups = r.signatureGroups.map((g) => ({
              ...g,
              slots: g.slots.map((s) => ({
                ...s,
                status: 'PENDING' as const,
                signedByUserId: undefined,
                signedByName: undefined,
                signedAt: undefined,
                signatureImageUrl: undefined,
              })),
            }));
            return {
              ...r,
              status: 'DRAFT' as const,
              signatureGroups: resetGroups,
              rejectionHistory: [
                {
                  at: now,
                  byName: actor.name,
                  stage: r.status,
                  note: note || 'Dikembalikan untuk revisi data',
                },
                ...r.rejectionHistory,
              ],
              updatedAt: now,
            };
          }),
          notifications: [
            {
              id: `notif-rej-${Date.now()}`,
              title: 'Laporan Dikembalikan ke Draft',
              message: `${rep.documentId} ditolak oleh ${actor.name}: "${note || 'Perlu revisi'}"`,
              type: 'LAPORAN',
              targetRoles: ['STAFF', 'SUPER_ADMIN'],
              linkTo: '/app/reports',
              read: false,
              createdAt: now,
            },
            ...prev.notifications,
          ],
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'REJECT',
              objectType: 'Laporan Bulanan',
              objectLabel: rep.documentId,
              oldValue: rep.status,
              newValue: `DRAFT (${note})`,
            }),
            ...prev.auditLogs,
          ],
        };
      });
    },
    [commit]
  );

  const applyTemplateToReport = useCallback(
    (reportId: string, templateId: string, actor: User) => {
      const tpl = store.templates.find((t) => t.id === templateId);
      if (!tpl) return;
      commit((prev) => ({
        ...prev,
        reports: prev.reports.map((r) => {
          if (r.id !== reportId || r.locked) return r;
          const nextGroups: SignatureGroup[] = tpl.groups.map((g) => ({
            id: g.id,
            label: g.label,
            stage: g.stage,
            order: g.order,
            slots: g.slots.map((s) => ({
              id: s.id,
              name: s.name,
              jabatan: s.jabatan,
              allowedUserId: s.allowedUserId,
              order: s.order,
              status: 'PENDING',
            })),
          }));
          return {
            ...r,
            templateId: tpl.id,
            signatureGroups: nextGroups,
            status: 'DRAFT',
            updatedAt: new Date().toISOString(),
          };
        }),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Template Tanda Tangan Laporan',
            objectLabel: `${reportId} -> ${tpl.name}`,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit, store.templates]
  );

  const upsertSignatureTemplate = useCallback(
    (tpl: SignatureTemplate, actor: User) => {
      commit((prev) => {
        const exists = prev.templates.some((t) => t.id === tpl.id);
        let templates = exists
          ? prev.templates.map((t) => (t.id === tpl.id ? tpl : t))
          : [...prev.templates, tpl];
        if (tpl.isDefault) {
          templates = templates.map((t) =>
            t.jenis === tpl.jenis && t.id !== tpl.id ? { ...t, isDefault: false } : t
          );
        }
        return {
          ...prev,
          templates,
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: exists ? 'UPDATE' : 'CREATE',
              objectType: 'Template Tanda Tangan',
              objectLabel: tpl.name,
            }),
            ...prev.auditLogs,
          ],
        };
      });
    },
    [commit]
  );

  const deleteSignatureTemplate = useCallback(
    (tplId: string, actor: User) => {
      commit((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== tplId),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'DELETE',
            objectType: 'Template Tanda Tangan',
            objectLabel: tplId,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const sendReminderNotification = useCallback(
    (reportId: string, actor: User) => {
      const rep = store.reports.find((r) => r.id === reportId);
      if (!rep) return;
      const now = new Date().toISOString();
      const pendingSlots = rep.signatureGroups.flatMap((g) =>
        g.slots.filter((s) => s.status === 'PENDING').map((s) => ({ group: g.label, slot: s }))
      );
      if (pendingSlots.length === 0) return;

      const newNotifs: AppNotification[] = pendingSlots.map((p, i) => ({
        id: `notif-rem-${Date.now()}-${i}`,
        title: 'Pengingat Tanda Tangan Laporan',
        message: `${actor.name} mengingatkan Anda untuk menandatangani ${rep.title} (${rep.periodLabel}).`,
        type: 'PENGINGAT',
        targetUserId: p.slot.allowedUserId,
        linkTo: '/app/signatures',
        read: false,
        createdAt: now,
      }));

      commit((prev) => ({
        ...prev,
        notifications: [...newNotifs, ...prev.notifications],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'CREATE',
            objectType: 'Pengingat Tanda Tangan',
            objectLabel: `${rep.documentId} (${pendingSlots.length} penanda tangan)`,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit, store.reports]
  );

  const getNextPartId = useCallback(
    (prefix: PartPrefix): string => {
      const matching = store.inventories.filter((inv) => inv.prefix === prefix);
      let maxNum = 0;
      matching.forEach((m) => {
        const numPart = Number(m.partId.split('-')[1]);
        if (Number.isFinite(numPart) && numPart > maxNum) maxNum = numPart;
      });
      return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
    },
    [store.inventories]
  );

  const upsertInventoryItem = useCallback(
    (
      input: Omit<OverheadInventoryItem, 'id' | 'partId' | 'mutations' | 'createdAt' | 'updatedAt'> & {
        id?: string;
        partId?: string;
      },
      actor: User
    ): OverheadInventoryItem => {
      const now = new Date().toISOString();
      const existing = input.id ? store.inventories.find((x) => x.id === input.id) : undefined;
      const partId = existing ? existing.partId : input.partId || getNextPartId(input.prefix);
      const saved: OverheadInventoryItem = existing
        ? {
            ...existing,
            ...input,
            id: existing.id,
            partId,
            updatedAt: now,
          }
        : {
            ...input,
            id: `inv-${Date.now()}`,
            partId,
            mutations: [
              {
                id: `mut-${Date.now()}`,
                date: now.slice(0, 10),
                type: 'IN',
                qty: input.qty,
                note: 'Pendaftaran aset inventaris baru',
                byName: actor.name,
              },
            ],
            createdAt: now,
            updatedAt: now,
          };

      commit((prev) => ({
        ...prev,
        inventories: existing
          ? prev.inventories.map((i) => (i.id === saved.id ? saved : i))
          : [...prev.inventories, saved],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: existing ? 'UPDATE' : 'CREATE',
            objectType: 'Inventaris Overhead',
            objectLabel: `${saved.partId} — ${saved.itemName}`,
          }),
          ...prev.auditLogs,
        ],
      }));
      return saved;
    },
    [commit, getNextPartId, store.inventories]
  );

  const recordInventoryMutation = useCallback(
    (
      inventoryId: string,
      type: 'IN' | 'OUT' | 'KONDISI',
      qty: number,
      condition: 'BAGUS' | 'RUSAK',
      note: string,
      actor: User
    ) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        inventories: prev.inventories.map((inv) => {
          if (inv.id !== inventoryId) return inv;
          const nextQty =
            type === 'IN' ? inv.qty + qty : type === 'OUT' ? Math.max(0, inv.qty - qty) : inv.qty;
          return {
            ...inv,
            qty: nextQty,
            condition,
            mutations: [
              {
                id: `mut-${Date.now()}`,
                date: now.slice(0, 10),
                type,
                qty,
                note: note || (type === 'KONDISI' ? `Update kondisi: ${condition}` : `Mutasi ${type}`),
                byName: actor.name,
              },
              ...inv.mutations,
            ],
            updatedAt: now,
          };
        }),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Mutasi Inventaris',
            objectLabel: `${inventoryId} (${type} ${qty})`,
            newValue: note,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const upsertEmployee = useCallback(
    (
      emp: Omit<HrEmployee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
      actor: User
    ): { ok: boolean; employee?: HrEmployee; error?: string } => {
      const cleanName = emp.name.trim();
      const cleanNik = emp.nik.trim().toUpperCase();
      if (!cleanName) {
        return { ok: false, error: 'Nama karyawan wajib diisi.' };
      }

      if (cleanNik) {
        const dupNik = (store.employees || []).find(
          (e) => e.id !== emp.id && e.nik.trim().toUpperCase() === cleanNik
        );
        if (dupNik) {
          return {
            ok: false,
            error: `NIK "${cleanNik}" sudah terdaftar atas nama ${dupNik.name}.`,
          };
        }
      }

      const now = new Date().toISOString();
      const existing = emp.id ? (store.employees || []).find((e) => e.id === emp.id) : undefined;
      const saved: HrEmployee = existing
        ? {
            ...existing,
            nik: cleanNik,
            name: cleanName,
            section: emp.section,
            jabatan: emp.jabatan.trim(),
            active: emp.active,
            updatedAt: now,
          }
        : {
            id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            nik: cleanNik,
            name: cleanName,
            section: emp.section,
            jabatan: emp.jabatan.trim(),
            active: emp.active,
            createdAt: now,
            updatedAt: now,
          };

      commit((prev) => {
        const list = prev.employees || [];
        const nextList = existing
          ? list.map((e) => (e.id === saved.id ? saved : e))
          : [saved, ...list];
        return {
          ...prev,
          employees: nextList,
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: existing ? 'UPDATE' : 'CREATE',
              objectType: 'Karyawan Dept. HR',
              objectLabel: `${saved.name}${saved.nik ? ` (${saved.nik})` : ''} · ${saved.section}`,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return { ok: true, employee: saved };
    },
    [commit, store.employees]
  );

  const deleteEmployee = useCallback(
    (id: string, actor: User) => {
      const target = (store.employees || []).find((e) => e.id === id);
      if (!target) return;
      commit((prev) => ({
        ...prev,
        employees: (prev.employees || []).filter((e) => e.id !== id),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'DELETE',
            objectType: 'Karyawan Dept. HR',
            objectLabel: `${target.name}${target.nik ? ` (${target.nik})` : ''}`,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit, store.employees]
  );

  const importEmployeesBatch = useCallback(
    (
      rows: Array<{ nik: string; name: string; section: HrSection; jabatan: string }>,
      actor: User
    ): { added: number; updated: number } => {
      const now = new Date().toISOString();
      let added = 0;
      let updated = 0;

      commit((prev) => {
        const list = [...(prev.employees || [])];
        for (const r of rows) {
          const cleanName = r.name.trim();
          if (!cleanName) continue;
          const cleanNik = r.nik.trim().toUpperCase();

          const matchIdx = list.findIndex((e) =>
            cleanNik
              ? e.nik.trim().toUpperCase() === cleanNik
              : e.name.trim().toLowerCase() === cleanName.toLowerCase()
          );

          if (matchIdx >= 0) {
            list[matchIdx] = {
              ...list[matchIdx],
              nik: cleanNik || list[matchIdx].nik,
              name: cleanName,
              section: r.section,
              jabatan: r.jabatan.trim() || list[matchIdx].jabatan,
              active: true,
              updatedAt: now,
            };
            updated++;
          } else {
            list.push({
              id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              nik: cleanNik,
              name: cleanName,
              section: r.section,
              jabatan: r.jabatan.trim(),
              active: true,
              createdAt: now,
              updatedAt: now,
            });
            added++;
          }
        }

        return {
          ...prev,
          employees: list,
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'IMPORT',
              objectType: 'Karyawan Dept. HR',
              objectLabel: `Import ${added} baru, ${updated} diperbarui`,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return { added, updated };
    },
    [commit]
  );

  const createItemRequest = useCallback(
    (req: Omit<ItemRequest, 'id' | 'status'>, actor?: User): ItemRequest => {
      const created: ItemRequest = {
        ...req,
        id: `req-${Date.now()}`,
        status: 'MENUNGGU',
        source: req.source || (actor ? 'ADMIN' : 'PORTAL_DEPAN'),
      };
      const now = new Date().toISOString();
      const totalUnits = created.items.reduce((s, it) => s + it.qty, 0);
      commit((prev) => ({
        ...prev,
        itemRequests: [created, ...prev.itemRequests],
        notifications: [
          {
            id: `notif-req-${Date.now()}`,
            title: 'Pengambilan Barang Menunggu Approval',
            message: `${created.requesterName} (${created.requesterSection}) mengajukan ${created.items.length} jenis barang (${totalUnits} unit).`,
            type: 'LAPORAN',
            targetRoles: ['STAFF', 'SECTION_MANAGER', 'SUPER_ADMIN'],
            linkTo: '/app/requests',
            read: false,
            createdAt: now,
          },
          ...prev.notifications,
        ],
        auditLogs: actor
          ? [
              makeAudit({
                userId: actor.id,
                userName: actor.name,
                userRole: actor.role,
                action: 'CREATE',
                objectType: 'Pengambilan Barang',
                objectLabel: `${created.requesterName} (${created.requesterSection}) · ${created.items.length} item`,
              }),
              ...prev.auditLogs,
            ]
          : prev.auditLogs,
      }));
      return created;
    },
    [commit]
  );

  const processItemRequest = useCallback(
    (
      reqId: string,
      approve: boolean,
      actor: User,
      rejectionNote?: string
    ): { ok: boolean; error?: string } => {
      const req = store.itemRequests.find((r) => r.id === reqId);
      if (!req) return { ok: false, error: 'Permintaan tidak ditemukan.' };
      if (req.status !== 'MENUNGGU') return { ok: false, error: 'Permintaan sudah diproses.' };

      if (approve) {
        const res = recordTransactions(
          req.items.map((it) => ({
            itemId: it.itemId,
            type: 'PAKAI',
            qty: it.qty,
            date: new Date().toISOString().slice(0, 10),
            note: `Pengambilan Karyawan ${req.requesterName}${req.requesterNik ? ` (${req.requesterNik})` : ''} · ${req.requesterSection}${req.note ? ` — ${req.note}` : ''}`,
          })),
          actor
        );
        if (!res.ok) return res;
      }

      const now = new Date().toISOString();
      const cleanRejectNote = !approve && rejectionNote?.trim() ? rejectionNote.trim() : undefined;
      commit((prev) => ({
        ...prev,
        itemRequests: prev.itemRequests.map((r) =>
          r.id === reqId
            ? {
                ...r,
                status: approve ? 'DISETUJUI' : 'DITOLAK',
                rejectionNote: cleanRejectNote,
                processedByName: actor.name,
                processedAt: now,
              }
            : r
        ),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: approve ? 'APPROVE' : 'REJECT',
            objectType: 'Pengambilan Barang',
            objectLabel: `${req.requesterName} (${req.requesterSection})`,
            newValue: cleanRejectNote || (approve ? 'Disetujui & dicatat Pakai' : 'Ditolak'),
          }),
          ...prev.auditLogs,
        ],
      }));

      return { ok: true };
    },
    [commit, recordTransactions, store.itemRequests]
  );

  const setActiveForecastMonth = useCallback(
    (month: ForecastMonthKey, actor: User) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        rollingForecast: {
          ...prev.rollingForecast,
          activeMonth: month,
          lastUpdatedAt: now,
          lastUpdatedBy: actor.name,
        },
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Rolling Forecast GA',
            objectLabel: `Bulan aktif diubah ke ${month}`,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit]
  );

  const updateForecastRow = useCallback(
    (
      rowId: string,
      patch: {
        rmStock?: number | null;
        monthQty?: { month: ForecastMonthKey; qty: number | undefined };
        estPemakaian?: string;
        keterangan?: string;
      },
      actor?: User
    ) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        rollingForecast: {
          ...prev.rollingForecast,
          lastUpdatedAt: now,
          lastUpdatedBy: actor?.name || prev.rollingForecast.lastUpdatedBy,
          rows: prev.rollingForecast.rows.map((r) => {
            if (r.id !== rowId) return r;
            const nextMonths = { ...r.months };
            if (patch.monthQty) {
              if (
                patch.monthQty.qty === undefined ||
                Number.isNaN(patch.monthQty.qty) ||
                patch.monthQty.qty <= 0
              ) {
                delete nextMonths[patch.monthQty.month];
              } else {
                nextMonths[patch.monthQty.month] = Math.round(patch.monthQty.qty);
              }
            }
            return {
              ...r,
              rmStock: patch.rmStock !== undefined ? patch.rmStock : r.rmStock,
              months: nextMonths,
              estPemakaian: patch.estPemakaian !== undefined ? patch.estPemakaian : r.estPemakaian,
              keterangan: patch.keterangan !== undefined ? patch.keterangan : r.keterangan,
              updatedAt: now,
            };
          }),
        },
      }));
    },
    [commit]
  );

  const addForecastRow = useCallback(
    (
      input: {
        jenis: string;
        codeItem: string;
        itemName: string;
        itemDescription: string;
        uom: string;
        rmStock: number | null;
        estPemakaian?: string;
        keterangan?: string;
      },
      actor: User
    ): RollingForecastRow => {
      const now = new Date().toISOString();
      const existingRows = store.rollingForecast.rows;
      const matchJenis = existingRows.find(
        (r) => r.jenis.toLowerCase() === input.jenis.trim().toLowerCase()
      );
      const maxJenisNo = existingRows.reduce((m, r) => Math.max(m, r.jenisNo), 0);
      const maxItemNo = existingRows.reduce((m, r) => Math.max(m, r.itemNo), 0);

      const newRow: RollingForecastRow = {
        id: `rf-${Date.now()}`,
        jenisNo: matchJenis ? matchJenis.jenisNo : maxJenisNo + 1,
        jenis: matchJenis ? matchJenis.jenis : input.jenis.trim(),
        itemNo: maxItemNo + 1,
        codeItem: input.codeItem.trim(),
        itemName: input.itemName.trim(),
        itemDescription: (input.itemDescription || input.itemName).trim(),
        uom: input.uom.trim().toUpperCase() || 'PC',
        rmStock: input.rmStock,
        months: {},
        estPemakaian: input.estPemakaian || '',
        keterangan: input.keterangan || '',
        updatedAt: now,
      };

      commit((prev) => ({
        ...prev,
        rollingForecast: {
          ...prev.rollingForecast,
          rows: [...prev.rollingForecast.rows, newRow],
          lastUpdatedAt: now,
          lastUpdatedBy: actor.name,
        },
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'CREATE',
            objectType: 'Item Rolling Forecast GA',
            objectLabel: `${newRow.codeItem || '-'} ${newRow.itemDescription}`,
          }),
          ...prev.auditLogs,
        ],
      }));

      return newRow;
    },
    [commit, store.rollingForecast.rows]
  );

  const syncForecastStockFromMaster = useCallback(
    (actor: User): number => {
      const now = new Date().toISOString();
      let syncedCount = 0;
      const activeOfficeItems = store.items.filter(
        (i) => !i.archived && i.jenis === 'OFFICE_SUPPLIES'
      );

      commit((prev) => {
        const nextRows = prev.rollingForecast.rows.map((row) => {
          const byCode = row.codeItem
            ? activeOfficeItems.find((it) => it.codeItem && it.codeItem === row.codeItem)
            : undefined;
          const byName = !byCode
            ? activeOfficeItems.find(
                (it) =>
                  it.itemName.toLowerCase() === row.itemDescription.toLowerCase() ||
                  it.itemName.toLowerCase() === row.itemName.toLowerCase()
              )
            : undefined;
          const matched = byCode || byName;
          if (!matched) return row;
          if (row.rmStock === matched.currentStock) return row;
          syncedCount += 1;
          return {
            ...row,
            rmStock: matched.currentStock,
            updatedAt: now,
          };
        });

        return {
          ...prev,
          rollingForecast: {
            ...prev.rollingForecast,
            rows: nextRows,
            lastUpdatedAt: now,
            lastUpdatedBy: actor.name,
          },
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'UPDATE',
              objectType: 'Sinkronisasi R/M Stock RF',
              objectLabel: `${syncedCount} baris diperbarui dari Master Item`,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return syncedCount;
    },
    [commit, store.items]
  );

  const copyForecastMonth = useCallback(
    (fromMonth: ForecastMonthKey, toMonth: ForecastMonthKey, actor: User): number => {
      if (fromMonth === toMonth) return 0;
      const now = new Date().toISOString();
      let copiedCount = 0;

      commit((prev) => {
        const nextRows = prev.rollingForecast.rows.map((row) => {
          const val = row.months[fromMonth];
          if (!val || val <= 0) return row;
          copiedCount += 1;
          return {
            ...row,
            months: { ...row.months, [toMonth]: val },
            updatedAt: now,
          };
        });

        return {
          ...prev,
          rollingForecast: {
            ...prev.rollingForecast,
            activeMonth: toMonth,
            rows: nextRows,
            lastUpdatedAt: now,
            lastUpdatedBy: actor.name,
          },
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'UPDATE',
              objectType: 'Salin Rolling Forecast GA',
              objectLabel: `${fromMonth} → ${toMonth} (${copiedCount} item)`,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return copiedCount;
    },
    [commit]
  );

  const prefillCriticalForecast = useCallback(
    (month: ForecastMonthKey, actor: User): number => {
      const now = new Date().toISOString();
      const criticalOffice = store.items.filter(
        (i) => !i.archived && i.jenis === 'OFFICE_SUPPLIES' && i.currentStock <= i.minStock
      );
      let updatedCount = 0;

      commit((prev) => {
        const nextRows = prev.rollingForecast.rows.map((row) => {
          const matched = criticalOffice.find(
            (it) =>
              (row.codeItem && it.codeItem && it.codeItem === row.codeItem) ||
              it.itemName.toLowerCase() === row.itemDescription.toLowerCase()
          );
          if (!matched) return row;
          const suggestedQty = Math.max(1, matched.minStock * 2 - matched.currentStock);
          updatedCount += 1;
          return {
            ...row,
            rmStock: matched.currentStock,
            months: { ...row.months, [month]: suggestedQty },
            updatedAt: now,
          };
        });

        return {
          ...prev,
          rollingForecast: {
            ...prev.rollingForecast,
            activeMonth: month,
            rows: nextRows,
            lastUpdatedAt: now,
            lastUpdatedBy: actor.name,
          },
          auditLogs: [
            makeAudit({
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              action: 'UPDATE',
              objectType: 'Isi Otomatis Forecast Stok Kritis',
              objectLabel: `Periode ${month} (${updatedCount} item)`,
            }),
            ...prev.auditLogs,
          ],
        };
      });

      return updatedCount;
    },
    [commit, store.items]
  );

  const submitMonthlyForecast = useCallback(
    (month: ForecastMonthKey, note: string, actor: User): RollingForecastSubmission => {
      const now = new Date().toISOString();
      const filled = store.rollingForecast.rows.filter((r) => (r.months[month] || 0) > 0);
      const totalUnits = filled.reduce((s, r) => s + (r.months[month] || 0), 0);

      const submission: RollingForecastSubmission = {
        id: `rf-sub-${Date.now()}`,
        month,
        submittedAt: now,
        submittedByName: actor.name,
        totalItemsRequested: filled.length,
        totalUnitsRequested: totalUnits,
        note: note.trim() || `Update Rolling Forecast pemesanan Office Supplies bulan ${month} ke GA Dept.`,
      };

      commit((prev) => ({
        ...prev,
        rollingForecast: {
          ...prev.rollingForecast,
          activeMonth: month,
          submissions: [submission, ...prev.rollingForecast.submissions],
          lastUpdatedAt: now,
          lastUpdatedBy: actor.name,
        },
        notifications: [
          {
            id: `notif-rf-${Date.now()}`,
            title: `Rolling Forecast GA (${month}) Diperbarui`,
            message: `${actor.name} mencatat ${filled.length} item (${totalUnits} unit) untuk dikirim ke GA Dept.`,
            type: 'LAPORAN',
            targetRoles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
            linkTo: '/app/forecast',
            read: false,
            createdAt: now,
          },
          ...prev.notifications,
        ],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'EXPORT',
            objectType: 'Rolling Forecast GA',
            objectLabel: `Kirim Forecast ${month} ke GA Dept.`,
            newValue: `${filled.length} item · ${totalUnits} unit`,
          }),
          ...prev.auditLogs,
        ],
      }));

      return submission;
    },
    [commit, store.rollingForecast.rows]
  );

  const addDocument = useCallback(
    (
      docInput: Omit<SystemDocument, 'uploadedByUserId' | 'uploadedByName' | 'uploadedAt' | 'updatedAt'>,
      actor: User
    ): SystemDocument => {
      const now = new Date().toISOString();
      const saved: SystemDocument = {
        ...docInput,
        uploadedByUserId: actor.id,
        uploadedByName: actor.name,
        uploadedAt: now,
        updatedAt: now,
      };
      commit((prev) => ({
        ...prev,
        documents: [saved, ...(prev.documents || [])],
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'CREATE',
            objectType: 'Upload Dokumen',
            objectLabel: `${saved.title} (${saved.fileName})`,
            newValue: `${saved.category} · Periode ${saved.period}`,
          }),
          ...prev.auditLogs,
        ],
      }));
      return saved;
    },
    [commit]
  );

  const updateDocument = useCallback(
    (
      docId: string,
      patch: Partial<Pick<SystemDocument, 'title' | 'category' | 'period' | 'linkedModule' | 'linkedReportId' | 'notes'>>,
      actor: User
    ) => {
      const target = (store.documents || []).find((d) => d.id === docId);
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        documents: (prev.documents || []).map((d) =>
          d.id === docId ? { ...d, ...patch, updatedAt: now } : d
        ),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'UPDATE',
            objectType: 'Metadata Dokumen',
            objectLabel: patch.title || target?.title || docId,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit, store.documents]
  );

  const deleteDocument = useCallback(
    (docId: string, actor: User) => {
      const target = (store.documents || []).find((d) => d.id === docId);
      if (target?.storagePath) {
        void deleteDocumentFromStorage(target.storagePath);
      }
      commit((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((d) => d.id !== docId),
        auditLogs: [
          makeAudit({
            userId: actor.id,
            userName: actor.name,
            userRole: actor.role,
            action: 'DELETE',
            objectType: 'Arsip Dokumen',
            objectLabel: target ? `${target.title} (${target.fileName})` : docId,
          }),
          ...prev.auditLogs,
        ],
      }));
    },
    [commit, store.documents]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },
    [commit]
  );

  const markAllNotificationsRead = useCallback(() => {
    commit((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, [commit]);

  return (
    <SupplyHubContext.Provider
      value={{
        store,
        isSupabaseConnected,
        supabaseHost,
        syncStatus,
        lastHealthReport,
        testSupabaseConnection,
        syncAllToSupabase,
        replaceSupabaseFromLocal,
        refreshFromSupabase,
        resetDemoData,
        exportBackupJson,
        importBackupJson,
        upsertUser,
        reassignUserSlots,
        deleteUser,
        updateUserSavedSignature,
        updateMasterData,
        updateSettings,
        upsertItem,
        bulkUpdateItems,
        toggleArchiveItem,
        duplicateItem,
        importItemsBatch,
        getRecommendedMinStock,
        recordTransactions,
        createOpnameSession,
        reviewOpnameSession,
        createMonthlyReport,
        updateReportPlaceDate,
        updateReportCheckRow,
        duplicateReportToNextMonth,
        signReportSlot,
        rejectReport,
        applyTemplateToReport,
        upsertSignatureTemplate,
        deleteSignatureTemplate,
        sendReminderNotification,
        getNextPartId,
        upsertInventoryItem,
        recordInventoryMutation,
        upsertEmployee,
        deleteEmployee,
        importEmployeesBatch,
        createItemRequest,
        processItemRequest,
        setActiveForecastMonth,
        updateForecastRow,
        addForecastRow,
        syncForecastStockFromMaster,
        copyForecastMonth,
        prefillCriticalForecast,
        submitMonthlyForecast,
        addDocument,
        updateDocument,
        deleteDocument,
        markNotificationRead,
        markAllNotificationsRead,
        logAction,
      }}
    >
      {children}
    </SupplyHubContext.Provider>
  );
};

export function useSupplyHub(): SupplyHubContextValue {
  const ctx = useContext(SupplyHubContext);
  if (!ctx) throw new Error('useSupplyHub harus digunakan di dalam SupplyHubProvider');
  return ctx;
}
