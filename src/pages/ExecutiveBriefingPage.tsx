import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  CalendarRange,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Layers,
  Package,
  Presentation,
  Printer,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { BoardPresentationModal } from '../components/executive/BoardPresentationModal';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import {
  buildExecutiveCsv,
  buildExecutiveSummaryText,
  computeExecutiveMetrics,
  getHorizonOptions,
  type ExecutiveFilterState,
  type FiscalHorizon,
  type SectionScopeFilter,
  type SupplyScopeFilter,
} from '../utils/executiveAnalytics';
import { exportElementToA3Pdf } from '../utils/exportUtils';

const QUICK_SLIDE_CARDS = [
  {
    idx: 0,
    num: '01',
    titleId: 'Kesehatan Stok Makro',
    titleEn: 'Macro Stock Health',
    descId: 'Ketersediaan katalog & koridor target 85%+',
    descEn: 'Catalog availability & 85%+ tolerance corridor',
  },
  {
    idx: 1,
    num: '02',
    titleId: 'Kategori & Lemari Simpan',
    titleEn: 'Category & Cabinets',
    descId: 'Grafik aman vs kritis & item prioritas',
    descEn: 'Healthy vs critical chart & priority items',
  },
  {
    idx: 2,
    num: '03',
    titleId: 'Aset Overhead & Layanan HR',
    titleEn: 'Assets & HR Service',
    descId: 'Kondisi MCH/ELC/ATK & permintaan seksi HR',
    descEn: 'MCH/ELC/ATK readiness & HR section requests',
  },
  {
    idx: 3,
    num: '04',
    titleId: 'Pemakaian & Forecast GA',
    titleEn: 'Pacing & GA Forecast',
    descId: 'Tren terima/pakai bulanan & usulan GA Dept',
    descEn: 'Monthly terima/pakai pacing & GA proposals',
  },
  {
    idx: 4,
    num: '05',
    titleId: 'Ratifikasi Pimpinan',
    titleEn: 'Board Ratification',
    descId: 'Audit laporan A3, opname & pengesahan aksi',
    descEn: 'A3 audit readiness, opname & board sign-off',
  },
];

