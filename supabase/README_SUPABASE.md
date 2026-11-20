# Panduan Koneksi Database Supabase — HR SupplyHub
**PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory**
Departemen Human Resources (HR Development & HR Adm. & Operation)

Seluruh struktur database, storage foto, akun pengguna (termasuk fitur edit akun & serah terima jabatan re-organisasi), serta lapisan integrasi Supabase SDK sudah siap pakai. Ikuti 4 langkah berikut untuk mengaktifkan database cloud Supabase:

---

## Langkah 1 — Buat Project di Supabase
1. Masuk ke [supabase.com](https://supabase.com) dan buat project baru (disarankan region **Southeast Asia / Singapore**).
2. Tunggu hingga database PostgreSQL selesai dibuat.

## Langkah 2 — Jalankan Skema Tabel, Storage & RLS
Buka menu **SQL Editor → New Query** di dashboard Supabase, lalu jalankan secara berurutan:
1. Salin & jalankan seluruh isi file `supabase/01_schema.sql` (membuat 17 tabel relasional + indeks + trigger + fungsi sinkronisasi re-organisasi).
2. Salin & jalankan seluruh isi file `supabase/02_storage_and_rls.sql` (membuat bucket Storage `supplyhub-media` untuk foto Master Item, foto Inventaris Overhead, dan tanda tangan digital, plus kebijakan RLS & Realtime).

> **Tip:** Anda juga bisa mengunduh kedua script tersebut sekaligus **SQL Seed Data Terkini** (berisi seluruh data yang sudah Anda input saat ini) langsung dari halaman **Pengaturan Sistem → Draft Database & Integrasi Supabase** di dalam aplikasi (khusus Super Admin).

## Langkah 3 — Hubungkan Environment Variables
Buka **Project Settings → API** di Supabase, salin **Project URL** dan **anon / publishable key**, lalu tambahkan ke environment variables (`.env` atau Secrets):

```env
VITE_SUPABASE_URL="https://xxxx-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_STORAGE_BUCKET="supplyhub-media"
VITE_SUPABASE_DOCUMENTS_BUCKET="supplyhub-documents"
```

## Langkah 4 — Sinkronisasi Otomatis & Migrasi Foto / Dokumen
Setelah environment variables terpasang dan aplikasi dimuat ulang:
- Jika database Supabase masih kosong, aplikasi akan **otomatis mengunggah data awal & memigrasikan seluruh foto, tanda tangan, dan dokumen arsip lokal** ke bucket `supplyhub-media` dan `supplyhub-documents`.
- Setiap perubahan data (tambah/edit akun, re-organisasi jabatan, master item, upload foto, upload dokumen PDF/Excel/Word, transaksi, stock opname, rolling forecast GA, laporan bulanan, tanda tangan digital, notifikasi, dan audit log) otomatis tersimpan ke PostgreSQL & Storage Supabase secara real-time.
- Jika environment variables belum diisi, aplikasi tetap berjalan normal menggunakan penyimpanan lokal browser (`localStorage`).

---

## Ringkasan Cakupan Tabel (18 Tabel + 2 Storage Bucket)
| Modul | Tabel PostgreSQL & Storage |
|---|---|
| Akun & Re-organisasi | `app_users`, `sync_user_reorganization()` |
| Pengaturan & Referensi | `company_settings`, `master_data_config` |
| Master Item & Foto | `supply_items` + Storage `supplyhub-media/items/` |
| Transaksi & Opname | `stock_transactions`, `opname_sessions`, `opname_lines` |
| Inventaris Overhead & Foto | `overhead_inventories`, `overhead_inventory_mutations` + Storage `supplyhub-media/inventories/` |
| Permintaan Internal | `item_requests` |
| Rolling Forecast GA FY2026 | `rolling_forecast_meta`, `rolling_forecast_rows`, `rolling_forecast_submissions` |
| Laporan A3 & Tanda Tangan | `signature_templates`, `monthly_reports` + Storage `supplyhub-media/signatures/` |
| Arsip & Lampiran Dokumen | `system_documents` + Storage `supplyhub-documents/` (PDF, Excel, Word, Scan) |
| Notifikasi & Audit | `app_notifications`, `audit_logs` |
