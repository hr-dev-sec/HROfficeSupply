import schemaSqlRaw from '../../supabase/01_schema.sql?raw';
import storageRlsSqlRaw from '../../supabase/02_storage_and_rls.sql?raw';
import type { SupplyHubStore } from '../types';

export function getSupabaseSchemaSql(): string {
  return schemaSqlRaw;
}

export function getSupabaseStorageRlsSql(): string {
  return storageRlsSqlRaw;
}

function sqlStr(val: string | undefined | null): string {
  if (val === undefined || val === null) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function sqlJson(val: unknown): string {
  if (val === undefined || val === null) return 'NULL';
  return `${sqlStr(JSON.stringify(val))}::jsonb`;
}

function sqlNum(val: number | undefined | null): string {
  if (val === undefined || val === null || Number.isNaN(val)) return 'NULL';
  return String(val);
}

function sqlBool(val: boolean): string {
  return val ? 'true' : 'false';
}

function sqlTextArray(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return 'NULL';
  return `ARRAY[${arr.map((s) => sqlStr(s)).join(', ')}]::text[]`;
}

/**
 * Menghasilkan script SQL Seed lengkap dari data sistem HR SupplyHub terkini
 * agar langsung dapat diimpor ke Supabase SQL Editor (idempotent ON CONFLICT DO UPDATE).
 */
export function generateCurrentStoreSeedSql(store: SupplyHubStore): string {
  const lines: string[] = [
    '-- ============================================================================',
    '-- HR SupplyHub — Seed Data Snapshot untuk Supabase (PostgreSQL)',
    `-- PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory`,
    `-- Diekspor pada: ${new Date().toISOString()}`,
    '-- Jalankan SETELAH 01_schema.sql dan 02_storage_and_rls.sql',
    '-- ============================================================================',
    'begin;',
    '',
    '-- 1. Company Settings',
    `insert into public.company_settings (id, company_name, factory_name, department, section, location_city, logo_url, instructions_check, instructions_inventory, reminder_early_month_day, reminder_opname_day, language) values (` +
      `'default', ${sqlStr(store.settings.companyName)}, ${sqlStr(store.settings.factoryName)}, ${sqlStr(store.settings.department)}, ${sqlStr(store.settings.section)}, ${sqlStr(store.settings.locationCity)}, ${sqlStr(store.settings.logoUrl)}, ${sqlJson(store.settings.instructionsCheck)}, ${sqlJson(store.settings.instructionsInventory)}, ${sqlNum(store.settings.reminderEarlyMonthDay)}, ${sqlNum(store.settings.reminderOpnameDay)}, ${sqlStr(store.settings.language)}) ` +
      `on conflict (id) do update set company_name = excluded.company_name, factory_name = excluded.factory_name, department = excluded.department, section = excluded.section, location_city = excluded.location_city, logo_url = excluded.logo_url, instructions_check = excluded.instructions_check, instructions_inventory = excluded.instructions_inventory, reminder_early_month_day = excluded.reminder_early_month_day, reminder_opname_day = excluded.reminder_opname_day;`,
    '',
    '-- 2. Master Data Referensi',
    `insert into public.master_data_config (id, categories_office, categories_overhead, uoms, locations) values (` +
      `'default', ${sqlJson(store.masterData.categoriesOffice)}, ${sqlJson(store.masterData.categoriesOverhead)}, ${sqlJson(store.masterData.uoms)}, ${sqlJson(store.masterData.locations)}) ` +
      `on conflict (id) do update set categories_office = excluded.categories_office, categories_overhead = excluded.categories_overhead, uoms = excluded.uoms, locations = excluded.locations;`,
    '',
    `-- 3. Akun Pengguna (${store.users.length} akun)`,
  ];

  for (const u of store.users) {
    lines.push(
      `insert into public.app_users (id, username, email, password_hash, name, role, jabatan, seksi, avatar_initials, saved_signature_url, active) values (` +
        `${sqlStr(u.id)}, ${sqlStr(u.username)}, ${sqlStr(u.email)}, ${sqlStr(u.password)}, ${sqlStr(u.name)}, ${sqlStr(u.role)}, ${sqlStr(u.jabatan)}, ${sqlStr(u.seksi)}, ${sqlStr(u.avatarInitials)}, ${sqlStr(u.savedSignatureDataUrl)}, ${sqlBool(u.active)}) ` +
        `on conflict (id) do update set username = excluded.username, email = excluded.email, password_hash = excluded.password_hash, name = excluded.name, role = excluded.role, jabatan = excluded.jabatan, seksi = excluded.seksi, avatar_initials = excluded.avatar_initials, saved_signature_url = excluded.saved_signature_url, active = excluded.active;`
    );
  }

  lines.push('', `-- 4. Template Tanda Tangan (${store.templates.length} template)`);
  for (const t of store.templates) {
    lines.push(
      `insert into public.signature_templates (id, name, jenis, is_default, groups) values (` +
        `${sqlStr(t.id)}, ${sqlStr(t.name)}, ${sqlStr(t.jenis)}, ${sqlBool(t.isDefault)}, ${sqlJson(t.groups)}) ` +
        `on conflict (id) do update set name = excluded.name, jenis = excluded.jenis, is_default = excluded.is_default, groups = excluded.groups;`
    );
  }

  lines.push('', `-- 5. Master Item (${store.items.length} item termasuk foto)`);
  for (const i of store.items) {
    lines.push(
      `insert into public.supply_items (id, jenis, kategori, code_item, item_name, uom, min_stock, current_stock, location, notes, photo_url, archived, sort_order, created_at, updated_at) values (` +
        `${sqlStr(i.id)}, ${sqlStr(i.jenis)}, ${sqlStr(i.kategori)}, ${sqlStr(i.codeItem)}, ${sqlStr(i.itemName)}, ${sqlStr(i.uom)}, ${sqlNum(i.minStock)}, ${sqlNum(i.currentStock)}, ${sqlStr(i.location)}, ${sqlStr(i.notes)}, ${sqlStr(i.photoUrl)}, ${sqlBool(i.archived)}, ${sqlNum(i.sortOrder)}, ${sqlStr(i.createdAt)}, ${sqlStr(i.updatedAt)}) ` +
        `on conflict (id) do update set jenis = excluded.jenis, kategori = excluded.kategori, code_item = excluded.code_item, item_name = excluded.item_name, uom = excluded.uom, min_stock = excluded.min_stock, current_stock = excluded.current_stock, location = excluded.location, notes = excluded.notes, photo_url = excluded.photo_url, archived = excluded.archived, sort_order = excluded.sort_order;`
    );
  }

  lines.push('', `-- 6. Transaksi Stok (${store.transactions.length} transaksi)`);
  for (const tx of store.transactions) {
    lines.push(
      `insert into public.stock_transactions (id, item_id, jenis, code_item, item_name, uom, type, qty, tx_date, period, recorded_by_user_id, recorded_by_name, note, reference_no, created_at) values (` +
        `${sqlStr(tx.id)}, ${sqlStr(tx.itemId)}, ${sqlStr(tx.jenis)}, ${sqlStr(tx.codeItem)}, ${sqlStr(tx.itemName)}, ${sqlStr(tx.uom)}, ${sqlStr(tx.type)}, ${sqlNum(tx.qty)}, ${sqlStr(tx.date)}, ${sqlStr(tx.period)}, ${sqlStr(tx.recordedByUserId || null)}, ${sqlStr(tx.recordedByName)}, ${sqlStr(tx.note)}, ${sqlStr(tx.referenceNo)}, ${sqlStr(tx.createdAt)}) ` +
        `on conflict (id) do nothing;`
    );
  }

  lines.push('', `-- 7. Stock Opname (${store.opnames.length} sesi)`);
  for (const o of store.opnames) {
    lines.push(
      `insert into public.opname_sessions (id, period, jenis, status, created_by_user_id, created_by_name, approved_by_user_id, approved_by_name, approved_at, rejection_note, created_at) values (` +
        `${sqlStr(o.id)}, ${sqlStr(o.period)}, ${sqlStr(o.jenis)}, ${sqlStr(o.status)}, ${sqlStr(o.createdByUserId || null)}, ${sqlStr(o.createdByName)}, ${sqlStr(o.approvedByUserId)}, ${sqlStr(o.approvedByName)}, ${sqlStr(o.approvedAt)}, ${sqlStr(o.rejectionNote)}, ${sqlStr(o.createdAt)}) ` +
        `on conflict (id) do update set status = excluded.status, approved_by_user_id = excluded.approved_by_user_id, approved_by_name = excluded.approved_by_name, approved_at = excluded.approved_at, rejection_note = excluded.rejection_note;`
    );
    o.lines.forEach((l, idx) => {
      lines.push(
        `insert into public.opname_lines (id, session_id, item_id, kategori, code_item, item_name, uom, stok_awal, terima, pakai, system_stock, physical_stock, diff, reason, balanced, sort_index) values (` +
          `${sqlStr(`${o.id}__${l.itemId}`)}, ${sqlStr(o.id)}, ${sqlStr(l.itemId)}, ${sqlStr(l.kategori)}, ${sqlStr(l.codeItem)}, ${sqlStr(l.itemName)}, ${sqlStr(l.uom)}, ${sqlNum(l.stokAwal)}, ${sqlNum(l.terima)}, ${sqlNum(l.pakai)}, ${sqlNum(l.systemStock)}, ${sqlNum(l.physicalStock)}, ${sqlNum(l.diff)}, ${sqlStr(l.reason)}, ${sqlBool(l.balanced)}, ${idx}) ` +
          `on conflict (id) do update set physical_stock = excluded.physical_stock, diff = excluded.diff, reason = excluded.reason, balanced = excluded.balanced;`
      );
    });
  }

  lines.push('', `-- 8. Laporan Bulanan (${store.reports.length} dokumen)`);
  for (const r of store.reports) {
    lines.push(
      `insert into public.monthly_reports (id, document_id, doc_hash, jenis, title, period, period_label, department, section, place_date_text, status, check_rows, inventory_rows, signature_groups, template_id, locked, version, versions, rejection_history, created_at, updated_at) values (` +
        `${sqlStr(r.id)}, ${sqlStr(r.documentId)}, ${sqlStr(r.docHash)}, ${sqlStr(r.jenis)}, ${sqlStr(r.title)}, ${sqlStr(r.period)}, ${sqlStr(r.periodLabel)}, ${sqlStr(r.department)}, ${sqlStr(r.section)}, ${sqlStr(r.placeDateText)}, ${sqlStr(r.status)}, ${sqlJson(r.checkRows)}, ${sqlJson(r.inventoryRows)}, ${sqlJson(r.signatureGroups)}, ${sqlStr(r.templateId || null)}, ${sqlBool(r.locked)}, ${sqlNum(r.version)}, ${sqlJson(r.versions)}, ${sqlJson(r.rejectionHistory)}, ${sqlStr(r.createdAt)}, ${sqlStr(r.updatedAt)}) ` +
        `on conflict (id) do update set status = excluded.status, check_rows = excluded.check_rows, inventory_rows = excluded.inventory_rows, signature_groups = excluded.signature_groups, locked = excluded.locked, version = excluded.version, versions = excluded.versions, rejection_history = excluded.rejection_history;`
    );
  }

  lines.push('', `-- 9. Inventaris Overhead & Mutasi (${store.inventories.length} aset)`);
  for (const inv of store.inventories) {
    lines.push(
      `insert into public.overhead_inventories (id, part_id, prefix, kategori, item_name, qty, uom, location, condition, notes, photo_url, created_at, updated_at) values (` +
        `${sqlStr(inv.id)}, ${sqlStr(inv.partId)}, ${sqlStr(inv.prefix)}, ${sqlStr(inv.kategori)}, ${sqlStr(inv.itemName)}, ${sqlNum(inv.qty)}, ${sqlStr(inv.uom)}, ${sqlStr(inv.location)}, ${sqlStr(inv.condition)}, ${sqlStr(inv.notes)}, ${sqlStr(inv.photoUrl)}, ${sqlStr(inv.createdAt)}, ${sqlStr(inv.updatedAt)}) ` +
        `on conflict (id) do update set item_name = excluded.item_name, qty = excluded.qty, location = excluded.location, condition = excluded.condition, notes = excluded.notes, photo_url = excluded.photo_url;`
    );
    for (const m of inv.mutations) {
      lines.push(
        `insert into public.overhead_inventory_mutations (id, inventory_id, mutation_date, type, qty, note, by_name) values (` +
          `${sqlStr(m.id)}, ${sqlStr(inv.id)}, ${sqlStr(m.date)}, ${sqlStr(m.type)}, ${sqlNum(m.qty)}, ${sqlStr(m.note)}, ${sqlStr(m.byName)}) ` +
          `on conflict (id) do nothing;`
      );
    }
  }

  lines.push('', `-- 10. Permintaan Barang Internal (${store.itemRequests.length} permintaan)`);
  for (const req of store.itemRequests) {
    lines.push(
      `insert into public.item_requests (id, requester_name, requester_section, request_date, status, items, note, processed_by_name, processed_at) values (` +
        `${sqlStr(req.id)}, ${sqlStr(req.requesterName)}, ${sqlStr(req.requesterSection)}, ${sqlStr(req.requestDate)}, ${sqlStr(req.status)}, ${sqlJson(req.items)}, ${sqlStr(req.note)}, ${sqlStr(req.processedByName)}, ${sqlStr(req.processedAt)}) ` +
        `on conflict (id) do update set status = excluded.status, processed_by_name = excluded.processed_by_name, processed_at = excluded.processed_at;`
    );
  }

  lines.push('', `-- 11. Rolling Forecast GA Dept. (${store.rollingForecast.rows.length} baris)`);
  lines.push(
    `insert into public.rolling_forecast_meta (id, fiscal_year_label, period_range_label, department, section, active_month, last_updated_at, last_updated_by) values (` +
      `'FY2026', ${sqlStr(store.rollingForecast.fiscalYearLabel)}, ${sqlStr(store.rollingForecast.periodRangeLabel)}, ${sqlStr(store.rollingForecast.department)}, ${sqlStr(store.rollingForecast.section)}, ${sqlStr(store.rollingForecast.activeMonth)}, ${sqlStr(store.rollingForecast.lastUpdatedAt)}, ${sqlStr(store.rollingForecast.lastUpdatedBy)}) ` +
      `on conflict (id) do update set active_month = excluded.active_month, last_updated_at = excluded.last_updated_at, last_updated_by = excluded.last_updated_by;`
  );
  for (const row of store.rollingForecast.rows) {
    lines.push(
      `insert into public.rolling_forecast_rows (id, fiscal_year_id, jenis_no, jenis, item_no, code_item, item_name, item_description, uom, rm_stock, months, est_pemakaian, keterangan, updated_at) values (` +
        `${sqlStr(row.id)}, 'FY2026', ${sqlNum(row.jenisNo)}, ${sqlStr(row.jenis)}, ${sqlNum(row.itemNo)}, ${sqlStr(row.codeItem)}, ${sqlStr(row.itemName)}, ${sqlStr(row.itemDescription)}, ${sqlStr(row.uom)}, ${sqlNum(row.rmStock)}, ${sqlJson(row.months)}, ${sqlStr(row.estPemakaian)}, ${sqlStr(row.keterangan)}, ${sqlStr(row.updatedAt || new Date().toISOString())}) ` +
        `on conflict (id) do update set rm_stock = excluded.rm_stock, months = excluded.months, est_pemakaian = excluded.est_pemakaian, keterangan = excluded.keterangan;`
    );
  }
  for (const sub of store.rollingForecast.submissions) {
    lines.push(
      `insert into public.rolling_forecast_submissions (id, fiscal_year_id, month, submitted_at, submitted_by_name, total_items_requested, total_units_requested, note) values (` +
        `${sqlStr(sub.id)}, 'FY2026', ${sqlStr(sub.month)}, ${sqlStr(sub.submittedAt)}, ${sqlStr(sub.submittedByName)}, ${sqlNum(sub.totalItemsRequested)}, ${sqlNum(sub.totalUnitsRequested)}, ${sqlStr(sub.note)}) ` +
        `on conflict (id) do nothing;`
    );
  }

  lines.push('', `-- 12. Arsip & Lampiran Dokumen (${(store.documents || []).length} berkas)`);
  for (const d of store.documents || []) {
    lines.push(
      `insert into public.system_documents (id, title, category, period, linked_module, linked_report_id, file_name, file_type, file_size, file_url, storage_path, notes, uploaded_by_user_id, uploaded_by_name, uploaded_at, updated_at) values (` +
        `${sqlStr(d.id)}, ${sqlStr(d.title)}, ${sqlStr(d.category)}, ${sqlStr(d.period)}, ${sqlStr(d.linkedModule)}, ${sqlStr(d.linkedReportId || null)}, ${sqlStr(d.fileName)}, ${sqlStr(d.fileType)}, ${sqlNum(d.fileSize)}, ${sqlStr(d.fileUrl)}, ${sqlStr(d.storagePath || null)}, ${sqlStr(d.notes)}, ${sqlStr(d.uploadedByUserId || null)}, ${sqlStr(d.uploadedByName)}, ${sqlStr(d.uploadedAt)}, ${sqlStr(d.updatedAt)}) ` +
        `on conflict (id) do update set title = excluded.title, category = excluded.category, period = excluded.period, linked_report_id = excluded.linked_report_id, notes = excluded.notes, file_url = excluded.file_url, storage_path = excluded.storage_path;`
    );
  }

  lines.push('', `-- 13. Notifikasi & Audit Log`);
  for (const n of store.notifications) {
    lines.push(
      `insert into public.app_notifications (id, title, message, type, target_user_id, target_roles, link_to, read, created_at) values (` +
        `${sqlStr(n.id)}, ${sqlStr(n.title)}, ${sqlStr(n.message)}, ${sqlStr(n.type)}, ${sqlStr(n.targetUserId)}, ${sqlTextArray(n.targetRoles)}, ${sqlStr(n.linkTo)}, ${sqlBool(n.read)}, ${sqlStr(n.createdAt)}) ` +
        `on conflict (id) do update set read = excluded.read;`
    );
  }
  for (const a of store.auditLogs) {
    lines.push(
      `insert into public.audit_logs (id, timestamp, user_id, user_name, user_role, action, object_type, object_label, old_value, new_value) values (` +
        `${sqlStr(a.id)}, ${sqlStr(a.timestamp)}, ${sqlStr(a.userId || null)}, ${sqlStr(a.userName)}, ${sqlStr(a.userRole)}, ${sqlStr(a.action)}, ${sqlStr(a.objectType)}, ${sqlStr(a.objectLabel)}, ${sqlStr(a.oldValue)}, ${sqlStr(a.newValue)}) ` +
        `on conflict (id) do nothing;`
    );
  }

  lines.push('', 'commit;');
  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/sql;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
