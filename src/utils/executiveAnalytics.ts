import {
  FORECAST_MONTH_KEYS,
  type ForecastMonthKey,
  type HrSection,
  type OverheadInventoryItem,
  type SupplyHubStore,
  type SupplyItem,
  type SupplyType,
} from '../types';

export type FiscalHorizon = 'FULL_FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type SupplyScopeFilter = 'ALL' | SupplyType;
export type SectionScopeFilter = 'ALL' | HrSection;

export interface ExecutiveFilterState {
  horizon: FiscalHorizon;
  supplyScope: SupplyScopeFilter;
  sectionScope: SectionScopeFilter;
}

const HORIZON_CONFIG: Record<
  FiscalHorizon,
  {
    labelId: string;
    labelEn: string;
    shortLabel: string;
    forecastKeys: ForecastMonthKey[];
    ymPeriods: string[];
  }
> = {
  FULL_FY: {
    labelId: 'Full FY 2026/2027 (Apr–Mar)',
    labelEn: 'Full FY 2026/2027 (Apr–Mar)',
    shortLabel: 'Full FY (Apr–Mar)',
    forecastKeys: [...FORECAST_MONTH_KEYS],
    ymPeriods: [
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
    ],
  },
  Q1: {
    labelId: 'Q1 FY2026 (Apr–Jun)',
    labelEn: 'Q1 FY2026 (Apr–Jun)',
    shortLabel: 'Q1 (Apr–Jun)',
    forecastKeys: ['Apr-26', 'May-26', 'Jun-26'],
    ymPeriods: ['2026-04', '2026-05', '2026-06'],
  },
  Q2: {
    labelId: 'Q2 FY2026 (Jul–Sep)',
    labelEn: 'Q2 FY2026 (Jul–Sep)',
    shortLabel: 'Q2 (Jul–Sep)',
    forecastKeys: ['Jul-26', 'Aug-26', 'Sep-26'],
    ymPeriods: ['2026-07', '2026-08', '2026-09'],
  },
  Q3: {
    labelId: 'Q3 FY2026 (Okt–Des)',
    labelEn: 'Q3 FY2026 (Oct–Dec)',
    shortLabel: 'Q3 (Oct–Dec)',
    forecastKeys: ['Oct-26', 'Nov-26', 'Dec-26'],
    ymPeriods: ['2026-10', '2026-11', '2026-12'],
  },
  Q4: {
    labelId: 'Q4 FY2026 (Jan–Mar)',
    labelEn: 'Q4 FY2026 (Jan–Mar)',
    shortLabel: 'Q4 (Jan–Mar)',
    forecastKeys: ['Jan-27', 'Feb-27', 'Mar-27'],
    ymPeriods: ['2027-01', '2027-02', '2027-03'],
  },
};

export interface CategoryHealthRow {
  kategori: string;
  jenis: SupplyType;
  totalItems: number;
  healthyItems: number;
  criticalItems: number;
  outOfStockItems: number;
  totalUnits: number;
  healthyPct: number;
}

export interface CabinetSummaryRow {
  location: string;
  totalItems: number;
  criticalItems: number;
  assetsCount: number;
}

export interface MonthlyPacingPoint {
  monthKey: ForecastMonthKey;
  period: string;
  terima: number;
  pakai: number;
  forecastUnits: number;
}

export interface TopConsumedRow {
  itemId: string;
  codeItem: string;
  itemName: string;
  uom: string;
  totalPakai: number;
  currentStock: number;
  minStock: number;
}

