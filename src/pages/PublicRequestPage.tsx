import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { AppearanceControls } from '../components/common/AppearanceControls';
import { AjiuLogoBadge, AjinomotoLogoTile, HseLogoBadge } from '../components/common/BrandEmblems';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { activePreset } = useTheme();
  const { tr, language } = useLanguage();
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
      toast(tr('Pilih nama karyawan terlebih dahulu', 'Please select an employee first'), 'warning');
      return;
    }
    if (requiresNikVerification && !isNikVerified) {
      toast(
        tr('Verifikasi NIK tidak sesuai', 'NIK verification mismatch'),
        'error',
        tr(
          'Pastikan NIK sesuai dengan data karyawan yang dipilih.',
          'Make sure the NIK matches the selected employee record.'
        )
      );
      return;
    }
    if (cart.length === 0) {
      toast(tr('Pilih minimal 1 barang', 'Select at least 1 item'), 'warning');
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
      note:
        note.trim() ||
        tr(
          `Pengambilan kebutuhan ${selectedEmployee.section}`,
          `Supply request for ${selectedEmployee.section}`
        ),
    });

    setSubmittedRequest(created);
    setCart([]);
    setNote('');
    setNikInput('');
    toast(
      tr('Permintaan pengambilan berhasil dikirim', 'Supply request submitted'),
      'success',
      tr('Menunggu persetujuan PIC / Admin HR.', 'Awaiting HR PIC / Admin approval.')
    );
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
    <div className="min-h-screen flex flex-col bg-theme-canvas text-[#1A1D21] dark:text-[#F4F5F7] transition-colors duration-300">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 px-3 sm:px-6 lg:px-10 pt-3">
        <div
          className="w-full max-w-[1440px] mx-auto rounded-2xl border bg-white/88 dark:bg-[#12151B]/90 backdrop-blur-2xl shadow-[0_10px_32px_-14px_rgba(24,26,32,0.14)]"
          style={{ borderColor: `rgba(var(--brand-accent-rgb), 0.28)` }}
        >
          <div
            className="h-[2px] w-full rounded-t-2xl opacity-85"
            style={{
              background: `linear-gradient(to right, ${activePreset.primary}, ${activePreset.accent}, transparent)`,
            }}
          />
          <div className="px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 whitespace-nowrap shrink-0">
              <AjinomotoLogoTile size="sm" />
              <span className="font-display font-extrabold text-[16px] tracking-tight">
                HR SupplyHub
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              <Link to="/" className="hover:text-theme-primary transition-colors whitespace-nowrap shrink-0">
                {tr('Beranda', 'Home')}
              </Link>
              <a href="#form-pengambilan" className="text-theme-primary whitespace-nowrap shrink-0">
                {tr('Form Pengambilan', 'Request Form')}
              </a>
              <a href="#pantau-status" className="hover:text-theme-primary transition-colors whitespace-nowrap shrink-0">
                {tr('Pantau Status', 'Track Status')}
              </a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="hidden md:flex items-center gap-2 pr-1">
                <AjiuLogoBadge size="sm" />
                <HseLogoBadge size="sm" />
              </div>
              <AppearanceControls compact />
              <button
                type="button"
                onClick={() => navigate(user ? '/app/requests' : '/login')}
                className="px-4 py-2 rounded-xl bg-theme-primary text-white text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {user ? tr('Buka Dashboard', 'Open Dashboard') : tr('Masuk Admin', 'Admin Sign In')}
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-theme-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {tr('Kembali ke Beranda', 'Back to Home')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">
              {tr(
                'Form Pengambilan Office Supplies & Overhead Goods',
                'Office Supplies & Overhead Goods Request Form'
              )}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              {tr(
                'Departemen Human Resources · Seksi HR Development & Administration & Operation · PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
                'Human Resources Department · HR Development & Administration & Operation Sections · PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory'
              )}
            </p>
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 md:text-right">
            <div className="font-semibold text-neutral-800 dark:text-neutral-200">
              {tr('Alur Pengambilan Barang', 'Supply Request Flow')}
            </div>
            <div>
              {tr(
                '1. Pilih Nama & Verifikasi NIK · 2. Pilih Barang · 3. Approval PIC HR',
                '1. Select Name & Verify NIK · 2. Pick Items · 3. HR PIC Approval'
              )}
            </div>
          </div>
        </div>

        {/* Receipt Banner after successful submit */}
        {submittedRequest && (
          <div className="p-5 sm:p-6 rounded-2xl border border-emerald-300/80 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {tr('Permintaan Pengambilan Berhasil Dikirim', 'Supply Request Submitted Successfully')}
              </div>
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                {tr('Pemohon:', 'Requester:')} <strong>{submittedRequest.requesterName}</strong>
                {submittedRequest.requesterNik ? ` (${submittedRequest.requesterNik})` : ''} ·{' '}
                {submittedRequest.requesterSection} ·{' '}
                <span className="font-mono-num">
                  {submittedRequest.items.length} {tr('jenis barang', 'item types')} (
                  {submittedRequest.items.reduce((s, it) => s + it.qty, 0)} {tr('unit', 'units')})
                </span>
              </p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                {tr('Status saat ini:', 'Current status:')}{' '}
                <strong>{tr('Menunggu Approval PIC / Admin HR', 'Awaiting HR PIC / Admin Approval')}</strong>.{' '}
                {tr(
                  'Stok akan otomatis tercatat setelah disetujui oleh PIC.',
                  'Stock will be deducted automatically once approved by the PIC.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubmittedRequest(null)}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tr('Buat Pengambilan Baru', 'Create New Request')}
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
                    <UserCheck className="w-4 h-4 text-theme-primary" />
                    {tr('01. Identitas Karyawan Departemen HR', '01. HR Department Employee Identity')}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {tr(
                      'Pilih nama Anda dari database karyawan Departemen HR lalu konfirmasi NIK.',
                      'Select your name from the HR employee directory and confirm your NIK.'
                    )}
                  </p>
                </div>
                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmpId('');
                      setNikInput('');
                    }}
                    className="text-xs font-semibold text-theme-primary hover:underline cursor-pointer"
                  >
                    {tr('Ganti Karyawan', 'Change Employee')}
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
                        placeholder={tr('Ketik nama karyawan atau jabatan...', 'Type employee name or role...')}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] text-xs focus:outline-none focus:border-theme-primary"
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
                          {sec === 'ALL' ? tr('Semua Seksi', 'All Sections') : sec}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                      {tr(
                        'Nama karyawan tidak ditemukan. Hubungi Admin HR untuk mendaftarkan nama Anda di Database Karyawan HR.',
                        'Employee not found. Contact HR Admin to register your name in the HR Employee Directory.'
                      )}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 rounded-xl">
                      {filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className="w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03] flex items-center justify-between gap-3 transition cursor-pointer"
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
                          <span className="text-xs font-semibold text-theme-primary shrink-0">
                            {tr('Pilih', 'Select')}
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
                        {tr('Seksi:', 'Section:')}{' '}
                        <strong className="text-neutral-800 dark:text-neutral-200">
                          {selectedEmployee.section}
                        </strong>
                        {selectedEmployee.jabatan ? ` · ${selectedEmployee.jabatan}` : ''}
                      </div>
                    </div>
                    {isNikVerified && (
                      <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        {tr('Identitas Terverifikasi', 'Identity Verified')}
                      </div>
                    )}
                  </div>

                  {requiresNikVerification && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold">
                        {tr('Verifikasi NIK Karyawan *', 'Employee NIK Verification *')}
                      </label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <input
                          type="text"
                          value={nikInput}
                          onChange={(e) => setNikInput(e.target.value)}
                          placeholder={tr(
                            'Masukkan NIK Anda sesuai data HR...',
                            'Enter your NIK as recorded in HR...'
                          )}
                          autoComplete="off"
                          className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs font-mono-num uppercase focus:outline-none ${
                            nikInput.trim().length === 0
                              ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] focus:border-theme-primary'
                              : isNikVerified
                              ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                              : 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                          }`}
                        />
                        <span className="text-[11px] text-neutral-500 shrink-0">
                          {nikInput.trim().length === 0
                            ? tr(
                                'Diperlukan untuk mencegah salah pilih nama',
                                'Required to prevent selecting the wrong employee'
                              )
                            : isNikVerified
                            ? tr('NIK cocok', 'NIK matched')
                            : tr('NIK tidak sesuai dengan nama terpilih', 'NIK does not match selected name')}
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
                    <Package className="w-4 h-4 text-theme-primary" />
                    {tr('02. Pilih Barang yang Akan Diambil', '02. Select Supplies to Request')}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {tr(
                      'Tersedia Office Supplies & Overhead Goods. Anda dapat menambahkan lebih dari satu item.',
                      'Includes Office Supplies & Overhead Goods. You can add multiple items.'
                    )}
                  </p>
                </div>
                <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-xs shrink-0">
                  {(
                    [
                      { id: 'ALL', label: tr('Semua', 'All') },
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
                  placeholder={tr(
                    'Cari nama barang, kategori, atau kode item...',
                    'Search item name, category, or item code...'
                  )}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] text-xs focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div className="max-h-[440px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200/80 dark:border-neutral-800 rounded-xl">
                {catalogItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-neutral-500">
                    {tr(
                      'Tidak ada barang yang cocok dengan pencarian Anda.',
                      'No items match your search.'
                    )}
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
                              {outOfStock ? tr('Stok Habis', 'Out of Stock') : `${it.currentStock} ${it.uom}`}
                            </div>
                            {!outOfStock && (
                              <div className="text-[10px] text-neutral-400">
                                {tr('Tersedia', 'Available')}
                              </div>
                            )}
                          </div>

                          {inCartQty > 0 ? (
                            <div
                              className="inline-flex items-center gap-1 rounded-xl border p-0.5"
                              style={{
                                borderColor: 'rgba(var(--brand-primary-rgb), 0.4)',
                                backgroundColor: 'rgba(var(--brand-primary-rgb), 0.06)',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => updateCartQty(it.id, inCartQty - 1)}
                                className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer"
                                aria-label={tr('Kurangi jumlah', 'Decrease quantity')}
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
                                aria-label={tr('Tambah jumlah', 'Increase quantity')}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={outOfStock}
                              onClick={() => addToCart(it.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-theme-primary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer whitespace-nowrap"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {tr('Tambah', 'Add')}
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
                  <ShoppingBag className="w-4 h-4 text-theme-primary" />
                  {tr('03. Ringkasan Pengambilan', '03. Request Summary')}
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5 font-mono-num">
                  {cart.length} {tr('jenis barang', 'item types')} · {totalUnits}{' '}
                  {tr('total unit', 'total units')}
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-neutral-500 hover:text-red-600 cursor-pointer"
                >
                  {tr('Kosongkan', 'Clear')}
                </button>
              )}
            </div>

            {/* Selected employee summary */}
            <div className="text-xs space-y-1 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="text-[11px] font-semibold text-neutral-500">
                {tr('Pemohon', 'Requester')}
              </div>
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
                    {isNikVerified
                      ? tr('NIK Terverifikasi', 'NIK Verified')
                      : tr('Belum Verifikasi NIK', 'NIK Pending')}
                  </span>
                </div>
              ) : (
                <div className="text-neutral-400">
                  {tr('Belum memilih nama karyawan di Langkah 01', 'No employee selected in Step 01')}
                </div>
              )}
            </div>

            {/* Cart items */}
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                {tr('Keranjang masih kosong. Klik', 'Cart is empty. Click')}{' '}
                <strong>+ {tr('Tambah', 'Add')}</strong>{' '}
                {tr('pada daftar barang di samping.', 'on the item list beside.')}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {cart.map((line) => (
                  <div key={line.itemId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{line.itemName}</div>
                      <div className="text-[11px] text-neutral-500 font-mono-num">
                        {line.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'} ·{' '}
                        {tr('Maks', 'Max')} {line.maxStock} {line.uom}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(line.itemId, line.qty - 1)}
                        className="w-7 h-7 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center hover:border-theme-primary cursor-pointer"
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
                        className="w-7 h-7 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40 flex items-center justify-center hover:border-theme-primary cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.itemId)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 cursor-pointer"
                        aria-label={tr('Hapus item', 'Remove item')}
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
              <label className="block font-semibold">
                {tr('Keperluan / Catatan', 'Purpose / Notes')}
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr(
                  'Contoh: Keperluan training karyawan baru / operasional meja HR...',
                  'e.g., New hire training / HR desk operations...'
                )}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] focus:outline-none focus:border-theme-primary"
              />
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${activePreset.primary}, ${activePreset.primaryHover})`,
                  boxShadow: `0 12px 28px -10px rgba(var(--brand-primary-rgb), 0.52)`,
                }}
              >
                <ClipboardCheck className="w-4 h-4" />
                {tr('Kirim Permintaan Pengambilan', 'Submit Supply Request')}
              </button>
              <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
                {tr(
                  'Permintaan akan masuk ke antrean PIC / Admin HR. Stok baru terpotong setelah PIC mengklik Setujui.',
                  'Your request enters the HR PIC / Admin queue. Stock is only deducted after PIC approval.'
                )}
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
                {tr(
                  'Pantau Status Pengambilan Karyawan Dept. HR',
                  'Track HR Employee Request Status'
                )}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {tr(
                  'Cek apakah permintaan Anda masih menunggu persetujuan PIC, sudah disetujui, atau ditolak.',
                  'Check whether your request is pending PIC review, approved, or rejected.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={statusSearch}
                  onChange={(e) => setStatusSearch(e.target.value)}
                  placeholder={tr('Cari nama karyawan / barang...', 'Search employee / item...')}
                  className="pl-8 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] w-56 focus:outline-none focus:border-theme-primary"
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
                    {sec === 'ALL' ? tr('Semua', 'All') : sec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
                  <th className="py-2.5 pr-3">{tr('Tanggal', 'Date')}</th>
                  <th className="py-2.5 px-3">{tr('Karyawan & Seksi', 'Employee & Section')}</th>
                  <th className="py-2.5 px-3">{tr('Barang Diminta', 'Requested Items')}</th>
                  <th className="py-2.5 px-3">{tr('Keperluan', 'Purpose')}</th>
                  <th className="py-2.5 pl-3 text-right">{tr('Status Approval', 'Approval Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      {tr(
                        'Belum ada riwayat permintaan untuk filter ini.',
                        'No request history for this filter.'
                      )}
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                      <td className="py-3 pr-3 whitespace-nowrap font-mono-num text-neutral-600 dark:text-neutral-400">
                        {formatDateIndo(req.requestDate, language)}
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
                            {tr('Alasan:', 'Reason:')} {req.rejectionNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        {req.status === 'MENUNGGU' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                            <Clock className="w-3.5 h-3.5" />
                            {tr('Menunggu Approval', 'Pending Approval')}
                          </span>
                        )}
                        {req.status === 'DISETUJUI' && (
                          <div className="inline-flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {tr('Disetujui', 'Approved')}
                            </span>
                            {req.processedByName && (
                              <span className="text-[10px] text-neutral-400">
                                {tr('oleh', 'by')} {req.processedByName}
                              </span>
                            )}
                          </div>
                        )}
                        {req.status === 'DITOLAK' && (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                            <XCircle className="w-3.5 h-3.5" />
                            {tr('Ditolak', 'Rejected')}
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
