import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Box,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  FileSpreadsheet,
  FileText,
  Globe,
  Lightbulb,
  Maximize2,
  Minimize2,
  Moon,
  Package,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useSupplyHub } from '../../context/SupplyHubContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import type { ExecutiveFilterState, ExecutiveMetrics } from '../../utils/executiveAnalytics';

interface BoardPresentationModalProps {
  open: boolean;
  initialSlide?: number;
  metrics: ExecutiveMetrics;
  filters: ExecutiveFilterState;
  ratifiedDecisions: Record<string, boolean>;
  onToggleRatify: (decisionId: string) => void;
  onClose: () => void;
}

interface SlideDescriptor {
  index: number;
  shortTitleId: string;
  shortTitleEn: string;
  shortSubId: string;
  shortSubEn: string;
  kickerId: string;
  kickerEn: string;
  headlineId: string;
  headlineEn: string;
  subtitleId: string;
  subtitleEn: string;
}

const SLIDES: SlideDescriptor[] = [
  {
    index: 0,
    shortTitleId: 'Kesehatan Stok Makro',
    shortTitleEn: 'Macro Stock Health',
    shortSubId: 'Ketersediaan & Toleransi',
    shortSubEn: 'Availability & Corridor',
    kickerId: 'SLIDE 1 · KETERSEDIAAN & KESEHATAN PERSEDIAAN PABRIK MOJOKERTO',
    kickerEn: 'SLIDE 1 · MOJOKERTO FACTORY MACRO INVENTORY AVAILABILITY',
    headlineId: 'Status Ketersediaan Stok & Kepatuhan Operasional HR',
    headlineEn: 'Supply Availability Status & Operational Compliance',
    subtitleId:
      'Ringkasan ketersediaan katalog Office Supplies & Overhead Goods Departemen HR guna menjaga kelancaran administrasi dan operasional pabrik tanpa hambatan stok.',
    subtitleEn:
      'Executive overview of HR Department Office Supplies & Overhead Goods availability to safeguard uninterrupted plant administration and operations.',
  },
  {
    index: 1,
    shortTitleId: 'Evaluasi Kategori & Lemari',
    shortTitleEn: 'Category & Cabinet Check',
    shortSubId: 'Sebaran & Kesenjangan',
    shortSubEn: 'Coverage & Gap Check',
    kickerId: 'SLIDE 2 · EVALUASI KATEGORI BARANG & PENYIMPANAN LEMARI',
    kickerEn: 'SLIDE 2 · CATEGORY HEALTH & STORAGE CABINET EVALUATION',
    headlineId: 'Distribusi Kategori Persediaan & Kontrol Lokasi Simpan',
    headlineEn: 'Category Distribution & Storage Location Control',
    subtitleId:
      'Pemetaan kondisi aman vs kritis di setiap kategori barang dan lemari penyimpanan guna memprioritaskan pengendalian stok harian.',
    subtitleEn:
      'Mapping healthy versus critical stock across every supply category and storage cabinet to prioritize daily replenishment oversight.',
  },
  {
    index: 2,
    shortTitleId: 'Aset Overhead & Layanan HR',
    shortTitleEn: 'Overhead Assets & Service',
    shortSubId: 'Kondisi Aset & Permintaan',
    shortSubEn: 'Asset Integrity & Requests',
    kickerId: 'SLIDE 3 · INTEGRITAS ASET INVENTARIS OVERHEAD & LAYANAN KARYAWAN HR',
    kickerEn: 'SLIDE 3 · OVERHEAD INVENTORY ASSETS & HR REQUEST SERVICE',
    headlineId: 'Kesiapan Aset Inventaris & Pemenuhan Permintaan Seksi HR',
    headlineEn: 'Overhead Asset Readiness & HR Section Request Fulfillment',
    subtitleId:
      'Evaluasi kondisi fisik aset operasional (MCH, ELC, ATK) serta respons layanan pengambilan barang untuk Seksi HR Development dan Administration & Operation.',
    subtitleEn:
      'Physical readiness review of operational assets (MCH, ELC, ATK) alongside internal supply service responsiveness across both HR sections.',
  },
  {
    index: 3,
    shortTitleId: 'Tren Pemakaian & Forecast GA',
    shortTitleEn: 'Pacing & GA Forecast',
    shortSubId: 'Realisasi vs Proyeksi GA',
    shortSubEn: 'Monthly Pacing Apr–Mar',
    kickerId: 'SLIDE 4 · TREN PEMAKAIAN BULANAN & ROLLING FORECAST KE GA DEPT',
    kickerEn: 'SLIDE 4 · MONTHLY CONSUMPTION PACING & GA ROLLING FORECAST',
    headlineId: 'Pola Konsumsi Operasional & Kesiapan Rolling Forecast GA',
    headlineEn: 'Operational Consumption Pacing & GA Rolling Forecast Alignment',
    subtitleId:
      'Perbandingan arus barang masuk (TERIMA), pemakaian (PAKAI), dan usulan Rolling Forecast bulanan ke GA Dept. tanpa pencatatan nominal pembelian.',
    subtitleEn:
      'Tracking monthly inbound receipts (TERIMA), usage (PAKAI), and GA Dept. rolling forecast order proposals on a strictly non-monetary operational basis.',
  },
  {
    index: 4,
    shortTitleId: 'Ratifikasi Pimpinan',
    shortTitleEn: 'Board Ratification',
    shortSubId: 'Keputusan & Tata Kelola',
    shortSubEn: 'Strategic Decisions',
    kickerId: 'SLIDE 5 · TATA KELOLA AUDIT & KEPUTUSAN PIMPINAN',
    kickerEn: 'SLIDE 5 · GOVERNANCE SCORECARD & BOARD RATIFICATION',
    headlineId: 'Kesiapan Audit Laporan A3 & Keputusan Strategis Pimpinan',
    headlineEn: 'A3 Audit Readiness & Executive Board Decisions',
    subtitleId:
      'Peninjauan status tanda tangan digital laporan bulanan A3, hasil verifikasi Stock Opname, serta pengesahan tindak lanjut prioritas Departemen HR.',
    subtitleEn:
      'Review of monthly A3 digital signature completion, Stock Opname verification integrity, and formal ratification of priority HR operational actions.',
  },
];