export interface ExecutiveMetrics {
  horizonMeta: (typeof HORIZON_CONFIG)[FiscalHorizon];
  // 1. Supply Stock Health
  totalItems: number;
  officeCount: number;
  overheadCount: number;
  healthyItems: number;
  criticalItems: number;
  outOfStockItems: number;
  healthyPct: number;
  totalUnitsInStock: number;
  urgentItems: SupplyItem[];
  // 2. Category & Storage
  categories: CategoryHealthRow[];
  cabinets: CabinetSummaryRow[];
  totalCabinets: number;
  // 3. Overhead Inventory Assets
  assetsTotal: number;
  assetsBagus: number;
  assetsRusak: number;
  assetsHealthPct: number;
  mchCount: number;
  elcCount: number;
  atkCount: number;
  damagedAssets: OverheadInventoryItem[];
  // 4. HR Employees & Supply Requests
  activeEmployees: number;
  hrDevEmployees: number;
  adminOpsEmployees: number;
  requestsTotal: number;
  requestsPending: number;
  requestsApproved: number;
  requestsRejected: number;
  requestProcessedPct: number;
  hrDevRequests: number;
  adminOpsRequests: number;
  // 5. Consumption & GA Rolling Forecast
  totalTerima: number;
  totalPakai: number;
  txCount: number;
  monthlyPacing: MonthlyPacingPoint[];
  topConsumed: TopConsumedRow[];
  activeForecastMonth: ForecastMonthKey;
  forecastCatalogCount: number;
  forecastFilledInHorizon: number;
  forecastUnitsInHorizon: number;
  forecastActiveMonthFilled: number;
  forecastActiveMonthUnits: number;
  zeroRmStockCount: number;
  forecastSubmissionsCount: number;
  // 6. Governance: Reports, Signatures, Opname & Archive
  reportsTotal: number;
  reportsFinal: number;
  reportsPending: number;
  totalSignatureSlots: number;
  signedSignatureSlots: number;
  signatureCompliancePct: number;
  pendingReportTitles: Array<{ id: string; documentId: string; title: string; periodLabel: string; pendingNames: string[] }>;
  opnameTotal: number;
  opnameApproved: number;
  opnamePending: number;
  opnameDiscrepancyCount: number;
  documentsTotal: number;
  governanceReadinessPct: number;
}

export function getHorizonOptions() {
  return (Object.keys(HORIZON_CONFIG) as FiscalHorizon[]).map((key) => ({
    key,
    ...HORIZON_CONFIG[key],
  }));
}

