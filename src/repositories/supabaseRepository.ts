import { buildSeedStore } from '../data/seedData';
import { buildRollingForecastSeed } from '../data/forecastSeed';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
  uploadDataUrlToStorage,
  uploadDocumentDataUrlToStorage,
} from '../services/mediaStorageService';
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
  OverheadInventoryMutation,
  RollingForecastRow,
  RollingForecastSubmission,
  SignatureTemplate,
  StockTransaction,
  SupplyHubStore,
  SupplyItem,
  SystemDocument,
  User,
} from '../types';
import { LocalStorageSupplyHubRepository } from './localStorageRepository';
import type { ISupplyHubRepository, SyncResult } from './types';

function chunkArray<T>(arr: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function upsertInBatches(table: string, rows: Record<string, unknown>[], onConflict = 'id') {
  if (!supabase || rows.length === 0) return;
  for (const batch of chunkArray(rows, 150)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`Supabase upsert [${table}] gagal: ${error.message}`);
    }
  }
}

async function deleteByIds(table: string, ids: string[]) {
  if (!supabase || ids.length === 0) return;
  for (const batch of chunkArray(ids, 150)) {
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) {
      throw new Error(`Supabase delete [${table}] gagal: ${error.message}`);
    }
  }
}

async function deleteOrphanIds(table: string, keepIds: Set<string>, filterCol?: { col: string; val: string }) {
  if (!supabase) return;
  let query = supabase.from(table).select('id');
  if (filterCol) {
    query = query.eq(filterCol.col, filterCol.val);
  }
  const { data, error } = await query;
  if (error || !data) return;
  const orphanIds = (data as Array<{ id: string }>)
    .map((r) => String(r.id))
    .filter((id) => !keepIds.has(id));
  await deleteByIds(table, orphanIds);
}

async function uploadReportSignaturesIfNeeded(report: MonthlyReport): Promise<MonthlyReport> {
  if (!isSupabaseConfigured || !supabase) return report;
  let changed = false;
  const nextGroups = await Promise.all(
    report.signatureGroups.map(async (g) => ({
      ...g,
      slots: await Promise.all(
        g.slots.map(async (s) => {
          if (s.signatureImageUrl && s.signatureImageUrl.startsWith('data:')) {
            const uploaded = await uploadDataUrlToStorage(
              s.signatureImageUrl,
              'signatures',
              `${report.id}-${s.id}`
            );
            if (uploaded !== s.signatureImageUrl) {
              changed = true;
              return { ...s, signatureImageUrl: uploaded };
            }
          }
          return s;
        })
      ),
    }))
  );
  return changed ? { ...report, signatureGroups: nextGroups } : report;
}

/**
 * Mengunggah otomatis foto/tanda tangan berbentuk DataURL (base64) ke Supabase Storage
 * sebelum disinkronkan ke tabel PostgreSQL agar database tetap ringan & terintegrasi penuh.
 */
async function prepareStoreMediaForCloud(store: SupplyHubStore): Promise<SupplyHubStore> {
  const users = await Promise.all(
    store.users.map(async (u) => {
      if (u.savedSignatureDataUrl && u.savedSignatureDataUrl.startsWith('data:')) {
        const uploaded = await uploadDataUrlToStorage(u.savedSignatureDataUrl, 'signatures', u.id);
        return { ...u, savedSignatureDataUrl: uploaded };
      }
      return u;
    })
  );

  const items = await Promise.all(
    store.items.map(async (it) => {
      if (it.photoUrl && it.photoUrl.startsWith('data:')) {
        const uploaded = await uploadDataUrlToStorage(it.photoUrl, 'items', it.id);
        return { ...it, photoUrl: uploaded };
      }
      return it;
    })
  );

  const inventories = await Promise.all(
    store.inventories.map(async (inv) => {
      if (inv.photoUrl && inv.photoUrl.startsWith('data:')) {
        const uploaded = await uploadDataUrlToStorage(inv.photoUrl, 'inventories', inv.id);
        return { ...inv, photoUrl: uploaded };
      }
      return inv;
    })
  );

  const documents = await Promise.all(
    (store.documents || []).map(async (doc) => {
      if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
        const uploaded = await uploadDocumentDataUrlToStorage(
          doc.fileUrl,
          doc.category,
          doc.id,
          doc.fileName
        );
        return {
          ...doc,
          fileUrl: uploaded.fileUrl,
          storagePath: uploaded.storagePath ?? doc.storagePath,
        };
      }
      return doc;
    })
  );

  const reports = await Promise.all(store.reports.map(uploadReportSignaturesIfNeeded));

  return {
    ...store,
    users,
    items,
    inventories,
    documents,
    reports,
  };
}

interface RefIdSets {
  userIds: Set<string>;
  templateIds: Set<string>;
  reportIds: Set<string>;
}

function buildRefIdSets(store: SupplyHubStore): RefIdSets {
  return {
    userIds: new Set(store.users.map((u) => u.id)),
    templateIds: new Set(store.templates.map((t) => t.id)),
    reportIds: new Set(store.reports.map((r) => r.id)),
  };
}

function safeFk(id: string | undefined | null, validIds?: Set<string>): string | null {
  const clean = id?.trim();
  if (!clean) return null;
  if (validIds && !validIds.has(clean)) return null;
  return clean;
}

// ============================================================================
// MAPPERS: App Store <-> PostgreSQL Rows (17 Tabel Supabase)
// ============================================================================

const toUserRow = (u: User) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  password_hash: u.password,
  name: u.name,
  role: u.role,
  jabatan: u.jabatan,
  seksi: u.seksi,
  avatar_initials: u.avatarInitials,
  saved_signature_url: u.savedSignatureDataUrl ?? null,
  active: u.active,
});

const fromUserRow = (r: Record<string, unknown>): User => ({
  id: String(r.id),
  username: String(r.username),
  email: String(r.email),
  password: String(r.password_hash ?? ''),
  name: String(r.name),
  role: r.role as User['role'],
  jabatan: String(r.jabatan ?? ''),
  seksi: String(r.seksi ?? ''),
  avatarInitials: String(r.avatar_initials ?? 'HR'),
  savedSignatureDataUrl: r.saved_signature_url ? String(r.saved_signature_url) : undefined,
  active: Boolean(r.active),
});