export const BoardPresentationModal: React.FC<BoardPresentationModalProps> = ({
  open,
  initialSlide = 0,
  metrics,
  filters,
  ratifiedDecisions,
  onToggleRatify,
  onClose,
}) => {
  const { store } = useSupplyHub();
  const { theme, toggleTheme, activePreset } = useTheme();
  const { language, setLanguage, tr } = useLanguage();
  const { toast } = useToast();

  const [slideIdx, setSlideIdx] = useState(initialSlide);
  const [showNotes, setShowNotes] = useState(true);
  const [timerRunning, setTimerRunning] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isNativeFs, setIsNativeFs] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);

  const deckRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setSlideIdx(Math.max(0, Math.min(SLIDES.length - 1, initialSlide)));
      setElapsedSeconds(0);
      setTimerRunning(true);
    }
  }, [open, initialSlide]);

  // Live presentation timer
  useEffect(() => {
    if (!open || !timerRunning) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, timerRunning]);

  // Sync native browser fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsNativeFs(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const toggleNativeFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const target = (deckRef.current || document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        if (target.requestFullscreen) await target.requestFullscreen();
        else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
      }
    } catch {
      // Deck already covers 100% viewport via fixed inset-0 when iframe blocks native Fullscreen API
    }
  }, []);

  const handleClose = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      }
    } catch {
      // ignore
    }
    onClose();
  }, [onClose]);

  // Keyboard shortcuts: Left/Right, 1-5, T (Theme), N (Notes), L (Language), F (Fullscreen), Esc (Close)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setSlideIdx((prev) => Math.min(SLIDES.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setSlideIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key >= '1' && e.key <= '5') {
        setSlideIdx(Number(e.key) - 1);
      } else if (e.key.toLowerCase() === 't') {
        toggleTheme();
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((v) => !v);
      } else if (e.key.toLowerCase() === 'l') {
        setLanguage(language === 'id' ? 'en' : 'id');
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleNativeFullscreen();
      } else if (e.key === 'Escape') {
        const doc = document as Document & { webkitFullscreenElement?: Element | null };
        if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
          e.preventDefault();
          void handleClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, language, setLanguage, toggleTheme, toggleNativeFullscreen, handleClose]);

  const speakerNotes = useMemo(() => {
    const m = metrics;
    const horizonLabel = language === 'en' ? m.horizonMeta.labelEn : m.horizonMeta.labelId;

    const map: Record<number, { title: string; bullets: string[]; tip: string }> = {
      0: {
        title: tr(
          'Slide 1: Pembukaan & Ketersediaan Persediaan Makro HR',
          'Slide 1: Opening & Macro HR Inventory Availability'
        ),
        bullets:
          language === 'en'
            ? [
                `Honorable Board of Directors, to open today's briefing (${horizonLabel}), HR SupplyHub currently manages ${m.totalItems} active supply items (${m.officeCount} Office Supplies and ${m.overheadCount} Overhead Goods) across ${m.totalCabinets} storage cabinets.`,
                `Overall stock health stands at ${m.healthyPct}% (${m.healthyItems} items comfortably above minimum buffer), with ${m.criticalItems} items requiring replenishment attention — including ${m.outOfStockItems} out-of-stock item(s).`,
                `All tracking operates transparently without monetary purchasing overlap, linking directly to monthly GA Dept. Rolling Forecast replenishment and digital A3 reporting.`,
              ]
            : [
                `Yang terhormat Jajaran Direksi & Manajemen, sebagai pembuka briefing (${horizonLabel}), HR SupplyHub saat ini mengelola ${m.totalItems} item aktif (${m.officeCount} Office Supplies dan ${m.overheadCount} Overhead Goods) di ${m.totalCabinets} lokasi lemari.`,
                `Tingkat ketersediaan stok sehat berada di angka ${m.healthyPct}% (${m.healthyItems} item aman di atas batas minimum), sementara ${m.criticalItems} item masuk pantauan restock termasuk ${m.outOfStockItems} item bersaldo nol.`,
                `Seluruh pencatatan berfokus pada pengendalian kuantitas operasional dan terhubung langsung dengan usulan Rolling Forecast ke GA Dept. serta pelaporan bulanan standar A3.`,
              ],
        tip: tr(
          'Tekankan bahwa sistem memantau batas minimum secara real-time sehingga risiko kekosongan alat kerja di lini administrasi pabrik dapat dicegah lebih awal.',
          'Emphasize that real-time minimum buffer monitoring prevents workplace supply shortages across plant administration.'
        ),
      },
      1: {
        title: tr(
          'Slide 2: Evaluasi Kategori & Disiplin Penyimpanan',
          'Slide 2: Category Evaluation & Storage Discipline'
        ),
        bullets:
          language === 'en'
            ? [
                `Across ${m.categories.length} active supply categories, the largest catalog group is "${m.categories[0]?.kategori || '-'}" (${m.categories[0]?.totalItems ?? 0} items).`,
                `Storage allocation is mapped systematically across ${m.totalCabinets} cabinets/rows, enabling rapid physical verification during month-end Stock Opname.`,
                `Items flagged below minimum threshold are automatically queued for the upcoming GA Rolling Forecast update without manual spreadsheet consolidation.`,
              ]
            : [
                `Dari total ${m.categories.length} kategori katalog aktif, kelompok terbesar adalah "${m.categories[0]?.kategori || '-'}" sebanyak ${m.categories[0]?.totalItems ?? 0} item.`,
                `Sebaran penyimpanan tercatat rapi pada ${m.totalCabinets} lokasi lemari/baris sehingga memudahkan pemeriksaan fisik (5S) dan percepatan Stock Opname akhir bulan.`,
                `Setiap item yang menyentuh batas minimum otomatis masuk daftar prioritas pengisian Rolling Forecast bulanan ke GA Dept.`,
              ],
        tip: tr(
          'Soroti kategori dengan jumlah item kritis terbanyak sebagai fokus pengendalian minggu ini.',
          'Highlight the category with the highest critical count as this week’s replenishment priority.'
        ),
      },
      2: {
        title: tr(
          'Slide 3: Integritas Aset Overhead & Layanan Seksi HR',
          'Slide 3: Overhead Asset Integrity & HR Section Service'
        ),
        bullets:
          language === 'en'
            ? [
                `Overhead Inventory currently tracks ${m.assetsTotal} departmental assets (${m.mchCount} MCH, ${m.elcCount} ELC, ${m.atkCount} ATK) with a ${m.assetsHealthPct}% operational readiness rate (${m.assetsBagus} Good, ${m.assetsRusak} Damaged).`,
                `Internal supply requests from ${m.activeEmployees} active HR staff totaled ${m.requestsTotal} requests (${m.hrDevRequests} HR Development, ${m.adminOpsRequests} Administration & Operation).`,
                `Approval completion stands at ${m.requestProcessedPct}% (${m.requestsApproved} approved, ${m.requestsPending} pending PIC sign-off), ensuring stock is only deducted after verified approval.`,
              ]
            : [
                `Modul Inventaris Overhead mencatat ${m.assetsTotal} aset departemen (${m.mchCount} MCH, ${m.elcCount} ELC, ${m.atkCount} ATK) dengan tingkat kesiapan pakai ${m.assetsHealthPct}% (${m.assetsBagus} Bagus, ${m.assetsRusak} Rusak).`,
                `Layanan pengambilan barang mandiri oleh ${m.activeEmployees} karyawan aktif HR mencatat ${m.requestsTotal} permintaan (${m.hrDevRequests} dari HR Development, ${m.adminOpsRequests} dari Administration & Operation).`,
                `Tingkat penyelesaian persetujuan mencapai ${m.requestProcessedPct}% (${m.requestsApproved} disetujui, ${m.requestsPending} menunggu approval PIC), dengan pemotongan stok otomatis pasca-persetujuan.`,
              ],
        tip: tr(
          'Apabila terdapat aset berkondisi RUSAK, sampaikan rencana tindak lanjut perbaikan atau pengajuan penggantian kepada manajemen.',
          'If any DAMAGED assets are listed, briefly state the repair or replacement plan to leadership.'
        ),
      },
      3: {
        title: tr(
          'Slide 4: Pola Pemakaian & Kesiapan Rolling Forecast GA',
          'Slide 4: Consumption Pacing & GA Rolling Forecast Readiness'
        ),
        bullets:
          language === 'en'
            ? [
                `Within ${horizonLabel}, ${m.txCount} transactions were logged: +${m.totalTerima} units received (TERIMA) and -${m.totalPakai} units consumed (PAKAI).`,
                `For active GA Rolling Forecast month ${m.activeForecastMonth}, ${m.forecastActiveMonthFilled} items (${m.forecastActiveMonthUnits} total units) are scheduled out of ${m.forecastCatalogCount} GA catalog rows.`,
                `Attention item: ${m.zeroRmStockCount} GA catalog entries currently report 0 R/M stock — proactive coordination with GA Dept. ensures timely buffer availability.`,
              ]
            : [
                `Pada horizon ${horizonLabel}, tercatat ${m.txCount} transaksi operasional: penerimaan +${m.totalTerima} unit (TERIMA) dan pemakaian -${m.totalPakai} unit (PAKAI).`,
                `Untuk bulan aktif Rolling Forecast GA (${m.activeForecastMonth}), sudah terisi ${m.forecastActiveMonthFilled} item (${m.forecastActiveMonthUnits} unit) dari total ${m.forecastCatalogCount} katalog GA.`,
                `Catatan perhatian: terdapat ${m.zeroRmStockCount} item katalog GA dengan R/M Stock bernilai 0 yang perlu dikoordinasikan lebih awal bersama GA Dept.`,
              ],
        tip: tr(
          'Gunakan grafik tren 12 bulan untuk menunjukkan bahwa permintaan ke GA selalu berbasis data pemakaian aktual, bukan perkiraan kasar.',
          'Use the 12-month pacing chart to show GA requests are strictly driven by real consumption trends.'
        ),
      },
      4: {
        title: tr(
          'Slide 5: Kesiapan Audit A3 & Ratifikasi Keputusan Pimpinan',
          'Slide 5: A3 Audit Readiness & Board Ratification'
        ),
        bullets:
          language === 'en'
            ? [
                `Monthly A3 Report governance stands at ${m.reportsFinal}/${m.reportsTotal} finalized documents with ${m.signatureCompliancePct}% digital signature completion (${m.signedSignatureSlots}/${m.totalSignatureSlots} slots signed).`,
                `Stock Opname verification covers ${m.opnameTotal} recorded session(s) (${m.opnameApproved} approved, ${m.opnameDiscrepancyCount} variance line(s) documented) supported by ${m.documentsTotal} archived files.`,
                `We seek Management endorsement on the 4 action items below to close pending signatures, align ${m.activeForecastMonth} GA forecast submission, and sustain zero-disruption HR operations.`,
              ]
            : [
                `Kepatuhan pelaporan bulanan standar A3 tercatat ${m.reportsFinal}/${m.reportsTotal} dokumen berstatus FINAL dengan penyelesaian tanda tangan digital sebesar ${m.signatureCompliancePct}% (${m.signedSignatureSlots}/${m.totalSignatureSlots} slot tertandatangani).`,
                `Verifikasi Stock Opname mencakup ${m.opnameTotal} sesi (${m.opnameApproved} disetujui, ${m.opnameDiscrepancyCount} catatan selisih terdokumentasi) disertai ${m.documentsTotal} arsip dokumen resmi.`,
                `Mohon persetujuan dan arahan Pimpinan atas 4 poin keputusan strategis di layar untuk menuntaskan tanda tangan tertunda serta pengiriman Rolling Forecast ${m.activeForecastMonth} ke GA Dept.`,
              ],
        tip: tr(
          'Klik kartu keputusan saat diskusi berlangsung untuk menandai poin yang telah disahkan langsung di hadapan pimpinan.',
          'Click decision items during the meeting to mark ratified points live in front of leadership.'
        ),
      },
    };
    return map[slideIdx] || map[0];
  }, [metrics, slideIdx, language, tr]);

  const boardDecisions = useMemo(() => {
    const m = metrics;
    return [
      {
        id: 'dec-forecast',
        num: '01',
        title: tr(
          `Pengesahan Rolling Forecast GA (${m.activeForecastMonth})`,
          `Endorsement of GA Rolling Forecast (${m.activeForecastMonth})`
        ),
        desc: tr(
          `Usulan pemenuhan ${m.forecastActiveMonthFilled} item (${m.forecastActiveMonthUnits} unit) serta antisipasi ${m.criticalItems} item kritis (${m.outOfStockItems} stok habis) ke GA Dept.`,
          `Endorse ${m.forecastActiveMonthFilled} proposed items (${m.forecastActiveMonthUnits} units) and address ${m.criticalItems} critical items (${m.outOfStockItems} out-of-stock) with GA Dept.`
        ),
        defaultStatus: m.criticalItems > 0 ? 'ACTION' : 'APPROVED',
      },
      {
        id: 'dec-signatures',
        num: '02',
        title: tr(
          'Penyelesaian Tanda Tangan Digital Laporan A3',
          'Completion of Monthly A3 Digital Signatures'
        ),
        desc: tr(
          `${m.reportsFinal}/${m.reportsTotal} laporan sudah FINAL (${m.signatureCompliancePct}% slot TTD selesai). ${
            m.reportsPending > 0
              ? `Terdapat ${m.reportsPending} laporan menunggu tanda tangan peninjau/pimpinan.`
              : 'Seluruh laporan periode ini telah ditandatangani lengkap dan siap audit.'
          }`,
          `${m.reportsFinal}/${m.reportsTotal} reports finalized (${m.signatureCompliancePct}% signatures complete). ${
            m.reportsPending > 0
              ? `${m.reportsPending} report(s) awaiting management sign-off.`
              : 'All period reports are fully signed and audit-ready.'
          }`
        ),
        defaultStatus: m.reportsPending > 0 ? 'ACTION' : 'APPROVED',
      },
      {
        id: 'dec-opname',
        num: '03',
        title: tr(
          'Verifikasi Stock Opname & Penyelarasan Saldo',
          'Stock Opname Verification & Balance Alignment'
        ),
        desc: tr(
          `${m.opnameApproved}/${m.opnameTotal} sesi opname telah disetujui Section Manager dengan ${m.opnameDiscrepancyCount} catatan selisih terdokumentasi dan ${m.requestsPending} permintaan karyawan menunggu approval.`,
          `${m.opnameApproved}/${m.opnameTotal} opname session(s) approved by Section Manager with ${m.opnameDiscrepancyCount} documented variance(s) and ${m.requestsPending} pending employee request(s).`
        ),
        defaultStatus: m.opnamePending > 0 || m.requestsPending > 0 ? 'RECOMMENDED' : 'APPROVED',
      },
      {
        id: 'dec-assets',
        num: '04',
        title: tr(
          'Pemeliharaan & Kesiapan Aset Inventaris Overhead',
          'Overhead Inventory Asset Readiness & Maintenance'
        ),
        desc: tr(
          `${m.assetsBagus}/${m.assetsTotal} aset operasional (MCH/ELC/ATK) dalam kondisi BAGUS (${m.assetsHealthPct}%). ${
            m.assetsRusak > 0
              ? `Diperlukan tindak lanjut perbaikan/penggantian untuk ${m.assetsRusak} aset kondisi RUSAK.`
              : 'Tidak ada aset rusak — pertahankan inspeksi berkala tiap bulan.'
          }`,
          `${m.assetsBagus}/${m.assetsTotal} operational assets (MCH/ELC/ATK) are in GOOD condition (${m.assetsHealthPct}%). ${
            m.assetsRusak > 0
              ? `Repair/replacement follow-up required for ${m.assetsRusak} DAMAGED asset(s).`
              : 'Zero damaged assets — maintain monthly preventive inspection.'
          }`
        ),
        defaultStatus: m.assetsRusak > 0 ? 'ACTION' : 'APPROVED',
      },
    ];
  }, [metrics, tr]);

  if (!open) return null;

  const activeSlide = SLIDES[slideIdx];
  const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(elapsedSeconds % 60).padStart(2, '0');

  const handleCopyNotes = async () => {
    const text = [
      speakerNotes.title,
      '',
      ...speakerNotes.bullets.map((b) => `• ${b}`),
      '',
      `Tip: ${speakerNotes.tip}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotes(true);
      toast(tr('Catatan pembicara disalin', 'Speaker notes copied'), 'success');
      window.setTimeout(() => setCopiedNotes(false), 2000);
    } catch {
      toast(tr('Gagal menyalin catatan', 'Failed to copy notes'), 'error');
    }
  };

  const scopeLabel =
    filters.supplyScope === 'ALL'
      ? tr('Semua Katalog', 'All Catalogs')
      : filters.supplyScope === 'OFFICE_SUPPLIES'
      ? 'Office Supplies'
      : 'Overhead Goods';

  const availabilityStatus =
    metrics.healthyPct >= 85
      ? {
          label: tr('KAPASITAS: STABIL & OPTIMAL', 'CAPACITY: STABLE & OPTIMAL'),
          colorClass: 'text-emerald-700 dark:text-emerald-400',
        }
      : metrics.healthyPct >= 65
      ? {
          label: tr('PERHATIAN: PERLU RESTOCK TERKENDALI', 'WATCH: CONTROLLED RESTOCK NEEDED'),
          colorClass: 'text-amber-700 dark:text-amber-400',
        }
      : {
          label: tr('PRIORITAS: PENGISIAN FORECAST SEGERA', 'PRIORITY: IMMEDIATE FORECAST ACTION'),
          colorClass: 'text-red-700 dark:text-red-400',
        };

  return (
    <div
      ref={deckRef}
      role="dialog"
      aria-modal="true"
      aria-label={tr('Mode Presentasi Direksi', 'Board Presentation Mode')}
      className="no-print fixed inset-0 z-[90] flex flex-col bg-[#F5F7FA] dark:bg-[#0D1015] text-[#1F2328] dark:text-[#F1F3F5] transition-colors duration-200 overflow-hidden"
    >
      {/* Top Executive Deck Header */}
      <header className="shrink-0 px-4 sm:px-6 py-3 bg-white dark:bg-[#141820] border-b border-neutral-200/90 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Corporate Identity & Deck Title */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={store.settings.logoUrl}
            alt="Logo Ajinomoto"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-xl object-contain bg-white border border-neutral-200/80 p-1 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              <span className="font-bold text-theme-primary tracking-wide">
                {tr('RAPAT PIMPINAN · DIREKSI', 'BOARD OF DIRECTORS')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">
                SLIDE {slideIdx + 1} / {SLIDES.length}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="text-sm sm:text-base font-extrabold font-display tracking-tight truncate">
                {tr(
                  'Executive Board Meeting Presentation Deck',
                  'Executive Board Meeting Presentation Deck'
                )}
              </h2>
              <span className="hidden lg:inline text-xs text-neutral-500 dark:text-neutral-400 truncate">
                · PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory ·{' '}
                {language === 'en' ? metrics.horizonMeta.labelEn : metrics.horizonMeta.labelId}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Presenter Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Live Timer */}
          <div className="hidden sm:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F131A] text-xs font-mono-num">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span className="font-semibold tabular-nums">
              {mins}:{secs}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="p-1 rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
              title={timerRunning ? tr('Jeda timer', 'Pause timer') : tr('Lanjutkan timer', 'Resume timer')}
            >
              {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => setElapsedSeconds(0)}
              className="p-1 rounded-md hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
              title={tr('Reset timer', 'Reset timer')}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Live Bilingual ID / EN Switcher */}
          <div
            role="group"
            aria-label={tr('Bahasa Presentasi', 'Presentation Language')}
            className="inline-flex items-center p-0.5 h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-100/90 dark:bg-[#0F131A] text-[11px] font-bold"
          >
            <button
              type="button"
              onClick={() => setLanguage('id')}
              className={`inline-flex items-center gap-1 px-2 h-full rounded-lg transition-colors cursor-pointer ${
                language === 'id'
                  ? 'bg-white dark:bg-[#1E2430] text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3 hidden md:inline" />
              ID
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 h-full rounded-lg transition-colors cursor-pointer ${
                language === 'en'
                  ? 'bg-white dark:bg-[#1E2430] text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Dark / Light Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1A1F29] text-xs font-semibold hover:border-theme-primary transition-colors cursor-pointer whitespace-nowrap"
            title={tr('Ganti Mode Gelap / Terang (T)', 'Toggle Light / Dark Mode (T)')}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">
              {theme === 'dark' ? tr('Light Mode', 'Light Mode') : tr('Dark Mode', 'Dark Mode')}
            </span>
          </button>

          {/* Speaker Notes Toggle */}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              showNotes
                ? 'border-theme-primary bg-theme-primary text-white'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1A1F29] text-neutral-700 dark:text-neutral-200 hover:border-theme-primary'
            }`}
            title={tr('Tampilkan / Sembunyikan Panduan Pembicara (N)', 'Toggle Speaker Notes (N)')}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{tr('Catatan', 'Notes')}</span>
          </button>

          {/* Native Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleNativeFullscreen}
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1A1F29] hover:border-theme-primary transition-colors cursor-pointer"
            title={isNativeFs ? tr('Keluar Fullscreen Browser (F)', 'Exit Browser Fullscreen (F)') : tr('Layar Penuh Browser (F)', 'Browser Fullscreen (F)')}
            aria-label={tr('Layar penuh browser', 'Toggle browser fullscreen')}
          >
            {isNativeFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Slide Prev / Next */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={slideIdx === 0}
              onClick={() => setSlideIdx((s) => Math.max(0, s - 1))}
              className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1A1F29] disabled:opacity-35 hover:border-theme-primary transition-colors cursor-pointer"
              aria-label={tr('Slide sebelumnya', 'Previous slide')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={slideIdx === SLIDES.length - 1}
              onClick={() => setSlideIdx((s) => Math.min(SLIDES.length - 1, s + 1))}
              className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1A1F29] disabled:opacity-35 hover:border-theme-primary transition-colors cursor-pointer"
              aria-label={tr('Slide berikutnya', 'Next slide')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-theme-primary bg-theme-primary-hover text-white transition-colors cursor-pointer"
            aria-label={tr('Tutup Mode Presentasi', 'Close Presentation Mode')}
            title={tr('Tutup (Esc)', 'Close (Esc)')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 5-Step Executive Slide Strip */}
      <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-white/80 dark:bg-[#12161E] border-b border-neutral-200/80 dark:border-neutral-800 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-2 min-w-max">
          {SLIDES.map((s) => {
            const active = s.index === slideIdx;
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => setSlideIdx(s.index)}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-theme-primary text-white border-transparent shadow-sm'
                    : 'bg-white dark:bg-[#181D26] border-neutral-200/90 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-theme-primary/60'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full text-xs font-extrabold font-mono-num flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-white text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {s.index + 1}
                </span>
                <div className="leading-tight">
                  <div className="text-xs font-bold">
                    {language === 'en' ? s.shortTitleEn : s.shortTitleId}
                  </div>
                  <div
                    className={`text-[10px] ${
                      active ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {language === 'en' ? s.shortSubEn : s.shortSubId}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Centered Slide Canvas */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Slide Header Block */}
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="text-[11px] font-bold tracking-wider text-theme-primary">
              {language === 'en' ? activeSlide.kickerEn : activeSlide.kickerId}
              <span className="text-neutral-400 font-normal"> · {scopeLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold font-display tracking-tight text-balance leading-tight">
              {language === 'en' ? activeSlide.headlineEn : activeSlide.headlineId}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl mx-auto">
              {language === 'en' ? activeSlide.subtitleEn : activeSlide.subtitleId}
            </p>
          </div>

          {/* ============================================================== */}
          {/* SLIDE 1: MACRO INVENTORY AVAILABILITY & HEALTH                 */}
          {/* ============================================================== */}
          {slideIdx === 0 && (
            <div className="space-y-5">
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    <span>{tr('Total Katalog Aktif', 'Total Active Catalog')}</span>
                    <Package className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold font-mono-num tabular-nums">
                      {metrics.totalItems}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500">
                      {tr('Item', 'Items')}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {metrics.officeCount} Office Supplies · {metrics.overheadCount} Overhead Goods
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    <span>{tr('Stok Kondisi Sehat', 'Healthy Stock Items')}</span>
                    <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold font-mono-num tabular-nums text-sky-600 dark:text-sky-400">
                      {metrics.healthyItems}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500">
                      ({metrics.healthyPct}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {metrics.totalUnitsInStock.toLocaleString('id-ID')}{' '}
                    {tr('total unit fisik tersedia', 'total physical units in stock')}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    <span>{tr('Stok Kritis & Habis', 'Critical & Out-of-Stock')}</span>
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-extrabold font-mono-num tabular-nums ${
                        metrics.criticalItems > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {metrics.criticalItems}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500">
                      {tr('Item', 'Items')}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {metrics.outOfStockItems} {tr('stok 0 (habis)', 'out of stock (0)')} ·{' '}
                    {Math.max(0, metrics.criticalItems - metrics.outOfStockItems)}{' '}
                    {tr('di bawah min', 'below min')}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    <span>{tr('Kesiapan Tata Kelola', 'Governance Readiness')}</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold font-mono-num tabular-nums text-emerald-600 dark:text-emerald-400">
                      {metrics.governanceReadinessPct}%
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {metrics.signatureCompliancePct}% {tr('TTD A3', 'A3 Sign')} ·{' '}
                    {metrics.assetsHealthPct}% {tr('Aset Bagus', 'Good Assets')}
                  </div>
                </div>
              </div>

              {/* Operational Availability & Tolerance Corridor Card */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      {tr(
                        'Evaluasi Ketersediaan Stok & Koridor Toleransi Operasional HR',
                        'Stock Availability Evaluation & HR Operational Tolerance Corridor'
                      )}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {tr(
                        'Ketersediaan persediaan dijaga di atas target 85% agar operasional administrasi pabrik berjalan tanpa hambatan.',
                        'Inventory availability is benchmarked against an 85%+ target corridor to prevent administrative bottlenecks.'
                      )}
                    </p>
                  </div>
                  <span className={`text-xs font-extrabold tracking-wide ${availabilityStatus.colorClass}`}>
                    {availabilityStatus.label}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>
                      {tr('Ketersediaan Sehat Saat Ini:', 'Current Healthy Availability:')}{' '}
                      <strong className="font-mono-num text-theme-primary">
                        {metrics.healthyPct}%
                      </strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold hidden sm:inline">
                      {tr('Koridor Target: 85% – 100%', 'Target Corridor: 85% – 100%')}
                    </span>
                    <span className="font-mono-num text-neutral-500 dark:text-neutral-400">
                      100% ({metrics.totalItems} {tr('Item', 'Items')})
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(4, metrics.healthyPct))}%`,
                        background: `linear-gradient(90deg, ${activePreset.primary}, #10B981)`,
                      }}
                    />
                  </div>
                </div>

                {/* 3 Readiness Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {tr('Cakupan Lemari Simpan:', 'Storage Cabinet Coverage:')}{' '}
                    </span>
                    <strong className="font-semibold">
                      {metrics.totalCabinets} {tr('Lokasi Terpetakan', 'Locations Mapped')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {tr('Rolling Forecast GA Aktif:', 'Active GA Rolling Forecast:')}{' '}
                    </span>
                    <strong className="font-semibold font-mono-num">
                      {metrics.activeForecastMonth} ({metrics.forecastActiveMonthFilled}{' '}
                      {tr('item', 'items')} / {metrics.forecastActiveMonthUnits}{' '}
                      {tr('unit', 'units')})
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {tr('Status Laporan A3:', 'Monthly A3 Reports:')}{' '}
                    </span>
                    <strong className="font-semibold font-mono-num">
                      {metrics.reportsFinal}/{metrics.reportsTotal} Final ({metrics.signatureCompliancePct}%)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SLIDE 2: CATEGORY & STORAGE CABINET EVALUATION                 */}
          {/* ============================================================== */}
          {slideIdx === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-bold">
                    {tr(
                      'Perbandingan Item Aman vs Kritis per Kategori',
                      'Healthy vs Critical Items by Category'
                    )}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {tr(
                      `Menampilkan ${Math.min(8, metrics.categories.length)} kategori utama berdasarkan jumlah katalog aktif.`,
                      `Showing top ${Math.min(8, metrics.categories.length)} categories by active catalog volume.`
                    )}
                  </p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.categories.slice(0, 8).map((c) => ({
                        name: c.kategori.length > 14 ? `${c.kategori.slice(0, 13)}…` : c.kategori,
                        fullName: c.kategori,
                        [tr('Aman', 'Healthy')]: c.healthyItems,
                        [tr('Kritis', 'Critical')]: c.criticalItems,
                      }))}
                      margin={{ top: 8, right: 8, left: -16, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey={tr('Aman', 'Healthy')}
                        fill={activePreset.primary}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey={tr('Kritis', 'Critical')}
                        fill="#D97706"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">
                    {tr('Item Kritis Prioritas & Lokasi Lemari', 'Priority Critical Items & Cabinets')}
                  </h3>
                  <span className="text-xs font-mono-num text-neutral-500">
                    {metrics.criticalItems} {tr('kritis', 'critical')}
                  </span>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs flex-1 overflow-y-auto max-h-72">
                  {metrics.urgentItems.length === 0 ? (
                    <div className="py-10 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                      {tr(
                        'Seluruh item berada di atas batas minimum.',
                        'All items are comfortably above minimum buffer.'
                      )}
                    </div>
                  ) : (
                    metrics.urgentItems.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{item.itemName}</div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                            {item.codeItem || '-'} · {item.location} · {item.kategori}
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono-num tabular-nums">
                          <div
                            className={`font-bold ${
                              item.currentStock <= 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.currentStock} / {item.minStock} {item.uom}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {item.currentStock <= 0
                              ? tr('HABIS', 'OUT OF STOCK')
                              : tr('DI BAWAH MIN', 'BELOW MIN')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SLIDE 3: OVERHEAD INVENTORY ASSETS & HR REQUEST SERVICE        */}
          {/* ============================================================== */}
          {slideIdx === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              {/* Left: Overhead Inventory Assets */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Box className="w-4 h-4 text-theme-primary" />
                      {tr('Integritas Aset Inventaris Overhead', 'Overhead Inventory Asset Integrity')}
                    </h3>
                    <span className="text-xs font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                      {metrics.assetsHealthPct}% {tr('Siap Pakai', 'Ready')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">MCH ({tr('Mesin', 'Machine')})</div>
                      <div className="text-2xl font-extrabold font-mono-num mt-1">
                        {metrics.mchCount}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">ELC ({tr('Elektronik', 'Electronic')})</div>
                      <div className="text-2xl font-extrabold font-mono-num mt-1">
                        {metrics.elcCount}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">ATK ({tr('Alat Kerja', 'Tools')})</div>
                      <div className="text-2xl font-extrabold font-mono-num mt-1">
                        {metrics.atkCount}
                      </div>
                    </div>
                  </div>

                  {/* Condition Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        {tr('Kondisi BAGUS:', 'GOOD Condition:')}{' '}
                        <strong className="font-mono-num text-emerald-600 dark:text-emerald-400">
                          {metrics.assetsBagus}
                        </strong>
                      </span>
                      <span>
                        {tr('Kondisi RUSAK:', 'DAMAGED:')}{' '}
                        <strong
                          className={`font-mono-num ${
                            metrics.assetsRusak > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-neutral-500'
                          }`}
                        >
                          {metrics.assetsRusak}
                        </strong>
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${metrics.assetsHealthPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  {metrics.damagedAssets.length === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {tr(
                        `Seluruh ${metrics.assetsTotal} aset Inventaris Overhead dalam kondisi BAGUS dan layak operasional.`,
                        `All ${metrics.assetsTotal} Overhead Inventory assets are in GOOD operational condition.`
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="font-semibold text-red-600 dark:text-red-400">
                        {tr('Daftar Aset Perlu Perbaikan / Penggantian:', 'Assets Requiring Maintenance / Replacement:')}
                      </div>
                      {metrics.damagedAssets.slice(0, 4).map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium truncate">
                            {inv.partId} · {inv.itemName}
                          </span>
                          <span className="text-neutral-500 shrink-0">{inv.location}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: HR Supply Requests & Section Activity */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Users className="w-4 h-4 text-theme-primary" />
                      {tr('Layanan Pengambilan Karyawan Dept. HR', 'HR Employee Supply Service')}
                    </h3>
                    <span className="text-xs font-mono-num text-neutral-500">
                      {metrics.activeEmployees} {tr('Karyawan Aktif', 'Active Staff')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">{tr('Disetujui', 'Approved')}</div>
                      <div className="text-2xl font-extrabold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
                        {metrics.requestsApproved}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">{tr('Menunggu', 'Pending')}</div>
                      <div className="text-2xl font-extrabold font-mono-num text-amber-600 dark:text-amber-400 mt-1">
                        {metrics.requestsPending}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">{tr('Ditolak', 'Rejected')}</div>
                      <div className="text-2xl font-extrabold font-mono-num text-neutral-600 dark:text-neutral-300 mt-1">
                        {metrics.requestsRejected}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="font-semibold">HR Development</span>
                      <span className="font-mono-num text-neutral-600 dark:text-neutral-300">
                        {metrics.hrDevEmployees} {tr('karyawan', 'staff')} ·{' '}
                        <strong>{metrics.hrDevRequests}</strong> {tr('permintaan', 'requests')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <span className="font-semibold">Administration &amp; Operation</span>
                      <span className="font-mono-num text-neutral-600 dark:text-neutral-300">
                        {metrics.adminOpsEmployees} {tr('karyawan', 'staff')} ·{' '}
                        <strong>{metrics.adminOpsRequests}</strong> {tr('permintaan', 'requests')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {tr('Tingkat Penyelesaian Layanan (SLA):', 'Service Resolution Rate:')}
                  </span>
                  <strong className="font-mono-num text-theme-primary text-sm">
                    {metrics.requestProcessedPct}%
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SLIDE 4: MONTHLY PACING & GA ROLLING FORECAST                  */}
          {/* ============================================================== */}
          {slideIdx === 3 && (
            <div className="space-y-5">
              <div className="p-6 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold">
                      {tr(
                        'Pergerakan Bulanan: Terima vs Pakai & Rolling Forecast GA',
                        'Monthly Movement: Received vs Consumed & GA Rolling Forecast'
                      )}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {tr(
                        `Periode ${metrics.horizonMeta.labelId} · Total Terima: +${metrics.totalTerima} unit · Total Pakai: -${metrics.totalPakai} unit`,
                        `Horizon ${metrics.horizonMeta.labelEn} · Total Received: +${metrics.totalTerima} units · Total Consumed: -${metrics.totalPakai} units`
                      )}
                    </p>
                  </div>
                  <div className="text-xs font-mono-num text-neutral-500">
                    {tr('Bulan Aktif GA:', 'Active GA Month:')}{' '}
                    <strong className="text-theme-primary">{metrics.activeForecastMonth}</strong>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.monthlyPacing.map((pt) => ({
                        month: pt.monthKey,
                        [tr('Terima', 'Received')]: pt.terima,
                        [tr('Pakai', 'Consumed')]: pt.pakai,
                        [tr('Forecast GA', 'GA Forecast')]: pt.forecastUnits,
                      }))}
                      margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey={tr('Terima', 'Received')} fill="#16A34A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={tr('Pakai', 'Consumed')} fill={activePreset.primary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey={tr('Forecast GA', 'GA Forecast')} fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold">
                    {tr('Top Item Paling Banyak Dipakai', 'Top Consumed Supply Items')}
                  </h4>
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                    {metrics.topConsumed.length === 0 ? (
                      <div className="py-4 text-neutral-500">
                        {tr('Belum ada catatan pemakaian pada periode ini.', 'No consumption logged in this horizon.')}
                      </div>
                    ) : (
                      metrics.topConsumed.slice(0, 5).map((row, idx) => (
                        <div key={row.itemId} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono-num text-neutral-400 mr-2">0{idx + 1}.</span>
                            <span className="font-semibold">{row.itemName}</span>
                          </div>
                          <span className="font-mono-num font-bold text-theme-primary shrink-0">
                            {row.totalPakai} {row.uom}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold">
                    {tr('Kesiapan Rolling Forecast ke GA Dept.', 'GA Dept. Rolling Forecast Readiness')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">
                        {tr(`Usulan ${metrics.activeForecastMonth}`, `${metrics.activeForecastMonth} Proposed`)}
                      </div>
                      <div className="text-xl font-extrabold font-mono-num mt-0.5">
                        {metrics.forecastActiveMonthUnits}{' '}
                        <span className="text-xs font-normal text-neutral-500">
                          ({metrics.forecastActiveMonthFilled} item)
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#10141C] border border-neutral-200/70 dark:border-neutral-800">
                      <div className="text-[11px] text-neutral-500">
                        {tr('Katalog GA R/M Stock = 0', 'GA Catalog R/M Stock = 0')}
                      </div>
                      <div className="text-xl font-extrabold font-mono-num text-amber-600 dark:text-amber-400 mt-0.5">
                        {metrics.zeroRmStockCount}{' '}
                        <span className="text-xs font-normal text-neutral-500">
                          / {metrics.forecastCatalogCount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {tr(
                      `Tercatat ${metrics.forecastSubmissionsCount} riwayat pengiriman Rolling Forecast resmi ke GA Dept. sepanjang tahun fiskal.`,
                      `${metrics.forecastSubmissionsCount} official Rolling Forecast submission(s) to GA Dept. logged this fiscal year.`
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SLIDE 5: GOVERNANCE SCORECARD & BOARD RATIFICATION             */}
          {/* ============================================================== */}
          {slideIdx === 4 && (
            <div className="space-y-5">
              {/* Governance Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500">
                      {tr('Laporan Bulanan A3 & TTD', 'A3 Reports & Signatures')}
                    </div>
                    <div className="text-2xl font-extrabold font-mono-num mt-0.5">
                      {metrics.reportsFinal}/{metrics.reportsTotal}{' '}
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        ({metrics.signatureCompliancePct}%)
                      </span>
                    </div>
                  </div>
                  <FileSpreadsheet className="w-6 h-6 text-theme-primary shrink-0" />
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500">
                      {tr('Verifikasi Stock Opname', 'Stock Opname Verification')}
                    </div>
                    <div className="text-2xl font-extrabold font-mono-num mt-0.5">
                      {metrics.opnameApproved}/{metrics.opnameTotal}{' '}
                      <span className="text-xs font-normal text-neutral-500">
                        ({metrics.opnameDiscrepancyCount} {tr('selisih', 'variances')})
                      </span>
                    </div>
                  </div>
                  <ClipboardCheck className="w-6 h-6 text-theme-primary shrink-0" />
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#171B24] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500">
                      {tr('Arsip Dokumen Sistem', 'System Document Archive')}
                    </div>
                    <div className="text-2xl font-extrabold font-mono-num mt-0.5">
                      {metrics.documentsTotal}{' '}
                      <span className="text-xs font-normal text-neutral-500">
                        {tr('dokumen', 'files')}
                      </span>
                    </div>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
              </div>

              {/* 4 Board Ratification Decisions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boardDecisions.map((dec) => {
                  const isRatified = Boolean(ratifiedDecisions[dec.id]);
                  return (
                    <button
                      key={dec.id}
                      type="button"
                      onClick={() => onToggleRatify(dec.id)}
                      className={`text-left p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isRatified
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-400/70 dark:border-emerald-700'
                          : 'bg-white dark:bg-[#171B24] border-neutral-200/80 dark:border-neutral-800 hover:border-theme-primary'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-bold leading-snug">
                          <span className="font-mono-num text-theme-primary mr-1.5">{dec.num}.</span>
                          {dec.title}
                        </div>
                        <span
                          className={`text-[10px] font-extrabold tracking-wide shrink-0 ${
                            isRatified
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : dec.defaultStatus === 'ACTION'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-sky-700 dark:text-sky-400'
                          }`}
                        >
                          {isRatified
                            ? tr('✓ DISAHKAN', '✓ RATIFIED')
                            : dec.defaultStatus === 'ACTION'
                            ? tr('PERLU ARAHAN', 'ACTION NEEDED')
                            : dec.defaultStatus === 'RECOMMENDED'
                            ? tr('DIREKOMENDASIKAN', 'RECOMMENDED')
                            : tr('SIAP DISAHKAN', 'READY')}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {dec.desc}
                      </p>
                      <div className="pt-1 text-[11px] font-semibold text-theme-primary">
                        {isRatified
                          ? tr('Klik untuk batalkan tanda pengesahan', 'Click to undo ratification mark')
                          : tr('Klik untuk menandai disahkan dalam rapat', 'Click to ratify during meeting')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Presenter Speaker Talking Points Guide (Collapsible, Warm Amber Box) */}
          {showNotes && (
            <div className="p-5 rounded-2xl border border-amber-300/80 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-950/25 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold tracking-wide text-amber-950 dark:text-amber-200">
                      {tr('PANDUAN POIN BICARA PRESENTER', 'PRESENTER SPEAKER TALKING POINTS GUIDE')}
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300/90 truncate">
                      {speakerNotes.title}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300/80 dark:hover:bg-amber-800/70 text-amber-950 dark:text-amber-100 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {copiedNotes ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedNotes ? tr('Tersalin', 'Copied') : tr('Salin Catatan', 'Copy Notes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotes(false)}
                    className="p-1.5 rounded-lg text-amber-900 dark:text-amber-200 hover:bg-amber-200/60 dark:hover:bg-amber-900/50 cursor-pointer"
                    aria-label={tr('Sembunyikan catatan', 'Hide notes')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100/90 leading-relaxed pl-1">
                {speakerNotes.bullets.map((bullet, bIdx) => (
                  <p key={bIdx} className="italic">
                    • “{bullet}”
                  </p>
                ))}
              </div>

              <div className="px-3.5 py-2.5 rounded-xl bg-amber-100/90 dark:bg-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>{tr('Tips Presenter:', 'Presenter Tip:')}</strong> {speakerNotes.tip}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Executive Deck Footer */}
      <footer className="shrink-0 px-4 sm:px-6 py-2.5 bg-white dark:bg-[#141820] border-t border-neutral-200/90 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        <div className="truncate">
          PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory ·{' '}
          {language === 'en' ? metrics.horizonMeta.labelEn : metrics.horizonMeta.labelId}
        </div>

        {/* Interactive Slide Dots */}
        <div className="flex items-center gap-1.5">
          {SLIDES.map((s) => (
            <button
              key={s.index}
              type="button"
              onClick={() => setSlideIdx(s.index)}
              aria-label={`Slide ${s.index + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                s.index === slideIdx
                  ? 'w-7 bg-theme-primary'
                  : 'w-2 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>

        {/* Keyboard Shortcut Legend */}
        <div className="hidden lg:flex items-center gap-3 font-mono-num text-[10px]">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-1">
              ←/→
            </kbd>
            {tr('Navigasi', 'Navigate')}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-1">
              T
            </kbd>
            {tr('Tema', 'Theme')}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-1">
              L
            </kbd>
            ID/EN
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-1">
              N
            </kbd>
            {tr('Catatan', 'Notes')}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-1">
              F
            </kbd>
            Fullscreen
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 mr-1">
              ESC
            </kbd>
            {tr('Tutup', 'Close')}
          </span>
        </div>
      </footer>
    </div>
  );
};