export function computeExecutiveMetrics(
  store: SupplyHubStore,
  filters: ExecutiveFilterState
): ExecutiveMetrics {
  const horizonMeta = HORIZON_CONFIG[filters.horizon];
  const ymSet = new Set(horizonMeta.ymPeriods);
  const fkSet = new Set(horizonMeta.forecastKeys);

  // 1. Supply Items
  const allActiveItems = store.items.filter((i) => !i.archived);
  const scopedItems =
    filters.supplyScope === 'ALL'
      ? allActiveItems
      : allActiveItems.filter((i) => i.jenis === filters.supplyScope);

  const officeCount = scopedItems.filter((i) => i.jenis === 'OFFICE_SUPPLIES').length;
  const overheadCount = scopedItems.filter((i) => i.jenis === 'OVERHEAD_GOODS').length;
  const outOfStockItems = scopedItems.filter((i) => i.currentStock <= 0).length;
  const criticalList = scopedItems
    .filter((i) => i.currentStock <= i.minStock)
    .sort((a, b) => a.currentStock - a.minStock - (b.currentStock - b.minStock));
  const criticalItems = criticalList.length;
  const healthyItems = Math.max(0, scopedItems.length - criticalItems);
  const healthyPct =
    scopedItems.length > 0 ? Math.round((healthyItems / scopedItems.length) * 1000) / 10 : 100;
  const totalUnitsInStock = scopedItems.reduce((sum, i) => sum + i.currentStock, 0);

  // 2. Category Breakdown
  const catMap = new Map<string, CategoryHealthRow>();
  for (const item of scopedItems) {
    const key = `${item.jenis}::${item.kategori}`;
    const prev = catMap.get(key) || {
      kategori: item.kategori,
      jenis: item.jenis,
      totalItems: 0,
      healthyItems: 0,
      criticalItems: 0,
      outOfStockItems: 0,
      totalUnits: 0,
      healthyPct: 100,
    };
    prev.totalItems += 1;
    prev.totalUnits += item.currentStock;
    if (item.currentStock <= 0) prev.outOfStockItems += 1;
    if (item.currentStock <= item.minStock) prev.criticalItems += 1;
    else prev.healthyItems += 1;
    prev.healthyPct = Math.round((prev.healthyItems / prev.totalItems) * 1000) / 10;
    catMap.set(key, prev);
  }
  const categories = Array.from(catMap.values()).sort((a, b) => b.totalItems - a.totalItems);

  // Storage Cabinet Breakdown
  const cabMap = new Map<string, CabinetSummaryRow>();
  for (const item of scopedItems) {
    const loc = item.location || 'Lainnya';
    const prev = cabMap.get(loc) || { location: loc, totalItems: 0, criticalItems: 0, assetsCount: 0 };
    prev.totalItems += 1;
    if (item.currentStock <= item.minStock) prev.criticalItems += 1;
    cabMap.set(loc, prev);
  }
  for (const inv of store.inventories) {
    const loc = inv.location || 'Lainnya';
    const prev = cabMap.get(loc) || { location: loc, totalItems: 0, criticalItems: 0, assetsCount: 0 };
    prev.assetsCount += 1;
    cabMap.set(loc, prev);
  }
  const cabinets = Array.from(cabMap.values()).sort(
    (a, b) => b.totalItems + b.assetsCount - (a.totalItems + a.assetsCount)
  );

  // 3. Overhead Inventory Assets
  const assetsTotal = store.inventories.length;
  const assetsBagus = store.inventories.filter((i) => i.condition === 'BAGUS').length;
  const damagedAssets = store.inventories.filter((i) => i.condition === 'RUSAK');
  const assetsRusak = damagedAssets.length;
  const assetsHealthPct =
    assetsTotal > 0 ? Math.round((assetsBagus / assetsTotal) * 1000) / 10 : 100;
  const mchCount = store.inventories.filter((i) => i.prefix === 'MCH').length;
  const elcCount = store.inventories.filter((i) => i.prefix === 'ELC').length;
  const atkCount = store.inventories.filter((i) => i.prefix === 'ATK').length;

  // 4. HR Employees & Requests
  const allActiveEmployees = store.employees.filter((e) => e.active);
  const scopedEmployees =
    filters.sectionScope === 'ALL'
      ? allActiveEmployees
      : allActiveEmployees.filter((e) => e.section === filters.sectionScope);
  const hrDevEmployees = allActiveEmployees.filter((e) => e.section === 'HR Development').length;
  const adminOpsEmployees = allActiveEmployees.filter(
    (e) => e.section === 'Administration & Operation'
  ).length;

  const scopedRequests = store.itemRequests.filter((r) => {
    const sectionOk =
      filters.sectionScope === 'ALL' || r.requesterSection === filters.sectionScope;
    const periodYm = r.requestDate.slice(0, 7);
    const periodOk = filters.horizon === 'FULL_FY' || ymSet.has(periodYm);
    return sectionOk && periodOk;
  });
  const requestsTotal = scopedRequests.length;
  const requestsPending = scopedRequests.filter((r) => r.status === 'MENUNGGU').length;
  const requestsApproved = scopedRequests.filter((r) => r.status === 'DISETUJUI').length;
  const requestsRejected = scopedRequests.filter((r) => r.status === 'DITOLAK').length;
  const requestProcessedPct =
    requestsTotal > 0
      ? Math.round(((requestsApproved + requestsRejected) / requestsTotal) * 1000) / 10
      : 100;
  const hrDevRequests = scopedRequests.filter((r) => r.requesterSection === 'HR Development').length;
  const adminOpsRequests = scopedRequests.filter(
    (r) => r.requesterSection === 'Administration & Operation'
  ).length;

  // 5. Transactions & Rolling Forecast Pacing
  const scopedTx = store.transactions.filter((tx) => {
    const scopeOk = filters.supplyScope === 'ALL' || tx.jenis === filters.supplyScope;
    const periodOk = ymSet.has(tx.period);
    return scopeOk && periodOk;
  });

  const totalTerima = scopedTx
    .filter((tx) => tx.type === 'TERIMA')
    .reduce((sum, tx) => sum + tx.qty, 0);
  const totalPakai = scopedTx
    .filter((tx) => tx.type === 'PAKAI')
    .reduce((sum, tx) => sum + tx.qty, 0);

  const monthlyPacing: MonthlyPacingPoint[] = horizonMeta.forecastKeys.map((monthKey, idx) => {
    const period = horizonMeta.ymPeriods[idx];
    const monthTxs = scopedTx.filter((tx) => tx.period === period);
    const terima = monthTxs
      .filter((tx) => tx.type === 'TERIMA')
      .reduce((s, tx) => s + tx.qty, 0);
    const pakai = monthTxs
      .filter((tx) => tx.type === 'PAKAI')
      .reduce((s, tx) => s + tx.qty, 0);
    const forecastUnits =
      filters.supplyScope === 'OVERHEAD_GOODS'
        ? 0
        : store.rollingForecast.rows.reduce((s, row) => s + (row.months[monthKey] || 0), 0);

    return {
      monthKey,
      period,
      terima,
      pakai,
      forecastUnits,
    };
  });

  const itemLookup = new Map(store.items.map((i) => [i.id, i]));
  const usageMap = new Map<string, TopConsumedRow>();
  for (const tx of scopedTx) {
    if (tx.type !== 'PAKAI') continue;
    const prev = usageMap.get(tx.itemId) || {
      itemId: tx.itemId,
      codeItem: tx.codeItem,
      itemName: tx.itemName,
      uom: tx.uom,
      totalPakai: 0,
      currentStock: itemLookup.get(tx.itemId)?.currentStock ?? 0,
      minStock: itemLookup.get(tx.itemId)?.minStock ?? 0,
    };
    prev.totalPakai += tx.qty;
    usageMap.set(tx.itemId, prev);
  }
  const topConsumed = Array.from(usageMap.values())
    .sort((a, b) => b.totalPakai - a.totalPakai)
    .slice(0, 6);

  const rf = store.rollingForecast;
  let forecastFilledInHorizon = 0;
  let forecastUnitsInHorizon = 0;
  for (const row of rf.rows) {
    let rowSum = 0;
    for (const mk of horizonMeta.forecastKeys) {
      if (fkSet.has(mk)) rowSum += row.months[mk] || 0;
    }
    if (rowSum > 0) {
      forecastFilledInHorizon += 1;
      forecastUnitsInHorizon += rowSum;
    }
  }
  const forecastActiveMonthRows = rf.rows.filter((r) => (r.months[rf.activeMonth] || 0) > 0);
  const forecastActiveMonthFilled = forecastActiveMonthRows.length;
  const forecastActiveMonthUnits = forecastActiveMonthRows.reduce(
    (s, r) => s + (r.months[rf.activeMonth] || 0),
    0
  );
  const zeroRmStockCount = rf.rows.filter((r) => r.rmStock === 0).length;

  // 6. Governance: Reports, Signatures, Opname & Archive
  const scopedReports = store.reports.filter((r) => {
    const scopeOk =
      filters.supplyScope === 'ALL' ||
      r.jenis === filters.supplyScope ||
      r.jenis === 'INVENTARIS_OVERHEAD';
    const periodOk = filters.horizon === 'FULL_FY' || ymSet.has(r.period);
    return scopeOk && periodOk;
  });
  const reportsTotal = scopedReports.length;
  const reportsFinal = scopedReports.filter((r) => r.locked).length;
  const reportsPending = reportsTotal - reportsFinal;

  let totalSignatureSlots = 0;
  let signedSignatureSlots = 0;
  const pendingReportTitles: ExecutiveMetrics['pendingReportTitles'] = [];
  for (const rep of scopedReports) {
    const allSlots = rep.signatureGroups.flatMap((g) => g.slots);
    const signed = allSlots.filter((s) => s.status === 'SIGNED');
    const pending = allSlots.filter((s) => s.status === 'PENDING');
    totalSignatureSlots += allSlots.length;
    signedSignatureSlots += signed.length;
    if (!rep.locked && pending.length > 0) {
      pendingReportTitles.push({
        id: rep.id,
        documentId: rep.documentId,
        title: rep.title,
        periodLabel: rep.periodLabel,
        pendingNames: pending.map((s) => `${s.name} (${s.jabatan})`),
      });
    }
  }
  const signatureCompliancePct =
    totalSignatureSlots > 0
      ? Math.round((signedSignatureSlots / totalSignatureSlots) * 1000) / 10
      : 100;

  const scopedOpnames = store.opnames.filter(
    (o) =>
      (filters.supplyScope === 'ALL' || o.jenis === filters.supplyScope) &&
      (filters.horizon === 'FULL_FY' || ymSet.has(o.period))
  );
  const opnameTotal = scopedOpnames.length;
  const opnameApproved = scopedOpnames.filter((o) => o.status === 'DISETUJUI').length;
  const opnamePending = scopedOpnames.filter((o) => o.status === 'MENUNGGU_SM').length;
  const opnameDiscrepancyCount = scopedOpnames.reduce(
    (sum, o) => sum + o.lines.filter((l) => l.diff !== 0).length,
    0
  );

  // Composite governance readiness: average of signature compliance + asset integrity + request fulfillment
  const governanceReadinessPct =
    Math.round(((signatureCompliancePct + assetsHealthPct + requestProcessedPct) / 3) * 10) / 10;

  return {
    horizonMeta,
    totalItems: scopedItems.length,
    officeCount,
    overheadCount,
    healthyItems,
    criticalItems,
    outOfStockItems,
    healthyPct,
    totalUnitsInStock,
    urgentItems: criticalList.slice(0, 8),
    categories,
    cabinets,
    totalCabinets: cabinets.length,
    assetsTotal,
    assetsBagus,
    assetsRusak,
    assetsHealthPct,
    mchCount,
    elcCount,
    atkCount,
    damagedAssets,
    activeEmployees: scopedEmployees.length,
    hrDevEmployees,
    adminOpsEmployees,
    requestsTotal,
    requestsPending,
    requestsApproved,
    requestsRejected,
    requestProcessedPct,
    hrDevRequests,
    adminOpsRequests,
    totalTerima,
    totalPakai,
    txCount: scopedTx.length,
    monthlyPacing,
    topConsumed,
    activeForecastMonth: rf.activeMonth,
    forecastCatalogCount: rf.rows.length,
    forecastFilledInHorizon,
    forecastUnitsInHorizon,
    forecastActiveMonthFilled,
    forecastActiveMonthUnits,
    zeroRmStockCount,
    forecastSubmissionsCount: rf.submissions.length,
    reportsTotal,
    reportsFinal,
    reportsPending,
    totalSignatureSlots,
    signedSignatureSlots,
    signatureCompliancePct,
    pendingReportTitles,
    opnameTotal,
    opnameApproved,
    opnamePending,
    opnameDiscrepancyCount,
    documentsTotal: store.documents.length,
    governanceReadinessPct,
  };
}

