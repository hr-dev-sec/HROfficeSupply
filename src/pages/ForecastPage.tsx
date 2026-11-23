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
  Printer,
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
import { useLanguage } from '../context/LanguageContext';
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
  const { language, tr } = useLanguage();
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
  const [exportingExcel, setExportingExcel] = useState(false);
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
    try {
      // Wait reliably until DOCUMENT tab and [data-rf-page] nodes are mounted in DOM
      let pageEls: HTMLElement[] = [];
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const container = docContainerRef.current;
        if (container) {
          pageEls = Array.from(container.querySelectorAll<HTMLElement>('[data-rf-page]'));
          if (pageEls.length > 0) break;
        }
      }
      if (pageEls.length === 0) {
        throw new Error(
          tr(
            'Halaman pratinjau dokumen belum siap. Coba klik lagi.',
            'Document preview pages are not ready yet. Please try again.'
          )
        );
      }
      // Give one extra frame for layout/images to settle
      await new Promise((resolve) => setTimeout(resolve, 120));

      await exportElementsToMultiPageA3Pdf(
        pageEls,
        `RF_Office_Supplies_GA_${rf.fiscalYearLabel}_${activeMonth}.pdf`
      );
      toast(
        tr('PDF Rolling Forecast berhasil diunduh', 'Rolling Forecast PDF downloaded'),
        'success',
        tr(`Format A3 Landscape (${pageEls.length} halaman)`, `A3 Landscape (${pageEls.length} pages)`)
      );
    } catch (err) {
      console.error('[HR SupplyHub] Export Rolling Forecast PDF failed:', err);
      const detail = err instanceof Error ? err.message : String(err || '');
      toast(
        tr('Gagal mengekspor PDF Rolling Forecast', 'Failed to export Rolling Forecast PDF'),
        'error',
        detail || undefined
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      await exportRollingForecastToExcel(rf);
      toast(
        tr('Excel Rolling Forecast berhasil diunduh', 'Rolling Forecast Excel downloaded'),
        'success',
        tr(
          `Sheet RF ${rf.fiscalYearLabel} & List Item GA (${rf.rows.length} item)`,
          `RF ${rf.fiscalYearLabel} & GA Item Catalog (${rf.rows.length} items)`
        )
      );
    } catch (err) {
      console.error('[HR SupplyHub] Export Rolling Forecast Excel failed:', err);
      const detail = err instanceof Error ? err.message : String(err || '');
      toast(
        tr('Gagal mengekspor Excel Rolling Forecast', 'Failed to export Rolling Forecast Excel'),
        'error',
        detail || undefined
      );
    } finally {
      setExportingExcel(false);
    }
  };

  const handleSyncStock = () => {
    if (!user) return;
    const count = syncForecastStockFromMaster(user);
    toast(
      count > 0
        ? tr(`${count} item R/M Stock diperbarui`, `${count} R/M Stock item(s) updated`)
        : tr('R/M Stock sudah sinkron dengan Master Item', 'R/M Stock is already synced with Master Items'),
      'success'
    );
  };

  const handlePrefillCritical = () => {
    if (!user) return;
    const count = prefillCriticalForecast(activeMonth, user);
    toast(
      count > 0
        ? tr(
            `${count} item stok kritis otomatis terisi ke forecast ${activeMonth}`,
            `${count} critical-stock item(s) auto-filled into ${activeMonth} forecast`
          )
        : tr(
            'Tidak ada item Office Supplies stok kritis yang cocok di katalog GA',
            'No matching critical Office Supplies items found in GA catalog'
          ),
      count > 0 ? 'success' : 'info'
    );
  };

  const handleCopyPrevMonth = () => {
    if (!user || !prevMonth) return;
    const count = copyForecastMonth(prevMonth, activeMonth, user);
    toast(
      count > 0
        ? tr(
            `${count} baris disalin dari ${prevMonth} ke ${activeMonth}`,
            `${count} row(s) copied from ${prevMonth} to ${activeMonth}`
          )
        : tr(`Tidak ada isian forecast pada bulan ${prevMonth}`, `No forecast entries found for ${prevMonth}`),
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
    toast(tr('Item baru ditambahkan ke daftar Rolling Forecast', 'New item added to Rolling Forecast'), 'success');
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
      tr(
        `Update Forecast ${sub.month} tercatat siap kirim ke GA Dept.`,
        `${sub.month} Forecast Update logged for GA Dept.`
      ),
      'success',
      tr(
        `${sub.totalItemsRequested} item (${sub.totalUnitsRequested} unit) — silakan ekspor PDF / Excel.`,
        `${sub.totalItemsRequested} items (${sub.totalUnitsRequested} units) — ready to export PDF / Excel.`
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Export Actions */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-theme-primary mb-1">
            <CalendarRange className="w-3.5 h-3.5" />
            {tr('Request Office Supplies Melalui GA Dept.', 'Office Supplies Requests via GA Dept.')}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight">
            Rolling Forecast Office Supplies {rf.fiscalYearLabel}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {rf.periodRangeLabel} · {rf.department} ({rf.section}) —{' '}
            {tr(
              'HR hanya melakukan update forecast pemesanan bulanan ke GA Dept.',
              'HR submits monthly order forecast updates to GA Dept.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exportingExcel}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {exportingExcel
              ? tr('Memproses Excel...', 'Processing Excel...')
              : tr('Ekspor Excel (.xlsx)', 'Export Excel (.xlsx)')}
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-theme-primary" />
            {exportingPdf ? tr('Menyiapkan PDF...', 'Preparing PDF...') : tr('Ekspor PDF (A3)', 'Export PDF (A3)')}
          </button>
          {canEditOperational && (
            <button
              type="button"
              onClick={() => setUploadDocOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:border-theme-primary transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-theme-primary" />
              {tr('Unggah Dokumen GA', 'Upload GA Document')}
            </button>
          )}
          {canEditOperational && (
            <button
              type="button"
              onClick={() => setSubmitModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {tr('Catat Update GA', 'Log GA Update')} ({activeMonth})
            </button>
          )}
        </div>
      </div>

      {/* Arsip Dokumen Rolling Forecast GA */}
      {forecastDocs.length > 0 && (
        <div className="no-print p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-theme-primary" />
              {tr('Arsip Dokumen Rolling Forecast GA', 'GA Rolling Forecast Document Archive')} ({forecastDocs.length})
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
                  className="flex items-center gap-2 min-w-0 text-left flex-1 group cursor-pointer"
                >
                  {renderDocumentIcon(doc, 'w-4 h-4 shrink-0')}
                  <div className="min-w-0">
                    <div className="font-semibold truncate group-hover:text-theme-primary transition">
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
                    title={tr('Pratinjau', 'Preview')}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-800 text-theme-primary cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSystemDocument(doc)}
                    title={tr('Unduh', 'Download')}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {(isSuperAdmin || doc.uploadedByUserId === user?.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        deleteDocument(doc.id, user);
                        toast(tr('Dokumen Rolling Forecast dihapus', 'Rolling Forecast document deleted'), 'success');
                      }}
                      title={tr('Hapus', 'Delete')}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 cursor-pointer"
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
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-xs text-neutral-500">
            {tr('Katalog Resmi GA Dept.', 'Official GA Dept. Catalog')}
          </div>
          <div className="text-2xl font-extrabold font-display mt-1 tabular-nums">
            {stats.totalCatalog} {tr('Item', 'Items')}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {tr(`Terkelompok dalam ${stats.totalJenis} jenis barang`, `Grouped into ${stats.totalJenis} item categories`)}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-300/80 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/20">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {tr('Bulan Aktif Update RF', 'Active RF Update Month')}
          </div>
          <div className="text-2xl font-extrabold font-display text-amber-900 dark:text-amber-200 mt-1">
            {activeMonth}
          </div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
            {tr('Kolom sorotan kuning pada dokumen GA', 'Yellow highlighted column on GA sheet')}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-xs text-neutral-500">
            {tr('Forecast Bulan', 'Month Forecast')} {activeMonth}
          </div>
          <div className="text-2xl font-extrabold font-display text-theme-primary mt-1 tabular-nums">
            {stats.filledCount} {tr('Item', 'Items')} · {stats.totalUnits} {tr('Unit', 'Units')}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {tr('Diisi untuk periode pemesanan ini', 'Filled for this ordering period')}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-xs text-neutral-500">
            {tr('Item R/M Stock Kosong (0)', 'Zero R/M Stock Items (0)')}
          </div>
          <div className="text-2xl font-extrabold font-display mt-1 tabular-nums">
            {stats.zeroStockCount} {tr('Item', 'Items')}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {tr('Terakhir diperbarui oleh', 'Last updated by')} {rf.lastUpdatedBy}
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setTab('FORM')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'FORM' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {tr('Form Update Bulanan', 'Monthly Update Form')}
          </button>
          <button
            type="button"
            onClick={() => setTab('DOCUMENT')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'DOCUMENT' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {tr('Pratinjau Dokumen RF (PDF A3)', 'RF Document Preview (A3 PDF)')}
          </button>
          <button
            type="button"
            onClick={() => setTab('CATALOG')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'CATALOG' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {tr('List Item GA', 'GA Item List')} ({rf.rows.length})
          </button>
        </div>

        {/* Active Month Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-neutral-500">
            {tr('Pilih Bulan Update:', 'Select Update Month:')}
          </span>
          <select
            value={activeMonth}
            onChange={(e) => {
              if (!user) return;
              setActiveForecastMonth(e.target.value as ForecastMonthKey, user);
              toast(
                tr(
                  `Bulan aktif RF diubah ke ${e.target.value}`,
                  `Active RF month changed to ${e.target.value}`
                ),
                'info'
              );
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
                  placeholder={tr(
                    'Cari deskripsi item, code item, atau jenis...',
                    'Search item description, item code, or category...'
                  )}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={jenisFilter}
                  onChange={(e) => setJenisFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="ALL">
                    {tr('Semua Jenis', 'All Categories')} ({uniqueJenisList.length})
                  </option>
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
                  {tr('Hanya Terisi', 'Filled Only')} ({activeMonth})
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                  {tr('Sinkron R/M Stock dari Master Item', 'Sync R/M Stock from Master Items')}
                </button>
                <button
                  type="button"
                  onClick={handlePrefillCritical}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {tr('Isi Otomatis dari Item Kritis', 'Auto-Fill Critical Items')} ({activeMonth})
                </button>
                {prevMonth && (
                  <button
                    type="button"
                    onClick={handleCopyPrevMonth}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {tr('Salin Isian dari', 'Copy Entries from')} {prevMonth}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-theme-primary text-theme-primary hover:bg-theme-primary-soft text-xs font-semibold transition-colors ml-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {tr('Tambah Item ke RF', 'Add Item to RF')}
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
                    <th className="p-2.5 font-semibold min-w-[140px]">{tr('Jenis', 'Category')}</th>
                    <th className="p-2.5 font-semibold w-20 text-center">Code</th>
                    <th className="p-2.5 font-semibold min-w-[230px]">item_description</th>
                    <th className="p-2.5 font-semibold w-14 text-center">UOM</th>
                    <th className="p-2.5 font-semibold w-20 text-center">R/M Stock</th>
                    <th className="p-2.5 font-bold w-24 text-center bg-[#FDE047]/70 text-black border-x border-amber-400">
                      RF {activeMonth}
                    </th>
                    <th className="p-2.5 font-semibold min-w-[190px]">
                      {tr('Est. Pemakaian per bulan', 'Est. Monthly Usage')}
                    </th>
                    <th className="p-2.5 font-semibold min-w-[210px]">{tr('Keterangan', 'Remarks')}</th>
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
                              className="w-16 text-center px-1.5 py-1 rounded-lg border border-amber-400 bg-white dark:bg-[#0F1114] font-mono-num font-bold text-theme-primary"
                            />
                          ) : (
                            <span className="font-mono-num font-bold text-theme-primary">
                              {hasOrder ? activeVal : '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {canEditOperational ? (
                            <input
                              type="text"
                              value={row.estPemakaian}
                              placeholder={tr('Contoh: 1 pack pemakaian per bulan', 'Example: 1 pack per month')}
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
                              placeholder={tr('Catatan / PIC penerima...', 'Notes / Recipient PIC...')}
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
                {tr('Menampilkan', 'Showing')} <strong>{filteredRows.length}</strong>{' '}
                {tr('dari', 'of')} {rf.rows.length} {tr('item katalog GA', 'GA catalog items')}
              </span>
              <span>
                {tr(
                  'Semua perubahan langsung tersimpan otomatis & siap diekspor ke PDF / Excel',
                  'All changes auto-save immediately & are ready to export to PDF / Excel'
                )}
              </span>
            </div>
          </div>

          {/* Submission History Log */}
          <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <History className="w-4 h-4 text-[#C9A24B]" />
                {tr('Riwayat Update Rolling Forecast ke GA Dept.', 'GA Dept. Rolling Forecast Update History')}
              </h3>
              <span className="text-[11px] text-neutral-500">
                {rf.submissions.length} {tr('catatan pengiriman', 'submission log(s)')}
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
                      {tr('Periode', 'Period')} {sub.month} — {sub.totalItemsRequested}{' '}
                      {tr('item', 'items')} ({sub.totalUnitsRequested} {tr('unit', 'units')})
                    </div>
                    <div className="text-neutral-500 mt-0.5">{sub.note}</div>
                  </div>
                  <div className="text-right text-[11px] text-neutral-500 font-mono-num">
                    <div>{sub.submittedByName}</div>
                    <div>{formatDateTimeIndo(sub.submittedAt, language)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'DOCUMENT' && (
        <div className="space-y-4">
          <div className="no-print p-3.5 rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {tr(
                'Pratinjau Dokumen Rolling Forecast resmi format GA Dept. (2 halaman A3 Landscape). Gunakan tombol Ekspor PDF (A3) atau Ekspor Excel di atas.',
                'Official GA Dept. Rolling Forecast Document preview (2-page A3 Landscape). Use Export PDF (A3) or Export Excel above.'
              )}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/80 bg-white/80 dark:bg-neutral-900/60 text-amber-900 dark:text-amber-200 font-semibold hover:bg-white transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              {tr('Cetak A3', 'Print A3')}
            </button>
          </div>
          <div ref={docContainerRef} className="print-only-container overflow-x-auto pb-4">
            <RollingForecastDocument data={rf} logoUrl={store.settings.logoUrl} />
          </div>
        </div>
      )}

      {tab === 'CATALOG' && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">
                {tr(
                  'List Item Office Supplies (Request Melalui GA Dept.)',
                  'Office Supplies Item List (Requests via GA Dept.)'
                )}
              </h3>
              <p className="text-xs text-neutral-500">
                {tr(
                  `Referensi resmi ${rf.rows.length} item & ${uniqueJenisList.length} jenis dari katalog GA Dept.`,
                  `Official reference of ${rf.rows.length} items & ${uniqueJenisList.length} categories from GA Dept. catalog.`
                )}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('Cari item atau kode...', 'Search item or code...')}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-left">
                <tr>
                  <th className="p-3 w-16 text-center">{tr('No. urut', 'Seq.')}</th>
                  <th className="p-3">{tr('Jenis', 'Category')}</th>
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
                    <td className="p-2.5 text-center font-mono-num text-theme-primary font-semibold">
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
              <h3 className="text-base font-bold">
                {tr('Tambah Item ke Rolling Forecast GA', 'Add Item to GA Rolling Forecast')}
              </h3>
              <button type="button" onClick={() => setAddModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">{tr('Jenis / Kategori', 'Type / Category')}</label>
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
                  placeholder={tr('Contoh: 20355', 'Example: 20355')}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">
                  {tr('Deskripsi Item (item_description)', 'Item Description (item_description)')}
                </label>
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
                  placeholder={tr('Contoh: Kertas A4 80gr SIDU', 'Example: A4 Paper 80gsm SIDU')}
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
                <label className="block font-semibold mb-1">
                  {tr('R/M Stock Saat Ini', 'Current R/M Stock')}
                </label>
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
                <label className="block font-semibold mb-1">
                  {tr('Est. Pemakaian per bulan', 'Est. Monthly Usage')}
                </label>
                <input
                  type="text"
                  value={newRowForm.estPemakaian}
                  onChange={(e) => setNewRowForm({ ...newRowForm, estPemakaian: e.target.value })}
                  placeholder={tr('Contoh: 2 pack pemakaian per bulan', 'Example: 2 packs per month')}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">{tr('Keterangan', 'Remarks')}</label>
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
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white font-semibold cursor-pointer"
              >
                {tr('Tambahkan ke RF', 'Add to RF')}
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
              <h3 className="text-base font-bold">
                {tr('Catat Update Rolling Forecast ke GA Dept.', 'Log Rolling Forecast Update to GA Dept.')}
              </h3>
              <button type="button" onClick={() => setSubmitModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
              <div>
                {tr('Bulan Update:', 'Update Month:')} <strong>{activeMonth}</strong>
              </div>
              <div>
                {tr('Total Item Dipesan:', 'Total Items Ordered:')}{' '}
                <strong>
                  {stats.filledCount} {tr('item', 'items')}
                </strong>{' '}
                ({stats.totalUnits} {tr('unit', 'units')})
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                {tr('Catatan Pengiriman ke GA Dept.', 'Submission Note for GA Dept.')}
              </label>
              <textarea
                rows={3}
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
                placeholder={tr(
                  `Contoh: Update forecast pemesanan Office Supplies bulan ${activeMonth} untuk kebutuhan HR Development & HR Adm. Operation`,
                  `Example: Monthly Office Supplies order forecast for ${activeMonth} for HR Development & Administration & Operation`
                )}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold cursor-pointer"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {tr('Simpan Log Update GA', 'Save GA Update Log')}
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
