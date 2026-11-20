-- ============================================================================
-- HR SupplyHub — Migrasi Tambahan: Database Karyawan Dept. HR & Form Pengambilan
-- PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
-- ============================================================================
-- Jalankan script ini di Supabase SQL Editor -> New query -> Run
-- (Aman dijalankan pada database yang sudah aktif / idempotent).
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

-- Tambahkan kolom pendukung pada tabel item_requests yang sudah ada
alter table public.item_requests add column if not exists employee_id text;
alter table public.item_requests add column if not exists requester_nik text;
alter table public.item_requests add column if not exists source text not null default 'PORTAL_DEPAN';
alter table public.item_requests add column if not exists rejection_note text;

-- Hak akses GRANT + RLS Policy + Realtime untuk tabel hr_employees
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.hr_employees to anon, authenticated;
grant select, insert, update, delete on table public.item_requests to anon, authenticated;

alter table public.hr_employees enable row level security;
drop policy if exists "hr_supplyhub_all_hr_employees" on public.hr_employees;
create policy "hr_supplyhub_all_hr_employees"
  on public.hr_employees
  for all
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.hr_employees;
exception
  when duplicate_object then
    null;
end;
$$;
