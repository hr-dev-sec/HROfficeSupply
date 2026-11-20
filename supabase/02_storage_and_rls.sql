-- ============================================================================
-- HR SupplyHub — Supabase Storage Bucket, RLS Policies & Realtime Setup
-- PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
-- ============================================================================
-- Jalankan script ini SETELAH 01_schema.sql berhasil dieksekusi di SQL Editor.
-- ============================================================================

-- 1. STORAGE BUCKET UNTUK FOTO MASTER ITEM, INVENTARIS, & TANDA TANGAN DIGITAL
-- Struktur folder di dalam bucket `supplyhub-media`:
--   items/{item_id}-{timestamp}.jpg         -> Foto Master Item (Office Supplies & Overhead Goods)
--   inventories/{inv_id}-{timestamp}.jpg    -> Foto Aset Inventaris Overhead (MCH/ELC/ATK)
--   signatures/{user_id}-{timestamp}.png    -> Tanda Tangan Digital Tersimpan & Laporan
--   company/{filename}                      -> Logo & aset kop dokumen

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplyhub-media',
  'supplyhub-media',
  true,
  5242880, -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policy Storage: Baca publik (agar foto langsung tampil di web & PDF) + Upload/Update/Delete dari aplikasi
drop policy if exists "supplyhub_media_public_read" on storage.objects;
create policy "supplyhub_media_public_read"
  on storage.objects for select
  using (bucket_id = 'supplyhub-media');

drop policy if exists "supplyhub_media_insert" on storage.objects;
create policy "supplyhub_media_insert"
  on storage.objects for insert
  with check (bucket_id = 'supplyhub-media');

drop policy if exists "supplyhub_media_update" on storage.objects;
create policy "supplyhub_media_update"
  on storage.objects for update
  using (bucket_id = 'supplyhub-media');

drop policy if exists "supplyhub_media_delete" on storage.objects;
create policy "supplyhub_media_delete"
  on storage.objects for delete
  using (bucket_id = 'supplyhub-media');

-- 1B. STORAGE BUCKET KHUSUS ARSIP & LAMPIRAN DOKUMEN SISTEM & REPORT
-- Struktur folder di dalam bucket `supplyhub-documents`:
--   LAPORAN_OFFICE_SUPPLIES/  -> Scan PDF / Excel Laporan Office Supplies
--   LAPORAN_OVERHEAD_GOODS/   -> Scan PDF / Excel Laporan Overhead Goods
--   LAPORAN_INVENTARIS/       -> Scan PDF / Excel Laporan Inventaris Overhead
--   ROLLING_FORECAST_GA/      -> File Excel / PDF Rolling Forecast GA Dept.
--   STOCK_OPNAME/             -> Berita Acara & Lampiran Stock Opname
--   BUKTI_SERAH_TERIMA/       -> Surat Jalan GA / Bukti Terima & Pakai Barang
--   SOP_MEMO/                 -> SOP Internal HR / Memo Re-organisasi

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplyhub-documents',
  'supplyhub-documents',
  true,
  15728640, -- 15 MB per dokumen
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "supplyhub_docs_public_read" on storage.objects;
create policy "supplyhub_docs_public_read"
  on storage.objects for select
  using (bucket_id = 'supplyhub-documents');

drop policy if exists "supplyhub_docs_insert" on storage.objects;
create policy "supplyhub_docs_insert"
  on storage.objects for insert
  with check (bucket_id = 'supplyhub-documents');

drop policy if exists "supplyhub_docs_update" on storage.objects;
create policy "supplyhub_docs_update"
  on storage.objects for update
  using (bucket_id = 'supplyhub-documents');

drop policy if exists "supplyhub_docs_delete" on storage.objects;
create policy "supplyhub_docs_delete"
  on storage.objects for delete
  using (bucket_id = 'supplyhub-documents');

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) UNTUK SELURUH TABEL
-- ============================================================================
-- CATATAN:
-- Policy di bawah ini dirancang agar aplikasi HR SupplyHub langsung bekerja
-- begitu VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY dihubungkan (menggunakan
-- mekanisme login akun internal HR pada tabel `app_users`).
-- Jika nanti perusahaan mengaktifkan Supabase Auth SSO (auth.users), ganti
-- klausa `using (true)` menjadi `using (auth.role() = 'authenticated')`.

grant usage on schema public to anon, authenticated;
grant execute on function public.sync_user_reorganization(text, text, text) to anon, authenticated;

do $$
declare
  tbl text;
  tables text[] := array[
    'company_settings',
    'master_data_config',
    'app_users',
    'supply_items',
    'stock_transactions',
    'opname_sessions',
    'opname_lines',
    'signature_templates',
    'monthly_reports',
    'overhead_inventories',
    'overhead_inventory_mutations',
    'item_requests',
    'rolling_forecast_meta',
    'rolling_forecast_rows',
    'rolling_forecast_submissions',
    'system_documents',
    'app_notifications',
    'audit_logs'
  ];
begin
  foreach tbl in array tables loop
    execute format('grant select, insert, update, delete on table public.%I to anon, authenticated;', tbl);
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('drop policy if exists "hr_supplyhub_all_%I" on public.%I;', tbl, tbl);
    execute format(
      'create policy "hr_supplyhub_all_%I" on public.%I for all to anon, authenticated using (true) with check (true);',
      tbl,
      tbl
    );
  end loop;
end;
$$;

-- ============================================================================
-- 3. SUPABASE REALTIME (Opsional: Sinkronisasi Multi-Pengguna Real-Time)
-- ============================================================================
do $$
declare
  tbl text;
  rt_tables text[] := array[
    'app_users',
    'supply_items',
    'stock_transactions',
    'monthly_reports',
    'overhead_inventories',
    'item_requests',
    'rolling_forecast_rows',
    'system_documents',
    'app_notifications'
  ];
begin
  foreach tbl in array rt_tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    exception
      when duplicate_object then
        null;
    end;
  end loop;
end;
$$;
