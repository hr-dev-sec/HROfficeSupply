import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CloudUpload,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileCode2,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { processAndUploadImage } from '../services/mediaStorageService';
import type { User, UserRole } from '../types';
import { getRoleLabel } from '../utils/format';
import {
  downloadTextFile,
  generateCurrentStoreSeedSql,
  getSupabaseSchemaSql,
  getSupabaseStorageRlsSql,
} from '../utils/supabaseSqlGenerator';

interface UserFormState {
  id?: string;
  username: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  jabatan: string;
  seksi: string;
  avatarInitials: string;
  savedSignatureDataUrl?: string;
  active: boolean;
  syncReorg: boolean;
  isSelfProfile?: boolean;
}

const DEFAULT_SECTIONS = [
  'HR Development',
  'HR Adm. & Operation',
  'Human Resources',
  'Industrial Relations & HR Services',
  'People & Organization Development',
];

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export const SettingsPage: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const {
    store,
    isSupabaseConnected,
    syncAllToSupabase,
    updateSettings,
    upsertUser,
    reassignUserSlots,
    deleteUser,
    exportBackupJson,
    importBackupJson,
    resetDemoData,
  } = useSupplyHub();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [settingsForm, setSettingsForm] = useState(store.settings);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal Tambah / Edit Akun (mendukung Re-organisasi & Edit Profil Pribadi)
  const [userForm, setUserForm] = useState<UserFormState | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Modal Serah Terima Jabatan (Re-organisasi)
  const [handoverFromUser, setHandoverFromUser] = useState<User | null>(null);
  const [handoverToUserId, setHandoverToUserId] = useState('');
  const [handoverDeactivateOld, setHandoverDeactivateOld] = useState(true);

  // Konfirmasi Hapus Akun
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);

  // Sync Supabase state
  const [syncingSupabase, setSyncingSupabase] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return store.users.filter((u) => {
      if (userStatusFilter === 'ACTIVE' && !u.active) return false;
      if (userStatusFilter === 'INACTIVE' && u.active) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.jabatan.toLowerCase().includes(q) ||
        u.seksi.toLowerCase().includes(q)
      );
    });
  }, [store.users, userSearch, userStatusFilter]);

  const handoverImpact = useMemo(() => {
    if (!handoverFromUser) return { templates: 0, draftReports: 0 };
    const templates = store.templates.filter((t) =>
      t.groups.some((g) => g.slots.some((s) => s.allowedUserId === handoverFromUser.id))
    ).length;
    const draftReports = store.reports.filter(
      (r) =>
        !r.locked &&
        r.signatureGroups.some((g) =>
          g.slots.some((s) => s.allowedUserId === handoverFromUser.id && s.status === 'PENDING')
        )
    ).length;
    return { templates, draftReports };
  }, [handoverFromUser, store.reports, store.templates]);

  if (!user) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(settingsForm, user);
    toast('Pengaturan dokumen & sistem disimpan', 'success');
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    downloadTextFile(
      `HR_SupplyHub_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json'
    );
    toast('Backup JSON berhasil diunduh', 'success');
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackupJson(String(reader.result), user);
        toast('Restore data JSON berhasil', 'success');
      } catch (err) {
        toast('Gagal memulihkan backup', 'error', err instanceof Error ? err.message : undefined);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openCreateUserModal = () => {
    setShowPassword(false);
    setUserForm({
      username: '',
      email: '',
      password: '',
      name: '',
      role: 'STAFF',
      jabatan: 'Staff HR Development',
      seksi: 'HR Development',
      avatarInitials: '',
      active: true,
      syncReorg: false,
      isSelfProfile: false,
    });
  };

  const openEditUserModal = (target: User, isSelfProfile = false) => {
    setShowPassword(false);
    setUserForm({
      id: target.id,
      username: target.username,
      email: target.email,
      password: '', // Kosongkan saat edit; jika diisi akan memperbarui sandi
      name: target.name,
      role: target.role,
      jabatan: target.jabatan,
      seksi: target.seksi,
      avatarInitials: target.avatarInitials,
      savedSignatureDataUrl: target.savedSignatureDataUrl,
      active: target.active,
      syncReorg: true,
      isSelfProfile,
    });
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userForm) return;
    if (!file.type.startsWith('image/')) {
      toast('Berkas tanda tangan harus berupa gambar (PNG/JPG/SVG)', 'error');
      return;
    }
    try {
      const { url } = await processAndUploadImage(
        file,
        'signatures',
        userForm.id || userForm.username || `sig-${Date.now()}`
      );
      setUserForm((prev) => (prev ? { ...prev, savedSignatureDataUrl: url } : prev));
      toast('Gambar tanda tangan dimuat', 'success', 'Klik "Simpan Perubahan" untuk menerapkan.');
    } catch {
      toast('Gagal memproses gambar tanda tangan', 'error');
    }
    e.target.value = '';
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm) return;

    const existing = userForm.id ? store.users.find((u) => u.id === userForm.id) : undefined;
    if (!existing && !userForm.password.trim()) {
      toast('Kata sandi wajib diisi untuk akun baru', 'error');
      return;
    }

    const finalPassword = userForm.password.trim() || existing?.password || 'demo123';
    const finalInitials = (userForm.avatarInitials.trim() || buildInitials(userForm.name))
      .toUpperCase()
      .slice(0, 2);

    const payload: User = {
      id: existing ? existing.id : `usr-${Date.now()}`,
      username: userForm.username.trim(),
      email: userForm.email.trim() || `${userForm.username.trim()}@ajinomoto.co.id`,
      password: finalPassword,
      name: userForm.name.trim(),
      role: userForm.isSelfProfile && !isSuperAdmin && existing ? existing.role : userForm.role,
      jabatan: userForm.jabatan.trim() || 'Staff HR',
      seksi: userForm.seksi.trim() || 'HR Development',
      avatarInitials: finalInitials,
      savedSignatureDataUrl: userForm.savedSignatureDataUrl,
      active: userForm.isSelfProfile && existing ? existing.active : userForm.active,
    };

    const res = upsertUser(payload, user, { syncReorg: userForm.syncReorg });
    if (!res.ok) {
      toast('Gagal menyimpan akun', 'error', res.error);
      return;
    }

    setUserForm(null);
    toast(
      existing ? 'Akun pengguna berhasil diperbarui' : 'Pengguna baru berhasil ditambahkan',
      'success',
      existing && userForm.syncReorg
        ? 'Nama & jabatan turut diselaraskan pada Template Tanda Tangan & Laporan Draft.'
        : undefined
    );
  };

  const handleConfirmHandover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverFromUser || !handoverToUserId) return;
    const res = reassignUserSlots(
      handoverFromUser.id,
      handoverToUserId,
      handoverDeactivateOld,
      user
    );
    if (!res.ok) {
      toast('Serah terima gagal', 'error', res.error);
      return;
    }
    const targetName = store.users.find((u) => u.id === handoverToUserId)?.name || 'Pengganti';
    toast(
      'Serah terima jabatan selesai',
      'success',
      `Slot persetujuan dari ${handoverFromUser.name} dialihkan ke ${targetName} (${res.updatedTemplates} template, ${res.updatedReports} laporan draft).`
    );
    setHandoverFromUser(null);
    setHandoverToUserId('');
  };

  const handleConfirmDeleteUser = () => {
    if (!deleteTargetUser) return;
    const res = deleteUser(deleteTargetUser.id, user);
    if (!res.ok) {
      toast('Tidak dapat menghapus akun', 'error', res.error);
      return;
    }
    toast(`Akun ${deleteTargetUser.name} dihapus`, 'success');
    setDeleteTargetUser(null);
  };

  const handlePushToSupabase = async () => {
    setSyncingSupabase(true);
    const res = await syncAllToSupabase();
    setSyncingSupabase(false);
    if (res.ok) {
      toast(
        'Sinkronisasi Supabase berhasil',
        'success',
        'Seluruh akun, tabel sistem, dan foto telah tersimpan ke PostgreSQL & Storage Supabase.'
      );
    } else {
      toast('Sinkronisasi Supabase gagal', 'error', res.error);
    }
  };

  const totalPhotosCount =
    store.items.filter((i) => Boolean(i.photoUrl)).length +
    store.inventories.filter((inv) => Boolean(inv.photoUrl)).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold font-display">Pengaturan Sistem &amp; Profil</h2>
        <p className="text-xs text-neutral-500">
          Kelola profil, tanda tangan tersimpan, kop laporan, akun &amp; re-organisasi HR, serta persiapan database Supabase.
        </p>
      </div>

      {/* Profil & Tema */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Profil &amp; Tanda Tangan Tersimpan</h3>
            <button
              type="button"
              onClick={() => openEditUserModal(user, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profil &amp; Sandi
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#E60012] text-white font-bold flex items-center justify-center shrink-0">
              {user.avatarInitials}
            </div>
            <div className="text-xs min-w-0">
              <div className="font-bold text-sm truncate">{user.name}</div>
              <div className="text-neutral-500">
                {user.jabatan} · {user.seksi}
              </div>
              <div className="text-neutral-400 font-mono-num truncate">
                {user.email} · {getRoleLabel(user.role)}
              </div>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white text-center">
            {user.savedSignatureDataUrl ? (
              <img
                src={user.savedSignatureDataUrl}
                alt="Tanda tangan tersimpan"
                className="max-h-16 mx-auto object-contain"
              />
            ) : (
              <span className="text-xs text-neutral-400">
                Belum ada tanda tangan tersimpan (otomatis tersimpan saat menandatangani laporan atau unggah melalui Edit Profil).
              </span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <h3 className="text-sm font-bold">Tampilan &amp; Backup Data</h3>
          <div className="flex items-center justify-between text-xs">
            <span>Tema Antarmuka</span>
            <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1.5 rounded-lg font-semibold ${
                  theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'
                }`}
              >
                Terang
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1.5 rounded-lg font-semibold ${
                  theme === 'dark' ? 'bg-[#171A1F] text-white shadow-sm' : 'text-neutral-500'
                }`}
              >
                Gelap
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Backup JSON
            </button>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition">
              <Upload className="w-3.5 h-3.5" />
              Restore JSON
              <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
            </label>
            <button
              type="button"
              onClick={() => {
                resetDemoData(user);
                toast('Data demo berhasil direset', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/15 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-600/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Data Demo
            </button>
          </div>
        </div>
      </div>

      {/* Kop Dokumen & Petunjuk Editor */}
      <form
        onSubmit={handleSaveSettings}
        className="p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4 text-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Kop Dokumen, Pengingat &amp; Teks Petunjuk Laporan</h3>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white font-semibold transition"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan Pengaturan
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold mb-1">Departemen</label>
            <input
              type="text"
              value={settingsForm.department}
              onChange={(e) => setSettingsForm({ ...settingsForm, department: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Seksi</label>
            <input
              type="text"
              value={settingsForm.section}
              onChange={(e) => setSettingsForm({ ...settingsForm, section: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Kota Tanda Tangan</label>
            <input
              type="text"
              value={settingsForm.locationCity}
              onChange={(e) => setSettingsForm({ ...settingsForm, locationCity: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block font-semibold">
            7 Petunjuk Laporan Pengechekan Barang (1 baris = 1 poin)
          </label>
          <textarea
            rows={7}
            value={settingsForm.instructionsCheck.join('\n')}
            onChange={(e) =>
              setSettingsForm({
                ...settingsForm,
                instructionsCheck: e.target.value.split('\n').filter((l) => l.trim().length > 0),
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] leading-relaxed"
          />
        </div>
      </form>

      {/* Manajemen Pengguna & Re-organisasi (Super Admin) */}
      {isSuperAdmin && (
        <div className="p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E60012]" />
                Manajemen Akun Pengguna &amp; Re-organisasi ({store.users.length})
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Ubah nama, jabatan, seksi, peran, kata sandi, atau lakukan serah terima slot persetujuan saat terjadi rotasi/re-organisasi.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateUserModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold shrink-0 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Tambah Pengguna
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama, username, jabatan, atau seksi..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
              />
            </div>
            <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'ACTIVE', label: 'Aktif' },
                  { id: 'INACTIVE', label: 'Nonaktif' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUserStatusFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold ${
                    userStatusFilter === opt.id
                      ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
                  <th className="py-2.5 pr-3">Pengguna</th>
                  <th className="py-2.5 px-2">Username</th>
                  <th className="py-2.5 px-2">Jabatan &amp; Seksi</th>
                  <th className="py-2.5 px-2">Peran</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 pl-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredUsers.map((u) => {
                  const isCurrentUser = u.id === user.id;
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 ${
                        !u.active ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-800 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                            {u.avatarInitials}
                          </div>
                          <div>
                            <div className="font-semibold flex items-center gap-1.5">
                              {u.name}
                              {isCurrentUser && (
                                <span className="text-[10px] font-bold text-[#E60012]">(Anda)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono-num">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono-num">{u.username}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-medium">{u.jabatan}</div>
                        <div className="text-[11px] text-neutral-500">{u.seksi}</div>
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          value={u.role}
                          onChange={(e) => {
                            const res = upsertUser(
                              { ...u, role: e.target.value as UserRole },
                              user,
                              { syncReorg: false }
                            );
                            if (!res.ok) {
                              toast('Gagal mengubah peran', 'error', res.error);
                            } else {
                              toast(`Peran ${u.name} diperbarui`, 'success');
                            }
                          }}
                          className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                        >
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="STAFF">Staff / PIC</option>
                          <option value="SECTION_MANAGER">Section Manager</option>
                          <option value="DEPT_MANAGER">Department Manager</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          disabled={isCurrentUser}
                          onClick={() => {
                            const res = upsertUser({ ...u, active: !u.active }, user, {
                              syncReorg: false,
                            });
                            if (!res.ok) {
                              toast('Gagal mengubah status', 'error', res.error);
                            } else {
                              toast(
                                `${u.name} ${!u.active ? 'diaktifkan' : 'dinonaktifkan'}`,
                                'success'
                              );
                            }
                          }}
                          className={`font-semibold disabled:opacity-50 ${
                            u.active ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u, false)}
                            title="Edit Akun & Penyesuaian Jabatan"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-[#E60012] hover:text-[#E60012] font-semibold transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHandoverFromUser(u);
                              const firstOther = store.users.find(
                                (cand) => cand.id !== u.id && cand.active
                              );
                              setHandoverToUserId(firstOther?.id || '');
                              setHandoverDeactivateOld(u.id !== user.id);
                            }}
                            title="Serah Terima Jabatan / Re-organisasi"
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-amber-500 hover:text-amber-600 transition"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          {!isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetUser(u)}
                              title="Hapus Akun"
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-red-500 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Draft Database & Integrasi Supabase (Super Admin) */}
      {isSuperAdmin && (
        <div className="p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-[#E60012]" />
                Draft Database &amp; Kesiapan Integrasi Supabase (PostgreSQL + Storage)
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-3xl leading-relaxed">
                Struktur database mencakup keseluruhan data HR SupplyHub: <strong>18 tabel relasional PostgreSQL</strong> (akun pengguna &amp; re-organisasi, master item, transaksi, stock opname, inventaris overhead &amp; mutasi, permintaan barang, rolling forecast GA FY2026, template &amp; laporan bulanan A3, arsip dokumen, notifikasi, audit trail) serta <strong>2 Storage Bucket (<code className="font-mono-num">supplyhub-media</code> &amp; <code className="font-mono-num">supplyhub-documents</code>)</strong> untuk foto barang, tanda tangan, dan arsip dokumen PDF/Excel/Word.
              </p>
            </div>
            {isSupabaseConnected && (
              <button
                type="button"
                disabled={syncingSupabase}
                onClick={handlePushToSupabase}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] disabled:opacity-60 text-white text-xs font-semibold shrink-0 transition"
              >
                <CloudUpload className="w-4 h-4" />
                {syncingSupabase ? 'Menyinkronkan...' : 'Sinkronkan Data, Foto & Dokumen ke Supabase'}
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114] space-y-1">
              <div className="text-[11px] font-semibold text-neutral-500">Cakupan Tabel Inti</div>
              <div className="font-bold text-sm font-mono-num">18 Tabel Relasional</div>
              <p className="text-[11px] text-neutral-500">
                Akun ({store.users.length}), Master Item ({store.items.length}), RF GA ({store.rollingForecast.rows.length}), Laporan ({store.reports.length}), Dokumen ({(store.documents || []).length}).
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114] space-y-1">
              <div className="text-[11px] font-semibold text-neutral-500">Storage Media &amp; Dokumen</div>
              <div className="font-bold text-sm font-mono-num">2 Bucket Storage</div>
              <p className="text-[11px] text-neutral-500">
                {totalPhotosCount} foto item/aset (<code className="font-mono-num">supplyhub-media</code>) &amp; {(store.documents || []).length} arsip PDF/Excel/Word (<code className="font-mono-num">supplyhub-documents</code>).
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114] space-y-1">
              <div className="text-[11px] font-semibold text-neutral-500">Variabel Koneksi (.env)</div>
              <div className="font-bold text-sm font-mono-num">VITE_SUPABASE_URL</div>
              <p className="text-[11px] text-neutral-500">
                Isi <code className="font-mono-num">VITE_SUPABASE_URL</code> &amp; <code className="font-mono-num">VITE_SUPABASE_ANON_KEY</code> lalu jalankan SQL di bawah di SQL Editor Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                downloadTextFile('01_schema.sql', getSupabaseSchemaSql());
                toast('01_schema.sql berhasil diunduh', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#E60012]" />
              Unduh 01_schema.sql
            </button>
            <button
              type="button"
              onClick={() => {
                downloadTextFile('02_storage_and_rls.sql', getSupabaseStorageRlsSql());
                toast('02_storage_and_rls.sql berhasil diunduh', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Unduh 02_storage_and_rls.sql
            </button>
            <button
              type="button"
              onClick={() => {
                const seedSql = generateCurrentStoreSeedSql(store);
                downloadTextFile(
                  `03_seed_hr_supplyhub_${new Date().toISOString().slice(0, 10)}.sql`,
                  seedSql
                );
                toast('SQL Seed Data Terkini berhasil diunduh', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh 03_seed_data_terkini.sql
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Akun Pengguna (Mendukung Re-organisasi) */}
      {userForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveUserForm}
            className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs max-h-[92vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {userForm.isSelfProfile
                    ? 'Edit Profil & Kata Sandi'
                    : userForm.id
                    ? 'Edit Akun Pengguna & Penyesuaian Re-organisasi'
                    : 'Tambah Pengguna Baru'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {userForm.id
                    ? 'Perbarui identitas, jabatan, seksi, hak akses, atau kata sandi akun ini.'
                    : 'Tambahkan akun baru untuk tim Departemen Human Resources.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserForm(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setUserForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            name: nextName,
                            avatarInitials:
                              !prev.id || prev.avatarInitials === buildInitials(prev.name)
                                ? buildInitials(nextName)
                                : prev.avatarInitials,
                          }
                        : prev
                    );
                  }}
                  placeholder="Contoh: Mahmud Nurdiansyah"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Username Login *</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="Contoh: mahmud"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email Perusahaan *</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="nama@ajinomoto.co.id"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Jabatan *</label>
                <input
                  type="text"
                  required
                  value={userForm.jabatan}
                  onChange={(e) => setUserForm({ ...userForm, jabatan: e.target.value })}
                  placeholder="Contoh: Sect. Manager HR Development"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Seksi / Bagian *</label>
                <input
                  type="text"
                  list="hr-section-suggestions"
                  required
                  value={userForm.seksi}
                  onChange={(e) => setUserForm({ ...userForm, seksi: e.target.value })}
                  placeholder="Pilih atau ketik seksi baru"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
                <datalist id="hr-section-suggestions">
                  {DEFAULT_SECTIONS.map((sec) => (
                    <option key={sec} value={sec} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold mb-1">Peran Akses</label>
                <select
                  disabled={Boolean(userForm.isSelfProfile && !isSuperAdmin)}
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] disabled:opacity-60"
                >
                  <option value="STAFF">Staff / PIC</option>
                  <option value="SECTION_MANAGER">Section Manager</option>
                  <option value="DEPT_MANAGER">Department Manager</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Inisial Avatar (2 Huruf)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={userForm.avatarInitials}
                  onChange={(e) =>
                    setUserForm({ ...userForm, avatarInitials: e.target.value.toUpperCase() })
                  }
                  placeholder="MN"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num uppercase"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">
                  {userForm.id
                    ? 'Kata Sandi Baru (kosongkan jika tidak ingin mengganti)'
                    : 'Kata Sandi *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!userForm.id}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder={
                      userForm.id
                        ? 'Biarkan kosong untuk mempertahankan kata sandi saat ini'
                        : 'Masukkan kata sandi awal'
                    }
                    className="w-full px-3 pr-10 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Tanda Tangan Tersimpan */}
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1.5">Tanda Tangan Digital Tersimpan</label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114]">
                  <div className="w-28 h-14 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white flex items-center justify-center overflow-hidden shrink-0 p-1">
                    {userForm.savedSignatureDataUrl ? (
                      <img
                        src={userForm.savedSignatureDataUrl}
                        alt="Tanda tangan"
                        className="max-h-12 max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-400">Belum ada</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] font-semibold cursor-pointer hover:border-[#E60012] transition">
                      <Upload className="w-3.5 h-3.5" />
                      Unggah PNG/JPG
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                    </label>
                    {userForm.savedSignatureDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setUserForm({ ...userForm, savedSignatureDataUrl: undefined })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!userForm.isSelfProfile && (
                <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#0F1114]">
                  <div>
                    <div className="font-semibold">Status Akun Aktif</div>
                    <div className="text-[11px] text-neutral-500">
                      Akun nonaktif tidak dapat masuk ke sistem namun riwayat audit &amp; laporan lama tetap terjaga.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.active}
                    disabled={userForm.id === user.id}
                    onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                    className="w-4 h-4 accent-[#E60012]"
                  />
                </div>
              )}

              {userForm.id && (
                <label className="sm:col-span-2 flex items-start gap-2.5 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.syncReorg}
                    onChange={(e) => setUserForm({ ...userForm, syncReorg: e.target.checked })}
                    className="w-4 h-4 mt-0.5 accent-[#E60012] shrink-0"
                  />
                  <div>
                    <div className="font-semibold text-amber-900 dark:text-amber-200">
                      Sinkronkan Perubahan Re-organisasi ke Template &amp; Laporan Draft
                    </div>
                    <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      Otomatis memperbarui Nama &amp; Jabatan baru pada seluruh Template Tanda Tangan serta slot tertunda di Laporan Draft. Laporan Final yang sudah ditandatangani tetap utuh untuk integritas audit.
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setUserForm(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white font-semibold"
              >
                {userForm.id ? 'Simpan Perubahan' : 'Simpan Pengguna'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Serah Terima Jabatan (Re-organisasi) */}
      {handoverFromUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmHandover}
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#E60012]" />
                Serah Terima Jabatan (Re-organisasi)
              </h3>
              <button
                type="button"
                onClick={() => setHandoverFromUser(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200 dark:border-neutral-800 space-y-1">
              <div className="text-[11px] text-neutral-500">Pejabat / PIC Sebelumnya</div>
              <div className="font-bold text-sm">{handoverFromUser.name}</div>
              <div className="text-neutral-500">
                {handoverFromUser.jabatan} · {handoverFromUser.seksi}
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400 pt-1">
                Terkait pada <strong>{handoverImpact.templates} Template Tanda Tangan</strong> &amp;{' '}
                <strong>{handoverImpact.draftReports} Laporan Draft (Pending)</strong>.
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">Alihkan Slot Persetujuan ke Akun Pengganti *</label>
              <select
                required
                value={handoverToUserId}
                onChange={(e) => setHandoverToUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              >
                <option value="">-- Pilih Akun Pengganti Aktif --</option>
                {store.users
                  .filter((u) => u.id !== handoverFromUser.id && u.active)
                  .map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name} — {cand.jabatan} ({cand.seksi})
                    </option>
                  ))}
              </select>
            </div>

            {handoverFromUser.id !== user.id && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={handoverDeactivateOld}
                  onChange={(e) => setHandoverDeactivateOld(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#E60012]"
                />
                <span>
                  Sekaligus nonaktifkan akun <strong>{handoverFromUser.name}</strong> setelah serah terima selesai (riwayat audit &amp; laporan Final tetap aman).
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHandoverFromUser(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!handoverToUserId}
                className="px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] disabled:opacity-50 text-white font-semibold"
              >
                Jalankan Serah Terima
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akun */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold text-red-600">Hapus Akun Pengguna?</h3>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Anda yakin ingin menghapus akun <strong>{deleteTargetUser.name}</strong> ({deleteTargetUser.username})? Jika akun ini masih terhubung dengan template tanda tangan, gunakan fitur <strong>Serah Terima Jabatan</strong> atau cukup nonaktifkan akun.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
