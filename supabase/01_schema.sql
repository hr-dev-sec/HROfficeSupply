-- ============================================================================
-- HR SupplyHub — Full Database Schema Draft for Supabase (PostgreSQL)
-- PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
-- Departemen Human Resources (HR Development & HR Adm. & Operation)
-- ============================================================================
-- Jalankan script ini di Supabase Dashboard -> SQL Editor -> New Query.
-- Script bersifat idempotent (aman dijalankan ulang tanpa merusak tabel).
-- ============================================================================

create extension if not exists "pgcrypto";

-- Helper trigger function untuk otomatis memperbarui kolom updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================================
-- 1. PENGATURAN PERUSAHAAN & KOP DOKUMEN (Singleton: id = 'default')
-- ============================================================================
create table if not exists public.company_settings (
  id text primary key default 'default',
  company_name text not null default 'PT Ajinomoto Indonesia - PT Ajinex International',
  factory_name text not null default 'Mojokerto Factory',
  department text not null default 'Human Resources',
  section text not null default 'HR Development & HR Adm. & Operation',
  location_city text not null default 'Mojokerto',
  logo_url text not null default '/logo-ajinomoto.png',
  instructions_check jsonb not null default '[]'::jsonb,
  instructions_inventory jsonb not null default '[]'::jsonb,
  reminder_early_month_day integer not null default 5,
  reminder_opname_day integer not null default 28,
  language text not null default 'id',
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. MASTER DATA REFERENSI (Kategori, Satuan/UOM, Lokasi Simpan)
-- ============================================================================
create table if not exists public.master_data_config (
  id text primary key default 'default',
  categories_office jsonb not null default '[]'::jsonb,
  categories_overhead jsonb not null default '[]'::jsonb,
  uoms jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_master_data_config_updated_at on public.master_data_config;
create trigger trg_master_data_config_updated_at
before update on public.master_data_config
for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. AKUN PENGGUNA & PROFIL ORGANISASI (Mendukung Edit Akun & Re-organisasi)
-- ============================================================================
create table if not exists public.app_users (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER')),
  jabatan text not null,
  seksi text not null,
  avatar_initials text not null default 'HR',
  saved_signature_url text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_users_role_active on public.app_users(role, active);
create index if not exists idx_app_users_seksi on public.app_users(seksi);

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. MASTER ITEM (Office Supplies & Overhead Goods + Foto Storage URL)
-- ============================================================================
create table if not exists public.supply_items (
  id text primary key,
  jenis text not null check (jenis in ('OFFICE_SUPPLIES', 'OVERHEAD_GOODS')),
  kategori text not null,
  code_item text not null default '',
  item_name text not null,
  uom text not null default 'PC',
  min_stock integer not null default 1 check (min_stock >= 0),
  current_stock integer not null default 0 check (current_stock >= 0),
  location text not null default '',
  notes text not null default '',
  photo_url text,
  archived boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_supply_items_jenis_archived on public.supply_items(jenis, archived);
create index if not exists idx_supply_items_code on public.supply_items(code_item);
create index if not exists idx_supply_items_kategori on public.supply_items(kategori);

drop trigger if exists trg_supply_items_updated_at on public.supply_items;
create trigger trg_supply_items_updated_at
before update on public.supply_items
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5. TRANSAKSI STOK (Terima, Pakai, Penyesuaian Opname)
-- ============================================================================
create table if not exists public.stock_transactions (
  id text primary key,
  item_id text not null references public.supply_items(id) on delete cascade,
  jenis text not null check (jenis in ('OFFICE_SUPPLIES', 'OVERHEAD_GOODS')),
  code_item text not null default '',
  item_name text not null,
  uom text not null default 'PC',
  type text not null check (type in ('TERIMA', 'PAKAI', 'OPNAME_ADJ')),
  qty integer not null,
  tx_date date not null,
  period text not null, -- Format YYYY-MM
  recorded_by_user_id text references public.app_users(id) on delete set null,
  recorded_by_name text not null,
  note text not null default '',
  reference_no text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_stock_tx_period_jenis on public.stock_transactions(period, jenis);
create index if not exists idx_stock_tx_item on public.stock_transactions(item_id);
create index if not exists idx_stock_tx_date on public.stock_transactions(tx_date desc);

-- ============================================================================
-- 6. STOCK OPNAME BULANAN (Header + Detail Baris Opname)
-- ============================================================================
create table if not exists public.opname_sessions (
  id text primary key,
  period text not null, -- Format YYYY-MM
  jenis text not null check (jenis in ('OFFICE_SUPPLIES', 'OVERHEAD_GOODS')),
  status text not null check (status in ('DRAFT', 'MENUNGGU_SM', 'DISETUJUI', 'DITOLAK')),
  created_by_user_id text references public.app_users(id) on delete set null,
  created_by_name text not null,
  approved_by_user_id text references public.app_users(id) on delete set null,
  approved_by_name text,
  approved_at timestamptz,
  rejection_note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_opname_sessions_period on public.opname_sessions(period, jenis);

create table if not exists public.opname_lines (
  id text primary key,
  session_id text not null references public.opname_sessions(id) on delete cascade,
  item_id text not null,
  kategori text not null,
  code_item text not null default '',
  item_name text not null,
  uom text not null default 'PC',
  stok_awal integer not null default 0,
  terima integer not null default 0,
  pakai integer not null default 0,
  system_stock integer not null default 0,
  physical_stock integer not null default 0,
  diff integer not null default 0,
  reason text not null default '',
  balanced boolean not null default true,
  sort_index integer not null default 0
);

create index if not exists idx_opname_lines_session on public.opname_lines(session_id);

-- ============================================================================
-- 7. TEMPLATE TANDA TANGAN DIGITAL BERJENJANG
-- ============================================================================
create table if not exists public.signature_templates (
  id text primary key,
  name text not null,
  jenis text not null check (jenis in ('OFFICE_SUPPLIES', 'OVERHEAD_GOODS', 'INVENTARIS_OVERHEAD')),
  is_default boolean not null default false,
  groups jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_signature_templates_updated_at on public.signature_templates;
create trigger trg_signature_templates_updated_at
before update on public.signature_templates
for each row execute function public.set_updated_at();

-- ============================================================================
-- 8. LAPORAN BULANAN RESMI A3/A4 + STATUS APPROVAL & VERIFIKASI QR
-- ============================================================================
create table if not exists public.monthly_reports (
  id text primary key,
  document_id text not null unique,
  doc_hash text not null,
  jenis text not null check (jenis in ('OFFICE_SUPPLIES', 'OVERHEAD_GOODS', 'INVENTARIS_OVERHEAD')),
  title text not null,
  period text not null, -- Format YYYY-MM
  period_label text not null,
  department text not null,
  section text not null,
  place_date_text text not null,
  status text not null check (status in ('DRAFT', 'DILAPORKAN', 'DICHECK', 'MENGETAHUI', 'FINAL')),
  check_rows jsonb,
  inventory_rows jsonb,
  signature_groups jsonb not null default '[]'::jsonb,
  template_id text references public.signature_templates(id) on delete set null,
  locked boolean not null default false,
  version integer not null default 1,
  versions jsonb not null default '[]'::jsonb,
  rejection_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_monthly_reports_period_jenis on public.monthly_reports(period, jenis);
create index if not exists idx_monthly_reports_status on public.monthly_reports(status);

drop trigger if exists trg_monthly_reports_updated_at on public.monthly_reports;
create trigger trg_monthly_reports_updated_at
before update on public.monthly_reports
for each row execute function public.set_updated_at();

-- ============================================================================
-- 9. INVENTARIS OVERHEAD (MCH / ELC / ATK + Foto Storage URL + Mutasi)
-- ============================================================================
create table if not exists public.overhead_inventories (
  id text primary key,
  part_id text not null unique,
  prefix text not null check (prefix in ('MCH', 'ELC', 'ATK')),
  kategori text not null default 'Overhead',
  item_name text not null,
  qty integer not null default 0 check (qty >= 0),
  uom text not null default 'PC',
  location text not null default '',
  condition text not null check (condition in ('BAGUS', 'RUSAK')),
  notes text not null default '',
  photo_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_overhead_inv_prefix on public.overhead_inventories(prefix);

drop trigger if exists trg_overhead_inventories_updated_at on public.overhead_inventories;
create trigger trg_overhead_inventories_updated_at
before update on public.overhead_inventories
for each row execute function public.set_updated_at();

create table if not exists public.overhead_inventory_mutations (
  id text primary key,
  inventory_id text not null references public.overhead_inventories(id) on delete cascade,
  mutation_date date not null,
  type text not null check (type in ('IN', 'OUT', 'KONDISI')),
  qty integer not null default 0,
  note text not null default '',
  by_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_overhead_mut_inventory on public.overhead_inventory_mutations(inventory_id);

-- ============================================================================
-- 10A. DATABASE KARYAWAN DEPARTEMEN HR (2 Seksi: HR Development & Administration & Operation)
-- ============================================================================
create table if not exists public.hr_employees (
  id text primary key,
  nik text not null default '',
  name text not null,
  section text not null check (section in ('HR Development', 'Administration & Operation')),
  jabatan text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_hr_employees_section on public.hr_employees(section);
create index if not exists idx_hr_employees_active on public.hr_employees(active);

drop trigger if exists trg_hr_employees_updated_at on public.hr_employees;
create trigger trg_hr_employees_updated_at
before update on public.hr_employees
for each row execute function public.set_updated_at();

-- ============================================================================
-- 10B. PERMINTAAN & PENGAMBILAN BARANG KARYAWAN DEPT. HR
-- ============================================================================
create table if not exists public.item_requests (
  id text primary key,
  employee_id text,
  requester_nik text,
  requester_name text not null,
  requester_section text not null,
  request_date date not null,
  status text not null check (status in ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  items jsonb not null default '[]'::jsonb,
  note text not null default '',
  source text not null default 'PORTAL_DEPAN',
  rejection_note text,
  processed_by_name text,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_item_requests_status on public.item_requests(status);

-- ============================================================================
-- 11. ROLLING FORECAST OFFICE SUPPLIES KE GA DEPT. (FY2026 & Seterusnya)
-- ============================================================================
create table if not exists public.rolling_forecast_meta (
  id text primary key default 'FY2026',
  fiscal_year_label text not null default 'FY 2026',
  period_range_label text not null default 'Apr 2026 - Mar 2027',
  department text not null default 'Human Resources',
  section text not null default 'HR Development & HR Adm. & Operation',
  active_month text not null default 'Nov-26',
  last_updated_at timestamptz not null default timezone('utc', now()),
  last_updated_by text not null default 'Mahmud Nurdiansyah'
);

create table if not exists public.rolling_forecast_rows (
  id text primary key,
  fiscal_year_id text not null default 'FY2026' references public.rolling_forecast_meta(id) on delete cascade,
  jenis_no integer not null,
  jenis text not null,
  item_no integer not null,
  code_item text not null default '',
  item_name text not null,
  item_description text not null,
  uom text not null default 'PC',
  rm_stock integer,
  months jsonb not null default '{}'::jsonb,
  est_pemakaian text not null default '',
  keterangan text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_rf_rows_fy_order on public.rolling_forecast_rows(fiscal_year_id, jenis_no, item_no);
create index if not exists idx_rf_rows_code on public.rolling_forecast_rows(code_item);

create table if not exists public.rolling_forecast_submissions (
  id text primary key,
  fiscal_year_id text not null default 'FY2026' references public.rolling_forecast_meta(id) on delete cascade,
  month text not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  submitted_by_name text not null,
  total_items_requested integer not null default 0,
  total_units_requested integer not null default 0,
  note text not null default ''
);

create index if not exists idx_rf_submissions_fy on public.rolling_forecast_submissions(fiscal_year_id, submitted_at desc);

-- ============================================================================
-- 12. ARSIP & LAMPIRAN DOKUMEN SISTEM & LAPORAN (PDF, Excel, Word, Scan)
-- ============================================================================
create table if not exists public.system_documents (
  id text primary key,
  title text not null,
  category text not null check (
    category in (
      'LAPORAN_OFFICE_SUPPLIES',
      'LAPORAN_OVERHEAD_GOODS',
      'LAPORAN_INVENTARIS',
      'ROLLING_FORECAST_GA',
      'STOCK_OPNAME',
      'BUKTI_SERAH_TERIMA',
      'SOP_MEMO'
    )
  ),
  period text not null, -- Format YYYY-MM
  linked_module text not null default 'GENERAL' check (
    linked_module in ('REPORTS', 'FORECAST', 'OPNAME', 'TRANSACTIONS', 'INVENTORY', 'GENERAL')
  ),
  linked_report_id text references public.monthly_reports(id) on delete set null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null default 0,
  file_url text not null,
  storage_path text,
  notes text not null default '',
  uploaded_by_user_id text references public.app_users(id) on delete set null,
  uploaded_by_name text not null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_system_documents_cat_period on public.system_documents(category, period desc);
create index if not exists idx_system_documents_report on public.system_documents(linked_report_id);
create index if not exists idx_system_documents_uploaded on public.system_documents(uploaded_at desc);

drop trigger if exists trg_system_documents_updated_at on public.system_documents;
create trigger trg_system_documents_updated_at
before update on public.system_documents
for each row execute function public.set_updated_at();

-- ============================================================================
-- 13. NOTIFIKASI & AUDIT TRAIL SISTEM
-- ============================================================================
create table if not exists public.app_notifications (
  id text primary key,
  title text not null,
  message text not null,
  type text not null check (type in ('STOK_KRITIS', 'TANDA_TANGAN', 'OPNAME', 'LAPORAN', 'PENGINGAT')),
  target_user_id text references public.app_users(id) on delete cascade,
  target_roles text[],
  link_to text not null default '/app',
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_created on public.app_notifications(created_at desc);

create table if not exists public.audit_logs (
  id text primary key,
  timestamp timestamptz not null default timezone('utc', now()),
  user_id text,
  user_name text not null,
  user_role text not null,
  action text not null check (
    action in (
      'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE',
      'SIGN', 'REJECT', 'APPROVE', 'EXPORT', 'IMPORT', 'RESET'
    )
  ),
  object_type text not null,
  object_label text not null,
  old_value text,
  new_value text
);

create index if not exists idx_audit_logs_ts on public.audit_logs(timestamp desc);

-- ============================================================================
-- 13. STORED FUNCTION: SINKRONISASI RE-ORGANISASI AKUN PENGGUNA
--     Otomatis menyelaraskan Nama & Jabatan baru ke Template Tanda Tangan
--     dan Laporan Bulanan yang belum Final (locked = false).
-- ============================================================================
create or replace function public.sync_user_reorganization(
  p_user_id text,
  p_new_name text,
  p_new_jabatan text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Perbarui nama & jabatan pada template tanda tangan
  update public.signature_templates st
  set groups = (
    select jsonb_agg(
      jsonb_set(
        grp,
        '{slots}',
        coalesce((
          select jsonb_agg(
            case
              when slot->>'allowedUserId' = p_user_id then
                jsonb_set(
                  jsonb_set(slot, '{name}', to_jsonb(p_new_name)),
                  '{jabatan}',
                  to_jsonb(p_new_jabatan)
                )
              else slot
            end
          )
          from jsonb_array_elements(grp->'slots') as slot
        ), '[]'::jsonb)
      )
    )
    from jsonb_array_elements(st.groups) as grp
  )
  where st.groups::text like '%' || p_user_id || '%';

  -- Perbarui slot PENDING pada laporan bulanan yang belum terkunci (Final tetap utuh)
  update public.monthly_reports mr
  set signature_groups = (
    select jsonb_agg(
      jsonb_set(
        grp,
        '{slots}',
        coalesce((
          select jsonb_agg(
            case
              when slot->>'allowedUserId' = p_user_id and coalesce(slot->>'status', 'PENDING') = 'PENDING' then
                jsonb_set(
                  jsonb_set(slot, '{name}', to_jsonb(p_new_name)),
                  '{jabatan}',
                  to_jsonb(p_new_jabatan)
                )
              else slot
            end
          )
          from jsonb_array_elements(grp->'slots') as slot
        ), '[]'::jsonb)
      )
    )
    from jsonb_array_elements(mr.signature_groups) as grp
  )
  where mr.locked = false
    and mr.signature_groups::text like '%' || p_user_id || '%';
end;
$$;
