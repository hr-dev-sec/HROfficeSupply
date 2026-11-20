import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarRange,
  Clock,
  FileCheck2,
  Package,
  PenTool,
  Send,
  TrendingDown,
} from 'lucide-react';
import { CountUp } from '../components/common/CountUp';
import { ReportStepper } from '../components/common/ReportStepper';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import type { ReportType } from '../types';
import {
  formatDateTimeIndo,
  formatPeriodShort,
  getStageLabel,
} from '../utils/format';

const CHART_COLORS = ['#E60012', '#C9A24B', '#1F2328', '#0284C7', '#16A34A', '#64748B'];

const STORAGE_CELLS = [
  { key: 'Lemari 5 Baris 1', cabinet: 'Lemari 5', row: 'Baris 1' },
  { key: 'Lemari 5 Baris 2', cabinet: 'Lemari 5', row: 'Baris 2' },
  { key: 'Lemari 6 Baris 1', cabinet: 'Lemari 6', row: 'Baris 1' },
  { key: 'Lemari 6 Baris 2', cabinet: 'Lemari 6', row: 'Baris 2' },
  { key: 'Lemari 7 Baris 1', cabinet: 'Lemari 7', row: 'Baris 1' },
  { key: 'Lemari 7 Baris 2', cabinet: 'Lemari 7', row: 'Baris 2' },
  { key: 'Cabinet 5 Baris 1', cabinet: 'Cabinet 5', row: 'Baris 1' },
  { key: 'Cabinet 5 Baris 2', cabinet: 'Cabinet 5', row: 'Baris 2' },
  { key: 'Cabinet 6 Baris 1', cabinet: 'Cabinet 6', row: 'Baris 1' },
  { key: 'Cabinet 6 Baris 2', cabinet: 'Cabinet 6', row: 'Baris 2' },
];

