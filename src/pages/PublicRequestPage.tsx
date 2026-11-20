import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Minus,
  Moon,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { AjiuLogoBadge, AjinomotoLogoTile, HseLogoBadge } from '../components/common/BrandEmblems';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { HR_SECTIONS, type HrEmployee, type HrSection, type ItemRequest, type SupplyType } from '../types';
import { formatDateIndo } from '../utils/format';

interface CartLine {
  itemId: string;
  itemName: string;
  jenis: SupplyType;
  uom: string;
  qty: number;
  maxStock: number;
}

export const PublicRequestPage: React.FC = () => {
  const { user } = useAuth();
  const { store, createItemRequest } = useSupplyHub();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Step 1: Identitas Karyawan Dept. HR
  const [sectionFilter, setSectionFilter] = useState<'ALL' | HrSection>('ALL');
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [nikInput, setNikInput] = useState('');

  // Step 2: Katalog Barang (Office Supplies & Overhead Goods)
  const [supplyFilter, setSupplyFilter] = useState<'ALL' | SupplyType>('ALL');
  const [itemSearch, setItemSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');

  // Receipt after submit
  const [submittedRequest, setSubmittedRequest] = useState<ItemRequest | null>(null);

  // Status tracker filter
  const [statusSearch, setStatusSearch] = useState('');
  const [statusSection, setStatusSection] = useState<'ALL' | HrSection>('ALL');

  const activeEmployees = useMemo(
    () =>
      (store.employees || [])
        .filter((e) => e.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [store.employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return activeEmployees.filter((e) => {
      if (sectionFilter !== 'ALL' && e.section !== sectionFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.nik.toLowerCase().includes(q) ||
        e.jabatan.toLowerCase().includes(q) ||
        e.section.toLowerCase().includes(q)
      );
    });
  }, [activeEmployees, empSearch, sectionFilter]);

  const selectedEmployee: HrEmployee | undefined = useMemo(
    () => activeEmployees.find((e) => e.id === selectedEmpId),
    [activeEmployees, selectedEmpId]
  );

  const requiresNikVerification = Boolean(selectedEmployee && selectedEmployee.nik.trim().length > 0);
  const isNikVerified = useMemo(() => {
    if (!selectedEmployee) return false;
    if (!requiresNikVerification) return true;
    return nikInput.trim().toUpperCase() === selectedEmployee.nik.trim().toUpperCase();
  }, [nikInput, requiresNikVerification, selectedEmployee]);

  const catalogItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return store.items
      .filter((it) => !it.archived)
      .filter((it) => (supplyFilter === 'ALL' ? true : it.jenis === supplyFilter))
      .filter((it) => {
        if (!q) return true;
        return (
          it.itemName.toLowerCase().includes(q) ||
          it.kategori.toLowerCase().includes(q) ||
          it.codeItem.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Items with available stock first
        if (a.currentStock > 0 && b.currentStock <= 0) return -1;
        if (a.currentStock <= 0 && b.currentStock > 0) return 1;
        return a.itemName.localeCompare(b.itemName, 'id');
      });
  }, [itemSearch, store.items, supplyFilter]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cart) map.set(c.itemId, c.qty);
    return map;
  }, [cart]);

  const totalUnits = useMemo(() => cart.reduce((sum, c) => sum + c.qty, 0), [cart]);

  const addToCart = (itemId: string) => {
    const item = store.items.find((i) => i.id === itemId);
    if (!item || item.currentStock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (existing) {
        const nextQty = Math.min(item.currentStock, existing.qty + 1);
        return prev.map((c) => (c.itemId === itemId ? { ...c, qty: nextQty, maxStock: item.currentStock } : c));
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.itemName,
          jenis: item.jenis,
          uom: item.uom,
          qty: 1,
          maxStock: item.currentStock,
        },
      ];
    });
  };

  const updateCartQty = (itemId: string, nextQty: number) => {
    setCart((prev) => {
      if (nextQty <= 0) return prev.filter((c) => c.itemId !== itemId);
      return prev.map((c) =>
        c.itemId === itemId ? { ...c, qty: Math.min(c.maxStock, Math.max(1, nextQty)) } : c
      );
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const handleSelectEmployee = (emp: HrEmployee) => {
    setSelectedEmpId(emp.id);
    setNikInput('');
    setSubmittedRequest(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      toast('Pilih nama karyawan terlebih dahulu', 'warning');
      return;
    }
    if (requiresNikVerification && !isNikVerified) {
      toast('Verifikasi NIK tidak sesuai', 'error', 'Pastikan NIK sesuai dengan data karyawan yang dipilih.');
      return;
    }
    if (cart.length === 0) {
      toast('Pilih minimal 1 barang', 'warning');
      return;
    }

    const created = createItemRequest({
      employeeId: selectedEmployee.id,
      requesterNik: selectedEmployee.nik || undefined,
      requesterName: selectedEmployee.name,
      requesterSection: selectedEmployee.section,
      requestDate: new Date().toISOString().slice(0, 10),
      source: 'PORTAL_DEPAN',
      items: cart.map((c) => ({
        itemId: c.itemId,
        itemName: c.itemName,
        jenis: c.jenis,
        uom: c.uom,
        qty: c.qty,
      })),
      note: note.trim() || `Pengambilan kebutuhan ${selectedEmployee.section}`,
    });

    setSubmittedRequest(created);
    setCart([]);
    setNote('');
    setNikInput('');
    toast('Permintaan pengambilan berhasil dikirim', 'success', 'Menunggu persetujuan PIC / Admin HR.');
  };

  const recentRequests = useMemo(() => {
    const q = statusSearch.trim().toLowerCase();
    return store.itemRequests
      .filter((r) => (statusSection === 'ALL' ? true : r.requesterSection === statusSection))
      .filter((r) => {
        if (!q) return true;
        return (
          r.requesterName.toLowerCase().includes(q) ||
          (r.requesterNik || '').toLowerCase().includes(q) ||
          r.requesterSection.toLowerCase().includes(q) ||
          r.items.some((it) => it.itemName.toLowerCase().includes(q))
        );
      })
      .slice(0, 20);
  }, [statusSearch, statusSection, store.itemRequests]);

  const canSubmit = Boolean(selectedEmployee && isNikVerified && cart.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F6F0] dark:bg-[#090B0E] text-[#1A1D21] dark:text-[#F4F5F7]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 px-3 sm:px-6 lg:px-10 pt-3">
        <div className="w-full max-w-[1440px] mx-auto rounded-2xl border border-[#C9A24B]/25 dark:border-[#C9A24B]/20 bg-white/88 dark:bg-[#12151B]/90 backdrop-blur-2xl shadow-[0_10px_32px_-14px_rgba(24,26,32,0.14)]">
          <div className="h-[2px] w-full rounded-t-2xl bg-gradient-to-r from-[#E60012] via-[#C9A24B] to-transparent opacity-85" />
          <div className="px-4 sm:px-6 h-15 flex items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-3 whitespace-nowrap shrink-0">
              <AjinomotoLogoTile size="sm" />
              <span className="font-display font-extrabold text-[16px] tracking-tight">
                HR SupplyHub
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              <Link to="/" className="hover:text-[#E60012] transition-colors whitespace-nowrap shrink-0">
                Beranda
              </Link>
              <a href="#form-pengambilan" className="text-[#E60012] whitespace-nowrap shrink-0">
                Form Pengambilan
              </a>
              <a href="#pantau-status" className="hover:text-[#E60012] transition-colors whitespace-nowrap shrink-0">
                Pantau Status
              </a>
            </nav>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="hidden sm:flex items-center gap-2 pr-1">
                <AjiuLogoBadge size="sm" />
                <HseLogoBadge size="sm" />
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Ubah tema tampilan"
                className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#C9A24B]/50 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => navigate(user ? '/app/requests' : '/login')}
                className="px-4 py-2 rounded-xl bg-[#181B20] dark:bg-white text-white dark:text-[#111318] text-xs font-semibold hover:opacity-90 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {user ? 'Buka Dashboard' : 'Masuk Admin'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="form-pengambilan" className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8">
        {/* Page Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5">
          <div className="space-y-1.5">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-[#E60012] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Beranda
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">
              Form Pengambilan Office Supplies &amp; Overhead Goods
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              Departemen Human Resources · Seksi HR Development &amp; Administration &amp; Operation · PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
            </p>
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 md:text-right">
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              Alur Pengambilan Barang
            </div>
            <div>1. Pilih Nama &amp; Verifikasi NIK · 2. Pilih Barang · 3. Approval PIC HR</div>
          </div>
        </div>

        {/* Receipt Banner after successful submit */}
        {submittedRequest && (
          <div className="p-5 sm:p-6 rounded-2xl border border-emerald-300/80 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Permintaan Pengambilan Berhasil Dikirim
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                Pemohon: <strong>{submittedRequest.requesterName}</strong>
                {submittedRequest.requesterNik ? ` (${submittedRequest.requesterNik})` : ''} ·{' '}
                {submittedRequest.requesterSection} ·{' '}
                <span className="font-mono-num">
                  {submittedRequest.items.length} jenis barang (
                  {submittedRequest.items.reduce((s, it) => s + it.qty, 0)} unit)
                </span>
              </p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                Status saat ini: <strong>Menunggu Approval PIC / Admin HR</strong>. Stok akan otomatis tercatat setelah disetujui oleh PIC.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubmittedRequest(null)}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Buat Pengambilan Baru
            </button>
          </div>
        )}

        {/* 2-Column Interactive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Step 1 (Employee) + Step 2 (Item Catalog) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Identitas Karyawan */}
            <section className="p-5 sm:p-6 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#14171D] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#E60012]" />
                    01. Identitas Karyawan Departemen HR
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Pilih nama Anda dari database karyawan Departemen HR lalu konfirmasi NIK.
                  </p>
                </div>
                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmpId('');
                      setNikInput('');
                    }}
                    className="text-xs font-semibold text-[#E60012] hover:underline cursor-pointer"
                  >
                    Ganti Karyawan
                  </button>
                )}
              </div>

              {!selectedEmployee ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        placeholder="Ketik nama karyawan atau jabatan..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] text-xs focus:outline-none focus:border-[#E60012]"
                      />
                    </div>
                    <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-xs shrink-0 overflow-x-auto">
                      {(['ALL', ...HR_SECTIONS] as const).map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setSectionFilter(sec)}
                          className={`px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                            sectionFilter === sec
                              ? 'bg-white dark:bg-[#1A1E26] text-neutral-900 dark:text-white shadow-sm'
                              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                          }`}
                        >
                          {sec === 'ALL' ? 'Semua Seksi' : sec}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                      Nama karyawan tidak ditemukan. Hubungi Admin HR untuk mendaftarkan nama Anda di Database Karyawan HR.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 rounded-xl">
                      {filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className="w-full px-4 py-3 text-left hover:bg-[#E60012]/[0.04] dark:hover:bg-white/[0.03] flex items-center justify-between gap-3 transition cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate">
                              {emp.section}
                              {emp.jabatan ? ` · ${emp.jabatan}` : ''}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-[#E60012] shrink-0">
                            Pilih
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800 text-xs">
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-white">
                        {selectedEmployee.name}
                      </div>
                      <div className="text-neutral-500 mt-0.5">
                        Seksi: <strong className="text-neutral-800 dark:text-neutral-200">{selectedEmployee.section}</strong>
                        {selectedEmployee.jabatan ? ` · ${selectedEmployee.jabatan}` : ''}
                      </div>
                    </div>
                    {isNikVerified && (
                      <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        Identitas Terverifikasi
                      </div>
                    )}
                  </div>

                  {requiresNikVerification && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold">
                        Verifikasi NIK Karyawan *
                      </label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <input
                          type="text"
                          value={nikInput}
                          onChange={(e) => setNikInput(e.target.value)}
                          placeholder="Masukkan NIK Anda sesuai data HR..."
                          autoComplete="off"
                          className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono-num uppercase focus:outline-none ${
                            nikInput.trim().length === 0
                              ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] focus:border-[#E60012]'
                              : isNikVerified
                              ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                              : 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                          }`}
                        />
                        <span className="text-[11px] text-neutral-500 shrink-0">
                          {nikInput.trim().length === 0
                            ? 'Diperlukan untuk mencegah salah pilih nama'
                            : isNikVerified
                            ? 'NIK cocok'
                            : 'NIK tidak sesuai dengan nama terpilih'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 2: Katalog Barang */}
            <section className="p-5 sm:p-6 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#14171D] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#E60012]" />
                    02. Pilih Barang yang Akan Diambil
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Tersedia Office Supplies &amp; Overhead Goods. Anda dapat menambahkan lebih dari satu item.
                  </p>
                </div>
                <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-xs shrink-0">
                  {(
                    [
                      { id: 'ALL', label: 'Semua' },
                      { id: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
                      { id: 'OVERHEAD_GOODS', label: 'Overhead Goods' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSupplyFilter(opt.id)}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                        supplyFilter === opt.id
                          ? 'bg-white dark:bg-[#1A1E26] text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Cari nama barang, kategori, atau kode item..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] text-xs focus:outline-none focus:border-[#E60012]"
                />
              </div>

              <div className="max-h-[440px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 rounded-xl">
                {catalogItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-neutral-500">
                    Tidak ada barang yang cocok dengan pencarian Anda.
                  </div>
                ) : (
                  catalogItems.map((it) => {
                    const inCartQty = cartQtyMap.get(it.id) || 0;
                    const outOfStock = it.currentStock <= 0;
                    return (
                      <div
                        key={it.id}
                        className={`px-4 py-3 flex items-center justify-between gap-3 text-xs ${
                          outOfStock ? 'opacity-55 bg-neutral-50/60 dark:bg-neutral-900/40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {it.photoUrl ? (
                            <img
                              src={it.photoUrl}
                              alt={it.itemName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-neutral-900 dark:text-white truncate">
                              {it.itemName}
                            </div>
                            <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-1.5">
                              <span>{it.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'}</span>
                              <span>·</span>
                              <span>{it.kategori}</span>
                              {it.codeItem && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono-num">{it.codeItem}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div
                              className={`font-mono-num font-bold ${
                                outOfStock
                                  ? 'text-red-600'
                                  : it.currentStock <= it.minStock
                                  ? 'text-amber-600'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {outOfStock ? 'Stok Habis' : `${it.currentStock} ${it.uom}`}
                            </div>
                            {!outOfStock && (
                              <div className="text-[10px] text-neutral-400">Tersedia</div>
                            )}
                          </div>

                          {inCartQty > 0 ? (
                            <div className="inline-flex items-center gap-1 rounded-xl border border-[#E60012]/40 bg-[#E60012]/5 p-0.5">
                              <button
                                type="button"
                                onClick={() => updateCartQty(it.id, inCartQty - 1)}
                                className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer"
                                aria-label="Kurangi jumlah"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-7 text-center font-mono-num font-bold">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                disabled={inCartQty >= it.currentStock}
                                onClick={() => updateCartQty(it.id, inCartQty + 1)}
                                className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                                aria-label="Tambah jumlah"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={outOfStock}
                              onClick={() => addToCart(it.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] hover:text-[#E60012] disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer whitespace-nowrap"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Tambah
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Right: Keranjang & Kirim Pengajuan */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 lg:sticky lg:top-24 p-5 sm:p-6 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#14171D] space-y-5"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#E60012]" />
                  03. Ringkasan Pengambilan
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5 font-mono-num">
                  {cart.length} jenis barang · {totalUnits} total unit
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-neutral-500 hover:text-red-600 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* Selected employee summary */}
            <div className="text-xs space-y-1 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="text-[11px] font-semibold text-neutral-500">Pemohon</div>
              {selectedEmployee ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      {selectedEmployee.name}
                    </span>
                    <span className="text-neutral-500"> · {selectedEmployee.section}</span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      isNikVerified ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {isNikVerified ? 'NIK Terverifikasi' : 'Belum Verifikasi NIK'}
                  </span>
                </div>
              ) : (
                <div className="text-neutral-400">Belum memilih nama karyawan di Langkah 01</div>
              )}
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                Keranjang masih kosong. Klik <strong>+ Tambah</strong> pada daftar barang di samping.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {cart.map((line) => (
                  <div key={line.itemId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{line.itemName}</div>
                      <div className="text-[11px] text-neutral-500 font-mono-num">
                        {line.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'} · Maks {line.maxStock} {line.uom}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(line.itemId, line.qty - 1)}
                        className="w-7 h-7 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center hover:border-[#E60012] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={line.maxStock}
                        value={line.qty}
                        onChange={(e) => updateCartQty(line.itemId, Number(e.target.value) || 1)}
                        className="w-12 py-1 text-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] font-mono-num font-bold"
                      />
                      <button
                        type="button"
                        disabled={line.qty >= line.maxStock}
                        onClick={() => updateCartQty(line.itemId, line.qty + 1)}
                        className="w-7 h-7 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 flex items-center justify-center hover:border-[#E60012] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.itemId)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 cursor-pointer"
                        aria-label="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Keperluan */}
            <div className="space-y-1.5 text-xs">
              <label className="block font-semibold">Keperluan / Catatan</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Keperluan training karyawan baru / operasional meja HR..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] focus:outline-none focus:border-[#E60012]"
              />
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E60012] to-[#BD000F] hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_12px_28px_-10px_rgba(230,0,18,0.55)] transition cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                Kirim Permintaan Pengambilan
              </button>
              <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
                Permintaan akan masuk ke antrean PIC / Admin HR. Stok baru terpotong setelah PIC mengklik <strong>Setujui</strong>.
              </p>
            </div>
          </form>
        </div>

        {/* Status Tracker Section */}
        <section
          id="pantau-status"
          className="p-5 sm:p-6 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#14171D] space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold font-display">
                Pantau Status Pengambilan Karyawan Dept. HR
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cek apakah permintaan Anda masih menunggu persetujuan PIC, sudah disetujui, atau ditolak.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={statusSearch}
                  onChange={(e) => setStatusSearch(e.target.value)}
                  placeholder="Cari nama karyawan / barang..."
                  className="pl-8 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] w-56 focus:outline-none focus:border-[#E60012]"
                />
              </div>
              <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80">
                {(['ALL', ...HR_SECTIONS] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setStatusSection(sec)}
                    className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                      statusSection === sec
                        ? 'bg-white dark:bg-[#1A1E26] text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500'
                    }`}
                  >
                    {sec === 'ALL' ? 'Semua' : sec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
                  <th className="py-2.5 pr-3">Tanggal</th>
                  <th className="py-2.5 px-3">Karyawan &amp; Seksi</th>
                  <th className="py-2.5 px-3">Barang Diminta</th>
                  <th className="py-2.5 px-3">Keperluan</th>
                  <th className="py-2.5 pl-3 text-right">Status Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      Belum ada riwayat permintaan untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                      <td className="py-3 pr-3 whitespace-nowrap font-mono-num text-neutral-600 dark:text-neutral-400">
                        {formatDateIndo(req.requestDate)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {req.requesterName}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {req.requesterSection}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-neutral-700 dark:text-neutral-300">
                        {req.items.map((it) => `${it.itemName} (${it.qty} ${it.uom})`).join(', ')}
                      </td>
                      <td className="py-3 px-3 text-neutral-500 max-w-xs">
                        <div className="truncate" title={req.note}>
                          {req.note}
                        </div>
                        {req.status === 'DITOLAK' && req.rejectionNote && (
                          <div className="text-[11px] text-red-600 mt-0.5">
                            Alasan: {req.rejectionNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        {req.status === 'MENUNGGU' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                            <Clock className="w-3.5 h-3.5" />
                            Menunggu Approval
                          </span>
                        )}
                        {req.status === 'DISETUJUI' && (
                          <div className="inline-flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Disetujui
                            </span>
                            {req.processedByName && (
                              <span className="text-[10px] text-neutral-400">
                                oleh {req.processedByName}
                              </span>
                            )}
                          </div>
                        )}
                        {req.status === 'DITOLAK' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                            <XCircle className="w-3.5 h-3.5" />
                            Ditolak
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};
