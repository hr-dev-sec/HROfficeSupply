import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DocumentPreviewModal,
  DocumentUploadModal,
  downloadSystemDocument,
  formatFileSize,
  renderDocumentIcon,
} from '../components/documents/DocumentModal';
import { RollingForecastDocument } from '../components/forecast/RollingForecastDocument';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { FORECAST_MONTH_KEYS, type ForecastMonthKey, type SystemDocument } from '../types';
import {
  exportElementsToMultiPageA3Pdf,
  exportRollingForecastToExcel,
} from '../utils/exportUtils';
import { formatDateTimeIndo } from '../utils/format';

function forecastMonthKeyToPeriod(monthKey: ForecastMonthKey): string {
  const map: Record<ForecastMonthKey, string> = {
    'Apr-26': '2026-04',
    'May-26': '2026-05',
    'Jun-26': '2026-06',
    'Jul-26': '2026-07',
    'Aug-26': '2026-08',
    'Sep-26': '2026-09',
    'Oct-26': '2026-10',
    'Nov-26': '2026-11',
    'Dec-26': '2026-12',
    'Jan-27': '2027-01',
    'Feb-27': '2027-02',
    'Mar-27': '2027-03',
  };
  return map[monthKey] || '2026-11';
}

export const ForecastPage: React.FC = () => {
  const { user, canEditOperational, isSuperAdmin } = useAuth();
  const {
    store,
    setActiveForecastMonth,
    updateForecastRow,
    addForecastRow,
    syncForecastStockFromMaster,
    copyForecastMonth,
    prefillCriticalForecast,
    submitMonthlyForecast,
    deleteDocument,
  } = useSupplyHub();
  const { toast } = useToast();

  const rf = store.rollingForecast;
  const forecastDocs = useMemo(
    () => (store.documents || []).filter((d) => d.category === 'ROLLING_FORECAST_GA'),
    [store.documents]
  );

  const [tab, setTab] = useState<'FORM' | 'DOCUMENT' | 'CATALOG'>('FORM');
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('ALL');
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [onlyZeroStock, setOnlyZeroStock] = useState(false);

  const [exportingPdf, setExportingPdf] = useState(false);
  const docContainerRef = useRef<HTMLDivElement>(null);

  // Add item modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newRowForm, setNewRowForm] = useState({
    jenis: 'Cutter',
    codeItem: '',
    itemName: '',
    itemDescription: '',
    uom: 'PC',
    rmStock: 0,
    estPemakaian: '',
    keterangan: '',
  });

  // Submit / Log monthly update modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState('');

  // Upload & Preview GA Document modals
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<SystemDocument | null>(null);

  const activeMonth = rf.activeMonth;
  const activeMonthIdx = FORECAST_MONTH_KEYS.indexOf(activeMonth);
  const prevMonth: ForecastMonthKey | null =
    activeMonthIdx > 0 ? FORECAST_MONTH_KEYS[activeMonthIdx - 1] : null;

  const uniqueJenisList = useMemo(() => {
    const seen = new Map<string, number>();
    rf.rows.forEach((r) => {
      if (!seen.has(r.jenis)) seen.set(r.jenis, r.jenisNo);
    });
    return Array.from(seen.entries())
      .map(([jenis, jenisNo]) => ({ jenis, jenisNo }))
      .sort((a, b) => a.jenisNo - b.jenisNo);
  }, [rf.rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rf.rows]
      .sort((a, b) => a.itemNo - b.itemNo)
      .filter((r) => {
        if (jenisFilter !== 'ALL' && r.jenis !== jenisFilter) return false;
        if (onlyFilled && !(r.months[activeMonth] && r.months[activeMonth]! > 0)) return false;
        if (onlyZeroStock && r.rmStock !== 0) return false;
        if (q) {
          return (
            r.itemDescription.toLowerCase().includes(q) ||
            r.itemName.toLowerCase().includes(q) ||
            r.codeItem.toLowerCase().includes(q) ||
            r.jenis.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [activeMonth, jenisFilter, onlyFilled, onlyZeroStock, rf.rows, search]);

  const stats = useMemo(() => {
    const filledRows = rf.rows.filter((r) => (r.months[activeMonth] || 0) > 0);
    const totalUnits = filledRows.reduce((s, r) => s + (r.months[activeMonth] || 0), 0);
    const zeroStockCount = rf.rows.filter((r) => r.rmStock === 0).length;
    return {
      totalCatalog: rf.rows.length,
      totalJenis: uniqueJenisList.length,
      filledCount: filledRows.length,
      totalUnits,
      zeroStockCount,
    };
  }, [activeMonth, rf.rows, uniqueJenisList.length]);

  const handleExportPdf = async () => {
    setTab('DOCUMENT');
    setExportingPdf(true);
    setTimeout(async () => {
      try {
        const container = docContainerRef.current;
        if (!container) return;
        const pageEls = Array.from(
          container.querySelectorAll<HTMLElement>('[data-rf-page]')
        );
        await exportElementsToMultiPageA3Pdf(
          pageEls,
          `RF_Office_Supplies_GA_${rf.fiscalYearLabel}_${activeMonth}.pdf`
        );
        toast('PDF Rolling Forecast berhasil diunduh', 'success', `Format A3 Landscape (${pageEls.length} halaman)`);
      } catch {
        toast('Gagal mengekspor PDF Rolling Forecast', 'error');
      } finally {
        setExportingPdf(false);
      }
    }, 150);
  };

  const handleExportExcel = () => {
    exportRollingForecastToExcel(rf);
    toast(
      'Excel Rolling Forecast berhasil diunduh',
      'success',
      `Sheet RF ${rf.fiscalYearLabel} & List Item GA (114 item)`
    );
  };

  const handleSyncStock = () => {
    if (!user) return;
    const count = syncForecastStockFromMaster(user);
    toast(
      count > 0 ? `${count} item R/M Stock diperbarui` : 'R/M Stock sudah sinkron dengan Master Item',
      'success'
    );
  };

  const handlePrefillCritical = () => {
    if (!user) return;
    const count = prefillCriticalForecast(activeMonth, user);
    toast(
      count > 0
        ? `${count} item stok kritis otomatis terisi ke forecast ${activeMonth}`
        : 'Tidak ada item Office Supplies stok kritis yang cocok di katalog GA',
      count > 0 ? 'success' : 'info'
    );
  };

  const handleCopyPrevMonth = () => {
    if (!user || !prevMonth) return;
    const count = copyForecastMonth(prevMonth, activeMonth, user);
    toast(
      count > 0
        ? `${count} baris disalin dari ${prevMonth} ke ${activeMonth}`
        : `Tidak ada isian forecast pada bulan ${prevMonth}`,
      count > 0 ? 'success' : 'info'
    );
  };

  const handleAddRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newRowForm.itemDescription.trim()) return;
    addForecastRow(
      {
        jenis: newRowForm.jenis,
        codeItem: newRowForm.codeItem,
        itemName: newRowForm.itemName || newRowForm.itemDescription,
        itemDescription: newRowForm.itemDescription,
        uom: newRowForm.uom,
        rmStock: Number(newRowForm.rmStock || 0),
        estPemakaian: newRowForm.estPemakaian,
        keterangan: newRowForm.keterangan,
      },
      user
    );
    toast('Item baru ditambahkan ke daftar Rolling Forecast', 'success');
    setAddModalOpen(false);
    setNewRowForm({
      jenis: uniqueJenisList[0]?.jenis || 'Cutter',
      codeItem: '',
      itemName: '',
      itemDescription: '',
      uom: 'PC',
      rmStock: 0,
      estPemakaian: '',
      keterangan: '',
    });
  };

  const handleConfirmSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const sub = submitMonthlyForecast(activeMonth, submitNote, user);
    setSubmitModalOpen(false);
    setSubmitNote('');
    toast(
      `Update Forecast ${sub.month} tercatat siap kirim ke GA Dept.`,
      'success',
      `${sub.totalItemsRequested} item (${sub.totalUnitsRequested} unit) — silakan ekspor PDF / Excel.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#E60012] mb-1">
            <CalendarRange className="w-3.5 h-3.5" />
            Request Office Supplies Melalui GA Dept.
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight">
            Rolling Forecast Office Supplies {rf.fiscalYearLabel}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {rf.periodRangeLabel} · {rf.department} ({rf.section}) — HR hanya melakukan update forecast pemesanan bulanan ke GA Dept.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Ekspor Excel (.xlsx)
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-[#E60012]" />
            {exportingPdf ? 'Menyiapkan PDF...' : 'Ekspor PDF (A3)'}
          </button>
          {canEditOperational && (
            <button
              type="button"
              onClick={() => setUploadDocOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:border-[#E60012] transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#E60012]" />
              Unggah Dokumen GA
            </button>
          )}
          {canEditOperational && (
            <button
              type="button"
              onClick={() => setSubmitModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Catat Update GA ({activeMonth})
            </button>
          )}
        </div>
      </div>

      {/* Arsip Dokumen Rolling Forecast GA */}
      {forecastDocs.length > 0 && (
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[#E60012]" />
              Arsip Dokumen Rolling Forecast GA ({forecastDocs.length})
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {forecastDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114]"
              >
                <button
                  type="button"
                  onClick={() => setPreviewDoc(doc)}
                  className="flex items-center gap-2 min-w-0 text-left flex-1 group"
                >
                  {renderDocumentIcon(doc, 'w-4 h-4 shrink-0')}
                  <div className="min-w-0">
                    <div className="font-semibold truncate group-hover:text-[#E60012] transition">
                      {doc.title}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono-num truncate">
                      {doc.fileName} · {formatFileSize(doc.fileSize)}
                    </div>
                  </div>
                </button>
                <div className="inline-flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    title="Pratinjau"
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-800 text-[#E60012]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSystemDocument(doc)}
                    title="Unduh"
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {(isSuperAdmin || doc.uploadedByUserId === user?.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        deleteDocument(doc.id, user);
                        toast('Dokumen Rolling Forecast dihapus', 'success');
                      }}
                      title="Hapus"
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-xs text-neutral-500">Katalog Resmi GA Dept.</div>
          <div className="text-2xl font-extrabold font-display mt-1 tabular-nums">
            {stats.totalCatalog} Item
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Terkelompok dalam {stats.totalJenis} jenis barang
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-300/80 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/20">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Bulan Aktif Update RF
          </div>
          <div className="text-2xl font-extrabold font-display text-amber-900 dark:text-amber-200 mt-1">
            {activeMonth}
          </div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
            Kolom sorotan kuning pada dokumen GA
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-xs text-neutral-500">Forecast Bulan {activeMonth}</div>
          <div className="text-2xl font-extrabold font-display text-[#E60012] mt-1 tabular-nums">
            {stats.filledCount} Item · {stats.totalUnits} Unit
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Diisi untuk periode pemesanan ini
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-xs text-neutral-500">Item R/M Stock Kosong (0)</div>
          <div className="text-2xl font-extrabold font-display mt-1 tabular-nums">
            {stats.zeroStockCount} Item
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Terakhir diperbarui oleh {rf.lastUpdatedBy}
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setTab('FORM')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'FORM' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Form Update Bulanan
          </button>
          <button
            type="button"
            onClick={() => setTab('DOCUMENT')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'DOCUMENT' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Pratinjau Dokumen RF (PDF A3)
          </button>
          <button
            type="button"
            onClick={() => setTab('CATALOG')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'CATALOG' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            List Item GA ({rf.rows.length})
          </button>
        </div>

        {/* Active Month Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-neutral-500">Pilih Bulan Update:</span>
          <select
            value={activeMonth}
            onChange={(e) => {
              if (!user) return;
              setActiveForecastMonth(e.target.value as ForecastMonthKey, user);
              toast(`Bulan aktif RF diubah ke ${e.target.value}`, 'info');
            }}
            disabled={!canEditOperational}
            className="px-3 py-1.5 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 font-bold text-xs"
          >
            {FORECAST_MONTH_KEYS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === 'FORM' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:min-w-[240px] min-w-0">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari deskripsi item, code item, atau jenis..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={jenisFilter}
                  onChange={(e) => setJenisFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="ALL">Semua Jenis ({uniqueJenisList.length})</option>
                  {uniqueJenisList.map((j) => (
                    <option key={j.jenis} value={j.jenis}>
                      {j.jenisNo}. {j.jenis}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyFilled}
                    onChange={(e) => setOnlyFilled(e.target.checked)}
                  />
                  Hanya Terisi ({activeMonth})
                </label>

                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyZeroStock}
                    onChange={(e) => setOnlyZeroStock(e.target.checked)}
                  />
                  R/M Stock = 0
                </label>
              </div>
            </div>

            {canEditOperational && (
              <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={handleSyncStock}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                  Sinkron R/M Stock dari Master Item
                </button>
                <button
                  type="button"
                  onClick={handlePrefillCritical}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Isi Otomatis dari Item Kritis ({activeMonth})
                </button>
                {prevMonth && (
                  <button
                    type="button"
                    onClick={handleCopyPrevMonth}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin Isian dari {prevMonth}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E60012]/40 text-[#E60012] hover:bg-[#E60012]/10 text-xs font-semibold transition-colors ml-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Item ke RF
                </button>
              </div>
            )}
          </div>

          {/* Interactive Rolling Forecast Table */}
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
            <div className="overflow-x-auto max-h-[680px]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                  <tr className="text-left text-neutral-600 dark:text-neutral-300">
                    <th className="p-2.5 font-semibold w-12 text-center">No.</th>
                    <th className="p-2.5 font-semibold min-w-[140px]">Jenis</th>
                    <th className="p-2.5 font-semibold w-20 text-center">Code</th>
                    <th className="p-2.5 font-semibold min-w-[230px]">item_description</th>
                    <th className="p-2.5 font-semibold w-14 text-center">UOM</th>
                    <th className="p-2.5 font-semibold w-20 text-center">R/M Stock</th>
                    <th className="p-2.5 font-bold w-24 text-center bg-[#FDE047]/70 text-black border-x border-amber-400">
                      RF {activeMonth}
                    </th>
                    <th className="p-2.5 font-semibold min-w-[190px]">Est. Pemakaian per bulan</th>
                    <th className="p-2.5 font-semibold min-w-[210px]">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {filteredRows.map((row) => {
                    const activeVal = row.months[activeMonth];
                    const hasOrder = typeof activeVal === 'number' && activeVal > 0;
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 ${
                          hasOrder ? 'bg-amber-50/40 dark:bg-amber-950/15' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center font-mono-num text-neutral-500">
                          {row.itemNo}
                        </td>
                        <td className="p-2.5">
                          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                            {row.jenisNo}. {row.jenis}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono-num text-neutral-600 dark:text-neutral-400">
                          {row.codeItem || '-'}
                        </td>
                        <td className="p-2.5 font-medium">{row.itemDescription}</td>
                        <td className="p-2.5 text-center font-mono-num">{row.uom}</td>
                        <td className="p-2 text-center">
                          {canEditOperational ? (
                            <input
                              type="number"
                              min={0}
                              value={row.rmStock === null ? '' : row.rmStock}
                              placeholder="-"
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateForecastRow(
                                  row.id,
                                  { rmStock: raw === '' ? null : Math.max(0, Number(raw)) },
                                  user || undefined
                                );
                              }}
                              className="w-16 text-center px-1.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] font-mono-num"
                            />
                          ) : (
                            <span className="font-mono-num">
                              {row.rmStock === null ? '-' : row.rmStock}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center bg-[#FEF9C3]/60 dark:bg-amber-950/25 border-x border-amber-300/60">
                          {canEditOperational ? (
                            <input
                              type="number"
                              min={0}
                              value={activeVal ?? ''}
                              placeholder="0"
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateForecastRow(
                                  row.id,
                                  {
                                    monthQty: {
                                      month: activeMonth,
                                      qty: raw === '' ? undefined : Math.max(0, Number(raw)),
                                    },
                                  },
                                  user || undefined
                                );
                              }}
                              className="w-16 text-center px-1.5 py-1 rounded-lg border border-amber-400 bg-white dark:bg-[#0F1114] font-mono-num font-bold text-[#E60012]"
                            />
                          ) : (
                            <span className="font-mono-num font-bold text-[#E60012]">
                              {hasOrder ? activeVal : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {canEditOperational ? (
                            <input
                              type="text"
                              value={row.estPemakaian}
                              placeholder="Contoh: 1 pack pemakaian per bulan"
                              onChange={(e) =>
                                updateForecastRow(
                                  row.id,
                                  { estPemakaian: e.target.value },
                                  user || undefined
                                )
                              }
                              className="w-full px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
                            />
                          ) : (
                            <span>{row.estPemakaian || '-'}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {canEditOperational ? (
                            <textarea
                              rows={1}
                              value={row.keterangan}
                              placeholder="Catatan / PIC penerima..."
                              onChange={(e) =>
                                updateForecastRow(
                                  row.id,
                                  { keterangan: e.target.value },
                                  user || undefined
                                )
                              }
                              className="w-full px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] resize-y"
                            />
                          ) : (
                            <span className="whitespace-pre-line">{row.keterangan || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
              <span>
                Menampilkan <strong>{filteredRows.length}</strong> dari {rf.rows.length} item katalog GA
              </span>
              <span>
                Semua perubahan langsung tersimpan otomatis &amp; siap diekspor ke PDF / Excel
              </span>
            </div>
          </div>

          {/* Submission History Log */}
          <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <History className="w-4 h-4 text-[#C9A24B]" />
                Riwayat Update Rolling Forecast ke GA Dept.
              </h3>
              <span className="text-[11px] text-neutral-500">
                {rf.submissions.length} catatan pengiriman
              </span>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {rf.submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Periode {sub.month} — {sub.totalItemsRequested} item ({sub.totalUnitsRequested}{' '}
                      unit)
                    </div>
                    <div className="text-neutral-500 mt-0.5">{sub.note}</div>
                  </div>
                  <div className="text-right text-[11px] text-neutral-500 font-mono-num">
                    <div>{sub.submittedByName}</div>
                    <div>{formatDateTimeIndo(sub.submittedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'DOCUMENT' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Pratinjau Dokumen Rolling Forecast resmi format GA Dept. (2 halaman A3 Landscape). Gunakan tombol Ekspor PDF (A3) atau Ekspor Excel di atas.
            </span>
          </div>
          <div ref={docContainerRef} className="overflow-x-auto pb-4">
            <RollingForecastDocument data={rf} logoUrl={store.settings.logoUrl} />
          </div>
        </div>
      )}

      {tab === 'CATALOG' && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">
                List Item Office Supplies (Request Melalui GA Dept.)
              </h3>
              <p className="text-xs text-neutral-500">
                Referensi resmi {rf.rows.length} item &amp; {uniqueJenisList.length} jenis dari katalog GA Dept.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari item atau kode..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-left">
                <tr>
                  <th className="p-3 w-16 text-center">No. urut</th>
                  <th className="p-3">Jenis</th>
                  <th className="p-3 w-14 text-center">No.</th>
                  <th className="p-3 w-24 text-center">Code Item</th>
                  <th className="p-3">Item_name</th>
                  <th className="p-3">item_description</th>
                  <th className="p-3 w-16 text-center">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                    <td className="p-2.5 text-center font-mono-num">{r.jenisNo}</td>
                    <td className="p-2.5 font-medium">{r.jenis}</td>
                    <td className="p-2.5 text-center font-mono-num">{r.itemNo}</td>
                    <td className="p-2.5 text-center font-mono-num text-[#E60012] font-semibold">
                      {r.codeItem}
                    </td>
                    <td className="p-2.5 font-semibold">{r.itemName}</td>
                    <td className="p-2.5 text-neutral-600 dark:text-neutral-300">
                      {r.itemDescription}
                    </td>
                    <td className="p-2.5 text-center font-mono-num">{r.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah Item ke RF */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={handleAddRowSubmit}
            className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold">Tambah Item ke Rolling Forecast GA</h3>
              <button type="button" onClick={() => setAddModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Jenis / Kategori</label>
                <input
                  type="text"
                  required
                  list="rf-jenis-list"
                  value={newRowForm.jenis}
                  onChange={(e) => setNewRowForm({ ...newRowForm, jenis: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
                <datalist id="rf-jenis-list">
                  {uniqueJenisList.map((j) => (
                    <option key={j.jenis} value={j.jenis} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-semibold mb-1">Code Item</label>
                <input
                  type="text"
                  value={newRowForm.codeItem}
                  onChange={(e) => setNewRowForm({ ...newRowForm, codeItem: e.target.value })}
                  placeholder="Contoh: 20355"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Deskripsi Item (item_description)</label>
                <input
                  type="text"
                  required
                  value={newRowForm.itemDescription}
                  onChange={(e) =>
                    setNewRowForm({
                      ...newRowForm,
                      itemDescription: e.target.value,
                      itemName: newRowForm.itemName || e.target.value,
                    })
                  }
                  placeholder="Contoh: Kertas A4 80gr SIDU"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">UOM</label>
                <select
                  value={newRowForm.uom}
                  onChange={(e) => setNewRowForm({ ...newRowForm, uom: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {store.masterData.uoms.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">R/M Stock Saat Ini</label>
                <input
                  type="number"
                  min={0}
                  value={newRowForm.rmStock}
                  onChange={(e) =>
                    setNewRowForm({ ...newRowForm, rmStock: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Est. Pemakaian per bulan</label>
                <input
                  type="text"
                  value={newRowForm.estPemakaian}
                  onChange={(e) => setNewRowForm({ ...newRowForm, estPemakaian: e.target.value })}
                  placeholder="Contoh: 2 pack pemakaian per bulan"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Keterangan</label>
                <input
                  type="text"
                  value={newRowForm.keterangan}
                  onChange={(e) => setNewRowForm({ ...newRowForm, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#E60012] text-white font-semibold"
              >
                Tambahkan ke RF
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Catat Update ke GA Dept */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmSubmission}
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold">Catat Update Rolling Forecast ke GA Dept.</h3>
              <button type="button" onClick={() => setSubmitModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
              <div>
                Bulan Update: <strong>{activeMonth}</strong>
              </div>
              <div>
                Total Item Dipesan: <strong>{stats.filledCount} item</strong> ({stats.totalUnits}{' '}
                unit)
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Catatan Pengiriman ke GA Dept.</label>
              <textarea
                rows={3}
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder={`Contoh: Update forecast pemesanan Office Supplies bulan ${activeMonth} untuk kebutuhan HR Development & HR Adm. Operation`}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#E60012] text-white font-semibold inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Simpan Log Update GA
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Upload & Preview Modals for GA Rolling Forecast Docs */}
      <DocumentUploadModal
        open={uploadDocOpen}
        onClose={() => setUploadDocOpen(false)}
        defaultCategory="ROLLING_FORECAST_GA"
        defaultPeriod={forecastMonthKeyToPeriod(activeMonth)}
        defaultLinkedModule="FORECAST"
      />
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
};
