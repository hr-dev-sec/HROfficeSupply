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
import { AjiuLogoBadge, HseLogoBadge } from '../components/common/BrandEmblems';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { getRoleLabel } from '../utils/format';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo, lockoutRemainingSeconds } = useAuth();
  const { store } = useSupplyHub();
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
      setError('Username/email dan kata sandi wajib diisi.');
      return;
    }
    const res = login(identifier, password, rememberMe);
    if (!res.ok) {
      setError(res.error || 'Gagal masuk.');
      return;
    }
    toast('Berhasil masuk ke HR SupplyHub', 'success');
    navigate('/app/dashboard');
  };

  const handleDemoClick = (username: string, name: string) => {
    loginAsDemo(username);
    toast(`Masuk sebagai ${name}`, 'success');
    navigate('/app/dashboard');
  };

  const formatLockout = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#FAF8F5] dark:bg-[#0F1114]">
      {/* Left Brand Panel */}
      <div className="lg:col-span-5 relative overflow-hidden bg-gradient-to-br from-[#B8000E] via-[#7A0712] to-[#1A1D22] text-white p-6 sm:p-10 xl:p-14 flex flex-col justify-between">
        <div className="space-y-6 sm:space-y-8 relative z-10">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-white/85 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda
            </Link>
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
              <p className="text-xs sm:text-[13px] font-semibold tracking-wide text-[#F6D37A] leading-snug">
                PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
              </p>
            </div>
            <p className="text-sm text-white/80 leading-relaxed max-w-lg">
              Sistem kontrol persediaan Office Supplies, Overhead Goods, Inventaris Overhead, dan Rolling Forecast GA Departemen Human Resources.
            </p>
          </div>

          {/* Minimalist Architectural Feature List */}
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#F6D37A] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">1. Pengendalian Stok &amp; Rolling Forecast GA</div>
                <div className="text-xs text-white/80 leading-relaxed">
                  Pencatatan transaksi harian, stock opname akhir bulan, serta pembaruan Rolling Forecast pemesanan ke GA Dept secara terstruktur.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#F6D37A] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">2. Pengesahan Digital Berjenjang</div>
                <div className="text-xs text-white/80 leading-relaxed">
                  Alur persetujuan berurutan dari Staff/PIC (Dilaporkan), Section Manager (Dicheck), hingga Department Manager (Mengetahui).
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#F6D37A] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">3. Pelaporan Standar HR &amp; Arsip Terverifikasi</div>
                <div className="text-xs text-white/80 leading-relaxed">
                  Ekspor dokumen bulanan siap cetak (PDF A3 &amp; Excel) yang terkunci otomatis beserta kode QR dan catatan audit resmi HR Dept.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-white/70 pt-6 sm:pt-8 relative z-10 leading-relaxed space-y-0.5">
          <div className="font-semibold text-white/85">Seksi HR Development &amp; HR Adm. &amp; Operation</div>
          <div>PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory</div>
        </div>
      </div>

      {/* Right Login Form & One-Click Demo Accounts */}
      <div className="lg:col-span-7 flex items-center justify-center p-5 sm:p-8 lg:p-10 xl:p-14">
        <div className="w-full max-w-xl space-y-6 sm:space-y-7">
          <div>
            <h2 className="text-2xl font-extrabold font-display text-[#1F2328] dark:text-white">
              Masuk ke Ruang Kerja
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Gunakan akun Ajinomoto Anda atau pilih salah satu akun demo di bawah untuk uji cepat tiap peran.
            </p>
          </div>

          {lockoutRemainingSeconds > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                <div className="font-bold">Login Dikunci Sementara (5 Menit)</div>
                <div>
                  Batas 5 kali percobaan gagal terlampaui. Silakan tunggu{' '}
                  <span className="font-mono-num font-bold">
                    {formatLockout(lockoutRemainingSeconds)}
                  </span>{' '}
                  atau gunakan kartu demo di bawah untuk pengujian.
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
                Username atau Email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Contoh: mahmud atau mahmud.nurdiansyah@ajinomoto.co.id"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#E60012]/30 focus:border-[#E60012]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi (demo123)"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-sm focus:outline-none focus:ring-2 focus:ring-[#E60012]/30 focus:border-[#E60012]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
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
                  className="rounded border-neutral-300 text-[#E60012] focus:ring-[#E60012]"
                />
                Ingat saya di perangkat ini
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setForgotSent(false);
                }}
                className="font-semibold text-[#E60012] hover:underline"
              >
                Lupa kata sandi?
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
              className="w-full py-3 rounded-xl bg-[#E60012] hover:bg-[#C4000F] disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Masuk ke HR SupplyHub
            </button>

            <div className="pt-1 flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <span>Karyawan Dept. HR ingin mengambil Office Supplies?</span>
              <Link
                to="/pengambilan"
                className="font-semibold text-[#E60012] hover:underline whitespace-nowrap shrink-0"
              >
                Buka Form Pengambilan →
              </Link>
            </div>
          </form>

          {/* One-Click Demo Account Cards */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Masuk Cepat Akun Demo (Kata sandi: demo123)
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {store.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleDemoClick(u.username, u.name)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] hover:border-[#E60012] hover:shadow-sm transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 group-hover:bg-[#E60012] group-hover:text-white flex items-center justify-center text-xs font-bold transition-colors shrink-0">
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
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Pemulihan Kata Sandi</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {forgotSent ? (
              <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                <p>
                  Permintaan reset kata sandi untuk <strong>{forgotEmail}</strong> telah diteruskan ke Super Admin HR. Untuk akun demo, kata sandi standar adalah <code className="font-mono-num px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">demo123</code>.
                </p>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-[#E60012] text-white text-sm font-semibold"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (forgotEmail.trim()) setForgotSent(true);
                }}
                className="space-y-4"
              >
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Masukkan email resmi Ajinomoto atau username Anda untuk menerima instruksi reset dari Administrator HR.
                </p>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="nama@ajinomoto.co.id"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
                  >
                    Kirim Permintaan
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