export function buildExecutiveSummaryText(
  m: ExecutiveMetrics,
  filters: ExecutiveFilterState,
  lang: 'id' | 'en'
): string {
  if (lang === 'en') {
    return [
      `EXECUTIVE SUPPLY & OPERATIONS BRIEFING — HR SUPPLYHUB`,
      `PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory`,
      `Evaluation Horizon: ${m.horizonMeta.labelEn} | Scope: ${filters.supplyScope} | HR Section: ${filters.sectionScope}`,
      ``,
      `1. INVENTORY AVAILABILITY & HEALTH`,
      `- Active Catalog: ${m.totalItems} items (${m.officeCount} Office Supplies, ${m.overheadCount} Overhead Goods)`,
      `- Healthy Stock Ratio: ${m.healthyPct}% (${m.healthyItems} healthy / ${m.criticalItems} critical, incl. ${m.outOfStockItems} out-of-stock)`,
      `- Storage Coverage: ${m.totalCabinets} cabinets/locations · ${m.totalUnitsInStock} total units in stock`,
      ``,
      `2. CONSUMPTION & GA ROLLING FORECAST`,
      `- Horizon Movement: +${m.totalTerima} Received (TERIMA) / -${m.totalPakai} Consumed (PAKAI) across ${m.txCount} transactions`,
      `- Active GA Rolling Forecast (${m.activeForecastMonth}): ${m.forecastActiveMonthFilled} items (${m.forecastActiveMonthUnits} units) · ${m.zeroRmStockCount} GA catalog items at 0 R/M stock`,
      ``,
      `3. OVERHEAD INVENTORY ASSETS & HR REQUESTS`,
      `- Overhead Assets: ${m.assetsTotal} total (${m.assetsBagus} Good / ${m.assetsRusak} Damaged — ${m.assetsHealthPct}% readiness)`,
      `- HR Supply Requests: ${m.requestsTotal} total (${m.requestsApproved} Approved, ${m.requestsPending} Pending, ${m.requestsRejected} Rejected)`,
      ``,
      `4. GOVERNANCE & AUDIT READINESS`,
      `- Monthly A3 Reports: ${m.reportsFinal}/${m.reportsTotal} Finalized (${m.signatureCompliancePct}% digital signatures completed)`,
      `- Stock Opname: ${m.opnameApproved}/${m.opnameTotal} Approved (${m.opnameDiscrepancyCount} recorded variances) · ${m.documentsTotal} archived files`,
    ].join('\n');
  }

  return [
    `BRIEFING EKSEKUTIF PERSEDIAAN & OPERASIONAL — HR SUPPLYHUB`,
    `PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory`,
    `Periode Evaluasi: ${m.horizonMeta.labelId} | Cakupan: ${filters.supplyScope} | Seksi HR: ${filters.sectionScope}`,
    ``,
    `1. KETERSEDIAAN & KESEHATAN STOK`,
    `- Katalog Aktif: ${m.totalItems} item (${m.officeCount} Office Supplies, ${m.overheadCount} Overhead Goods)`,
    `- Tingkat Ketersediaan Sehat: ${m.healthyPct}% (${m.healthyItems} aman / ${m.criticalItems} kritis, termasuk ${m.outOfStockItems} stok habis)`,
    `- Sebaran Penyimpanan: ${m.totalCabinets} lokasi lemari · total ${m.totalUnitsInStock} unit tersedia`,
    ``,
    `2. PEMAKAIAN & ROLLING FORECAST GA`,
    `- Pergerakan Periode: +${m.totalTerima} Terima / -${m.totalPakai} Pakai (${m.txCount} transaksi tercatat)`,
    `- Rolling Forecast GA Aktif (${m.activeForecastMonth}): ${m.forecastActiveMonthFilled} item (${m.forecastActiveMonthUnits} unit) · ${m.zeroRmStockCount} item katalog GA berstatus R/M Stock 0`,
    ``,
    `3. ASET INVENTARIS OVERHEAD & LAYANAN KARYAWAN HR`,
    `- Aset Inventaris Overhead: ${m.assetsTotal} aset (${m.assetsBagus} Bagus / ${m.assetsRusak} Rusak — kesiapan ${m.assetsHealthPct}%)`,
    `- Permintaan Karyawan HR: ${m.requestsTotal} total (${m.requestsApproved} Disetujui, ${m.requestsPending} Menunggu Approval, ${m.requestsRejected} Ditolak)`,
    ``,
    `4. TATA KELOLA & KESIAPAN AUDIT`,
    `- Laporan Bulanan A3: ${m.reportsFinal}/${m.reportsTotal} Final (${m.signatureCompliancePct}% slot tanda tangan digital selesai)`,
    `- Stock Opname: ${m.opnameApproved}/${m.opnameTotal} Disetujui (${m.opnameDiscrepancyCount} catatan selisih) · ${m.documentsTotal} dokumen terarsip`,
  ].join('\n');
}