export const DashboardPage: React.FC = () => {
  const { user, canEditOperational } = useAuth();
  const { store, updateForecastRow } = useSupplyHub();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState('2026-09');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('OFFICE_SUPPLIES');
  const [heatmapMode, setHeatmapMode] = useState<'COUNT' | 'CRITICAL'>('COUNT');

  const availablePeriods = useMemo(() => {
    const set = new Set<string>(['2026-08', '2026-09', '2026-10']);
    store.reports.forEach((r) => set.add(r.period));
    return Array.from(set).sort().reverse();
  }, [store.reports]);

  const activeItems = useMemo(
    () =>
      store.items.filter(
        (i) =>
          !i.archived &&
          (selectedReportType === 'INVENTARIS_OVERHEAD'
            ? i.jenis === 'OVERHEAD_GOODS'
            : i.jenis === selectedReportType)
      ),
    [selectedReportType, store.items]
  );

  const criticalItems = useMemo(
    () => activeItems.filter((i) => i.currentStock <= i.minStock),
    [activeItems]
  );

  const activeForecastMonth = store.rollingForecast.activeMonth;
  const forecastSummary = useMemo(() => {
    const rows = store.rollingForecast.rows;
    const filled = rows.filter((r) => (r.months[activeForecastMonth] || 0) > 0);
    const totalUnits = filled.reduce((s, r) => s + (r.months[activeForecastMonth] || 0), 0);
    return {
      filledCount: filled.length,
      totalUnits,
    };
  }, [activeForecastMonth, store.rollingForecast.rows]);

  const monthlyUsageQty = useMemo(() => {
    return store.transactions
      .filter((t) => t.period === selectedPeriod && t.type === 'PAKAI')
      .reduce((sum, t) => sum + t.qty, 0);
  }, [selectedPeriod, store.transactions]);

  const activeReport = useMemo(() => {
    return (
      store.reports.find(
        (r) => r.period === selectedPeriod && r.jenis === selectedReportType
      ) || store.reports[0]
    );
  }, [selectedPeriod, selectedReportType, store.reports]);

  // 12-Month Area Chart (Terima vs Pakai)
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { period: string; label: string; terima: number; pakai: number }>();
    const months = [
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ];
    months.forEach((m) =>
      map.set(m, { period: m, label: formatPeriodShort(m), terima: 0, pakai: 0 })
    );
    store.transactions.forEach((tx) => {
      const bucket = map.get(tx.period);
      if (!bucket) return;
      if (tx.type === 'TERIMA') bucket.terima += tx.qty;
      if (tx.type === 'PAKAI') bucket.pakai += tx.qty;
    });
    return Array.from(map.values());
  }, [store.transactions]);

  // Donut: Stock Composition by Category (Top 5 + Lainnya)
  const categoryDonut = useMemo(() => {
    const sums = new Map<string, number>();
    activeItems.forEach((item) => {
      sums.set(item.kategori, (sums.get(item.kategori) || 0) + item.currentStock);
    });
    const sorted = Array.from(sums.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (sorted.length <= 5) return sorted;
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((s, r) => s + r.value, 0);
    return [...top5, { name: 'Lainnya', value: rest }];
  }, [activeItems]);

  // Horizontal Bar: Top 10 Usage Items
  const top10Usage = useMemo(() => {
    const sums = new Map<string, { name: string; qty: number }>();
    store.transactions
      .filter((t) => t.type === 'PAKAI')
      .forEach((t) => {
        const curr = sums.get(t.itemId) || { name: t.itemName, qty: 0 };
        curr.qty += t.qty;
        sums.set(t.itemId, curr);
      });
    return Array.from(sums.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
      .map((x) => ({
        name: x.name.length > 22 ? x.name.slice(0, 22) + '…' : x.name,
        qty: x.qty,
      }));
  }, [store.transactions]);

  // Heatmap stats
  const heatmapCells = useMemo(() => {
    const allNonArchived = store.items.filter((i) => !i.archived);
    return STORAGE_CELLS.map((cell) => {
      const inCell = allNonArchived.filter((i) => i.location === cell.key);
      const critCount = inCell.filter((i) => i.currentStock <= i.minStock).length;
      return {
        ...cell,
        totalItems: inCell.length,
        totalStock: inCell.reduce((s, i) => s + i.currentStock, 0),
        critCount,
      };
    });
  }, [store.items]);

  // Pending Signatures for current user
  const pendingForMe = useMemo(() => {
    if (!user) return [];
    const list: Array<{ reportId: string; title: string; periodLabel: string; groupLabel: string; slotName: string }> = [];
    store.reports
      .filter((r) => !r.locked)
      .forEach((rep) => {
        const dilGroup = rep.signatureGroups.find((g) => g.stage === 'DILAPORKAN');
        const dicGroup = rep.signatureGroups.find((g) => g.stage === 'DICHECK');
        const dilDone = !dilGroup || dilGroup.slots.every((s) => s.status === 'SIGNED');
        const dicDone = !dicGroup || dicGroup.slots.every((s) => s.status === 'SIGNED');

        rep.signatureGroups.forEach((g) => {
          const stageReady =
            g.stage === 'DILAPORKAN' ||
            (g.stage === 'DICHECK' && dilDone) ||
            (g.stage === 'MENGETAHUI' && dilDone && dicDone);
          if (!stageReady) return;
          g.slots.forEach((s) => {
            if (s.status === 'PENDING' && (user.role === 'SUPER_ADMIN' || s.allowedUserId === user.id)) {
              list.push({
                reportId: rep.id,
                title: rep.title,
                periodLabel: rep.periodLabel,
                groupLabel: g.label.replace(',', ''),
                slotName: s.name,
              });
            }
          });
        });
      });
    return list;
  }, [store.reports, user]);

  const handleQuickAddForecast = (itemId: string) => {
    if (!user) return;
    const item = store.items.find((i) => i.id === itemId);
    if (!item) return;
    const qty = Math.max(2, item.minStock * 2 - item.currentStock);
    const norm = (s: string) => s.trim().toLowerCase();
    const match = store.rollingForecast.rows.find(
      (r) =>
        (item.codeItem && r.codeItem && norm(r.codeItem) === norm(item.codeItem)) ||
        norm(r.itemName) === norm(item.itemName) ||
        norm(r.itemDescription).includes(norm(item.itemName))
    );
    if (!match) {
      toast(
        'Item belum ada di daftar GA',
        'info',
        `Silakan tambahkan "${item.itemName}" di menu Rolling Forecast GA.`
      );
      navigate('/app/forecast');
      return;
    }
    updateForecastRow(
      match.id,
      {
        rmStock: item.currentStock,
        monthQty: { month: activeForecastMonth, qty },
      },
      user
    );
    toast(
      `Forecast ${activeForecastMonth} diperbarui`,
      'success',
      `${match.itemName}: ${qty} ${match.uom} siap dikirim ke GA Dept.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight">
            Ikhtisar Persediaan &amp; Persetujuan HR
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Pantau stok Office Supplies, Overhead Goods, kesiapan opname, dan status tanda tangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            aria-label="Filter periode bulan"
            className="px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold"
          >
            {availablePeriods.map((p) => (
              <option key={p} value={p}>
                Periode {formatPeriodShort(p)}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-800">
            {(
              [
                { id: 'OFFICE_SUPPLIES', label: 'Office Supplies' },
                { id: 'OVERHEAD_GOODS', label: 'Overhead Goods' },
                { id: 'INVENTARIS_OVERHEAD', label: 'Inventaris' },
              ] as Array<{ id: ReportType; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedReportType(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedReportType === tab.id
                    ? 'bg-white dark:bg-[#171A1F] text-[#1F2328] dark:text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5 Animated KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Total Item Aktif</span>
            <Package className="w-4 h-4 text-[#E60012]" />
          </div>
          <div className="text-2xl font-extrabold font-display mt-2">
            <CountUp value={activeItems.length} />
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {store.inventories.length} aset inventaris Overhead
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Di Bawah Minimum</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold font-display text-amber-600 dark:text-amber-400 mt-2">
            <CountUp value={criticalItems.length} />
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Perlu update forecast GA</div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/forecast')}
          className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] text-left hover:border-[#C9A24B]/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Rolling Forecast GA</span>
            <CalendarRange className="w-4 h-4 text-[#C9A24B]" />
          </div>
          <div className="text-2xl font-extrabold font-display mt-2">
            <CountUp value={forecastSummary.totalUnits} />
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 truncate">
            {activeForecastMonth} · {forecastSummary.filledCount} item diajukan
          </div>
        </button>

        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Pemakaian Periode</span>
            <TrendingDown className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold font-display mt-2">
            <CountUp value={monthlyUsageQty} />
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Total unit keluar ({formatPeriodShort(selectedPeriod)})
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-xs font-medium">Status Laporan</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold font-display mt-2 text-emerald-700 dark:text-emerald-400">
            {activeReport ? getStageLabel(activeReport.status) : 'Belum Ada'}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 truncate">
            {activeReport ? activeReport.documentId : 'Buat laporan periode ini'}
          </div>
        </div>
      </div>

      {/* Stepper Status Laporan + Menunggu Tanda Tangan Saya */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold">Progres Pengesahan Laporan Bulanan</h3>
              <p className="text-xs text-neutral-500 mt-0.5 truncate">
                {activeReport ? `${activeReport.title} (${activeReport.periodLabel})` : 'Belum ada laporan'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/reports')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E60012] hover:underline whitespace-nowrap"
            >
              Buka Laporan
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {activeReport ? (
            <ReportStepper report={activeReport} />
          ) : (
            <p className="text-xs text-neutral-500">Tidak ada laporan pada periode ini.</p>
          )}
        </div>

        <div className="xl:col-span-4 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Menunggu Tanda Tangan Saya</h3>
              <PenTool className="w-4 h-4 text-[#E60012]" />
            </div>
            {pendingForMe.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Tidak ada dokumen yang menunggu tanda tangan Anda saat ini.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingForMe.slice(0, 3).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => navigate('/app/signatures')}
                    className="w-full text-left p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-[#E60012] transition-colors"
                  >
                    <div className="text-xs font-bold truncate">{p.title}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {p.periodLabel} · {p.groupLabel} ({p.slotName})
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/signatures')}
            className="w-full py-2.5 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold transition-colors"
          >
            Buka Antrean Tanda Tangan ({pendingForMe.length})
          </button>
        </div>
      </div>

      {/* Charts Row: 12-Month Area Chart + Category Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold">Tren Terima vs Pakai (12 Bulan)</h3>
              <p className="text-xs text-neutral-500">Perbandingan volume barang masuk dan keluar</p>
            </div>
          </div>
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="gradTerima" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPakai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E60012" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#E60012" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.18} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="terima"
                  name="Terima"
                  stroke="#16A34A"
                  strokeWidth={2}
                  fill="url(#gradTerima)"
                />
                <Area
                  type="monotone"
                  dataKey="pakai"
                  name="Pakai"
                  stroke="#E60012"
                  strokeWidth={2}
                  fill="url(#gradPakai)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <h3 className="text-sm font-bold mb-1">Komposisi Stok per Kategori</h3>
          <p className="text-xs text-neutral-500 mb-3">Distribusi unit tersedia saat ini</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDonut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {categoryDonut.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
            {categoryDonut.map((c, idx) => (
              <div key={c.name} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="font-mono-num font-semibold">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 Horizontal Bar & Storage Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <h3 className="text-sm font-bold mb-1">Item dengan Pemakaian Terbesar</h3>
          <p className="text-xs text-neutral-500 mb-4">Akumulasi kuantitas pemakaian tercatat</p>
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Usage} layout="vertical" margin={{ left: 6, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" name="Total Pakai" fill="#E60012" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-6 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#C9A24B]" />
                Heatmap Penyimpanan Lemari &amp; Cabinet
              </h3>
              <p className="text-xs text-neutral-500">
                Pemetaan Lemari 5, 6, 7 &amp; Cabinet 5, 6 (Baris 1 &amp; 2)
              </p>
            </div>
            <div className="flex items-center p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px]">
              <button
                type="button"
                onClick={() => setHeatmapMode('COUNT')}
                className={`px-2.5 py-1 rounded-md font-semibold ${
                  heatmapMode === 'COUNT'
                    ? 'bg-white dark:bg-[#171A1F] shadow-sm'
                    : 'text-neutral-500'
                }`}
              >
                Jumlah Item
              </button>
              <button
                type="button"
                onClick={() => setHeatmapMode('CRITICAL')}
                className={`px-2.5 py-1 rounded-md font-semibold ${
                  heatmapMode === 'CRITICAL'
                    ? 'bg-white dark:bg-[#171A1F] shadow-sm'
                    : 'text-neutral-500'
                }`}
              >
                Tingkat Kritis
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {heatmapCells.map((cell) => {
              const bgClass =
                heatmapMode === 'CRITICAL'
                  ? cell.critCount >= 4
                    ? 'bg-red-500/20 border-red-400 dark:border-red-700'
                    : cell.critCount >= 1
                    ? 'bg-amber-500/15 border-amber-400 dark:border-amber-700'
                    : 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-800'
                  : cell.totalItems >= 15
                  ? 'bg-[#E60012]/15 border-[#E60012]/40'
                  : cell.totalItems >= 6
                  ? 'bg-[#C9A24B]/15 border-[#C9A24B]/40'
                  : 'bg-neutral-100 dark:bg-neutral-800/70 border-neutral-200 dark:border-neutral-700';

              return (
                <div
                  key={cell.key}
                  className={`p-3 rounded-xl border transition-colors ${bgClass}`}
                >
                  <div className="text-[11px] font-bold">{cell.cabinet}</div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {cell.row}
                  </div>
                  <div className="mt-2 font-mono-num text-base font-extrabold">
                    {heatmapMode === 'CRITICAL' ? cell.critCount : cell.totalItems}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {heatmapMode === 'CRITICAL' ? 'item kritis' : `item (${cell.totalStock} unit)`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Critical Stock Table + Recent Activity Timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Peringatan Stok Kritis</h3>
              <p className="text-xs text-neutral-500">
                Item dengan Stock Akhir ≤ Minimum Stok ({criticalItems.length} item)
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/forecast')}
              className="text-xs font-semibold text-[#E60012] hover:underline"
            >
              Kelola Rolling Forecast GA
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="py-2 px-2 font-semibold text-right">Stok</th>
                  <th className="py-2 px-2 font-semibold text-right">Min</th>
                  <th className="py-2 px-2 font-semibold">Lokasi</th>
                  {canEditOperational && <th className="py-2 pl-2 text-right font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {criticalItems.slice(0, 7).map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold">{item.itemName}</div>
                      <div className="text-[11px] text-neutral-500 font-mono-num">
                        {item.codeItem || '-'} · {item.kategori}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono-num font-bold text-[#E60012]">
                      {item.currentStock} {item.uom}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono-num text-neutral-500">
                      {item.minStock}
                    </td>
                    <td className="py-2.5 px-2 text-neutral-600 dark:text-neutral-400">
                      {item.location}
                    </td>
                    {canEditOperational && (
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleQuickAddForecast(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E60012]/10 text-[#E60012] hover:bg-[#E60012] hover:text-white text-[11px] font-semibold transition-colors whitespace-nowrap"
                        >
                          <Send className="w-3 h-3" />
                          Ajukan ke RF {activeForecastMonth}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Timeline Aktivitas Terbaru</h3>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-3">
            {store.auditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800 last:border-none last:pb-0"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {log.action.slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-semibold truncate">
                    {log.userName} · <span className="text-[#E60012]">{log.action}</span>
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-400 truncate">
                    {log.objectType}: {log.objectLabel}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono-num mt-0.5">
                    {formatDateTimeIndo(log.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
