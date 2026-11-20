import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AppearanceControls } from '../components/common/AppearanceControls';
import { AjiuLogoBadge, HseLogoBadge } from '../components/common/BrandEmblems';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { getRoleLabel } from '../utils/format';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo, lockoutRemainingSeconds } = useAuth();
  const { store } = useSupplyHub();
  const { activePreset } = useTheme();
  const { tr } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password.trim()) {
      setError(
        tr(
          'Username/email dan kata sandi wajib diisi.',
          'Username/email and password are required.'
        )
      );
      return;
    }
    const res = login(identifier, password, rememberMe);
    if (!res.ok) {
      setError(res.error || tr('Gagal masuk.', 'Failed to sign in.'));
      return;
    }
    toast(tr('Berhasil masuk ke HR SupplyHub', 'Signed in to HR SupplyHub'), 'success');
    navigate('/app/dashboard');
  };

  const handleDemoClick = (username: string, name: string) => {
    loginAsDemo(username);
    toast(tr(`Masuk sebagai ${name}`, `Signed in as ${name}`), 'success');
    navigate('/app/dashboard');
  };

  const formatLockout = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-theme-canvas transition-colors duration-300">
      {/* Left Brand Panel */}
      <div
        className="lg:col-span-5 relative overflow-hidden text-white p-6 sm:p-10 xl:p-14 flex flex-col justify-between transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${activePreset.loginFrom}, ${activePreset.loginVia}, ${activePreset.loginTo})`,
        }}
      >
        <div className="space-y-6 sm:space-y-8 relative z-10">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-white/85 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {tr('Kembali ke Beranda', 'Back to Home')}
            </Link>
            <div className="lg:hidden">
              <AppearanceControls compact onDarkSurface />
            </div>
          </div>

          <div className="space-y-4 pt-2 sm:pt-4">
            <div className="inline-flex flex-wrap items-center gap-3 bg-white/95 rounded-2xl px-4 py-2.5 shadow-lg">
              <img
                src="/logo-ajinomoto.png"
                alt="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
                className="h-10 sm:h-11 w-auto object-contain"
              />
              <div className="h-7 w-px bg-neutral-200" />
              <AjiuLogoBadge size="lg" />
              <HseLogoBadge size="lg" />
            </div>
            <div className="space-y-1.5 pt-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight">
                HR SupplyHub
              </h1>
              <p
                className="text-xs sm:text-[13px] font-semibold tracking-wide leading-snug"
                style={{ color: '#F6D37A' }}
              >
                PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
              </p>
            </div>
            <p className="text-sm text-white/85 leading-relaxed max-w-lg">
              {tr(
                'Sistem kontrol persediaan Office Supplies, Overhead Goods, Inventaris Overhead, dan Rolling Forecast GA Departemen Human Resources.',
                'Integrated control system for Office Supplies, Overhead Goods, Overhead Inventory, and GA Dept. Rolling Forecast for Human Resources Department.'
              )}
            </p>
          </div>

          {/* Minimalist Architectural Feature List */}
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#F6D37A] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">
                  {tr(
                    '1. Pengendalian Stok & Rolling Forecast GA',
                    '1. Inventory Control & GA Rolling Forecast'
                  )}
                </div>
                <div className="text-xs text-white/80 leading-relaxed">
                  {tr(
                    'Pencatatan transaksi harian, stock opname akhir bulan, serta pembaruan Rolling Forecast pemesanan ke GA Dept secara terstruktur.',
                    'Daily transaction tracking, month-end stock opname, and structured monthly Rolling Forecast updates to GA Dept.'
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#F6D37A] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">
                  {tr('2. Pengesahan Digital Berjenjang', '2. Tiered Digital Approval')}
                </div>
                <div className="text-xs text-white/80 leading-relaxed">
                  {tr(
                    'Alur persetujuan berurutan dari Staff/PIC (Dilaporkan), Section Manager (Dicheck), hingga Department Manager (Mengetahui).',
                    'Sequential digital sign-off from Staff/PIC (Reported), Section Manager (Checked), to Department Manager (Acknowledged).'
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#F6D37A] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">
                  {tr(
                    '3. Pelaporan Standar HR & Arsip Terverifikasi',
                    '3. Standard HR Reporting & Verified Archive'
                  )}
                </div>
                <div className="text-xs text-white/80 leading-relaxed">
                  {tr(
                    'Ekspor dokumen bulanan siap cetak (PDF A3 & Excel) yang terkunci otomatis beserta kode QR dan catatan audit resmi HR Dept.',
                    'Print-ready monthly exports (A3 PDF & Excel) locked automatically with QR verification and full HR audit trail.'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-white/75 pt-6 sm:pt-8 relative z-10 leading-relaxed space-y-0.5">
          <div className="font-semibold text-white/90">
            {tr(
              'Seksi HR Development & Administration & Operation',
              'HR Development & Administration & Operation Sections'
            )}
          </div>
          <div>PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory</div>
        </div>
      </div>

      {/* Right Login Form & One-Click Demo Accounts */}
      <div className="lg:col-span-7 flex flex-col justify-between p-5 sm:p-8 lg:p-10 xl:p-14">
        <div className="hidden lg:flex justify-end">
          <AppearanceControls />
        </div>

        <div className="w-full max-w-xl mx-auto my-auto py-4 space-y-6 sm:space-y-7">
          <div>
            <h2 className="text-2xl font-extrabold font-display text-[#1F2328] dark:text-white">
              {tr('Masuk ke Ruang Kerja', 'Sign In to Workspace')}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {tr(
                'Gunakan akun Ajinomoto Anda atau pilih salah satu akun demo di bawah untuk uji cepat tiap peran.',
                'Sign in with your Ajinomoto account or pick a demo account below to test each role.'
              )}
            </p>
          </div>

          {lockoutRemainingSeconds > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                <div className="font-bold">
                  {tr('Login Dikunci Sementara (5 Menit)', 'Login Temporarily Locked (5 Minutes)')}
                </div>
                <div>
                  {tr(
                    'Batas 5 kali percobaan gagal terlampaui. Silakan tunggu ',
                    'Maximum 5 failed attempts exceeded. Please wait '
                  )}
                  <span className="font-mono-num font-bold">
                    {formatLockout(lockoutRemainingSeconds)}
                  </span>{' '}
                  {tr(
                    'atau gunakan kartu demo di bawah untuk pengujian.',
                    'or use a demo account card below for testing.'
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5"
              >
                {tr('Username atau Email', 'Username or Email')}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={tr(
                    'Contoh: mahmud atau mahmud.nurdiansyah@ajinomoto.co.id',
                    'e.g., mahmud or mahmud.nurdiansyah@ajinomoto.co.id'
                  )}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5"
              >
                {tr('Kata Sandi', 'Password')}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr('Masukkan kata sandi (demo123)', 'Enter password (demo123)')}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? tr('Sembunyikan kata sandi', 'Hide password') : tr('Tampilkan kata sandi', 'Show password')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-neutral-300"
                  style={{ accentColor: activePreset.primary }}
                />
                {tr('Ingat saya di perangkat ini', 'Remember me on this device')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setForgotSent(false);
                }}
                className="font-semibold text-theme-primary hover:underline cursor-pointer"
              >
                {tr('Lupa kata sandi?', 'Forgot password?')}
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={lockoutRemainingSeconds > 0}
              className="w-full py-3 rounded-xl bg-theme-primary disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              {tr('Masuk ke HR SupplyHub', 'Sign In to HR SupplyHub')}
            </button>

            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <span>
                {tr(
                  'Karyawan Dept. HR ingin mengambil Office Supplies?',
                  'HR Dept. employee requesting Office Supplies?'
                )}
              </span>
              <Link
                to="/pengambilan"
                className="font-semibold text-theme-primary hover:underline whitespace-nowrap shrink-0"
              >
                {tr('Buka Form Pengambilan →', 'Open Request Form →')}
              </Link>
            </div>
          </form>

          {/* One-Click Demo Account Cards */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {tr(
                  'Masuk Cepat Akun Demo (Kata sandi: demo123)',
                  'Quick Demo Sign-In (Password: demo123)'
                )}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {store.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleDemoClick(u.username, u.name)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] hover:shadow-sm transition-all text-left group cursor-pointer"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = activePreset.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '';
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl text-white flex items-center justify-center text-xs font-bold transition-colors shrink-0"
                    style={{ backgroundColor: activePreset.primary }}
                  >
                    {u.avatarInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{u.name}</div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      {getRoleLabel(u.role)} · {u.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:block h-4" />
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display">
                {tr('Reset Kata Sandi', 'Reset Password')}
              </h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {forgotSent ? (
              <div className="space-y-3 text-sm">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs leading-relaxed">
                  {tr(
                    `Tautan pemulihan kata sandi (simulasi) telah dikirim ke ${forgotEmail || 'email Ajinomoto Anda'}.`,
                    `A simulated password recovery link has been sent to ${forgotEmail || 'your Ajinomoto email'}.`
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-theme-primary text-white text-xs font-semibold cursor-pointer"
                >
                  {tr('Kembali ke Login', 'Back to Sign In')}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setForgotSent(true);
                  toast(tr('Permintaan reset terkirim', 'Reset request sent'), 'success');
                }}
                className="space-y-4"
              >
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {tr(
                    'Masukkan email perusahaan Anda untuk menerima instruksi pemulihan kata sandi.',
                    'Enter your company email address to receive password recovery instructions.'
                  )}
                </p>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="nama@ajinomoto.co.id"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold cursor-pointer"
                  >
                    {tr('Batal', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-theme-primary text-white text-xs font-semibold cursor-pointer"
                  >
                    {tr('Kirim Instruksi', 'Send Instructions')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