export function buildExecutiveCsv(
  m: ExecutiveMetrics,
  filters: ExecutiveFilterState,
  lang: 'id' | 'en'
): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: Array<Array<string | number>> = [];

  rows.push([
    lang === 'en' ? 'Section' : 'Bagian',
    lang === 'en' ? 'Metric / Category' : 'Indikator / Kategori',
    lang === 'en' ? 'Value' : 'Nilai',
    lang === 'en' ? 'Detail / Notes' : 'Keterangan',
  ]);

  rows.push([
    'Scope',
    lang === 'en' ? 'Evaluation Period' : 'Periode Evaluasi',
    lang === 'en' ? m.horizonMeta.labelEn : m.horizonMeta.labelId,
    `${filters.supplyScope} | ${filters.sectionScope}`,
  ]);
  rows.push(['KPI', 'Active Catalog Items', m.totalItems, `Office: ${m.officeCount}, Overhead: ${m.overheadCount}`]);
  rows.push(['KPI', 'Healthy Stock Rate (%)', `${m.healthyPct}%`, `Healthy: ${m.healthyItems}, Critical: ${m.criticalItems}, Out of Stock: ${m.outOfStockItems}`]);
  rows.push(['KPI', 'Total Units In Stock', m.totalUnitsInStock, `${m.totalCabinets} storage locations`]);
  rows.push(['KPI', 'Transactions (TERIMA / PAKAI)', m.txCount, `Received: +${m.totalTerima}, Used: -${m.totalPakai}`]);
  rows.push(['KPI', `GA Rolling Forecast (${m.activeForecastMonth})`, m.forecastActiveMonthUnits, `${m.forecastActiveMonthFilled} items filled, ${m.zeroRmStockCount} zero R/M stock`]);
  rows.push(['KPI', 'Overhead Inventory Assets', m.assetsTotal, `Good: ${m.assetsBagus}, Damaged: ${m.assetsRusak} (${m.assetsHealthPct}%)`]);
  rows.push(['KPI', 'HR Employee Requests', m.requestsTotal, `Approved: ${m.requestsApproved}, Pending: ${m.requestsPending}, Rejected: ${m.requestsRejected}`]);
  rows.push(['KPI', 'A3 Reports & Digital Signatures', `${m.reportsFinal}/${m.reportsTotal}`, `${m.signedSignatureSlots}/${m.totalSignatureSlots} signed (${m.signatureCompliancePct}%)`]);

  rows.push(['', '', '', '']);
  rows.push([
    'Category Breakdown',
    'Category Name',
    'Total Items',
    'Healthy | Critical | Out of Stock | Total Units',
  ]);
  for (const cat of m.categories) {
    rows.push([
      cat.jenis,
      cat.kategori,
      cat.totalItems,
      `Healthy: ${cat.healthyItems} | Critical: ${cat.criticalItems} | Zero: ${cat.outOfStockItems} | Units: ${cat.totalUnits}`,
    ]);
  }

  rows.push(['', '', '', '']);
  rows.push(['Monthly Pacing', 'Month', 'Usage (PAKAI)', 'Received (TERIMA) | GA Forecast']);
  for (const pt of m.monthlyPacing) {
    rows.push([pt.period, pt.monthKey, pt.pakai, `Received: ${pt.terima} | GA Forecast: ${pt.forecastUnits}`]);
  }

  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