const toItemRow = (i: SupplyItem) => ({
  id: i.id,
  jenis: i.jenis,
  kategori: i.kategori,
  code_item: i.codeItem,
  item_name: i.itemName,
  uom: i.uom,
  min_stock: Math.max(0, Math.round(Number(i.minStock) || 0)),
  current_stock: Math.max(0, Math.round(Number(i.currentStock) || 0)),
  location: i.location,
  notes: i.notes,
  photo_url: i.photoUrl ?? null,
  archived: i.archived,
  sort_order: i.sortOrder ?? null,
  created_at: i.createdAt,
  updated_at: i.updatedAt,
});

const fromItemRow = (r: Record<string, unknown>): SupplyItem => ({
  id: String(r.id),
  jenis: r.jenis as SupplyItem['jenis'],
  kategori: String(r.kategori),
  codeItem: String(r.code_item ?? ''),
  itemName: String(r.item_name),
  uom: String(r.uom ?? 'PC'),
  minStock: Number(r.min_stock ?? 0),
  currentStock: Number(r.current_stock ?? 0),
  location: String(r.location ?? ''),
  notes: String(r.notes ?? ''),
  photoUrl: r.photo_url ? String(r.photo_url) : undefined,
  archived: Boolean(r.archived),
  sortOrder: r.sort_order != null ? Number(r.sort_order) : undefined,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

const toTxRow = (t: StockTransaction, refs?: RefIdSets) => ({
  id: t.id,
  item_id: t.itemId,
  jenis: t.jenis,
  code_item: t.codeItem,
  item_name: t.itemName,
  uom: t.uom,
  type: t.type,
  qty: Math.round(Number(t.qty) || 0),
  tx_date: t.date,
  period: t.period,
  recorded_by_user_id: safeFk(t.recordedByUserId, refs?.userIds),
  recorded_by_name: t.recordedByName,
  note: t.note,
  reference_no: t.referenceNo ?? null,
  created_at: t.createdAt,
});

const fromTxRow = (r: Record<string, unknown>): StockTransaction => ({
  id: String(r.id),
  itemId: String(r.item_id),
  jenis: r.jenis as StockTransaction['jenis'],
  codeItem: String(r.code_item ?? ''),
  itemName: String(r.item_name),
  uom: String(r.uom ?? 'PC'),
  type: r.type as StockTransaction['type'],
  qty: Number(r.qty ?? 0),
  date: String(r.tx_date),
  period: String(r.period),
  recordedByUserId: String(r.recorded_by_user_id ?? ''),
  recordedByName: String(r.recorded_by_name ?? ''),
  note: String(r.note ?? ''),
  referenceNo: r.reference_no ? String(r.reference_no) : undefined,
  createdAt: String(r.created_at),
});

const toOpnameSessionRow = (o: OpnameSession, refs?: RefIdSets) => ({
  id: o.id,
  period: o.period,
  jenis: o.jenis,
  status: o.status,
  created_by_user_id: safeFk(o.createdByUserId, refs?.userIds),
  created_by_name: o.createdByName,
  approved_by_user_id: safeFk(o.approvedByUserId, refs?.userIds),
  approved_by_name: o.approvedByName ?? null,
  approved_at: o.approvedAt ?? null,
  rejection_note: o.rejectionNote ?? null,
  created_at: o.createdAt,
});

const toOpnameLineRows = (o: OpnameSession) =>
  o.lines.map((l, idx) => ({
    id: `${o.id}__${l.itemId}`,
    session_id: o.id,
    item_id: l.itemId,
    kategori: l.kategori,
    code_item: l.codeItem,
    item_name: l.itemName,
    uom: l.uom,
    stok_awal: l.stokAwal,
    terima: l.terima,
    pakai: l.pakai,
    system_stock: l.systemStock,
    physical_stock: l.physicalStock,
    diff: l.diff,
    reason: l.reason,
    balanced: l.balanced,
    sort_index: idx,
  }));

const toTemplateRow = (t: SignatureTemplate) => ({
  id: t.id,
  name: t.name,
  jenis: t.jenis,
  is_default: t.isDefault,
  groups: t.groups,
});

const fromTemplateRow = (r: Record<string, unknown>): SignatureTemplate => ({
  id: String(r.id),
  name: String(r.name),
  jenis: r.jenis as SignatureTemplate['jenis'],
  isDefault: Boolean(r.is_default),
  groups: (r.groups as SignatureTemplate['groups']) || [],
});

const toReportRow = (rep: MonthlyReport, refs?: RefIdSets) => ({
  id: rep.id,
  document_id: rep.documentId,
  doc_hash: rep.docHash,
  jenis: rep.jenis,
  title: rep.title,
  period: rep.period,
  period_label: rep.periodLabel,
  department: rep.department,
  section: rep.section,
  place_date_text: rep.placeDateText,
  status: rep.status,
  check_rows: rep.checkRows ?? null,
  inventory_rows: rep.inventoryRows ?? null,
  signature_groups: rep.signatureGroups,
  template_id: safeFk(rep.templateId, refs?.templateIds),
  locked: rep.locked,
  version: rep.version,
  versions: rep.versions,
  rejection_history: rep.rejectionHistory,
  created_at: rep.createdAt,
  updated_at: rep.updatedAt,
});

const fromReportRow = (r: Record<string, unknown>): MonthlyReport => ({
  id: String(r.id),
  documentId: String(r.document_id),
  docHash: String(r.doc_hash),
  jenis: r.jenis as MonthlyReport['jenis'],
  title: String(r.title),
  period: String(r.period),
  periodLabel: String(r.period_label),
  department: String(r.department),
  section: String(r.section),
  placeDateText: String(r.place_date_text),
  status: r.status as MonthlyReport['status'],
  checkRows: (r.check_rows as MonthlyReport['checkRows']) ?? undefined,
  inventoryRows: (r.inventory_rows as MonthlyReport['inventoryRows']) ?? undefined,
  signatureGroups: (r.signature_groups as MonthlyReport['signatureGroups']) || [],
  templateId: String(r.template_id ?? ''),
  locked: Boolean(r.locked),
  version: Number(r.version ?? 1),
  versions: (r.versions as MonthlyReport['versions']) || [],
  rejectionHistory: (r.rejection_history as MonthlyReport['rejectionHistory']) || [],
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

const toInventoryRow = (inv: OverheadInventoryItem) => ({
  id: inv.id,
  part_id: inv.partId,
  prefix: inv.prefix,
  kategori: inv.kategori,
  item_name: inv.itemName,
  qty: Math.max(0, Math.round(Number(inv.qty) || 0)),
  uom: inv.uom,
  location: inv.location,
  condition: inv.condition,
  notes: inv.notes,
  photo_url: inv.photoUrl ?? null,
  created_at: inv.createdAt,
  updated_at: inv.updatedAt,
});

const toInventoryMutationRows = (inv: OverheadInventoryItem) =>
  inv.mutations.map((m) => ({
    id: m.id,
    inventory_id: inv.id,
    mutation_date: m.date,
    type: m.type,
    qty: m.qty,
    note: m.note,
    by_name: m.byName,
  }));

const toEmployeeRow = (emp: HrEmployee) => ({
  id: emp.id,
  nik: emp.nik,
  name: emp.name,
  section: emp.section,
  jabatan: emp.jabatan,
  active: emp.active,
  created_at: emp.createdAt,
  updated_at: emp.updatedAt,
});

const fromEmployeeRow = (r: Record<string, unknown>): HrEmployee => ({
  id: String(r.id),
  nik: String(r.nik ?? ''),
  name: String(r.name),
  section:
    r.section === 'HR Development' || r.section === 'Administration & Operation'
      ? (r.section as HrSection)
      : 'HR Development',
  jabatan: String(r.jabatan ?? ''),
  active: Boolean(r.active ?? true),
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const toRequestRow = (req: ItemRequest) => ({
  id: req.id,
  employee_id: req.employeeId ?? null,
  requester_nik: req.requesterNik ?? null,
  requester_name: req.requesterName,
  requester_section: req.requesterSection,
  request_date: req.requestDate,
  status: req.status,
  items: req.items,
  note: req.note,
  source: req.source ?? 'PORTAL_DEPAN',
  rejection_note: req.rejectionNote ?? null,
  processed_by_name: req.processedByName ?? null,
  processed_at: req.processedAt ?? null,
});

const toRequestRowLegacy = (req: ItemRequest) => ({
  id: req.id,
  requester_name: req.requesterName,
  requester_section: req.requesterSection,
  request_date: req.requestDate,
  status: req.status,
  items: req.items,
  note: req.note,
  processed_by_name: req.processedByName ?? null,
  processed_at: req.processedAt ?? null,
});

async function upsertItemRequestsSafe(requests: ItemRequest[]) {
  if (!supabase || requests.length === 0) return;
  try {
    await upsertInBatches('item_requests', requests.map(toRequestRow));
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('column') || msg.includes('schema cache') || msg.includes('employee_id')) {
      await upsertInBatches('item_requests', requests.map(toRequestRowLegacy));
    } else {
      throw err;
    }
  }
}

const fromRequestRow = (r: Record<string, unknown>): ItemRequest => ({
  id: String(r.id),
  employeeId: r.employee_id ? String(r.employee_id) : undefined,
  requesterNik: r.requester_nik ? String(r.requester_nik) : undefined,
  requesterName: String(r.requester_name),
  requesterSection:
    String(r.requester_section) === 'Production Dept.'
      ? 'HR Development'
      : String(r.requester_section) === 'QA & Laboratory'
      ? 'Administration & Operation'
      : String(r.requester_section),
  requestDate: String(r.request_date),
  status: r.status as ItemRequest['status'],
  items: (r.items as ItemRequest['items']) || [],
  note: String(r.note ?? ''),
  source: (r.source as ItemRequest['source']) || undefined,
  rejectionNote: r.rejection_note ? String(r.rejection_note) : undefined,
  processedByName: r.processed_by_name ? String(r.processed_by_name) : undefined,
  processedAt: r.processed_at ? String(r.processed_at) : undefined,
});

const toForecastRow = (row: RollingForecastRow) => ({
  id: row.id,
  fiscal_year_id: 'FY2026',
  jenis_no: row.jenisNo,
  jenis: row.jenis,
  item_no: row.itemNo,
  code_item: row.codeItem,
  item_name: row.itemName,
  item_description: row.itemDescription,
  uom: row.uom,
  rm_stock: row.rmStock,
  months: row.months,
  est_pemakaian: row.estPemakaian,
  keterangan: row.keterangan,
  updated_at: row.updatedAt || new Date().toISOString(),
});

const fromForecastRow = (r: Record<string, unknown>): RollingForecastRow => ({
  id: String(r.id),
  jenisNo: Number(r.jenis_no),
  jenis: String(r.jenis),
  itemNo: Number(r.item_no),
  codeItem: String(r.code_item ?? ''),
  itemName: String(r.item_name),
  itemDescription: String(r.item_description),
  uom: String(r.uom ?? 'PC'),
  rmStock: r.rm_stock != null ? Number(r.rm_stock) : null,
  months: (r.months as RollingForecastRow['months']) || {},
  estPemakaian: String(r.est_pemakaian ?? ''),
  keterangan: String(r.keterangan ?? ''),
  updatedAt: r.updated_at ? String(r.updated_at) : undefined,
});

const toForecastSubRow = (sub: RollingForecastSubmission) => ({
  id: sub.id,
  fiscal_year_id: 'FY2026',
  month: sub.month,
  submitted_at: sub.submittedAt,
  submitted_by_name: sub.submittedByName,
  total_items_requested: sub.totalItemsRequested,
  total_units_requested: sub.totalUnitsRequested,
  note: sub.note,
});

const fromForecastSubRow = (r: Record<string, unknown>): RollingForecastSubmission => ({
  id: String(r.id),
  month: r.month as ForecastMonthKey,
  submittedAt: String(r.submitted_at),
  submittedByName: String(r.submitted_by_name),
  totalItemsRequested: Number(r.total_items_requested ?? 0),
  totalUnitsRequested: Number(r.total_units_requested ?? 0),
  note: String(r.note ?? ''),
});

const toDocumentRow = (d: SystemDocument, refs?: RefIdSets) => ({
  id: d.id,
  title: d.title,
  category: d.category,
  period: d.period,
  linked_module: d.linkedModule,
  linked_report_id: safeFk(d.linkedReportId, refs?.reportIds),
  file_name: d.fileName,
  file_type: d.fileType,
  file_size: d.fileSize,
  file_url: d.fileUrl,
  storage_path: d.storagePath ?? null,
  notes: d.notes,
  uploaded_by_user_id: safeFk(d.uploadedByUserId, refs?.userIds),
  uploaded_by_name: d.uploadedByName,
  uploaded_at: d.uploadedAt,
  updated_at: d.updatedAt,
});

const fromDocumentRow = (r: Record<string, unknown>): SystemDocument => ({
  id: String(r.id),
  title: String(r.title),
  category: r.category as SystemDocument['category'],
  period: String(r.period),
  linkedModule: (r.linked_module as SystemDocument['linkedModule']) || 'GENERAL',
  linkedReportId: r.linked_report_id ? String(r.linked_report_id) : undefined,
  fileName: String(r.file_name),
  fileType: String(r.file_type),
  fileSize: Number(r.file_size ?? 0),
  fileUrl: String(r.file_url),
  storagePath: r.storage_path ? String(r.storage_path) : undefined,
  notes: String(r.notes ?? ''),
  uploadedByUserId: String(r.uploaded_by_user_id ?? ''),
  uploadedByName: String(r.uploaded_by_name ?? ''),
  uploadedAt: String(r.uploaded_at),
  updatedAt: String(r.updated_at),
});

const toNotifRow = (n: AppNotification, refs?: RefIdSets) => ({
  id: n.id,
  title: n.title,
  message: n.message,
  type: n.type,
  target_user_id: safeFk(n.targetUserId, refs?.userIds),
  target_roles: n.targetRoles ?? null,
  link_to: n.linkTo,
  read: n.read,
  created_at: n.createdAt,
});

const fromNotifRow = (r: Record<string, unknown>): AppNotification => ({
  id: String(r.id),
  title: String(r.title),
  message: String(r.message),
  type: r.type as AppNotification['type'],
  targetUserId: r.target_user_id ? String(r.target_user_id) : undefined,
  targetRoles: Array.isArray(r.target_roles) ? (r.target_roles as AppNotification['targetRoles']) : undefined,
  linkTo: String(r.link_to ?? '/app'),
  read: Boolean(r.read),
  createdAt: String(r.created_at),
});

const toAuditRow = (a: AuditLogEntry) => ({
  id: a.id,
  timestamp: a.timestamp,
  user_id: a.userId || null,
  user_name: a.userName,
  user_role: a.userRole,
  action: a.action,
  object_type: a.objectType,
  object_label: a.objectLabel,
  old_value: a.oldValue ?? null,
  new_value: a.newValue ?? null,
});

const fromAuditRow = (r: Record<string, unknown>): AuditLogEntry => ({
  id: String(r.id),
  timestamp: String(r.timestamp),
  userId: String(r.user_id ?? ''),
  userName: String(r.user_name ?? ''),
  userRole: r.user_role as AuditLogEntry['userRole'],
  action: r.action as AuditLogEntry['action'],
  objectType: String(r.object_type ?? ''),
  objectLabel: String(r.object_label ?? ''),
  oldValue: r.old_value ? String(r.old_value) : undefined,
  newValue: r.new_value ? String(r.new_value) : undefined,
});

export class SupabaseSupplyHubRepository implements ISupplyHubRepository {
  private cache = new LocalStorageSupplyHubRepository();

  isRemoteEnabled(): boolean {
    return isSupabaseConfigured && Boolean(supabase);
  }

  loadStore(): SupplyHubStore {
    return this.cache.loadStore();
  }

  saveStore(store: SupplyHubStore): void {
    this.cache.saveStore(store);
  }

  resetDemoData(): SupplyHubStore {
    return this.cache.resetDemoData();
  }

  exportJson(): string {
    return this.cache.exportJson();
  }

  importJson(rawJson: string): SupplyHubStore {
    return this.cache.importJson(rawJson);
  }

  async hydrateFromRemote(): Promise<SupplyHubStore | null> {
    if (!supabase || !isSupabaseConfigured) return null;

    try {
      const [
        usersRes,
        employeesRes,
        settingsRes,
        masterDataRes,
        itemsRes,
        txRes,
        opnameRes,
        opnameLinesRes,
        templatesRes,
        reportsRes,
        invRes,
        invMutRes,
        reqRes,
        rfMetaRes,
        rfRowsRes,
        rfSubRes,
        docsRes,
        notifRes,
        auditRes,
      ] = await Promise.all([
        supabase.from('app_users').select('*').order('created_at', { ascending: true }),
        supabase.from('hr_employees').select('*').order('name', { ascending: true }),
        supabase.from('company_settings').select('*').eq('id', 'default').maybeSingle(),
        supabase.from('master_data_config').select('*').eq('id', 'default').maybeSingle(),
        supabase.from('supply_items').select('*').order('sort_order', { ascending: true }),
        supabase.from('stock_transactions').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('opname_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('opname_lines').select('*').order('sort_index', { ascending: true }),
        supabase.from('signature_templates').select('*'),
        supabase.from('monthly_reports').select('*').order('created_at', { ascending: false }),
        supabase.from('overhead_inventories').select('*').order('part_id', { ascending: true }),
        supabase.from('overhead_inventory_mutations').select('*').order('mutation_date', { ascending: false }),
        supabase.from('item_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('rolling_forecast_meta').select('*').eq('id', 'FY2026').maybeSingle(),
        supabase.from('rolling_forecast_rows').select('*').eq('fiscal_year_id', 'FY2026').order('item_no', { ascending: true }),
        supabase.from('rolling_forecast_submissions').select('*').eq('fiscal_year_id', 'FY2026').order('submitted_at', { ascending: false }),
        supabase.from('system_documents').select('*').order('uploaded_at', { ascending: false }),
        supabase.from('app_notifications').select('*').order('created_at', { ascending: false }).limit(150),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500),
      ]);

      if (usersRes.error) {
        console.warn('Supabase belum memiliki tabel / gagal query:', usersRes.error.message);
        return null;
      }

      // Jika database Supabase baru & masih kosong, otomatis unggah data lokal/seed awal
      if (!usersRes.data || usersRes.data.length === 0) {
        const localSeed = this.cache.loadStore();
        await this.pushFullStoreToRemote(localSeed);
        return localSeed;
      }

      const fallback = buildSeedStore();
      const fallbackRf = buildRollingForecastSeed();

      const linesBySession = new Map<string, OpnameLine[]>();
      for (const lr of (opnameLinesRes.data || []) as Record<string, unknown>[]) {
        const sid = String(lr.session_id);
        const list = linesBySession.get(sid) || [];
        list.push({
          itemId: String(lr.item_id),
          kategori: String(lr.kategori),
          codeItem: String(lr.code_item ?? ''),
          itemName: String(lr.item_name),
          uom: String(lr.uom ?? 'PC'),
          stokAwal: Number(lr.stok_awal ?? 0),
          terima: Number(lr.terima ?? 0),
          pakai: Number(lr.pakai ?? 0),
          systemStock: Number(lr.system_stock ?? 0),
          physicalStock: Number(lr.physical_stock ?? 0),
          diff: Number(lr.diff ?? 0),
          reason: String(lr.reason ?? ''),
          balanced: Boolean(lr.balanced),
        });
        linesBySession.set(sid, list);
      }

      const mutsByInv = new Map<string, OverheadInventoryMutation[]>();
      for (const mr of (invMutRes.data || []) as Record<string, unknown>[]) {
        const invId = String(mr.inventory_id);
        const list = mutsByInv.get(invId) || [];
        list.push({
          id: String(mr.id),
          date: String(mr.mutation_date),
          type: mr.type as OverheadInventoryMutation['type'],
          qty: Number(mr.qty ?? 0),
          note: String(mr.note ?? ''),
          byName: String(mr.by_name ?? ''),
        });
        mutsByInv.set(invId, list);
      }

      const settingsData = settingsRes.data as Record<string, unknown> | null;
      const settings: CompanySettings = settingsData
        ? {
            companyName: String(settingsData.company_name),
            factoryName: String(settingsData.factory_name),
            department: String(settingsData.department),
            section: String(settingsData.section),
            locationCity: String(settingsData.location_city),
            logoUrl: String(settingsData.logo_url),
            instructionsCheck: (settingsData.instructions_check as string[]) || fallback.settings.instructionsCheck,
            instructionsInventory:
              (settingsData.instructions_inventory as string[]) || fallback.settings.instructionsInventory,
            reminderEarlyMonthDay: Number(settingsData.reminder_early_month_day ?? 5),
            reminderOpnameDay: Number(settingsData.reminder_opname_day ?? 28),
            language: settingsData.language === 'en' ? 'en' : 'id',
          }
        : fallback.settings;

      const mdData = masterDataRes.data as Record<string, unknown> | null;
      const masterData: MasterData = mdData
        ? {
            categoriesOffice: (mdData.categories_office as string[]) || fallback.masterData.categoriesOffice,
            categoriesOverhead: (mdData.categories_overhead as string[]) || fallback.masterData.categoriesOverhead,
            uoms: (mdData.uoms as string[]) || fallback.masterData.uoms,
            locations: (mdData.locations as string[]) || fallback.masterData.locations,
          }
        : fallback.masterData;

      const localCached = this.cache.loadStore();
      const rfMeta = rfMetaRes.data as Record<string, unknown> | null;
      const hydratedEmployees: HrEmployee[] =
        !employeesRes.error && Array.isArray(employeesRes.data)
          ? (employeesRes.data as Record<string, unknown>[]).map(fromEmployeeRow)
          : localCached.employees && localCached.employees.length > 0
          ? localCached.employees
          : fallback.employees;

      const hydrated: SupplyHubStore = {
        users: (usersRes.data as Record<string, unknown>[]).map(fromUserRow),
        employees: hydratedEmployees,
        items: ((itemsRes.data || []) as Record<string, unknown>[]).map(fromItemRow),
        transactions: ((txRes.data || []) as Record<string, unknown>[]).map(fromTxRow),
        opnames: ((opnameRes.data || []) as Record<string, unknown>[]).map((o) => ({
          id: String(o.id),
          period: String(o.period),
          jenis: o.jenis as OpnameSession['jenis'],
          createdAt: String(o.created_at),
          createdByUserId: String(o.created_by_user_id ?? ''),
          createdByName: String(o.created_by_name ?? ''),
          status: o.status as OpnameSession['status'],
          approvedByUserId: o.approved_by_user_id ? String(o.approved_by_user_id) : undefined,
          approvedByName: o.approved_by_name ? String(o.approved_by_name) : undefined,
          approvedAt: o.approved_at ? String(o.approved_at) : undefined,
          rejectionNote: o.rejection_note ? String(o.rejection_note) : undefined,
          lines: linesBySession.get(String(o.id)) || [],
        })),
        templates: ((templatesRes.data || []) as Record<string, unknown>[]).map(fromTemplateRow),
        reports: ((reportsRes.data || []) as Record<string, unknown>[]).map(fromReportRow),
        inventories: ((invRes.data || []) as Record<string, unknown>[]).map((inv) => ({
          id: String(inv.id),
          partId: String(inv.part_id),
          prefix: inv.prefix as OverheadInventoryItem['prefix'],
          kategori: String(inv.kategori ?? 'Overhead'),
          itemName: String(inv.item_name),
          qty: Number(inv.qty ?? 0),
          uom: String(inv.uom ?? 'PC'),
          location: String(inv.location ?? ''),
          condition: inv.condition as OverheadInventoryItem['condition'],
          notes: String(inv.notes ?? ''),
          photoUrl: inv.photo_url ? String(inv.photo_url) : undefined,
          mutations: mutsByInv.get(String(inv.id)) || [],
          createdAt: String(inv.created_at),
          updatedAt: String(inv.updated_at),
        })),
        itemRequests: ((reqRes.data || []) as Record<string, unknown>[]).map(fromRequestRow),
        rollingForecast: {
          fiscalYearLabel: rfMeta ? String(rfMeta.fiscal_year_label) : fallbackRf.fiscalYearLabel,
          periodRangeLabel: rfMeta ? String(rfMeta.period_range_label) : fallbackRf.periodRangeLabel,
          department: rfMeta ? String(rfMeta.department) : fallbackRf.department,
          section: rfMeta ? String(rfMeta.section) : fallbackRf.section,
          activeMonth: (rfMeta?.active_month as ForecastMonthKey) || fallbackRf.activeMonth,
          rows:
            rfRowsRes.data && rfRowsRes.data.length > 0
              ? (rfRowsRes.data as Record<string, unknown>[]).map(fromForecastRow)
              : fallbackRf.rows,
          submissions: ((rfSubRes.data || []) as Record<string, unknown>[]).map(fromForecastSubRow),
          lastUpdatedAt: rfMeta ? String(rfMeta.last_updated_at) : fallbackRf.lastUpdatedAt,
          lastUpdatedBy: rfMeta ? String(rfMeta.last_updated_by) : fallbackRf.lastUpdatedBy,
        },
        documents: ((docsRes.data || []) as Record<string, unknown>[]).map(fromDocumentRow),
        notifications: ((notifRes.data || []) as Record<string, unknown>[]).map(fromNotifRow),
        auditLogs: ((auditRes.data || []) as Record<string, unknown>[]).map(fromAuditRow),
        masterData,
        settings,
      };

      this.cache.saveStore(hydrated);
      return hydrated;
    } catch (err) {
      console.error('Gagal mengambil data dari Supabase:', err);
      return null;
    }
  }

  async pushFullStoreToRemote(rawStore: SupplyHubStore): Promise<SyncResult> {
    if (!supabase || !isSupabaseConfigured) {
      return { ok: false, error: 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum dikonfigurasi.' };
    }

    try {
      const store = await prepareStoreMediaForCloud(rawStore);
      this.cache.saveStore(store);
      const refs = buildRefIdSets(store);

      // 1. Settings & Master Data
      await upsertInBatches('company_settings', [
        {
          id: 'default',
          company_name: store.settings.companyName,
          factory_name: store.settings.factoryName,
          department: store.settings.department,
          section: store.settings.section,
          location_city: store.settings.locationCity,
          logo_url: store.settings.logoUrl,
          instructions_check: store.settings.instructionsCheck,
          instructions_inventory: store.settings.instructionsInventory,
          reminder_early_month_day: store.settings.reminderEarlyMonthDay,
          reminder_opname_day: store.settings.reminderOpnameDay,
          language: store.settings.language,
        },
      ]);

      await upsertInBatches('master_data_config', [
        {
          id: 'default',
          categories_office: store.masterData.categoriesOffice,
          categories_overhead: store.masterData.categoriesOverhead,
          uoms: store.masterData.uoms,
          locations: store.masterData.locations,
        },
      ]);

      // 2. Users & Templates (referenced by FK)
      await upsertInBatches('app_users', store.users.map(toUserRow));
      await upsertInBatches('signature_templates', store.templates.map(toTemplateRow));

      // 3. Master Items & Transactions
      await upsertInBatches('supply_items', store.items.map(toItemRow));
      await upsertInBatches('stock_transactions', store.transactions.map((t) => toTxRow(t, refs)));

      // 4. Opnames & Opname Lines
      await upsertInBatches('opname_sessions', store.opnames.map((o) => toOpnameSessionRow(o, refs)));
      await upsertInBatches(
        'opname_lines',
        store.opnames.flatMap(toOpnameLineRows)
      );

      // 5. Monthly Reports
      await upsertInBatches('monthly_reports', store.reports.map((r) => toReportRow(r, refs)));

      // 6. Overhead Inventories & Mutations
      await upsertInBatches('overhead_inventories', store.inventories.map(toInventoryRow));
      await upsertInBatches(
        'overhead_inventory_mutations',
        store.inventories.flatMap(toInventoryMutationRows)
      );

      // 7. Database Karyawan Dept. HR & Permintaan Pengambilan
      if (store.employees && store.employees.length > 0) {
        try {
          await upsertInBatches('hr_employees', store.employees.map(toEmployeeRow));
        } catch (empErr) {
          console.warn('Tabel hr_employees belum dimigrasi di Supabase:', empErr);
        }
      }
      await upsertItemRequestsSafe(store.itemRequests);

      // 8. Rolling Forecast Meta, Rows & Submissions
      await upsertInBatches('rolling_forecast_meta', [
        {
          id: 'FY2026',
          fiscal_year_label: store.rollingForecast.fiscalYearLabel,
          period_range_label: store.rollingForecast.periodRangeLabel,
          department: store.rollingForecast.department,
          section: store.rollingForecast.section,
          active_month: store.rollingForecast.activeMonth,
          last_updated_at: store.rollingForecast.lastUpdatedAt,
          last_updated_by: store.rollingForecast.lastUpdatedBy,
        },
      ]);
      await upsertInBatches('rolling_forecast_rows', store.rollingForecast.rows.map(toForecastRow));
      await upsertInBatches(
        'rolling_forecast_submissions',
        store.rollingForecast.submissions.map(toForecastSubRow)
      );

      // 9. Arsip Dokumen, Notifikasi & Audit Logs
      await upsertInBatches('system_documents', (store.documents || []).map((d) => toDocumentRow(d, refs)));
      await upsertInBatches('app_notifications', store.notifications.map((n) => toNotifRow(n, refs)));
      await upsertInBatches('audit_logs', store.auditLogs.map(toAuditRow));

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyinkronkan database ke Supabase.';
      console.error(msg, err);
      return { ok: false, error: msg };
    }
  }

  async replaceFullStoreOnRemote(rawStore: SupplyHubStore): Promise<SyncResult> {
    const pushRes = await this.pushFullStoreToRemote(rawStore);
    if (!pushRes.ok || !supabase || !isSupabaseConfigured) return pushRes;

    try {
      // Hapus baris yatim (child tables dulu, lalu parent tables agar FK aman)
      await deleteOrphanIds('system_documents', new Set((rawStore.documents || []).map((d) => d.id)));
      await deleteOrphanIds('app_notifications', new Set(rawStore.notifications.map((n) => n.id)));
      await deleteOrphanIds('audit_logs', new Set(rawStore.auditLogs.map((a) => a.id)));
      await deleteOrphanIds('rolling_forecast_submissions', new Set(rawStore.rollingForecast.submissions.map((s) => s.id)), { col: 'fiscal_year_id', val: 'FY2026' });
      await deleteOrphanIds('rolling_forecast_rows', new Set(rawStore.rollingForecast.rows.map((r) => r.id)), { col: 'fiscal_year_id', val: 'FY2026' });
      await deleteOrphanIds('item_requests', new Set(rawStore.itemRequests.map((r) => r.id)));
      await deleteOrphanIds('hr_employees', new Set((rawStore.employees || []).map((e) => e.id)));
      await deleteOrphanIds('overhead_inventories', new Set(rawStore.inventories.map((i) => i.id)));
      await deleteOrphanIds('monthly_reports', new Set(rawStore.reports.map((r) => r.id)));
      await deleteOrphanIds('opname_sessions', new Set(rawStore.opnames.map((o) => o.id)));
      await deleteOrphanIds('stock_transactions', new Set(rawStore.transactions.map((t) => t.id)));
      await deleteOrphanIds('supply_items', new Set(rawStore.items.map((i) => i.id)));
      await deleteOrphanIds('signature_templates', new Set(rawStore.templates.map((t) => t.id)));
      await deleteOrphanIds('app_users', new Set(rawStore.users.map((u) => u.id)));
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyelaraskan penghapusan data lama di Supabase.';
      console.error(msg, err);
      return { ok: false, error: msg };
    }
  }

  async syncStoreDelta(prev: SupplyHubStore, next: SupplyHubStore): Promise<SyncResult> {
    if (!supabase || !isSupabaseConfigured) return { ok: true };

    try {
      const refs = buildRefIdSets(next);

      if (prev.settings !== next.settings) {
        await upsertInBatches('company_settings', [
          {
            id: 'default',
            company_name: next.settings.companyName,
            factory_name: next.settings.factoryName,
            department: next.settings.department,
            section: next.settings.section,
            location_city: next.settings.locationCity,
            logo_url: next.settings.logoUrl,
            instructions_check: next.settings.instructionsCheck,
            instructions_inventory: next.settings.instructionsInventory,
            reminder_early_month_day: next.settings.reminderEarlyMonthDay,
            reminder_opname_day: next.settings.reminderOpnameDay,
            language: next.settings.language,
          },
        ]);
      }

      if (prev.masterData !== next.masterData) {
        await upsertInBatches('master_data_config', [
          {
            id: 'default',
            categories_office: next.masterData.categoriesOffice,
            categories_overhead: next.masterData.categoriesOverhead,
            uoms: next.masterData.uoms,
            locations: next.masterData.locations,
          },
        ]);
      }

      if (prev.users !== next.users) {
        const prevMap = new Map(prev.users.map((u) => [u.id, u]));
        const nextIds = new Set(next.users.map((u) => u.id));
        const deletedIds = prev.users.filter((u) => !nextIds.has(u.id)).map((u) => u.id);
        // Hapus user yang dihapus lebih dulu agar tidak bentrok UNIQUE username/email
        await deleteByIds('app_users', deletedIds);

        const changedUsers = await Promise.all(
          next.users
            .filter((u) => prevMap.get(u.id) !== u)
            .map(async (u) => {
              if (u.savedSignatureDataUrl && u.savedSignatureDataUrl.startsWith('data:')) {
                const uploaded = await uploadDataUrlToStorage(u.savedSignatureDataUrl, 'signatures', u.id);
                return { ...u, savedSignatureDataUrl: uploaded };
              }
              return u;
            })
        );
        await upsertInBatches('app_users', changedUsers.map(toUserRow));
      }

      if (prev.templates !== next.templates) {
        const prevMap = new Map(prev.templates.map((t) => [t.id, t]));
        const nextIds = new Set(next.templates.map((t) => t.id));
        const changed = next.templates.filter((t) => prevMap.get(t.id) !== t);
        const deletedIds = prev.templates.filter((t) => !nextIds.has(t.id)).map((t) => t.id);
        await upsertInBatches('signature_templates', changed.map(toTemplateRow));
        await deleteByIds('signature_templates', deletedIds);
      }

      if (prev.items !== next.items) {
        const prevMap = new Map(prev.items.map((i) => [i.id, i]));
        const nextIds = new Set(next.items.map((i) => i.id));
        const deletedIds = prev.items.filter((i) => !nextIds.has(i.id)).map((i) => i.id);
        const changed = await Promise.all(
          next.items
            .filter((i) => prevMap.get(i.id) !== i)
            .map(async (it) => {
              if (it.photoUrl && it.photoUrl.startsWith('data:')) {
                const uploaded = await uploadDataUrlToStorage(it.photoUrl, 'items', it.id);
                return { ...it, photoUrl: uploaded };
              }
              return it;
            })
        );
        await upsertInBatches('supply_items', changed.map(toItemRow));
        await deleteByIds('supply_items', deletedIds);
      }

      if (prev.transactions !== next.transactions) {
        const prevMap = new Map(prev.transactions.map((t) => [t.id, t]));
        const nextIds = new Set(next.transactions.map((t) => t.id));
        const changed = next.transactions.filter((t) => prevMap.get(t.id) !== t);
        const deletedIds = prev.transactions.filter((t) => !nextIds.has(t.id)).map((t) => t.id);
        await upsertInBatches('stock_transactions', changed.map((t) => toTxRow(t, refs)));
        await deleteByIds('stock_transactions', deletedIds);
      }

      if (prev.opnames !== next.opnames) {
        const prevMap = new Map(prev.opnames.map((o) => [o.id, o]));
        const nextIds = new Set(next.opnames.map((o) => o.id));
        const changed = next.opnames.filter((o) => prevMap.get(o.id) !== o);
        const deletedIds = prev.opnames.filter((o) => !nextIds.has(o.id)).map((o) => o.id);
        await upsertInBatches('opname_sessions', changed.map((o) => toOpnameSessionRow(o, refs)));
        await upsertInBatches('opname_lines', changed.flatMap(toOpnameLineRows));
        await deleteByIds('opname_sessions', deletedIds);
      }

      if (prev.reports !== next.reports) {
        const prevMap = new Map(prev.reports.map((r) => [r.id, r]));
        const nextIds = new Set(next.reports.map((r) => r.id));
        const deletedIds = prev.reports.filter((r) => !nextIds.has(r.id)).map((r) => r.id);
        const changed = await Promise.all(
          next.reports
            .filter((r) => prevMap.get(r.id) !== r)
            .map(uploadReportSignaturesIfNeeded)
        );
        await upsertInBatches('monthly_reports', changed.map((r) => toReportRow(r, refs)));
        await deleteByIds('monthly_reports', deletedIds);
      }

      if (prev.inventories !== next.inventories) {
        const prevMap = new Map(prev.inventories.map((i) => [i.id, i]));
        const nextIds = new Set(next.inventories.map((i) => i.id));
        const deletedIds = prev.inventories.filter((i) => !nextIds.has(i.id)).map((i) => i.id);
        const changed = await Promise.all(
          next.inventories
            .filter((i) => prevMap.get(i.id) !== i)
            .map(async (inv) => {
              if (inv.photoUrl && inv.photoUrl.startsWith('data:')) {
                const uploaded = await uploadDataUrlToStorage(inv.photoUrl, 'inventories', inv.id);
                return { ...inv, photoUrl: uploaded };
              }
              return inv;
            })
        );
        await upsertInBatches('overhead_inventories', changed.map(toInventoryRow));
        await upsertInBatches('overhead_inventory_mutations', changed.flatMap(toInventoryMutationRows));
        await deleteByIds('overhead_inventories', deletedIds);
      }

      if (prev.employees !== next.employees) {
        const prevList = prev.employees || [];
        const nextList = next.employees || [];
        const prevMap = new Map(prevList.map((e) => [e.id, e]));
        const nextIds = new Set(nextList.map((e) => e.id));
        const changed = nextList.filter((e) => prevMap.get(e.id) !== e);
        const deletedIds = prevList.filter((e) => !nextIds.has(e.id)).map((e) => e.id);
        await deleteByIds('hr_employees', deletedIds);
        await upsertInBatches('hr_employees', changed.map(toEmployeeRow));
      }

      if (prev.itemRequests !== next.itemRequests) {
        const prevMap = new Map(prev.itemRequests.map((r) => [r.id, r]));
        const nextIds = new Set(next.itemRequests.map((r) => r.id));
        const changed = next.itemRequests.filter((r) => prevMap.get(r.id) !== r);
        const deletedIds = prev.itemRequests.filter((r) => !nextIds.has(r.id)).map((r) => r.id);
        await upsertItemRequestsSafe(changed);
        await deleteByIds('item_requests', deletedIds);
      }

      if (prev.rollingForecast !== next.rollingForecast) {
        await upsertInBatches('rolling_forecast_meta', [
          {
            id: 'FY2026',
            fiscal_year_label: next.rollingForecast.fiscalYearLabel,
            period_range_label: next.rollingForecast.periodRangeLabel,
            department: next.rollingForecast.department,
            section: next.rollingForecast.section,
            active_month: next.rollingForecast.activeMonth,
            last_updated_at: next.rollingForecast.lastUpdatedAt,
            last_updated_by: next.rollingForecast.lastUpdatedBy,
          },
        ]);

        const prevRowMap = new Map(prev.rollingForecast.rows.map((r) => [r.id, r]));
        const nextRowIds = new Set(next.rollingForecast.rows.map((r) => r.id));
        const changedRows = next.rollingForecast.rows.filter((r) => prevRowMap.get(r.id) !== r);
        const deletedRowIds = prev.rollingForecast.rows
          .filter((r) => !nextRowIds.has(r.id))
          .map((r) => r.id);
        await upsertInBatches('rolling_forecast_rows', changedRows.map(toForecastRow));
        await deleteByIds('rolling_forecast_rows', deletedRowIds);

        const prevSubIds = new Set(prev.rollingForecast.submissions.map((s) => s.id));
        const addedSubs = next.rollingForecast.submissions.filter((s) => !prevSubIds.has(s.id));
        await upsertInBatches('rolling_forecast_submissions', addedSubs.map(toForecastSubRow));
      }

      if (prev.documents !== next.documents) {
        const prevDocs = prev.documents || [];
        const nextDocs = next.documents || [];
        const prevDocMap = new Map(prevDocs.map((d) => [d.id, d]));
        const nextDocIds = new Set(nextDocs.map((d) => d.id));
        const deletedDocIds = prevDocs.filter((d) => !nextDocIds.has(d.id)).map((d) => d.id);
        const changedDocs = await Promise.all(
          nextDocs
            .filter((d) => prevDocMap.get(d.id) !== d)
            .map(async (doc) => {
              if (doc.fileUrl && doc.fileUrl.startsWith('data:')) {
                const uploaded = await uploadDocumentDataUrlToStorage(
                  doc.fileUrl,
                  doc.category,
                  doc.id,
                  doc.fileName
                );
                return {
                  ...doc,
                  fileUrl: uploaded.fileUrl,
                  storagePath: uploaded.storagePath ?? doc.storagePath,
                };
              }
              return doc;
            })
        );
        await upsertInBatches('system_documents', changedDocs.map((d) => toDocumentRow(d, refs)));
        await deleteByIds('system_documents', deletedDocIds);
      }

      if (prev.notifications !== next.notifications) {
        const prevMap = new Map(prev.notifications.map((n) => [n.id, n]));
        const nextIds = new Set(next.notifications.map((n) => n.id));
        const changed = next.notifications.filter((n) => prevMap.get(n.id) !== n);
        const deletedIds = prev.notifications.filter((n) => !nextIds.has(n.id)).map((n) => n.id);
        await upsertInBatches('app_notifications', changed.map((n) => toNotifRow(n, refs)));
        await deleteByIds('app_notifications', deletedIds);
      }

      if (prev.auditLogs !== next.auditLogs) {
        const prevIds = new Set(prev.auditLogs.map((a) => a.id));
        const added = next.auditLogs.filter((a) => !prevIds.has(a.id));
        await upsertInBatches('audit_logs', added.map(toAuditRow));
      }

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal sinkronisasi otomatis ke Supabase.';
      console.error('Gagal sinkronisasi delta ke Supabase:', err);
      return { ok: false, error: msg };
    }
  }

  subscribeToRemoteChanges(onChange: (table: string) => void): () => void {
    if (!supabase || !isSupabaseConfigured) return () => {};
    const client = supabase;
    const channel = client
      .channel(`hr-supplyhub-live-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          onChange(String(payload.table || 'public'));
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }
}