export const ExecutiveBriefingPage: React.FC = () => {
  const { store } = useSupplyHub();
  const { language, tr } = useLanguage();
  const { activePreset } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [horizon, setHorizon] = useState<FiscalHorizon>('FULL_FY');
  const [supplyScope, setSupplyScope] = useState<SupplyScopeFilter>('ALL');
  const [sectionScope, setSectionScope] = useState<SectionScopeFilter>('ALL');

  const [presentationOpen, setPresentationOpen] = useState(false);
  const [initialSlide, setInitialSlide] = useState(0);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [ratifiedDecisions, setRatifiedDecisions] = useState<Record<string, boolean>>({});

  const dossierRef = useRef<HTMLDivElement | null>(null);

  const filters: ExecutiveFilterState = useMemo(
    () => ({ horizon, supplyScope, sectionScope }),
    [horizon, supplyScope, sectionScope]
  );

  const metrics = useMemo(
    () => computeExecutiveMetrics(store, filters),
    [store, filters]
  );

  const horizonOptions = useMemo(() => getHorizonOptions(), []);

  const toggleRatify = (decisionId: string) => {
    setRatifiedDecisions((prev) => ({ ...prev, [decisionId]: !prev[decisionId] }));
  };

  const openPresentationAt = (slideIndex: number) => {
    setInitialSlide(slideIndex);
    setPresentationOpen(true);
  };

  const handleCopySummary = async () => {
    const text = buildExecutiveSummaryText(metrics, filters, language);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      toast(
        tr('Ringkasan eksekutif disalin', 'Executive summary copied'),
        'success',
        tr('Siap ditempel ke email atau pesan manajemen.', 'Ready to paste into leadership email or brief.')
      );
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      toast(tr('Gagal menyalin ringkasan', 'Failed to copy summary'), 'error');
    }
  };

  const handleExportCsv = () => {
    const csv = buildExecutiveCsv(metrics, filters, language);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HR_SupplyHub_Executive_Briefing_${horizon}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(tr('CSV Briefing Eksekutif berhasil diunduh', 'Executive Briefing CSV downloaded'), 'success');
  };

  const handlePrintPdfDossier = async () => {
    if (!dossierRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportElementToA3Pdf(
        dossierRef.current,
        `HR_SupplyHub_Executive_Dossier_${horizon}_${new Date().toISOString().slice(0, 10)}.pdf`
      );
      toast(
        tr('Dossier PDF Eksekutif berhasil diunduh', 'Executive PDF Dossier downloaded'),
        'success'
      );
    } catch (err) {
      console.error('[HR SupplyHub] Executive PDF export error:', err);
      toast(
        tr('Gagal mengekspor Dossier PDF', 'Failed to export PDF Dossier'),
        'error'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const boardDecisions = useMemo(
    () => [
      {
        id: 'dec-forecast',
        num: '1.',
        title: tr(
          `Pengesahan Rolling Forecast GA (${metrics.activeForecastMonth})`,
          `GA Rolling Forecast Endorsement (${metrics.activeForecastMonth})`
        ),
        desc: tr(
          `Persetujuan usulan ${metrics.forecastActiveMonthFilled} item (${metrics.forecastActiveMonthUnits} unit) serta mitigasi ${metrics.criticalItems} item kritis (${metrics.outOfStockItems} stok habis) untuk koordinasi ke GA Dept.`,
          `Endorse ${metrics.forecastActiveMonthFilled} items (${metrics.forecastActiveMonthUnits} units) and replenish ${metrics.criticalItems} critical items (${metrics.outOfStockItems} out-of-stock) with GA Dept.`
        ),
        status: metrics.criticalItems > 0 ? 'ACTION' : 'APPROVED',
        linkTo: '/app/forecast',
        linkLabel: tr('Buka Rolling Forecast', 'Open Rolling Forecast'),
      },
      {
        id: 'dec-signatures',
        num: '2.',
        title: tr(
          'Tanda Tangan Digital Laporan Bulanan A3',
          'Monthly A3 Report Digital Sign-Off'
        ),
        desc: tr(
          `${metrics.reportsFinal} dari ${metrics.reportsTotal} dokumen laporan A3 telah berstatus FINAL (${metrics.signatureCompliancePct}% slot tanda tangan selesai).`,
          `${metrics.reportsFinal} of ${metrics.reportsTotal} monthly A3 reports are FINAL (${metrics.signatureCompliancePct}% digital signatures complete).`
        ),
        status: metrics.reportsPending > 0 ? 'ACTION' : 'APPROVED',
        linkTo: '/app/reports',
        linkLabel: tr('Tinjau Laporan A3', 'Review A3 Reports'),
      },
      {
        id: 'dec-opname',
        num: '3.',
        title: tr(
          'Verifikasi Stock Opname & Layanan Permintaan HR',
          'Stock Opname & HR Supply Request Governance'
        ),
        desc: tr(
          `${metrics.opnameApproved}/${metrics.opnameTotal} sesi opname disetujui (${metrics.opnameDiscrepancyCount} catatan selisih) dan ${metrics.requestsPending} permintaan karyawan sedang menunggu persetujuan PIC.`,
          `${metrics.opnameApproved}/${metrics.opnameTotal} opname sessions approved (${metrics.opnameDiscrepancyCount} recorded variances) and ${metrics.requestsPending} employee request(s) awaiting PIC approval.`
        ),
        status: metrics.opnamePending > 0 || metrics.requestsPending > 0 ? 'RECOMMENDED' : 'APPROVED',
        linkTo: '/app/opname',
        linkLabel: tr('Lihat Stock Opname', 'View Stock Opname'),
      },
      {
        id: 'dec-assets',
        num: '4.',
        title: tr(
          'Kesiapan & Inspeksi Aset Inventaris Overhead',
          'Overhead Inventory Asset Readiness & Audit'
        ),
        desc: tr(
          `${metrics.assetsBagus}/${metrics.assetsTotal} aset operasional MCH/ELC/ATK dalam kondisi BAGUS (${metrics.assetsHealthPct}%). ${
            metrics.assetsRusak > 0
              ? `Terdapat ${metrics.assetsRusak} aset kondisi RUSAK yang membutuhkan tindak lanjut.`
              : 'Seluruh aset dalam kondisi optimal tanpa temuan kerusakan.'
          }`,
          `${metrics.assetsBagus}/${metrics.assetsTotal} MCH/ELC/ATK operational assets are in GOOD condition (${metrics.assetsHealthPct}%). ${
            metrics.assetsRusak > 0
              ? `${metrics.assetsRusak} DAMAGED asset(s) require maintenance follow-up.`
              : 'All assets are in optimal condition with zero damage findings.'
          }`
        ),
        status: metrics.assetsRusak > 0 ? 'ACTION' : 'APPROVED',
        linkTo: '/app/inventory',
        linkLabel: tr('Buka Inventaris Overhead', 'Open Overhead Inventory'),
      },
    ],
    [metrics, tr]
  );

  return (
    <div className="space-y-5">
      {/* Printable Executive Dossier Wrapper */}
      <div ref={dossierRef} className="space-y-5">
        {/* Executive Header Card */}
        <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <img
              src={store.settings.logoUrl}
              alt="Logo Ajinomoto"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-contain bg-white border border-neutral-200/80 p-1.5 shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                <span className="font-extrabold text-theme-primary tracking-wide">
                  {tr('RAHASIA · TOP MANAGEMENT', 'CONFIDENTIAL · TOP MANAGEMENT')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">REF: HR-SH/BOD/2026</span>
                <span aria-hidden="true">·</span>
                <span>
                  {tr('Bulan Aktif GA:', 'Active GA Month:')}{' '}
                  <strong className="text-neutral-800 dark:text-neutral-200 font-mono-num">
                    {metrics.activeForecastMonth}
                  </strong>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-balance">
                {tr(
                  'Briefing Eksekutif Persediaan & Operasional HR',
                  'Executive Supply & Operations Briefing'
                )}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory Operations ·{' '}
                {language === 'en' ? metrics.horizonMeta.labelEn : metrics.horizonMeta.labelId}
              </p>
            </div>
          </div>

          {/* Primary Action Toolbar */}
          <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openPresentationAt(0)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F172A] dark:bg-theme-primary hover:opacity-90 text-white text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Presentation className="w-4 h-4 shrink-0" />
              {tr('Board Presentation Mode', 'Board Presentation Mode')}
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1E222A] hover:border-theme-primary text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedSummary ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
              )}
              {copiedSummary ? tr('Tersalin', 'Copied') : tr('Salin Ringkasan', 'Copy Summary')}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1E222A] hover:border-theme-primary text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              {tr('Export CSV', 'Export CSV')}
            </button>

            <button
              type="button"
              disabled={exportingPdf}
              onClick={handlePrintPdfDossier}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-theme-primary bg-theme-primary-hover disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              {exportingPdf
                ? tr('Memproses PDF...', 'Generating PDF...')
                : tr('Cetak PDF Dossier', 'Print PDF Dossier')}
            </button>
          </div>
        </section>

        {/* Time Horizon & Organizational Scope Filters */}
        <section className="no-print p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-theme-primary shrink-0">
                <CalendarRange className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold">
                  {tr('Horizon Waktu Evaluasi', 'Evaluation Time Horizon')} ·{' '}
                  <span className="text-theme-primary font-mono-num">FY 2026/2027</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {tr(
                    'Pilih rentang evaluasi kuartalan atau penuh satu tahun fiskal (Apr–Mar).',
                    'Select quarterly evaluation range or full fiscal year (Apr–Mar).'
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {horizonOptions.map((opt) => {
                const active = horizon === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setHorizon(opt.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-theme-primary text-white shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-800/90 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400">
              {tr('Filter Cakupan Operasional HR:', 'HR Operational Scope Filter:')}
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]">
                <Layers className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span className="text-neutral-500">{tr('Katalog:', 'Catalog:')}</span>
                <select
                  value={supplyScope}
                  onChange={(e) => setSupplyScope(e.target.value as SupplyScopeFilter)}
                  className="bg-transparent font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">{tr('Semua Katalog', 'All Catalogs')}</option>
                  <option value="OFFICE_SUPPLIES">Office Supplies</option>
                  <option value="OVERHEAD_GOODS">Overhead Goods</option>
                </select>
              </label>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]">
                <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span className="text-neutral-500">{tr('Seksi HR:', 'HR Section:')}</span>
                <select
                  value={sectionScope}
                  onChange={(e) => setSectionScope(e.target.value as SectionScopeFilter)}
                  className="bg-transparent font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">{tr('Semua Seksi HR', 'All HR Sections')}</option>
                  <option value="HR Development">HR Development</option>
                  <option value="Administration & Operation">Administration &amp; Operation</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* 4 Executive KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>{tr('TOTAL KATALOG PERSEDIAAN', 'TOTAL SUPPLY CATALOG')}</span>
              <Package className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono-num tabular-nums">
                {metrics.totalItems}
              </span>
              <span className="text-xs font-semibold text-neutral-500">
                {tr('Item Aktif', 'Active Items')}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {metrics.officeCount} Office Supplies · {metrics.overheadCount} Overhead Goods ·{' '}
              {metrics.totalCabinets} {tr('lemari', 'cabinets')}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>{tr('TINGKAT KETERSEDIAAN SEHAT', 'HEALTHY STOCK AVAILABILITY')}</span>
              <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono-num tabular-nums text-sky-600 dark:text-sky-400">
                {metrics.healthyPct}%
              </span>
              <span className="text-xs font-semibold text-neutral-500 font-mono-num">
                ({metrics.healthyItems}/{metrics.totalItems})
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${metrics.healthyPct}%`,
                  backgroundColor: activePreset.primary,
                }}
              />
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {metrics.criticalItems} {tr('item kritis', 'critical')} · {metrics.outOfStockItems}{' '}
              {tr('stok habis (0)', 'out of stock (0)')}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>{tr('PEMAKAIAN & FORECAST GA', 'USAGE & GA FORECAST')}</span>
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono-num tabular-nums">
                {metrics.totalPakai.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-semibold text-neutral-500">
                {tr('Unit Pakai', 'Units Used')}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              +{metrics.totalTerima.toLocaleString('id-ID')} {tr('Terima', 'Received')} ·{' '}
              {metrics.activeForecastMonth}:{' '}
              <strong className="font-mono-num text-neutral-800 dark:text-neutral-200">
                {metrics.forecastActiveMonthUnits}
              </strong>{' '}
              {tr('unit GA', 'GA units')}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>{tr('TATA KELOLA & KESIAPAN AUDIT', 'GOVERNANCE & AUDIT INDEX')}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono-num tabular-nums text-emerald-600 dark:text-emerald-400">
                {metrics.governanceReadinessPct}%
              </span>
              <span className="text-xs font-semibold text-neutral-500">
                {metrics.reportsFinal}/{metrics.reportsTotal} A3 Final
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {metrics.signatureCompliancePct}% {tr('TTD Digital', 'Digital Sign')} ·{' '}
              {metrics.assetsHealthPct}% {tr('Aset Bagus', 'Good Assets')}
            </p>
          </div>
        </section>

        {/* Main 2-Column Executive Split: Strategic Summary + Board Decisions */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: Strategic Summary */}
          <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-4 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-display">
                  {tr(
                    'Ringkasan Strategis untuk Direksi & Manajemen Umum',
                    'Strategic Summary for Board of Directors & General Management'
                  )}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {tr(
                    'Sintesis operasional persediaan Departemen HR berdasarkan verifikasi stok, transaksi, opname, dan Rolling Forecast GA.',
                    'HR Department supply synthesis based on live stock, transaction pacing, opname verification, and GA Rolling Forecast.'
                  )}
                </p>
              </div>
              <span className="text-xs font-mono-num font-semibold text-neutral-400 shrink-0">
                FY 2026/2027
              </span>
            </div>

            <div className="space-y-3 flex-1">
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#11141A] border border-neutral-200/70 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {tr(
                    'Kontinuitas Ketersediaan Persediaan Departemen HR',
                    'HR Department Supply Continuity & Buffer Control'
                  )}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {tr(
                    `Dari total ${metrics.totalItems} item katalog aktif di ${metrics.totalCabinets} lokasi penyimpanan, sebanyak ${metrics.healthyItems} item (${metrics.healthyPct}%) berada dalam kondisi aman. Sebanyak ${metrics.criticalItems} item kritis (termasuk ${metrics.outOfStockItems} item bersaldo nol) telah teridentifikasi otomatis untuk masuk rencana pemenuhan berikutnya.`,
                    `Out of ${metrics.totalItems} active catalog items across ${metrics.totalCabinets} storage locations, ${metrics.healthyItems} items (${metrics.healthyPct}%) sit safely above minimum thresholds. ${metrics.criticalItems} critical items (including ${metrics.outOfStockItems} out-of-stock) are automatically flagged for replenishment.`
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#11141A] border border-neutral-200/70 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  {tr(
                    'Keselarasan Pemakaian & Rolling Forecast ke GA Dept.',
                    'Consumption Pacing & GA Dept. Rolling Forecast Alignment'
                  )}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {tr(
                    `Realisasi pergerakan periode ini mencatat +${metrics.totalTerima} unit diterima dan -${metrics.totalPakai} unit terpakai (${metrics.txCount} transaksi). Untuk bulan aktif ${metrics.activeForecastMonth}, ${metrics.forecastActiveMonthFilled} item (${metrics.forecastActiveMonthUnits} unit) telah diproyeksikan ke GA Dept. dengan perhatian khusus pada ${metrics.zeroRmStockCount} item berstatus R/M Stock 0.`,
                    `Period movement logged +${metrics.totalTerima} units received and -${metrics.totalPakai} units consumed (${metrics.txCount} transactions). For active month ${metrics.activeForecastMonth}, ${metrics.forecastActiveMonthFilled} items (${metrics.forecastActiveMonthUnits} units) are scheduled for GA Dept. with close focus on ${metrics.zeroRmStockCount} zero R/M stock items.`
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#11141A] border border-neutral-200/70 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-theme-primary">
                  <Box className="w-4 h-4 shrink-0" />
                  {tr(
                    'Integritas Aset Overhead & Respons Layanan Karyawan',
                    'Overhead Asset Integrity & Internal HR Service Responsiveness'
                  )}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {tr(
                    `Aset Inventaris Overhead mencapai kesiapan pakai ${metrics.assetsHealthPct}% (${metrics.assetsBagus} Bagus / ${metrics.assetsRusak} Rusak dari ${metrics.assetsTotal} aset MCH, ELC, ATK). Layanan pengambilan barang karyawan HR memproses ${metrics.requestProcessedPct}% dari ${metrics.requestsTotal} permintaan (${metrics.requestsPending} menunggu approval PIC).`,
                    `Overhead Inventory assets achieved ${metrics.assetsHealthPct}% readiness (${metrics.assetsBagus} Good / ${metrics.assetsRusak} Damaged across ${metrics.assetsTotal} MCH, ELC, ATK assets). Employee supply service resolved ${metrics.requestProcessedPct}% of ${metrics.requestsTotal} requests (${metrics.requestsPending} pending PIC approval).`
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-[#11141A] border border-neutral-200/70 dark:border-neutral-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  {tr(
                    'Tata Kelola Laporan Standar A3, Stock Opname & Arsip',
                    'A3 Monthly Reporting, Stock Opname & Archive Governance'
                  )}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {tr(
                    `Sebanyak ${metrics.reportsFinal}/${metrics.reportsTotal} laporan bulanan standar A3 telah FINAL (${metrics.signatureCompliancePct}% tanda tangan digital lengkap), dilengkapi ${metrics.opnameTotal} sesi Stock Opname (${metrics.opnameDiscrepancyCount} catatan selisih) dan ${metrics.documentsTotal} arsip dokumen terverifikasi.`,
                    `${metrics.reportsFinal}/${metrics.reportsTotal} standard A3 monthly reports are FINAL (${metrics.signatureCompliancePct}% digital signatures complete), backed by ${metrics.opnameTotal} Stock Opname session(s) (${metrics.opnameDiscrepancyCount} documented variances) and ${metrics.documentsTotal} archived files.`
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Board of Directors Decisions */}
          <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-4 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-theme-primary" />
                {tr('Keputusan & Ratifikasi Pimpinan', 'Board of Directors Decisions')}
              </h3>
              <span className="text-[11px] text-neutral-400">
                {tr('Ratifikasi Resmi', 'Official Ratification')}
              </span>
            </div>

            <div className="space-y-3 flex-1">
              {boardDecisions.map((dec) => {
                const isRatified = Boolean(ratifiedDecisions[dec.id]);
                return (
                  <div
                    key={dec.id}
                    className={`p-4 rounded-xl border transition-colors space-y-2 ${
                      isRatified
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-neutral-50/70 dark:bg-[#11141A] border-neutral-200/80 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold leading-snug">
                        {dec.num} {dec.title}
                      </h4>
                      <span
                        className={`text-[10px] font-extrabold tracking-wide shrink-0 ${
                          isRatified
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : dec.status === 'ACTION'
                            ? 'text-amber-700 dark:text-amber-400'
                            : dec.status === 'RECOMMENDED'
                            ? 'text-sky-700 dark:text-sky-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isRatified
                          ? tr('DISAHKAN', 'RATIFIED')
                          : dec.status === 'ACTION'
                          ? tr('TINDAK LANJUT', 'ACTION NEEDED')
                          : dec.status === 'RECOMMENDED'
                          ? tr('DIREKOMENDASIKAN', 'RECOMMENDED')
                          : tr('TERKENDALI', 'APPROVED')}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {dec.desc}
                    </p>
                    <div className="no-print pt-1 flex items-center justify-between gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => toggleRatify(dec.id)}
                        className="font-semibold text-theme-primary hover:underline cursor-pointer"
                      >
                        {isRatified
                          ? tr('✓ Sudah disahkan (Batal)', '✓ Ratified (Undo)')
                          : tr('Tandai Disahkan', 'Mark Ratified')}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(dec.linkTo)}
                        className="inline-flex items-center gap-0.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-medium cursor-pointer"
                      >
                        {dec.linkLabel}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 5-Slide Quick Launch Strip into Board Presentation Mode */}
      <section className="no-print p-5 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">
              {tr('Pratinjau & Lompat Cepat ke Slide Presentasi Direksi', 'Quick Launch into Board Presentation Slides')}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {tr(
                'Klik salah satu slide di bawah untuk langsung memulai Board Presentation Mode pada topik tersebut.',
                'Click any slide below to jump directly into Board Presentation Mode on that topic.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openPresentationAt(0)}
            className="text-xs font-semibold text-theme-primary hover:underline cursor-pointer"
          >
            {tr('Mulai dari Slide 1 →', 'Start from Slide 1 →')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {QUICK_SLIDE_CARDS.map((card) => (
            <button
              key={card.idx}
              type="button"
              onClick={() => openPresentationAt(card.idx)}
              className="text-left p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#11141A] hover:border-theme-primary transition-all cursor-pointer space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold font-mono-num text-theme-primary">
                  SLIDE {card.num}
                </span>
                <Presentation className="w-3.5 h-3.5 text-neutral-400 group-hover:text-theme-primary transition-colors" />
              </div>
              <div className="text-xs font-bold leading-snug">
                {language === 'en' ? card.titleEn : card.titleId}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                {language === 'en' ? card.descEn : card.descId}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Full-Screen Board Presentation Mode Overlay */}
      <BoardPresentationModal
        open={presentationOpen}
        initialSlide={initialSlide}
        metrics={metrics}
        filters={filters}
        ratifiedDecisions={ratifiedDecisions}
        onToggleRatify={toggleRatify}
        onClose={() => setPresentationOpen(false)}
      />
    </div>
  );
};
