import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Clock,
  CloudDownload,
  CloudUpload,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileCode2,
  Globe,
  HardDrive,
  Palette,
  RefreshCw,
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
import {
  SESSION_TIMEOUT_OPTIONS,
  type SessionTimeoutMinutes,
  useAuth,
} from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { COLOR_THEMES, useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { processAndUploadImage } from '../services/mediaStorageService';
import type { User, UserRole } from '../types';
import { formatDateTimeIndo, getRoleLabel } from '../utils/format';
import {
  downloadTextFile,
  generateCurrentStoreSeedSql,
  getSupabaseEmployeeMigrationSql,
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
  'Administration & Operation',
  'Human Resources',
];

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export const SettingsPage: React.FC = () => {
  const { user, isSuperAdmin, canEditOperational, sessionTimeoutMinutes, setSessionTimeoutMinutes } =
    useAuth();
  const {
    store,
    isSupabaseConnected,
    supabaseHost,
    syncStatus,
    lastHealthReport,
    testSupabaseConnection,
    syncAllToSupabase,
    replaceSupabaseFromLocal,
    refreshFromSupabase,
    updateSettings,
    upsertUser,
    reassignUserSlots,
    deleteUser,
    exportBackupJson,
    importBackupJson,
    resetDemoData,
  } = useSupplyHub();
  const { theme, setTheme, colorTheme, setColorTheme, activePreset } = useTheme();
  const { language, setLanguage, tr } = useLanguage();
  const { toast } = useToast();
  const location = useLocation();

  const [settingsForm, setSettingsForm] = useState(store.settings);
  useEffect(() => {
    setSettingsForm(store.settings);
  }, [store.settings]);

  useEffect(() => {
    if (location.hash === '#supabase-control') {
      const el = document.getElementById('supabase-control');
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    }
  }, [location.hash]);

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

  // Kontrol Database Supabase state
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [pullingSupabase, setPullingSupabase] = useState(false);
  const [mirroringSupabase, setMirroringSupabase] = useState(false);
  const [confirmMirrorOpen, setConfirmMirrorOpen] = useState(false);
  const [showTableMatrix, setShowTableMatrix] = useState(true);

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
    toast(tr('Pengaturan dokumen & sistem disimpan', 'Document & system settings saved'), 'success');
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    downloadTextFile(
      `HR_SupplyHub_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json'
    );
    toast(tr('Backup JSON berhasil diunduh', 'JSON backup downloaded'), 'success');
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackupJson(String(reader.result), user);
        toast(tr('Restore data JSON berhasil', 'JSON data restored successfully'), 'success');
      } catch (err) {
        toast(
          tr('Gagal memulihkan backup', 'Failed to restore backup'),
          'error',
          err instanceof Error ? err.message : undefined
        );
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
      toast(
        tr(
          'Berkas tanda tangan harus berupa gambar (PNG/JPG/SVG)',
          'Signature file must be an image (PNG/JPG/SVG)'
        ),
        'error'
      );
      return;
    }
    try {
      const { url } = await processAndUploadImage(
        file,
        'signatures',
        userForm.id || userForm.username || `sig-${Date.now()}`
      );
      setUserForm((prev) => (prev ? { ...prev, savedSignatureDataUrl: url } : prev));
      toast(
        tr('Gambar tanda tangan dimuat', 'Signature image loaded'),
        'success',
        tr('Klik "Simpan Perubahan" untuk menerapkan.', 'Click "Save Changes" to apply.')
      );
    } catch {
      toast(tr('Gagal memproses gambar tanda tangan', 'Failed to process signature image'), 'error');
    }
    e.target.value = '';
  };

  const handleSaveUserForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm) return;

    const existing = userForm.id ? store.users.find((u) => u.id === userForm.id) : undefined;
    if (!existing && !userForm.password.trim()) {
      toast(
        tr('Kata sandi wajib diisi untuk akun baru', 'Password is required for new accounts'),
        'error'
      );
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
      toast(tr('Gagal menyimpan akun', 'Failed to save account'), 'error', res.error);
      return;
    }

    setUserForm(null);
    toast(
      existing
        ? tr('Akun pengguna berhasil diperbarui', 'User account updated')
        : tr('Pengguna baru berhasil ditambahkan', 'New user added'),
      'success',
      existing && userForm.syncReorg
        ? tr(
            'Nama & jabatan turut diselaraskan pada Template Tanda Tangan & Laporan Draft.',
            'Name & title were also synced across Signature Templates & Draft Reports.'
          )
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
      toast(tr('Serah terima gagal', 'Handover failed'), 'error', res.error);
      return;
    }
    const targetName = store.users.find((u) => u.id === handoverToUserId)?.name || tr('Pengganti', 'Successor');
    toast(
      tr('Serah terima jabatan selesai', 'Position handover completed'),
      'success',
      tr(
        `Slot persetujuan dari ${handoverFromUser.name} dialihkan ke ${targetName} (${res.updatedTemplates} template, ${res.updatedReports} laporan draft).`,
        `Approval slots from ${handoverFromUser.name} reassigned to ${targetName} (${res.updatedTemplates} templates, ${res.updatedReports} draft reports).`
      )
    );
    setHandoverFromUser(null);
    setHandoverToUserId('');
  };

  const handleConfirmDeleteUser = () => {
    if (!deleteTargetUser) return;
    const res = deleteUser(deleteTargetUser.id, user);
    if (!res.ok) {
      toast(tr('Tidak dapat menghapus akun', 'Unable to delete account'), 'error', res.error);
      return;
    }
    toast(
      tr(`Akun ${deleteTargetUser.name} dihapus`, `Account ${deleteTargetUser.name} deleted`),
      'success'
    );
    setDeleteTargetUser(null);
  };

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    const report = await testSupabaseConnection();
    setTestingSupabase(false);
    setShowTableMatrix(true);
    if (report.connected && report.canWrite && report.summary.tablesOk === report.summary.tablesTotal) {
      toast(
        tr('Uji koneksi Supabase berhasil', 'Supabase connection test passed'),
        'success',
        tr(
          `${report.summary.tablesOk}/${report.summary.tablesTotal} tabel · ${report.summary.bucketsOk}/${report.summary.bucketsTotal} bucket · Write OK (${report.latencyMs} ms)`,
          `${report.summary.tablesOk}/${report.summary.tablesTotal} tables · ${report.summary.bucketsOk}/${report.summary.bucketsTotal} buckets · Write OK (${report.latencyMs} ms)`
        )
      );
    } else {
      toast(
        tr('Uji koneksi mendeteksi kendala', 'Connection test detected issues'),
        'error',
        report.writeError ||
          tr(
            `${report.summary.tablesOk}/${report.summary.tablesTotal} tabel aktif.`,
            `${report.summary.tablesOk}/${report.summary.tablesTotal} tables active.`
          )
      );
    }
  };

  const handlePushToSupabase = async () => {
    setSyncingSupabase(true);
    const res = await syncAllToSupabase();
    setSyncingSupabase(false);
    if (res.ok) {
      toast(
        tr('Push ke Supabase berhasil', 'Push to Supabase completed'),
        'success',
        tr(
          'Seluruh akun, tabel sistem, foto & dokumen telah dikirim ke Supabase.',
          'All accounts, system tables, photos & documents have been pushed to Supabase.'
        )
      );
      if (lastHealthReport) {
        void testSupabaseConnection();
      }
    } else {
      toast(tr('Push ke Supabase gagal', 'Push to Supabase failed'), 'error', res.error);
    }
  };

  const handleMirrorToSupabase = async () => {
    setConfirmMirrorOpen(false);
    setMirroringSupabase(true);
    const res = await replaceSupabaseFromLocal();
    setMirroringSupabase(false);
    if (res.ok) {
      toast(
        tr('Sinkron cermin (Replace Cloud) selesai', 'Mirror sync (Replace Cloud) completed'),
        'success',
        tr(
          'Data Supabase kini identik dengan data lokal dan baris lama yang dihapus telah dibersihkan.',
          'Supabase now mirrors local data and removed orphan rows have been cleaned up.'
        )
      );
      void testSupabaseConnection();
    } else {
      toast(tr('Sinkron cermin gagal', 'Mirror sync failed'), 'error', res.error);
    }
  };

  const handlePullFromSupabase = async () => {
    setPullingSupabase(true);
    const ok = await refreshFromSupabase();
    setPullingSupabase(false);
    if (ok) {
      toast(
        tr('Pull dari Supabase berhasil', 'Pull from Supabase succeeded'),
        'success',
        tr(
          'Seluruh data terbaru dari PostgreSQL Supabase telah dimuat ke sistem.',
          'All latest records from Supabase PostgreSQL have been loaded.'
        )
      );
      if (lastHealthReport) {
        void testSupabaseConnection();
      }
    } else {
      toast(
        tr('Gagal menarik data dari Supabase', 'Failed to pull data from Supabase'),
        'error'
      );
    }
  };

  const dbAnyBusy = testingSupabase || syncingSupabase || pullingSupabase || mirroringSupabase;

  const totalPhotosCount =
    store.items.filter((i) => Boolean(i.photoUrl)).length +
    store.inventories.filter((inv) => Boolean(inv.photoUrl)).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold font-display">
          {tr('Pengaturan Sistem & Profil', 'System Settings & Profile')}
        </h2>
        <p className="text-xs text-neutral-500">
          {tr(
            'Kelola profil, tema warna, bahasa (ID/EN), tanda tangan tersimpan, kop laporan, akun HR, dan database Supabase.',
            'Manage profile, color themes, language (ID/EN), saved signatures, report headers, HR accounts, and Supabase database.'
          )}
        </p>
      </div>

      {/* Profil & Tampilan (Tema Warna + Bahasa + Backup) */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">
              {tr('Profil & Tanda Tangan Tersimpan', 'Profile & Saved Signature')}
            </h3>
            <button
              type="button"
              onClick={() => openEditUserModal(user, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-theme-primary text-xs font-semibold transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {tr('Edit Profil & Sandi', 'Edit Profile & Password')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl text-white font-bold flex items-center justify-center shrink-0"
              style={{ backgroundColor: activePreset.primary }}
            >
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
                {tr(
                  'Belum ada tanda tangan tersimpan (otomatis tersimpan saat menandatangani laporan atau unggah melalui Edit Profil).',
                  'No saved signature yet (auto-saved when signing a report or upload via Edit Profile).'
                )}
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Palette className="w-4 h-4 text-theme-primary" />
                {tr('Tema Warna, Mode & Bahasa Sistem', 'Color Theme, Mode & System Language')}
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {tr(
                  'Berlaku langsung pada Landing Page, Form Pengambilan, Login, dan seluruh Dashboard.',
                  'Applies instantly across Landing Page, Public Request Form, Login, and entire Dashboard.'
                )}
              </p>
            </div>
          </div>

          {/* 5 Color Theme Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {COLOR_THEMES.map((preset) => {
              const active = colorTheme === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setColorTheme(preset.id);
                    toast(
                      tr(
                        `Tema "${preset.nameId}" diterapkan`,
                        `Theme "${preset.nameEn}" applied`
                      ),
                      'success'
                    );
                  }}
                  style={
                    active
                      ? {
                          borderColor: preset.primary,
                          backgroundColor: 'rgba(var(--brand-primary-rgb), 0.06)',
                        }
                      : undefined
                  }
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    active
                      ? 'shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <span className="flex items-center -space-x-1 mt-0.5 shrink-0">
                    <span
                      className="w-4 h-4 rounded-full border border-white dark:border-neutral-900 shadow-xs"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white dark:border-neutral-900"
                      style={{ backgroundColor: preset.accent }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">
                        {language === 'id' ? preset.nameId : preset.nameEn}
                      </span>
                      {active && (
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: preset.primary }}
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {language === 'id' ? preset.descId : preset.descEn}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode + Language Row */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                {tr('Mode Tampilan', 'Display Mode')}
              </span>
              <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  {tr('Terang', 'Light')}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    theme === 'dark' ? 'bg-[#171A1F] text-white shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  {tr('Gelap', 'Dark')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-600 dark:text-neutral-300 inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-neutral-400" />
                {tr('Bahasa', 'Language')}
              </span>
              <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('id');
                    setSettingsForm((prev) => ({ ...prev, language: 'id' }));
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    language === 'id'
                      ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500'
                  }`}
                >
                  Indonesia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    setSettingsForm((prev) => ({ ...prev, language: 'en' }));
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    language === 'en'
                      ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Session Timeout & Tab-Close Auto-Logout Control */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
            <div>
              <div className="font-semibold text-neutral-700 dark:text-neutral-200 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-theme-primary" />
                {tr('Batas Waktu Sesi (Auto-Logout)', 'Session Idle Timeout (Auto Sign-Out)')}
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {tr(
                  'Otomatis kembali ke Login saat tab browser ditutup atau tidak aktif sesuai durasi pilihan.',
                  'Automatically returns to Login when the browser tab closes or remains idle.'
                )}
              </p>
            </div>
            <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 shrink-0">
              {SESSION_TIMEOUT_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setSessionTimeoutMinutes(mins as SessionTimeoutMinutes);
                    toast(
                      tr(
                        `Batas waktu sesi diatur ke ${mins} menit`,
                        `Session timeout set to ${mins} minutes`
                      ),
                      'success'
                    );
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold font-mono-num whitespace-nowrap cursor-pointer ${
                    sessionTimeoutMinutes === mins
                      ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Backup Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition cursor-pointer"
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
                toast(tr('Data demo berhasil direset', 'Demo data reset'), 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/15 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-600/20 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {tr('Reset Data Demo', 'Reset Demo Data')}
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
          <h3 className="text-sm font-bold">
            {tr(
              'Kop Dokumen, Pengingat & Teks Petunjuk Laporan',
              'Document Headers, Reminders & Report Guidelines'
            )}
          </h3>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme-primary text-white font-semibold transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {tr('Simpan Pengaturan', 'Save Settings')}
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold mb-1">{tr('Departemen', 'Department')}</label>
            <input
              type="text"
              value={settingsForm.department}
              onChange={(e) => setSettingsForm({ ...settingsForm, department: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">{tr('Seksi', 'Section')}</label>
            <input
              type="text"
              value={settingsForm.section}
              onChange={(e) => setSettingsForm({ ...settingsForm, section: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              {tr('Kota Tanda Tangan', 'Signature City')}
            </label>
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
            {tr(
              '7 Petunjuk Laporan Pengechekan Barang (1 baris = 1 poin)',
              '7 Stock Inspection Report Guidelines (1 line = 1 point)'
            )}
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
                <Users className="w-4 h-4 text-theme-primary" />
                {tr('Manajemen Akun Pengguna & Re-organisasi', 'User Account & Reorganization Management')} ({store.users.length})
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                {tr(
                  'Ubah nama, jabatan, seksi, peran, kata sandi, atau lakukan serah terima slot persetujuan saat terjadi rotasi/re-organisasi.',
                  'Update names, job titles, sections, roles, passwords, or hand over approval slots during reorganization.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateUserModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-primary text-white text-xs font-semibold shrink-0 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {tr('Tambah Pengguna', 'Add User')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={tr(
                  'Cari nama, username, jabatan, atau seksi...',
                  'Search name, username, job title, or section...'
                )}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
              />
            </div>
            <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              {(
                [
                  { id: 'ALL', label: tr('Semua', 'All') },
                  { id: 'ACTIVE', label: tr('Aktif', 'Active') },
                  { id: 'INACTIVE', label: tr('Nonaktif', 'Inactive') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUserStatusFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
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
                  <th className="py-2.5 pr-3">{tr('Pengguna', 'User')}</th>
                  <th className="py-2.5 px-2">Username</th>
                  <th className="py-2.5 px-2">{tr('Jabatan & Seksi', 'Position & Section')}</th>
                  <th className="py-2.5 px-2">{tr('Peran', 'Role')}</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 pl-2 text-right">{tr('Aksi', 'Actions')}</th>
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
                                <span className="text-[10px] font-bold text-theme-primary">
                                  ({tr('Anda', 'You')})
                                </span>
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
                              toast(tr('Gagal mengubah peran', 'Failed to change role'), 'error', res.error);
                            } else {
                              toast(tr(`Peran ${u.name} diperbarui`, `${u.name}'s role updated`), 'success');
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
                              toast(tr('Gagal mengubah status', 'Failed to change status'), 'error', res.error);
                            } else {
                              toast(
                                `${u.name} ${
                                  !u.active
                                    ? tr('diaktifkan', 'activated')
                                    : tr('dinonaktifkan', 'deactivated')
                                }`,
                                'success'
                              );
                            }
                          }}
                          className={`font-semibold disabled:opacity-50 cursor-pointer ${
                            u.active ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {u.active ? tr('Aktif', 'Active') : tr('Nonaktif', 'Inactive')}
                        </button>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u, false)}
                            title={tr('Edit Akun & Penyesuaian Jabatan', 'Edit Account & Position')}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-theme-primary hover:text-theme-primary font-semibold transition cursor-pointer"
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
                            title={tr('Serah Terima Jabatan / Re-organisasi', 'Position Handover / Reorganization')}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-amber-500 hover:text-amber-600 transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          {!isCurrentUser && (
                            <button
                              type="button"
                              onClick={() => setDeleteTargetUser(u)}
                              title={tr('Hapus Akun', 'Delete Account')}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-red-500 hover:text-red-600 transition cursor-pointer"
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

      {/* Pusat Kontrol Database Supabase (Uji Koneksi, Pull, Push, Mirror & SQL) */}
      <div
        id="supabase-control"
        className="p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-5 scroll-mt-20"
      >
        {/* Header Status Koneksi */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Database
                  className={`w-4 h-4 ${
                    !isSupabaseConnected
                      ? 'text-amber-600'
                      : syncStatus.state === 'error'
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                />
                {tr(
                  'Pusat Kontrol Database Supabase (PostgreSQL + Storage)',
                  'Supabase Database Control Center (PostgreSQL + Storage)'
                )}
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                  !isSupabaseConnected
                    ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                    : syncStatus.state === 'error'
                    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                    : syncStatus.state === 'syncing' || dbAnyBusy
                    ? 'border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400'
                    : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    !isSupabaseConnected
                      ? 'bg-amber-500'
                      : syncStatus.state === 'error'
                      ? 'bg-red-500'
                      : syncStatus.state === 'syncing' || dbAnyBusy
                      ? 'bg-sky-500 animate-pulse'
                      : 'bg-emerald-500'
                  }`}
                />
                {!isSupabaseConnected
                  ? tr('Mode Lokal', 'Local Mode')
                  : syncStatus.state === 'error'
                  ? tr('Gangguan Sinkronisasi', 'Sync Error')
                  : syncStatus.state === 'syncing' || dbAnyBusy
                  ? tr('Menyinkronkan...', 'Syncing...')
                  : tr('Terhubung & Auto-Sync Aktif', 'Connected & Auto-Sync Active')}
              </span>
            </div>

            <p className="text-xs text-neutral-500 max-w-3xl leading-relaxed">
              {isSupabaseConnected ? (
                <>
                  {tr('Host aktif:', 'Active host:')}{' '}
                  <code className="font-mono-num font-semibold text-neutral-700 dark:text-neutral-300">
                    {supabaseHost}
                  </code>
                  {syncStatus.lastSyncedAt && (
                    <>
                      {' · '}
                      {tr('Sinkron terakhir:', 'Last synced:')}{' '}
                      <span className="font-mono-num">
                        {formatDateTimeIndo(syncStatus.lastSyncedAt, language)}
                      </span>
                    </>
                  )}
                  {' · '}
                  {tr(
                    'Setiap perubahan data otomatis tersimpan ke database & realtime antar perangkat.',
                    'Every change is automatically persisted to the database with cross-device realtime sync.'
                  )}
                </>
              ) : (
                tr(
                  'Variabel VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY belum terpasang pada environment. Sistem saat ini menyimpan data pada browser lokal.',
                  'VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are not set in the environment. The system is currently storing data locally in the browser.'
                )
              )}
            </p>
          </div>
        </div>

        {/* Tombol Aksi Kontrol Database: Uji Koneksi, Pull, Push, Mirror */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 text-xs">
          <button
            type="button"
            disabled={!isSupabaseConnected || dbAnyBusy}
            onClick={handleTestSupabase}
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-theme-primary bg-neutral-50/70 dark:bg-[#0F1114] disabled:opacity-50 text-left transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-1.5">
                <Activity
                  className={`w-4 h-4 text-theme-primary shrink-0 ${
                    testingSupabase ? 'animate-pulse' : ''
                  }`}
                />
                {testingSupabase
                  ? tr('Menguji Koneksi...', 'Testing...')
                  : tr('Uji Koneksi Database', 'Test Connection')}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                {tr('Cek 19 tabel, 2 bucket & izin tulis', 'Check 19 tables, 2 buckets & write RLS')}
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={!isSupabaseConnected || dbAnyBusy}
            onClick={handlePullFromSupabase}
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-sky-500 bg-neutral-50/70 dark:bg-[#0F1114] disabled:opacity-50 text-left transition cursor-pointer"
          >
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-1.5">
                <CloudDownload
                  className={`w-4 h-4 text-sky-600 shrink-0 ${
                    pullingSupabase ? 'animate-bounce' : ''
                  }`}
                />
                {pullingSupabase
                  ? tr('Menarik Data...', 'Pulling...')
                  : tr('Pull dari Supabase', 'Pull from Supabase')}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                {tr('Muat data terbaru Cloud → Aplikasi', 'Load latest Cloud → App data')}
              </div>
            </div>
          </button>

          {(isSuperAdmin || canEditOperational) && (
            <button
              type="button"
              disabled={!isSupabaseConnected || dbAnyBusy}
              onClick={handlePushToSupabase}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-theme-primary bg-theme-primary-hover text-white disabled:opacity-50 text-left transition cursor-pointer"
            >
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1.5">
                  <CloudUpload
                    className={`w-4 h-4 shrink-0 ${syncingSupabase ? 'animate-bounce' : ''}`}
                  />
                  {syncingSupabase
                    ? tr('Mengirim Data...', 'Pushing...')
                    : tr('Push ke Supabase', 'Push to Supabase')}
                </div>
                <div className="text-[11px] text-white/80 mt-0.5 truncate">
                  {tr('Kirim & gabung Aplikasi → Cloud', 'Upsert App data & media → Cloud')}
                </div>
              </div>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              disabled={!isSupabaseConnected || dbAnyBusy}
              onClick={() => setConfirmMirrorOpen((v) => !v)}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 hover:border-amber-500 text-amber-900 dark:text-amber-300 disabled:opacity-50 text-left transition cursor-pointer"
            >
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1.5">
                  <RefreshCw
                    className={`w-4 h-4 text-amber-600 shrink-0 ${
                      mirroringSupabase ? 'animate-spin' : ''
                    }`}
                  />
                  {mirroringSupabase
                    ? tr('Menyelaraskan...', 'Mirroring...')
                    : tr('Mirror (Replace Cloud)', 'Mirror (Replace Cloud)')}
                </div>
                <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
                  {tr('Push + hapus baris yatim di Cloud', 'Push + purge orphan Cloud rows')}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Konfirmasi Inline untuk Mirror Replace Cloud */}
        {confirmMirrorOpen && isSuperAdmin && (
          <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5 text-amber-950 dark:text-amber-200">
              <div className="font-bold">
                {tr(
                  'Konfirmasi Sinkron Cermin (Replace Database Cloud)',
                  'Confirm Mirror Sync (Replace Cloud Database)'
                )}
              </div>
              <p className="text-[11px] opacity-90">
                {tr(
                  'Tindakan ini akan mengunggah seluruh data aplikasi saat ini ke Supabase DAN menghapus baris di Supabase yang tidak ada pada aplikasi lokal.',
                  'This will push all current app records to Supabase AND delete any rows in Supabase that do not exist locally.'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmMirrorOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-amber-400/70 font-semibold hover:bg-white/60 dark:hover:bg-black/20 cursor-pointer"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleMirrorToSupabase}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
              >
                {tr('Ya, Samakan Cloud', 'Yes, Mirror Cloud')}
              </button>
            </div>
          </div>
        )}

        {/* Banner Error Sinkronisasi */}
        {isSupabaseConnected && syncStatus.lastError && (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {tr('Sinkronisasi terakhir mengalami kendala:', 'Last sync encountered an issue:')}{' '}
                <strong className="font-mono-num">{syncStatus.lastError}</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={handlePushToSupabase}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold shrink-0 cursor-pointer"
            >
              {tr('Coba Push Ulang', 'Retry Push')}
            </button>
          </div>
        )}

        {/* Hasil Diagnostik Uji Koneksi Live */}
        {lastHealthReport && (
          <div className="rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/60 dark:bg-[#0F1114] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                {lastHealthReport.connected &&
                lastHealthReport.canWrite &&
                lastHealthReport.summary.tablesOk === lastHealthReport.summary.tablesTotal ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span>
                  {tr('Hasil Uji Koneksi Langsung', 'Live Connection Diagnostics')} (
                  {formatDateTimeIndo(lastHealthReport.checkedAt, language)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTableMatrix((v) => !v)}
                className="text-[11px] font-semibold text-theme-primary hover:underline cursor-pointer"
              >
                {showTableMatrix
                  ? tr('Sembunyikan Detail 19 Tabel', 'Hide 19-Table Details')
                  : tr('Tampilkan Detail 19 Tabel', 'Show 19-Table Details')}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-500">{tr('Latensi API', 'API Latency')}</div>
                <div className="font-mono-num font-extrabold text-sm mt-0.5">
                  {lastHealthReport.latencyMs} ms
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-500">{tr('Tabel PostgreSQL', 'PostgreSQL Tables')}</div>
                <div className="font-mono-num font-extrabold text-sm mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {lastHealthReport.summary.tablesOk} / {lastHealthReport.summary.tablesTotal} OK
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-500">{tr('Storage Bucket', 'Storage Buckets')}</div>
                <div className="font-mono-num font-extrabold text-sm mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {lastHealthReport.summary.bucketsOk} / {lastHealthReport.summary.bucketsTotal} OK
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-500">{tr('Uji Tulis & Hapus RLS', 'RLS Write/Delete Probe')}</div>
                <div
                  className={`font-extrabold text-sm mt-0.5 ${
                    lastHealthReport.canWrite
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {lastHealthReport.canWrite ? tr('Berhasil (OK)', 'Passed (OK)') : tr('Gagal', 'Failed')}
                </div>
              </div>
            </div>

            {/* Status 2 Storage Bucket */}
            {lastHealthReport.buckets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {lastHealthReport.buckets.map((b) => (
                  <div
                    key={b.bucket}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono-num ${
                      b.ok
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                        : 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                    }`}
                  >
                    <HardDrive className="w-3 h-3" />
                    <span>{b.bucket}</span>
                    <span className="font-bold">{b.ok ? 'OK' : b.error || 'Error'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tabel Perbandingan 19 Tabel Lokal vs Supabase */}
            {showTableMatrix && lastHealthReport.tables.length > 0 && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 dark:bg-[#12151B] border-b border-neutral-200 dark:border-neutral-800 text-neutral-500">
                    <tr>
                      <th className="py-2 px-3 text-left font-semibold">{tr('Tabel PostgreSQL', 'PostgreSQL Table')}</th>
                      <th className="py-2 px-3 text-right font-semibold">{tr('Baris Lokal', 'Local Rows')}</th>
                      <th className="py-2 px-3 text-right font-semibold">{tr('Baris Cloud', 'Cloud Rows')}</th>
                      <th className="py-2 px-3 text-right font-semibold">{tr('Status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {lastHealthReport.tables.map((t) => {
                      const synced = t.ok && t.localCount === t.remoteCount;
                      return (
                        <tr key={t.table} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30">
                          <td className="py-2 px-3 font-mono-num font-medium">{t.table}</td>
                          <td className="py-2 px-3 text-right font-mono-num">{t.localCount}</td>
                          <td className="py-2 px-3 text-right font-mono-num">{t.ok ? t.remoteCount : '-'}</td>
                          <td className="py-2 px-3 text-right">
                            {!t.ok ? (
                              <span className="text-red-600 font-semibold" title={t.error}>
                                {tr('Error', 'Error')}
                              </span>
                            ) : synced ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {tr('Sinkron', 'Synced')}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                {tr('Beda Jumlah', 'Count Diff')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Ringkasan Struktur & Unduh Script SQL (Super Admin) */}
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114] space-y-1">
            <div className="text-[11px] font-semibold text-neutral-500">
              {tr('Cakupan Tabel Inti', 'Core Table Coverage')}
            </div>
            <div className="font-bold text-sm font-mono-num">
              {tr('19 Tabel Relasional', '19 Relational Tables')}
            </div>
            <p className="text-[11px] text-neutral-500">
              {tr('Akun', 'Users')} ({store.users.length}), {tr('Karyawan HR', 'HR Employees')} (
              {(store.employees || []).length}), {tr('Item', 'Items')} ({store.items.length}), RF GA (
              {store.rollingForecast.rows.length}), {tr('Dokumen', 'Docs')} ({(store.documents || []).length}).
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114] space-y-1">
            <div className="text-[11px] font-semibold text-neutral-500">
              {tr('Storage Media & Dokumen', 'Media & Document Storage')}
            </div>
            <div className="font-bold text-sm font-mono-num">
              {tr('2 Bucket Storage', '2 Storage Buckets')}
            </div>
            <p className="text-[11px] text-neutral-500">
              {totalPhotosCount} {tr('foto item/aset', 'item/asset photos')} (
              <code className="font-mono-num">supplyhub-media</code>) &amp; {(store.documents || []).length}{' '}
              {tr('arsip PDF/Excel/Word', 'PDF/Excel/Word archives')} (
              <code className="font-mono-num">supplyhub-documents</code>).
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114] space-y-1">
            <div className="text-[11px] font-semibold text-neutral-500">
              {tr('Mode Sinkronisasi', 'Sync Mode')}
            </div>
            <div className="font-bold text-sm font-mono-num">
              {isSupabaseConnected
                ? tr('Auto-Sync + Realtime', 'Auto-Sync + Realtime')
                : 'VITE_SUPABASE_URL'}
            </div>
            <p className="text-[11px] text-neutral-500">
              {isSupabaseConnected
                ? tr(
                    'Perubahan tersimpan otomatis berurutan dengan retry otomatis dan sinkron live antar tab.',
                    'Changes auto-save sequentially with automatic retry and live cross-tab sync.'
                  )
                : tr(
                    'Isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY lalu jalankan SQL di bawah di SQL Editor Supabase.',
                    'Set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY, then run the SQL scripts below in Supabase SQL Editor.'
                  )}
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                downloadTextFile('01_schema.sql', getSupabaseSchemaSql());
                toast(tr('01_schema.sql berhasil diunduh', '01_schema.sql downloaded'), 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-theme-primary text-xs font-semibold transition cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-theme-primary" />
              {tr('Unduh 01_schema.sql', 'Download 01_schema.sql')}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadTextFile('02_storage_and_rls.sql', getSupabaseStorageRlsSql());
                toast(
                  tr('02_storage_and_rls.sql berhasil diunduh', '02_storage_and_rls.sql downloaded'),
                  'success'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-theme-primary text-xs font-semibold transition cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {tr('Unduh 02_storage_and_rls.sql', 'Download 02_storage_and_rls.sql')}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadTextFile('03_migration_hr_employees.sql', getSupabaseEmployeeMigrationSql());
                toast(
                  tr(
                    '03_migration_hr_employees.sql berhasil diunduh',
                    '03_migration_hr_employees.sql downloaded'
                  ),
                  'success'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C9A24B]/60 bg-[#C9A24B]/10 hover:border-theme-primary text-xs font-semibold transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#9A7422]" />
              {tr('Unduh Migrasi Karyawan HR (.sql)', 'Download HR Employees Migration (.sql)')}
            </button>
            <button
              type="button"
              onClick={() => {
                const seedSql = generateCurrentStoreSeedSql(store);
                downloadTextFile(
                  `04_seed_hr_supplyhub_${new Date().toISOString().slice(0, 10)}.sql`,
                  seedSql
                );
                toast(
                  tr('SQL Seed Data Terkini berhasil diunduh', 'Current Seed Data SQL downloaded'),
                  'success'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-black text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {tr('Unduh Seed Data Terkini (.sql)', 'Download Current Seed SQL (.sql)')}
            </button>
          </div>
        )}
      </div>

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
                    ? tr('Edit Profil & Kata Sandi', 'Edit Profile & Password')
                    : userForm.id
                    ? tr('Edit Akun Pengguna & Penyesuaian Re-organisasi', 'Edit User Account & Reorganization')
                    : tr('Tambah Pengguna Baru', 'Add New User')}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {userForm.id
                    ? tr(
                        'Perbarui identitas, jabatan, seksi, hak akses, atau kata sandi akun ini.',
                        'Update identity, job title, section, access role, or password for this account.'
                      )
                    : tr(
                        'Tambahkan akun baru untuk tim Departemen Human Resources.',
                        'Add a new account for the Human Resources Department team.'
                      )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserForm(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">{tr('Nama Lengkap *', 'Full Name *')}</label>
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
                  placeholder={tr('Contoh: Mahmud Nurdiansyah', 'Example: Mahmud Nurdiansyah')}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{tr('Username Login *', 'Login Username *')}</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder={tr('Contoh: mahmud', 'Example: mahmud')}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{tr('Email Perusahaan *', 'Company Email *')}</label>
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
                <label className="block font-semibold mb-1">{tr('Jabatan *', 'Job Title *')}</label>
                <input
                  type="text"
                  required
                  value={userForm.jabatan}
                  onChange={(e) => setUserForm({ ...userForm, jabatan: e.target.value })}
                  placeholder={tr('Contoh: Sect. Manager HR Development', 'Example: Sect. Manager HR Development')}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{tr('Seksi / Bagian *', 'Section / Unit *')}</label>
                <input
                  type="text"
                  list="hr-section-suggestions"
                  required
                  value={userForm.seksi}
                  onChange={(e) => setUserForm({ ...userForm, seksi: e.target.value })}
                  placeholder={tr('Pilih atau ketik seksi baru', 'Select or type a section')}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
                <datalist id="hr-section-suggestions">
                  {DEFAULT_SECTIONS.map((sec) => (
                    <option key={sec} value={sec} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold mb-1">{tr('Peran Akses', 'Access Role')}</label>
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
                <label className="block font-semibold mb-1">
                  {tr('Inisial Avatar (2 Huruf)', 'Avatar Initials (2 Letters)')}
                </label>
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
                    ? tr(
                        'Kata Sandi Baru (kosongkan jika tidak ingin mengganti)',
                        'New Password (leave blank to keep current password)'
                      )
                    : tr('Kata Sandi *', 'Password *')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!userForm.id}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder={
                      userForm.id
                        ? tr('Biarkan kosong untuk mempertahankan kata sandi saat ini', 'Leave empty to keep current password')
                        : tr('Masukkan kata sandi awal', 'Enter initial password')
                    }
                    className="w-full px-3 pr-10 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Tanda Tangan Tersimpan */}
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1.5">
                  {tr('Tanda Tangan Digital Tersimpan', 'Saved Digital Signature')}
                </label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114]">
                  <div className="w-28 h-14 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white flex items-center justify-center overflow-hidden shrink-0 p-1">
                    {userForm.savedSignatureDataUrl ? (
                      <img
                        src={userForm.savedSignatureDataUrl}
                        alt={tr('Tanda tangan', 'Signature')}
                        className="max-h-12 max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-neutral-400">{tr('Belum ada', 'None yet')}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] font-semibold cursor-pointer hover:border-theme-primary transition">
                      <Upload className="w-3.5 h-3.5" />
                      {tr('Unggah PNG/JPG', 'Upload PNG/JPG')}
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {tr('Hapus', 'Delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {!userForm.isSelfProfile && (
                <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#0F1114]">
                  <div>
                    <div className="font-semibold">{tr('Status Akun Aktif', 'Active Account Status')}</div>
                    <div className="text-[11px] text-neutral-500">
                      {tr(
                        'Akun nonaktif tidak dapat masuk ke sistem namun riwayat audit & laporan lama tetap terjaga.',
                        'Inactive accounts cannot sign in, while historical audit trails and finalized reports remain intact.'
                      )}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userForm.active}
                    disabled={userForm.id === user.id}
                    onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                    className="w-4 h-4 accent-current text-theme-primary"
                  />
                </div>
              )}

              {userForm.id && (
                <label className="sm:col-span-2 flex items-start gap-2.5 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.syncReorg}
                    onChange={(e) => setUserForm({ ...userForm, syncReorg: e.target.checked })}
                    className="w-4 h-4 mt-0.5 accent-current text-theme-primary shrink-0"
                  />
                  <div>
                    <div className="font-semibold text-amber-900 dark:text-amber-200">
                      {tr(
                        'Sinkronkan Perubahan Re-organisasi ke Template & Laporan Draft',
                        'Sync Reorganization Changes to Templates & Draft Reports'
                      )}
                    </div>
                    <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      {tr(
                        'Otomatis memperbarui Nama & Jabatan baru pada seluruh Template Tanda Tangan serta slot tertunda di Laporan Draft. Laporan Final yang sudah ditandatangani tetap utuh untuk integritas audit.',
                        'Automatically updates the new Name & Job Title across all Signature Templates and pending slots in Draft Reports. Signed Final reports stay unchanged for audit integrity.'
                      )}
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setUserForm(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white font-semibold cursor-pointer"
              >
                {userForm.id ? tr('Simpan Perubahan', 'Save Changes') : tr('Simpan Pengguna', 'Save User')}
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
                <ArrowRightLeft className="w-4 h-4 text-theme-primary" />
                {tr('Serah Terima Jabatan (Re-organisasi)', 'Position Handover (Reorganization)')}
              </h3>
              <button
                type="button"
                onClick={() => setHandoverFromUser(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200 dark:border-neutral-800 space-y-1">
              <div className="text-[11px] text-neutral-500">
                {tr('Pejabat / PIC Sebelumnya', 'Previous Officer / PIC')}
              </div>
              <div className="font-bold text-sm">{handoverFromUser.name}</div>
              <div className="text-neutral-500">
                {handoverFromUser.jabatan} · {handoverFromUser.seksi}
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400 pt-1">
                {tr('Terkait pada', 'Linked to')}{' '}
                <strong>
                  {handoverImpact.templates} {tr('Template Tanda Tangan', 'Signature Templates')}
                </strong>{' '}
                &amp;{' '}
                <strong>
                  {handoverImpact.draftReports} {tr('Laporan Draft (Pending)', 'Draft Reports (Pending)')}
                </strong>
                .
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5">
                {tr('Alihkan Slot Persetujuan ke Akun Pengganti *', 'Reassign Approval Slots to Successor Account *')}
              </label>
              <select
                required
                value={handoverToUserId}
                onChange={(e) => setHandoverToUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              >
                <option value="">{tr('-- Pilih Akun Pengganti Aktif --', '-- Select Active Successor --')}</option>
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
                  className="w-4 h-4 mt-0.5 accent-current text-theme-primary"
                />
                <span>
                  {tr('Sekaligus nonaktifkan akun', 'Also deactivate account')}{' '}
                  <strong>{handoverFromUser.name}</strong>{' '}
                  {tr(
                    'setelah serah terima selesai (riwayat audit & laporan Final tetap aman).',
                    'after handover completes (audit trail & Final reports remain safe).'
                  )}
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHandoverFromUser(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={!handoverToUserId}
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover disabled:opacity-50 text-white font-semibold cursor-pointer"
              >
                {tr('Jalankan Serah Terima', 'Execute Handover')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akun */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold text-red-600">
              {tr('Hapus Akun Pengguna?', 'Delete User Account?')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {tr('Anda yakin ingin menghapus akun', 'Are you sure you want to delete account')}{' '}
              <strong>{deleteTargetUser.name}</strong> ({deleteTargetUser.username})?{' '}
              {tr(
                'Jika akun ini masih terhubung dengan template tanda tangan, gunakan fitur Serah Terima Jabatan atau cukup nonaktifkan akun.',
                'If this account is still linked to signature templates, use Position Handover or simply deactivate the account.'
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
              >
                {tr('Hapus Akun', 'Delete Account')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
