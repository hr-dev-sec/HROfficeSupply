import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { HR_SECTIONS, type HrEmployee, type HrSection, type SupplyType } from '../types';
import { formatDateIndo, formatDateTimeIndo } from '../utils/format';

type ActiveTab = 'APPROVAL' | 'EMPLOYEES';

interface WalkinLine {
  itemId: string;
  itemName: string;
  jenis: SupplyType;
  uom: string;
  qty: number;
}

export const RequestsPage: React.FC = () => {
  const { user, canEditOperational, canApproveSM } = useAuth();
  const {
    store,
    upsertEmployee,
    deleteEmployee,
    importEmployeesBatch,
    createItemRequest,
    processItemRequest,
  } = useSupplyHub();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canManage = canEditOperational || canApproveSM;

  const [activeTab, setActiveTab] = useState<ActiveTab>('APPROVAL');

  // Approval Queue filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK'>('ALL');
  const [sectionFilter, setSectionFilter] = useState<'ALL' | HrSection>('ALL');
  const [reqSearch, setReqSearch] = useState('');

  // Rejection modal state
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Walk-in / Admin Input Request modal
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinEmpId, setWalkinEmpId] = useState('');
  const [walkinItemId, setWalkinItemId] = useState('');
  const [walkinQty, setWalkinQty] = useState(1);
  const [walkinLines, setWalkinLines] = useState<WalkinLine[]>([]);
  const [walkinNote, setWalkinNote] = useState('');
  const [walkinAutoApprove, setWalkinAutoApprove] = useState(true);

  // Employee DB filters & modal
  const [empSearch, setEmpSearch] = useState('');
  const [empSectionFilter, setEmpSectionFilter] = useState<'ALL' | HrSection>('ALL');
  const [empModal, setEmpModal] = useState<{
    id?: string;
    nik: string;
    name: string;
    section: HrSection;
    jabatan: string;
    active: boolean;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const employees = store.employees || [];
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [employees]
  );

  const itemMap = useMemo(() => {
    const map = new Map<string, (typeof store.items)[number]>();
    for (const it of store.items) map.set(it.id, it);
    return map;
  }, [store.items]);

  const stats = useMemo(() => {
    const menunggu = store.itemRequests.filter((r) => r.status === 'MENUNGGU').length;
    const disetujui = store.itemRequests.filter((r) => r.status === 'DISETUJUI').length;
    const ditolak = store.itemRequests.filter((r) => r.status === 'DITOLAK').length;
    const hrDevCount = activeEmployees.filter((e) => e.section === 'HR Development').length;
    const admOpCount = activeEmployees.filter((e) => e.section === 'Administration & Operation').length;
    return { menunggu, disetujui, ditolak, hrDevCount, admOpCount };
  }, [activeEmployees, store.itemRequests]);

  const filteredRequests = useMemo(() => {
    const q = reqSearch.trim().toLowerCase();
    return store.itemRequests.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (sectionFilter !== 'ALL' && r.requesterSection !== sectionFilter) return false;
      if (!q) return true;
      return (
        r.requesterName.toLowerCase().includes(q) ||
        (r.requesterNik || '').toLowerCase().includes(q) ||
        r.requesterSection.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.items.some((it) => it.itemName.toLowerCase().includes(q))
      );
    });
  }, [reqSearch, sectionFilter, statusFilter, store.itemRequests]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return [...employees]
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
      .filter((e) => {
        if (empSectionFilter !== 'ALL' && e.section !== empSectionFilter) return false;
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.nik.toLowerCase().includes(q) ||
          e.jabatan.toLowerCase().includes(q) ||
          e.section.toLowerCase().includes(q)
        );
      });
  }, [empSearch, empSectionFilter, employees]);

  const handleCopyPortalLink = async () => {
    const url = `${window.location.origin}/pengambilan`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Tautan Form Pengambilan disalin', 'success', url);
    } catch {
      toast('Tautan Form Pengambilan', 'info', url);
    }
  };

  const handleApproveRequest = (reqId: string) => {
    if (!user) return;
    const res = processItemRequest(reqId, true, user);
    if (!res.ok) {
      toast('Gagal menyetujui pengambilan', 'error', res.error);
      return;
    }
    toast('Permintaan disetujui & stok otomatis tercatat Pakai', 'success');
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectTargetId) return;
    const res = processItemRequest(rejectTargetId, false, user, rejectReason);
    if (!res.ok) {
      toast('Gagal menolak permintaan', 'error', res.error);
      return;
    }
    setRejectTargetId(null);
    setRejectReason('');
    toast('Permintaan ditolak', 'warning');
  };

  // Walk-in handlers
  const openWalkinModal = () => {
    const firstEmp = activeEmployees[0]?.id || '';
    const firstItem = store.items.find((i) => !i.archived && i.currentStock > 0)?.id || '';
    setWalkinEmpId(firstEmp);
    setWalkinItemId(firstItem);
    setWalkinQty(1);
    setWalkinLines([]);
    setWalkinNote('');
    setWalkinAutoApprove(true);
    setShowWalkinModal(true);
  };

  const handleAddWalkinLine = () => {
    const item = store.items.find((i) => i.id === walkinItemId);
    if (!item) return;
    if (item.currentStock <= 0) {
      toast('Stok barang habis', 'warning');
      return;
    }
    setWalkinLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id
            ? { ...l, qty: Math.min(item.currentStock, l.qty + Math.max(1, walkinQty)) }
            : l
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.itemName,
          jenis: item.jenis,
          uom: item.uom,
          qty: Math.min(item.currentStock, Math.max(1, walkinQty)),
        },
      ];
    });
    setWalkinQty(1);
  };

  const handleSubmitWalkin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const emp = activeEmployees.find((em) => em.id === walkinEmpId);
    if (!emp) {
      toast('Pilih karyawan Dept. HR terlebih dahulu', 'warning');
      return;
    }
    let finalLines = [...walkinLines];
    if (finalLines.length === 0 && walkinItemId) {
      const item = store.items.find((i) => i.id === walkinItemId);
      if (item && item.currentStock > 0) {
        finalLines = [
          {
            itemId: item.id,
            itemName: item.itemName,
            jenis: item.jenis,
            uom: item.uom,
            qty: Math.min(item.currentStock, Math.max(1, walkinQty)),
          },
        ];
      }
    }
    if (finalLines.length === 0) {
      toast('Tambahkan minimal 1 barang', 'warning');
      return;
    }

    const created = createItemRequest(
      {
        employeeId: emp.id,
        requesterNik: emp.nik || undefined,
        requesterName: emp.name,
        requesterSection: emp.section,
        requestDate: new Date().toISOString().slice(0, 10),
        source: 'ADMIN',
        items: finalLines,
        note: walkinNote.trim() || `Pengambilan langsung ${emp.section}`,
      },
      user
    );

    if (walkinAutoApprove) {
      const res = processItemRequest(created.id, true, user);
      if (!res.ok) {
        toast('Permintaan tersimpan, tetapi gagal auto-approve', 'warning', res.error);
      } else {
        toast('Pengambilan dicatat & langsung disetujui', 'success');
      }
    } else {
      toast('Permintaan pengambilan berhasil ditambahkan ke antrean', 'success');
    }
    setShowWalkinModal(false);
  };

  // Employee CRUD & Excel Import handlers
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !empModal) return;
    const res = upsertEmployee(empModal, user);
    if (!res.ok) {
      toast('Gagal menyimpan data karyawan', 'error', res.error);
      return;
    }
    toast(empModal.id ? 'Data karyawan diperbarui' : 'Karyawan baru ditambahkan', 'success');
    setEmpModal(null);
  };

  const handleDownloadEmployeeTemplate = () => {
    const sampleRows = [
      {
        NIK: 'HR-010',
        'Nama Lengkap': 'Contoh Nama Karyawan 1',
        Seksi: 'HR Development',
        Jabatan: 'Staff HR Development',
      },
      {
        NIK: 'HR-011',
        'Nama Lengkap': 'Contoh Nama Karyawan 2',
        Seksi: 'Administration & Operation',
        Jabatan: 'Staff HR Adm. & Operation',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Karyawan HR');
    XLSX.writeFile(wb, 'Template_Database_Karyawan_HR.xlsx');
    toast('Template Excel Karyawan HR berhasil diunduh', 'success');
  };

  const handleImportEmployeesFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const parsed: Array<{ nik: string; name: string; section: HrSection; jabatan: string }> = [];
      for (const row of rawRows) {
        const entries = Object.entries(row);
        const getVal = (keys: string[]) => {
          const found = entries.find(([k]) =>
            keys.some((target) => k.trim().toLowerCase().includes(target))
          );
          return found ? String(found[1] ?? '').trim() : '';
        };

        const name = getVal(['nama', 'name', 'karyawan', 'employee']);
        if (!name) continue;
        const nik = getVal(['nik', 'npk', 'id karyawan', 'badge']);
        const secRaw = getVal(['seksi', 'section', 'unit']);
        const section: HrSection = /dev/i.test(secRaw)
          ? 'HR Development'
          : 'Administration & Operation';
        const jabatan = getVal(['jabatan', 'posisi', 'title', 'role']);
        parsed.push({ nik, name, section, jabatan });
      }

      if (parsed.length === 0) {
        toast('Tidak ada baris valid', 'warning', 'Pastikan file memiliki kolom Nama Lengkap, NIK, Seksi, dan Jabatan.');
        return;
      }

      const res = importEmployeesBatch(parsed, user);
      toast(
        'Import Database Karyawan HR selesai',
        'success',
        `${res.added} karyawan baru ditambahkan, ${res.updated} data diperbarui.`
      );
    } catch {
      toast('Gagal membaca file Excel/CSV', 'error', 'Pastikan format file .xlsx, .xls, atau .csv valid.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">
            Pengambilan Barang &amp; Approval Karyawan HR
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Kelola persetujuan pengambilan Office Supplies &amp; Overhead Goods untuk Seksi HR Development dan Administration &amp; Operation. Stok otomatis terpotong setelah disetujui.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPortalLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Salin Link Form Depan
          </button>
          <button
            type="button"
            onClick={() => navigate('/pengambilan')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka Form Karyawan
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/forecast')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C9A24B]/50 bg-[#C9A24B]/10 hover:bg-[#C9A24B]/20 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <CalendarRange className="w-3.5 h-3.5 text-[#C9A24B]" />
            Rolling Forecast GA
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Menunggu Approval</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1 text-amber-600">
            {stats.menunggu}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Perlu persetujuan PIC / Admin</div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Disetujui &amp; Tercatat</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1 text-emerald-600">
            {stats.disetujui}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Otomatis masuk transaksi Pakai</div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Ditolak</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1 text-red-600">
            {stats.ditolak}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Stok tidak berkurang</div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Karyawan HR Terdaftar</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1">
            {activeEmployees.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 font-mono-num">
            HR Dev: {stats.hrDevCount} · Adm &amp; Ops: {stats.admOpCount}
          </div>
        </div>
      </div>

      {/* Main Segmented Tab Control + Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 text-xs w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('APPROVAL')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'APPROVAL'
                ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Antrean Approval ({stats.menunggu})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EMPLOYEES')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'EMPLOYEES'
                ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Database Karyawan HR ({employees.length})
          </button>
        </div>

        {activeTab === 'APPROVAL' && canManage && (
          <button
            type="button"
            onClick={openWalkinModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold transition whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Catat Pengambilan Langsung
          </button>
        )}

        {activeTab === 'EMPLOYEES' && canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportEmployeesFile}
            />
            <button
              type="button"
              onClick={handleDownloadEmployeeTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Template Excel
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] text-xs font-semibold transition whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Excel / CSV
            </button>
            <button
              type="button"
              onClick={() =>
                setEmpModal({
                  nik: '',
                  name: '',
                  section: 'HR Development',
                  jabatan: '',
                  active: true,
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold transition whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Tambah Karyawan
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: ANTREAN APPROVAL & PENGAMBILAN */}
      {activeTab === 'APPROVAL' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-wrap items-center gap-3 text-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
                placeholder="Cari nama karyawan, NIK, barang, atau keperluan..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
              />
            </div>

            <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'MENUNGGU', label: 'Menunggu' },
                  { id: 'DISETUJUI', label: 'Disetujui' },
                  { id: 'DITOLAK', label: 'Ditolak' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as 'ALL' | HrSection)}
              className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-semibold"
            >
              <option value="ALL">Semua Seksi HR</option>
              {HR_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Request List */}
          {filteredRequests.length === 0 ? (
            <div className="p-10 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] text-center text-xs text-neutral-500">
              Tidak ada permintaan pengambilan barang yang sesuai dengan filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const stockIssues =
                  req.status === 'MENUNGGU'
                    ? req.items.filter((it) => {
                        const live = itemMap.get(it.itemId);
                        return !live || live.currentStock < it.qty;
                      })
                    : [];

                return (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-bold text-sm text-neutral-900 dark:text-white">
                          {req.requesterName}
                        </span>
                        {req.requesterNik && (
                          <span className="font-mono-num text-neutral-500">· {req.requesterNik}</span>
                        )}
                        <span className="text-neutral-500">· {req.requesterSection}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="text-neutral-500">
                          {req.source === 'ADMIN' ? 'Input Admin' : 'Form Depan Karyawan'}
                        </span>
                      </div>

                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200/70 dark:border-neutral-800 rounded-xl overflow-hidden">
                        {req.items.map((it, idx) => {
                          const live = itemMap.get(it.itemId);
                          const insufficient =
                            req.status === 'MENUNGGU' && (!live || live.currentStock < it.qty);
                          return (
                            <div
                              key={`${req.id}-${it.itemId}-${idx}`}
                              className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 bg-neutral-50/50 dark:bg-[#0F1114]/50"
                            >
                              <div className="font-medium text-neutral-800 dark:text-neutral-200">
                                {it.itemName}
                                <span className="text-neutral-400 text-[11px] ml-1.5">
                                  ({live?.jenis === 'OVERHEAD_GOODS' || it.jenis === 'OVERHEAD_GOODS'
                                    ? 'Overhead Goods'
                                    : 'Office Supplies'})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 font-mono-num">
                                <span className="font-bold text-neutral-900 dark:text-white">
                                  Diminta: {it.qty} {it.uom}
                                </span>
                                {req.status === 'MENUNGGU' && live && (
                                  <span
                                    className={
                                      insufficient
                                        ? 'text-red-600 font-semibold'
                                        : 'text-neutral-500'
                                    }
                                  >
                                    Stok saat ini: {live.currentStock} {live.uom}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono-num">{formatDateIndo(req.requestDate)}</span>
                        <span>·</span>
                        <span>Keperluan: {req.note}</span>
                        {req.processedByName && req.processedAt && (
                          <>
                            <span>·</span>
                            <span>
                              Diproses {req.processedByName} ({formatDateTimeIndo(req.processedAt)})
                            </span>
                          </>
                        )}
                      </div>

                      {req.status === 'DITOLAK' && req.rejectionNote && (
                        <div className="text-[11px] text-red-600 font-medium">
                          Alasan Penolakan: {req.rejectionNote}
                        </div>
                      )}

                      {stockIssues.length > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Stok saat ini tidak mencukupi untuk {stockIssues.length} item di atas.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'MENUNGGU' && canManage && user ? (
                        <>
                          <button
                            type="button"
                            disabled={stockIssues.length > 0}
                            onClick={() => handleApproveRequest(req.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold transition cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Setujui &amp; Catat Pakai
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectTargetId(req.id);
                              setRejectReason('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold transition cursor-pointer whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        </>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold ${
                            req.status === 'DISETUJUI'
                              ? 'text-emerald-600'
                              : req.status === 'DITOLAK'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {req.status === 'MENUNGGU' && <Clock className="w-3.5 h-3.5" />}
                          {req.status === 'DISETUJUI' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {req.status === 'DITOLAK' && <XCircle className="w-3.5 h-3.5" />}
                          {req.status === 'MENUNGGU'
                            ? 'Menunggu Approval'
                            : req.status === 'DISETUJUI'
                            ? 'Disetujui'
                            : 'Ditolak'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DATABASE KARYAWAN DEPT. HR */}
      {activeTab === 'EMPLOYEES' && (
        <div className="p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Database Karyawan Departemen Human Resources</h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Daftar karyawan aktif di bawah ini otomatis muncul pada <strong>Form Pengambilan Karyawan</strong> di halaman depan sebelum login. Jika kolom NIK diisi, karyawan wajib memverifikasi NIK-nya saat mengambil barang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Cari nama karyawan, NIK, atau jabatan..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
              />
            </div>

            <div className="inline-flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
              {(['ALL', ...HR_SECTIONS] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setEmpSectionFilter(sec)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                    empSectionFilter === sec
                      ? 'bg-white dark:bg-[#171A1F] text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500'
                  }`}
                >
                  {sec === 'ALL' ? 'Semua Seksi' : sec}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
                  <th className="py-2.5 pr-3">NIK</th>
                  <th className="py-2.5 px-3">Nama Lengkap</th>
                  <th className="py-2.5 px-3">Seksi</th>
                  <th className="py-2.5 px-3">Jabatan</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  {canManage && <th className="py-2.5 pl-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-neutral-500">
                      Belum ada data karyawan yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp: HrEmployee) => (
                    <tr
                      key={emp.id}
                      className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 ${
                        !emp.active ? 'opacity-55' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-mono-num font-semibold text-neutral-700 dark:text-neutral-300">
                        {emp.nik || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">
                        {emp.name}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                        {emp.section}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">{emp.jabatan || '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        {canManage && user ? (
                          <button
                            type="button"
                            onClick={() => {
                              upsertEmployee({ ...emp, active: !emp.active }, user);
                              toast(
                                `${emp.name} ${!emp.active ? 'diaktifkan' : 'dinonaktifkan'}`,
                                'success'
                              );
                            }}
                            className={`font-semibold cursor-pointer ${
                              emp.active ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {emp.active ? 'Aktif' : 'Nonaktif'}
                          </button>
                        ) : (
                          <span className={emp.active ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {emp.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        )}
                      </td>
                      {canManage && user && (
                        <td className="py-2.5 pl-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEmpModal({
                                  id: emp.id,
                                  nik: emp.nik,
                                  name: emp.name,
                                  section: emp.section,
                                  jabatan: emp.jabatan,
                                  active: emp.active,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-[#E60012] hover:text-[#E60012] font-semibold transition cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                deleteEmployee(emp.id, user);
                                toast(`${emp.name} dihapus dari database karyawan HR`, 'info');
                              }}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-red-400 hover:text-red-600 transition cursor-pointer"
                              title="Hapus karyawan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tolak Permintaan dengan Alasan */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmReject}
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Tolak Permintaan Pengambilan</h3>
              <button
                type="button"
                onClick={() => setRejectTargetId(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-semibold mb-1.5">Alasan Penolakan (opsional)</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Stok sedang dialokasikan untuk jadwal training minggu ini..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTargetId(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Catat Pengambilan Langsung (Admin) */}
      {showWalkinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSubmitWalkin}
            className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Catat Pengambilan Barang Karyawan HR</h3>
                <p className="text-[11px] text-neutral-500">
                  Input pengambilan langsung oleh PIC / Admin atas nama karyawan Dept. HR.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkinModal(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-semibold mb-1">Pilih Karyawan Dept. HR *</label>
              <select
                required
                value={walkinEmpId}
                onChange={(e) => setWalkinEmpId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              >
                <option value="">-- Pilih Karyawan --</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.nik ? `(${emp.nik})` : ''} — {emp.section}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold">Tambah Barang (Office Supplies / Overhead Goods)</label>
              <div className="flex gap-2">
                <select
                  value={walkinItemId}
                  onChange={(e) => setWalkinItemId(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {store.items
                    .filter((i) => !i.archived && i.currentStock > 0)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.itemName} (Stok: {it.currentStock} {it.uom})
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={walkinQty}
                  onChange={(e) => setWalkinQty(Math.max(1, Number(e.target.value)))}
                  className="w-20 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
                />
                <button
                  type="button"
                  onClick={handleAddWalkinLine}
                  className="px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] font-semibold shrink-0 cursor-pointer"
                >
                  + Tambah
                </button>
              </div>

              {walkinLines.length > 0 && (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  {walkinLines.map((line) => (
                    <div key={line.itemId} className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{line.itemName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setWalkinLines((prev) =>
                              prev
                                .map((l) => (l.itemId === line.itemId ? { ...l, qty: l.qty - 1 } : l))
                                .filter((l) => l.qty > 0)
                            )
                          }
                          className="w-6 h-6 rounded border border-neutral-200 dark:border-neutral-700 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono-num font-bold w-14 text-center">
                          {line.qty} {line.uom}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setWalkinLines((prev) => prev.filter((l) => l.itemId !== line.itemId))
                          }
                          className="p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold mb-1">Keperluan</label>
              <input
                type="text"
                value={walkinNote}
                onChange={(e) => setWalkinNote(e.target.value)}
                placeholder="Contoh: Kebutuhan operasional HR"
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={walkinAutoApprove}
                onChange={(e) => setWalkinAutoApprove(e.target.checked)}
                className="rounded accent-[#E60012]"
              />
              <span className="font-medium">
                Langsung setujui &amp; potong stok (catat transaksi Pakai sekarang)
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWalkinModal(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white font-semibold cursor-pointer"
              >
                Simpan Pengambilan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tambah / Edit Karyawan HR */}
      {empModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEmployee}
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {empModal.id ? 'Edit Data Karyawan HR' : 'Tambah Karyawan Dept. HR'}
              </h3>
              <button
                type="button"
                onClick={() => setEmpModal(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={empModal.name}
                  onChange={(e) => setEmpModal({ ...empModal, name: e.target.value })}
                  placeholder="Contoh: Rina Kusuma Dewi"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  NIK Karyawan <span className="font-normal text-neutral-400">(untuk verifikasi form depan)</span>
                </label>
                <input
                  type="text"
                  value={empModal.nik}
                  onChange={(e) => setEmpModal({ ...empModal, nik: e.target.value })}
                  placeholder="Contoh: HR-007 atau 20240123"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Seksi Departemen HR *</label>
                <select
                  value={empModal.section}
                  onChange={(e) => setEmpModal({ ...empModal, section: e.target.value as HrSection })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {HR_SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Jabatan / Posisi</label>
                <input
                  type="text"
                  value={empModal.jabatan}
                  onChange={(e) => setEmpModal({ ...empModal, jabatan: e.target.value })}
                  placeholder="Contoh: Staff HR Development"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={empModal.active}
                  onChange={(e) => setEmpModal({ ...empModal, active: e.target.checked })}
                  className="rounded accent-[#E60012]"
                />
                <span className="font-medium">
                  Aktif (tampil di pilihan Form Pengambilan Karyawan)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmpModal(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white font-semibold cursor-pointer"
              >
                Simpan Data
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
