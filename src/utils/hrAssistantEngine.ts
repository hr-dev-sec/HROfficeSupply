import {
  FORECAST_MONTH_KEYS,
  type AssistantActionProposal,
  type AssistantVisualData,
  type ForecastMonthKey,
  type HrEmployee,
  type ItemRequest,
  type OverheadInventoryItem,
  type RollingForecastRow,
  type SupplyHubStore,
  type SupplyItem,
  type User,
} from '../types';

export interface LocalAssistantResponse {
  reply: string;
  visualData?: AssistantVisualData | null;
  actionProposal?: AssistantActionProposal | null;
  followUpSuggestions: string[];
}

const MONTH_NAME_MAP: Array<{ aliases: string[]; forecastKey: ForecastMonthKey; ym: string; idLabel: string; enLabel: string }> = [
  { aliases: ['apr-26', 'april 2026', 'april'], forecastKey: 'Apr-26', ym: '2026-04', idLabel: 'April 2026', enLabel: 'April 2026' },
  { aliases: ['may-26', 'mei 2026', 'mei', 'may'], forecastKey: 'May-26', ym: '2026-05', idLabel: 'Mei 2026', enLabel: 'May 2026' },
  { aliases: ['jun-26', 'juni 2026', 'juni', 'june'], forecastKey: 'Jun-26', ym: '2026-06', idLabel: 'Juni 2026', enLabel: 'June 2026' },
  { aliases: ['jul-26', 'juli 2026', 'juli', 'july'], forecastKey: 'Jul-26', ym: '2026-07', idLabel: 'Juli 2026', enLabel: 'July 2026' },
  { aliases: ['aug-26', 'agustus 2026', 'agustus', 'august', 'agu'], forecastKey: 'Aug-26', ym: '2026-08', idLabel: 'Agustus 2026', enLabel: 'August 2026' },
  { aliases: ['sep-26', 'september 2026', 'september', 'sept'], forecastKey: 'Sep-26', ym: '2026-09', idLabel: 'September 2026', enLabel: 'September 2026' },
  { aliases: ['oct-26', 'oktober 2026', 'oktober', 'october', 'okt'], forecastKey: 'Oct-26', ym: '2026-10', idLabel: 'Oktober 2026', enLabel: 'October 2026' },
  { aliases: ['nov-26', 'november 2026', 'november', 'nov'], forecastKey: 'Nov-26', ym: '2026-11', idLabel: 'November 2026', enLabel: 'November 2026' },
  { aliases: ['dec-26', 'desember 2026', 'desember', 'december', 'des'], forecastKey: 'Dec-26', ym: '2026-12', idLabel: 'Desember 2026', enLabel: 'December 2026' },
  { aliases: ['jan-27', 'januari 2027', 'januari', 'january', 'jan'], forecastKey: 'Jan-27', ym: '2027-01', idLabel: 'Januari 2027', enLabel: 'January 2027' },
  { aliases: ['feb-27', 'februari 2027', 'februari', 'february', 'feb'], forecastKey: 'Feb-27', ym: '2027-02', idLabel: 'Februari 2027', enLabel: 'February 2027' },
  { aliases: ['mar-27', 'maret 2027', 'maret', 'march'], forecastKey: 'Mar-27', ym: '2027-03', idLabel: 'Maret 2027', enLabel: 'March 2027' },
];

const STOPWORDS = new Set([
  'apa', 'apakah', 'ada', 'yang', 'di', 'ke', 'dari', 'dan', 'atau', 'untuk', 'pada', 'dengan', 'ini', 'itu',
  'berapa', 'jumlah', 'stok', 'stock', 'item', 'barang', 'data', 'cek', 'check', 'lihat', 'tampilkan', 'tolong',
  'cari', 'carikan', 'info', 'informasi', 'detail', 'bagaimana', 'siapa', 'dimana', 'kapan', 'mana', 'saja',
  'saat', 'sekarang', 'terbaru', 'semua', 'daftar', 'list', 'buat', 'buatkan', 'status', 'sistem', 'hr',
  'what', 'which', 'how', 'many', 'much', 'is', 'are', 'the', 'of', 'in', 'for', 'to', 'and', 'or', 'show',
  'me', 'all', 'current', 'about', 'please', 'get', 'find', 'give', 'tell', 'items', 'supplies', 'supply',
  'sisa', 'tersedia', 'punya', 'kita', 'kami', 'bisa', 'mohon', 'dong', 'ya', 'nih', 'nya',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSearchTokens(prompt: string): string[] {
  const norm = normalizeText(prompt);
  return norm
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok) && !/^\d+$/.test(tok));
}

function getStockStatus(item: SupplyItem): 'HABIS' | 'KRITIS' | 'AMAN' {
  if (item.currentStock <= 0) return 'HABIS';
  if (item.currentStock <= item.minStock) return 'KRITIS';
  return 'AMAN';
}

function detectMonthInPrompt(q: string) {
  for (const m of MONTH_NAME_MAP) {
    for (const alias of m.aliases) {
      const regex = new RegExp(`(^|\\b)${alias.replace('-', '\\-')}(\\b|$)`, 'i');
      if (regex.test(q)) return m;
    }
  }
  return null;
}

/**
 * Builds a complete, lossless, compact JSON context snapshot across all 14 SupplyHub modules
 * so Gemini can accurately answer any cross-module HR operational question without exceeding payload limits.
 */
export function buildComprehensiveAssistantContext(
  store: SupplyHubStore,
  currentUser: User | null
): Record<string, unknown> {
  const activeItems = store.items.filter((i) => !i.archived);
  const archivedItems = store.items.filter((i) => i.archived);
  const officeItems = activeItems.filter((i) => i.jenis === 'OFFICE_SUPPLIES');
  const overheadItems = activeItems.filter((i) => i.jenis === 'OVERHEAD_GOODS');
  const outOfStockItems = activeItems.filter((i) => i.currentStock <= 0);
  const criticalItems = activeItems.filter((i) => i.currentStock <= i.minStock);

  // Category aggregation
  const categoryMap = new Map<string, { jenis: string; count: number; totalStock: number; criticalCount: number }>();
  for (const item of activeItems) {
    const key = `${item.jenis}::${item.kategori}`;
    const prev = categoryMap.get(key) || { jenis: item.jenis, count: 0, totalStock: 0, criticalCount: 0 };
    prev.count += 1;
    prev.totalStock += item.currentStock;
    if (item.currentStock <= item.minStock) prev.criticalCount += 1;
    categoryMap.set(key, prev);
  }
  const categorySummary = Array.from(categoryMap.entries()).map(([k, v]) => ({
    kategori: k.split('::')[1],
    jenis: v.jenis,
    itemCount: v.count,
    totalStock: v.totalStock,
    criticalCount: v.criticalCount,
  }));

  // Location aggregation
  const locMap = new Map<string, { supplyCount: number; inventoryCount: number; criticalCount: number }>();
  for (const item of activeItems) {
    const loc = item.location || 'Belum ditentukan';
    const prev = locMap.get(loc) || { supplyCount: 0, inventoryCount: 0, criticalCount: 0 };
    prev.supplyCount += 1;
    if (item.currentStock <= item.minStock) prev.criticalCount += 1;
    locMap.set(loc, prev);
  }
  for (const inv of store.inventories) {
    const loc = inv.location || 'Belum ditentukan';
    const prev = locMap.get(loc) || { supplyCount: 0, inventoryCount: 0, criticalCount: 0 };
    prev.inventoryCount += 1;
    locMap.set(loc, prev);
  }
  const locationSummary = Array.from(locMap.entries()).map(([location, v]) => ({
    location,
    ...v,
  }));

  // Transaction analytics
  const monthlyTxMap = new Map<string, { period: string; terima: number; pakai: number; adj: number; txCount: number }>();
  const itemUsageMap = new Map<string, { itemId: string; codeItem: string; itemName: string; uom: string; totalPakai: number; totalTerima: number }>();

  for (const tx of store.transactions) {
    const m = monthlyTxMap.get(tx.period) || { period: tx.period, terima: 0, pakai: 0, adj: 0, txCount: 0 };
    m.txCount += 1;
    if (tx.type === 'TERIMA') m.terima += tx.qty;
    else if (tx.type === 'PAKAI') m.pakai += tx.qty;
    else m.adj += tx.qty;
    monthlyTxMap.set(tx.period, m);

    const u = itemUsageMap.get(tx.itemId) || {
      itemId: tx.itemId,
      codeItem: tx.codeItem,
      itemName: tx.itemName,
      uom: tx.uom,
      totalPakai: 0,
      totalTerima: 0,
    };
    if (tx.type === 'PAKAI') u.totalPakai += tx.qty;
    if (tx.type === 'TERIMA') u.totalTerima += tx.qty;
    itemUsageMap.set(tx.itemId, u);
  }

  const topConsumedItems = Array.from(itemUsageMap.values())
    .filter((x) => x.totalPakai > 0)
    .sort((a, b) => b.totalPakai - a.totalPakai)
    .slice(0, 15);

  const monthlyTotals = Array.from(monthlyTxMap.values()).sort((a, b) => a.period.localeCompare(b.period));

  // Rolling Forecast GA summary
  const rf = store.rollingForecast;
  const monthTotals: Record<string, { itemCount: number; totalUnits: number }> = {};
  for (const mKey of FORECAST_MONTH_KEYS) {
    let itemCount = 0;
    let totalUnits = 0;
    for (const row of rf.rows) {
      const val = row.months[mKey] || 0;
      if (val > 0) {
        itemCount += 1;
        totalUnits += val;
      }
    }
    monthTotals[mKey] = { itemCount, totalUnits };
  }

  const rfActiveFilledRows = rf.rows
    .filter((r) => (r.months[rf.activeMonth] || 0) > 0)
    .map((r) => ({
      code: r.codeItem,
      name: r.itemName,
      jenis: r.jenis,
      uom: r.uom,
      rmStock: r.rmStock,
      activeQty: r.months[rf.activeMonth] || 0,
      estPemakaian: r.estPemakaian,
      keterangan: r.keterangan,
    }));

  const rfAllFilledRows = rf.rows
    .filter((r) => FORECAST_MONTH_KEYS.some((mk) => (r.months[mk] || 0) > 0))
    .map((r) => {
      const filledMonths: Record<string, number> = {};
      for (const mk of FORECAST_MONTH_KEYS) {
        if ((r.months[mk] || 0) > 0) filledMonths[mk] = r.months[mk]!;
      }
      return {
        code: r.codeItem,
        name: r.itemName,
        jenis: r.jenis,
        uom: r.uom,
        rmStock: r.rmStock,
        months: filledMonths,
      };
    });

  const rfZeroRmStock = rf.rows
    .filter((r) => r.rmStock === 0)
    .map((r) => ({ code: r.codeItem, name: r.itemName, jenis: r.jenis, uom: r.uom }));

  // Employee requests summary
  const reqPending = store.itemRequests.filter((r) => r.status === 'MENUNGGU');
  const reqApproved = store.itemRequests.filter((r) => r.status === 'DISETUJUI');
  const reqRejected = store.itemRequests.filter((r) => r.status === 'DITOLAK');

  // Overhead inventory summary
  const invBagus = store.inventories.filter((i) => i.condition === 'BAGUS');
  const invRusak = store.inventories.filter((i) => i.condition === 'RUSAK');

  // Reports summary with full signature detail
  const reportsDetailed = store.reports.map((r) => {
    const signedSlots = r.signatureGroups.flatMap((g) =>
      g.slots
        .filter((s) => s.status === 'SIGNED')
        .map((s) => ({ group: g.label, name: s.signedByName || s.name, jabatan: s.jabatan, at: s.signedAt }))
    );
    const pendingSlots = r.signatureGroups.flatMap((g) =>
      g.slots
        .filter((s) => s.status === 'PENDING')
        .map((s) => ({ group: g.label, name: s.name, jabatan: s.jabatan }))
    );
    return {
      id: r.id,
      docId: r.documentId,
      jenis: r.jenis,
      title: r.title,
      period: r.period,
      periodLabel: r.periodLabel,
      status: r.status,
      locked: r.locked,
      version: r.version,
      rowCount: r.checkRows?.length ?? r.inventoryRows?.length ?? 0,
      signedSlots,
      pendingSlots,
      rejections: r.rejectionHistory.length,
    };
  });

  // Opname sessions with discrepancies
  const opnamesDetailed = store.opnames.map((op) => {
    const diffs = op.lines.filter((l) => l.diff !== 0);
    return {
      id: op.id,
      period: op.period,
      jenis: op.jenis,
      status: op.status,
      createdAt: op.createdAt,
      createdBy: op.createdByName,
      approvedBy: op.approvedByName || null,
      rejectionNote: op.rejectionNote || null,
      totalChecked: op.lines.length,
      discrepancyCount: diffs.length,
      discrepancies: diffs.map((d) => ({
        code: d.codeItem,
        name: d.itemName,
        uom: d.uom,
        system: d.systemStock,
        physical: d.physicalStock,
        diff: d.diff,
        reason: d.reason,
      })),
    };
  });

  const activeEmployees = store.employees.filter((e) => e.active);

  return {
    company: {
      name: store.settings.companyName,
      factory: store.settings.factoryName,
      department: store.settings.department,
      section: store.settings.section,
      city: store.settings.locationCity,
    },
    currentUser: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          jabatan: currentUser.jabatan,
          seksi: currentUser.seksi,
        }
      : null,
    summaryKPI: {
      totalActiveItems: activeItems.length,
      officeSuppliesCount: officeItems.length,
      overheadGoodsCount: overheadItems.length,
      archivedItemsCount: archivedItems.length,
      outOfStockCount: outOfStockItems.length,
      criticalCount: criticalItems.length,
      totalUnitsInStock: activeItems.reduce((s, i) => s + i.currentStock, 0),
      totalTransactions: store.transactions.length,
      totalOverheadAssets: store.inventories.length,
      assetsBagus: invBagus.length,
      assetsRusak: invRusak.length,
      totalEmployeesActive: activeEmployees.length,
      employeesHrDev: activeEmployees.filter((e) => e.section === 'HR Development').length,
      employeesAdminOps: activeEmployees.filter((e) => e.section === 'Administration & Operation').length,
      requestsTotal: store.itemRequests.length,
      requestsPending: reqPending.length,
      requestsApproved: reqApproved.length,
      requestsRejected: reqRejected.length,
      reportsTotal: store.reports.length,
      reportsFinal: store.reports.filter((r) => r.locked).length,
      reportsPendingSignature: store.reports.filter((r) => !r.locked).length,
      opnameSessionsTotal: store.opnames.length,
      documentsTotal: store.documents.length,
      rollingForecastActiveMonth: rf.activeMonth,
      rollingForecastCatalogRows: rf.rows.length,
      rollingForecastActiveFilled: rfActiveFilledRows.length,
      rollingForecastActiveUnits: rfActiveFilledRows.reduce((s, r) => s + r.activeQty, 0),
    },
    items: activeItems.map((i) => ({
      id: i.id,
      code: i.codeItem,
      jenis: i.jenis,
      cat: i.kategori,
      name: i.itemName,
      uom: i.uom,
      stock: i.currentStock,
      min: i.minStock,
      loc: i.location,
      status: getStockStatus(i),
      notes: i.notes || undefined,
    })),
    archivedItems: archivedItems.map((i) => ({
      id: i.id,
      code: i.codeItem,
      name: i.itemName,
      jenis: i.jenis,
      stock: i.currentStock,
    })),
    categorySummary,
    locationSummary,
    transactionsAnalytics: {
      monthlyTotals,
      topConsumedItems,
      recentTransactions: store.transactions.slice(0, 100).map((t) => ({
        date: t.date,
        period: t.period,
        type: t.type,
        code: t.codeItem,
        item: t.itemName,
        qty: t.qty,
        uom: t.uom,
        by: t.recordedByName,
        note: t.note,
      })),
    },
    itemRequests: store.itemRequests.map((r) => ({
      id: r.id,
      date: r.requestDate,
      nik: r.requesterNik || '-',
      name: r.requesterName,
      section: r.requesterSection,
      status: r.status,
      source: r.source || 'ADMIN',
      items: r.items.map((it) => `${it.itemName} (${it.qty} ${it.uom})`),
      note: r.note,
      processedBy: r.processedByName || null,
      rejectionNote: r.rejectionNote || null,
    })),
    employees: store.employees.map((e) => ({
      nik: e.nik,
      name: e.name,
      section: e.section,
      jabatan: e.jabatan,
      active: e.active,
    })),
    inventories: store.inventories.map((inv) => ({
      id: inv.id,
      partId: inv.partId,
      prefix: inv.prefix,
      cat: inv.kategori,
      name: inv.itemName,
      qty: inv.qty,
      uom: inv.uom,
      loc: inv.location,
      condition: inv.condition,
      notes: inv.notes || undefined,
      mutationCount: inv.mutations.length,
    })),
    rollingForecast: {
      fiscalYear: rf.fiscalYearLabel,
      periodRange: rf.periodRangeLabel,
      activeMonth: rf.activeMonth,
      lastUpdatedAt: rf.lastUpdatedAt,
      lastUpdatedBy: rf.lastUpdatedBy,
      totalCatalogRows: rf.rows.length,
      monthTotals,
      activeMonthRows: rfActiveFilledRows,
      allFilledRows: rfAllFilledRows,
      zeroRmStockItems: rfZeroRmStock.slice(0, 40),
      submissions: rf.submissions,
    },
    reports: reportsDetailed,
    opnames: opnamesDetailed,
    documents: store.documents.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      period: d.period,
      module: d.linkedModule,
      fileName: d.fileName,
      uploadedBy: d.uploadedByName,
      uploadedAt: d.uploadedAt,
    })),
    users: store.users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      jabatan: u.jabatan,
      seksi: u.seksi,
      active: u.active,
    })),
    auditLogs: store.auditLogs.slice(0, 40).map((a) => ({
      at: a.timestamp,
      user: a.userName,
      role: a.userRole,
      action: a.action,
      objectType: a.objectType,
      label: a.objectLabel,
    })),
  };
}

/**
 * Helper to score fuzzy matches of query tokens against a target string.
 */
function scoreMatch(tokens: string[], target: string, fullPromptNorm: string): number {
  const tNorm = normalizeText(target);
  if (!tNorm) return 0;
  let score = 0;
  if (tNorm.length >= 3 && fullPromptNorm.includes(tNorm)) {
    score += 12;
  }
  for (const tok of tokens) {
    if (tNorm === tok) score += 8;
    else if (tNorm.split(/\s+/).some((w) => w === tok)) score += 5;
    else if (tNorm.includes(tok)) score += 3;
  }
  return score;
}

/**
 * Rich, deterministic, live-data Local HR Assistant Engine.
 * Used ONLY when server GEMINI_API_KEY is unconfigured or backend route is unavailable (static deploy).
 * Never uses hardcoded/mock answers — every number, item, person, and chart is computed live from `store`.
 */
export function runLocalHrAssistant(
  prompt: string,
  store: SupplyHubStore,
  lang: 'id' | 'en',
  currentUser: User | null
): LocalAssistantResponse {
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const q = normalizeText(prompt);
  const tokens = extractSearchTokens(prompt);
  const activeItems = store.items.filter((i) => !i.archived);
  const criticalItems = activeItems
    .filter((i) => i.currentStock <= i.minStock)
    .sort((a, b) => a.currentStock - a.minStock - (b.currentStock - b.minStock));
  const outOfStockItems = activeItems.filter((i) => i.currentStock <= 0);
  const pendingReports = store.reports.filter((r) => !r.locked);
  const pendingRequests = store.itemRequests.filter((r) => r.status === 'MENUNGGU');
  const detectedMonth = detectMonthInPrompt(q);

  // =========================================================================
  // 1. EXPLICIT ACTION INTENTS (Write / Execute proposals)
  // =========================================================================
  const qtyMatch = prompt.match(/\b(\d+)\b/);
  const parsedQty = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;

  // 1a. Record Usage (PAKAI) or Receive (TERIMA)
  const isRecordPakai = /\b(catat pakai|catatkan pakai|keluarkan|kurangi stok|record usage|log usage|deduct stock)\b/i.test(q);
  const isRecordTerima = /\b(catat terima|catatkan terima|terima barang|tambah stok|barang masuk|record receive|add stock|log receive)\b/i.test(q);
  if (isRecordPakai || isRecordTerima) {
    const scored = activeItems
      .map((item) => ({
        item,
        score: scoreMatch(tokens, `${item.itemName} ${item.codeItem} ${item.kategori}`, q),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.item;
    if (best) {
      const actionType = isRecordTerima ? 'RECORD_TERIMA' : 'RECORD_PAKAI';
      const nextStock = isRecordTerima ? best.currentStock + parsedQty : Math.max(0, best.currentStock - parsedQty);
      return {
        reply: isRecordTerima
          ? t(
              `Siap mencatat **Penerimaan Barang (TERIMA)** untuk:\n- **Item:** ${best.itemName} (\`${best.codeItem}\`)\n- **Jumlah Masuk:** **+${parsedQty} ${best.uom}**\n- **Estimasi Stok Baru:** ${best.currentStock} → **${nextStock} ${best.uom}**\n- **Lokasi:** ${best.location}\n\nSilakan klik tombol konfirmasi di bawah untuk menyimpan transaksi ke sistem.`,
              `Ready to record **Stock Receipt (TERIMA)** for:\n- **Item:** ${best.itemName} (\`${best.codeItem}\`)\n- **Quantity Received:** **+${parsedQty} ${best.uom}**\n- **Estimated New Stock:** ${best.currentStock} → **${nextStock} ${best.uom}**\n- **Location:** ${best.location}\n\nClick Confirm below to save this transaction.`
            )
          : t(
              `Siap mencatat **Pemakaian Barang (PAKAI)** untuk:\n- **Item:** ${best.itemName} (\`${best.codeItem}\`)\n- **Jumlah Keluar:** **-${parsedQty} ${best.uom}**\n- **Stok Saat Ini:** ${best.currentStock} ${best.uom} → **Estimasi Sisa: ${nextStock} ${best.uom}**\n- **Lokasi:** ${best.location}\n\n${
                parsedQty > best.currentStock
                  ? `⚠️ *Perhatian: jumlah diminta (${parsedQty}) melebihi stok tersedia (${best.currentStock}).*`
                  : 'Silakan klik tombol konfirmasi di bawah untuk mengeksekusi.'
              }`,
              `Ready to record **Stock Usage (PAKAI)** for:\n- **Item:** ${best.itemName} (\`${best.codeItem}\`)\n- **Quantity Used:** **-${parsedQty} ${best.uom}**\n- **Current Stock:** ${best.currentStock} ${best.uom} → **Estimated Remaining: ${nextStock} ${best.uom}**\n- **Location:** ${best.location}\n\nClick Confirm below to execute.`
            ),
        actionProposal: {
          type: actionType,
          title: isRecordTerima
            ? t(`Catat Terima +${parsedQty} ${best.uom} ${best.itemName}`, `Record Receive +${parsedQty} ${best.uom} ${best.itemName}`)
            : t(`Catat Pakai -${parsedQty} ${best.uom} ${best.itemName}`, `Record Usage -${parsedQty} ${best.uom} ${best.itemName}`),
          description: t(
            `Kode ${best.codeItem} · Lokasi ${best.location} · Dicatat oleh ${currentUser?.name || 'PIC HR'}`,
            `Code ${best.codeItem} · Location ${best.location} · Recorded by ${currentUser?.name || 'HR PIC'}`
          ),
          payloadJson: JSON.stringify({
            itemId: best.id,
            qty: parsedQty,
            note: isRecordTerima ? 'Penerimaan dicatat via HR Assistant' : 'Pemakaian dicatat via HR Assistant',
          }),
        },
        followUpSuggestions: [
          t(`Cek riwayat transaksi ${best.itemName}`, `Check transaction history for ${best.itemName}`),
          t('Item apa saja yang stoknya kritis?', 'Which items are currently at critical stock?'),
        ],
      };
    }
  }

  // 1b. Approve Employee Request
  if (/\b(setujui|approve|acc)\b/i.test(q) && /\b(permintaan|request|pengambilan)\b/i.test(q)) {
    if (pendingRequests.length === 0) {
      return {
        reply: t(
          'Saat ini **tidak ada permintaan pengambilan barang** yang berstatus Menunggu Approval. Semua permintaan karyawan sudah diproses.',
          'There are currently **no pending employee supply requests**. All requests have been processed.'
        ),
        followUpSuggestions: [
          t('Tampilkan riwayat permintaan pengambilan barang', 'Show employee request history'),
          t('Ringkasan stok kritis saat ini', 'Current critical stock summary'),
        ],
      };
    }
    const matchedReq =
      pendingRequests.find((r) => scoreMatch(tokens, `${r.requesterName} ${r.requesterNik || ''} ${r.requesterSection}`, q) > 0) ||
      pendingRequests[0];

    return {
      reply: t(
        `Menemukan permintaan **Menunggu Approval** yang siap disetujui:\n- **Pemohon:** ${matchedReq.requesterName} (${matchedReq.requesterNik || '-'} · ${matchedReq.requesterSection})\n- **Tanggal:** ${matchedReq.requestDate}\n- **Barang:** ${matchedReq.items.map((i) => `${i.itemName} (${i.qty} ${i.uom})`).join(', ')}\n- **Keperluan:** ${matchedReq.note || '-'}\n\nMenyetujui permintaan ini akan otomatis memotong stok barang terkait. Klik konfirmasi di bawah untuk memproses.`,
        `Found a **Pending Approval** request ready to approve:\n- **Requester:** ${matchedReq.requesterName} (${matchedReq.requesterNik || '-'} · ${matchedReq.requesterSection})\n- **Date:** ${matchedReq.requestDate}\n- **Items:** ${matchedReq.items.map((i) => `${i.itemName} (${i.qty} ${i.uom})`).join(', ')}\n- **Purpose:** ${matchedReq.note || '-'}\n\nApproving will automatically deduct stock. Click Confirm below to proceed.`
      ),
      actionProposal: {
        type: 'APPROVE_REQUEST',
        title: t(`Setujui Permintaan ${matchedReq.requesterName}`, `Approve Request from ${matchedReq.requesterName}`),
        description: matchedReq.items.map((i) => `${i.itemName} (${i.qty} ${i.uom})`).join(', '),
        payloadJson: JSON.stringify({ requestId: matchedReq.id }),
      },
      followUpSuggestions: [
        t('Lihat semua permintaan karyawan yang menunggu approval', 'View all pending employee requests'),
        t('Item apa saja yang di bawah minimum?', 'Which items are below minimum stock?'),
      ],
    };
  }

  // 1c. Create Draft Report action
  if (/\b(buat|buatkan|create|generate)\b/i.test(q) && /\b(draft laporan|draf laporan|laporan baru|new report)\b/i.test(q)) {
    const jenis =
      q.includes('inventaris') || q.includes('inventory')
        ? 'INVENTARIS_OVERHEAD'
        : q.includes('overhead')
        ? 'OVERHEAD_GOODS'
        : 'OFFICE_SUPPLIES';
    const period = detectedMonth?.ym || new Date().toISOString().slice(0, 7);
    const labelJenis =
      jenis === 'INVENTARIS_OVERHEAD'
        ? 'Inventaris Overhead'
        : jenis === 'OVERHEAD_GOODS'
        ? 'Overhead Goods'
        : 'Office Supplies';
    return {
      reply: t(
        `Saya dapat langsung membuatkan **Draft Laporan Bulanan ${labelJenis}** untuk periode **${period}** lengkap dengan saldo stok terkini dan template tanda tangan standar A3. Klik konfirmasi di bawah untuk membuat draft.`,
        `I can generate a **Monthly ${labelJenis} Report Draft** for period **${period}** populated with live stock balances and the standard A3 signature template. Click Confirm below to create it.`
      ),
      actionProposal: {
        type: 'CREATE_DRAFT_REPORT',
        title: t(`Buat Draft Laporan ${labelJenis} (${period})`, `Create ${labelJenis} Draft Report (${period})`),
        description: t(
          'Membuat dokumen laporan A3 baru berstatus DRAFT siap diperiksa dan ditandatangani.',
          'Creates a new DRAFT A3 report ready for review and digital signature.'
        ),
        payloadJson: JSON.stringify({ jenis, period }),
      },
      followUpSuggestions: [
        t('Siapa saja yang belum tanda tangan laporan?', 'Who has not signed reports yet?'),
        t('Tampilkan status seluruh laporan bulanan', 'Show all monthly reports status'),
      ],
    };
  }

  // 1d. Prefill Rolling Forecast GA action
  if (/\b(isi|perbarui|update|prefill|lengkapi)\b/i.test(q) && /\b(forecast|ga)\b/i.test(q)) {
    const targetMonth = detectedMonth?.forecastKey || store.rollingForecast.activeMonth;
    return {
      reply: t(
        `Siap mengisi otomatis **Rolling Forecast GA bulan ${targetMonth}** berdasarkan **${criticalItems.length} item kritis** (stok ≤ minimum) pada katalog Office Supplies saat ini.\n\nKlik tombol konfirmasi di bawah untuk memperbarui usulan order ke GA Dept.`,
        `Ready to auto-populate **GA Rolling Forecast for ${targetMonth}** using **${criticalItems.length} critical items** (stock ≤ minimum).\n\nClick Confirm below to update order proposals for GA Dept.`
      ),
      actionProposal: {
        type: 'UPDATE_ROLLING_FORECAST',
        title: t(`Isi Rolling Forecast GA (${targetMonth})`, `Populate GA Rolling Forecast (${targetMonth})`),
        description: t(
          `Mengisi usulan qty order item kritis pada kolom ${targetMonth} untuk pengiriman ke GA Dept.`,
          `Fills critical item order quantities in column ${targetMonth} for GA Dept submission.`
        ),
        payloadJson: JSON.stringify({ month: targetMonth }),
      },
      followUpSuggestions: [
        t(`Detail item yang sudah terisi di Forecast ${targetMonth}`, `Details of items filled in ${targetMonth} Forecast`),
        t('Item mana di katalog GA yang R/M Stock-nya 0?', 'Which GA catalog items have 0 R/M stock?'),
      ],
    };
  }

  // =========================================================================
  // 2. DOCUMENT DRAFT GENERATORS (Live-Data Populated)
  // =========================================================================
  const isDraftAsk = /\b(draf|draft|pengumuman|announcement|memo|catatan resmi|checklist|daftar periksa|berita acara|pesan pengingat)\b/i.test(q);
  if (isDraftAsk) {
    const smUser = store.users.find((u) => u.role === 'SECTION_MANAGER' && u.active);
    const deptUser = store.users.find((u) => u.role === 'DEPT_MANAGER' && u.active);
    const latestOpname = store.opnames[0];
    const opDiffs = latestOpname ? latestOpname.lines.filter((l) => l.diff !== 0) : [];

    // 2a. Pengumuman Stock Opname
    if (q.includes('opname') && (q.includes('pengumuman') || q.includes('jadwal') || q.includes('announcement'))) {
      return {
        reply: t(
          `**Draf Pengumuman Internal — Jadwal Stock Opname Bulanan**\n\n**Kepada:** Seluruh Karyawan Departemen Human Resources (Seksi HR Development & Administration & Operation)\n**Dari:** PIC Pengelola Perlengkapan — ${store.settings.department}\n**Lokasi:** ${store.settings.companyName} (${store.settings.factoryName})\n\nDengan hormat,\nSehubungan dengan persiapan tutup buku persediaan bulanan, akan dilaksanakan kegiatan **Stock Opname Fisik** terhadap **${activeItems.length} item aktif** (Office Supplies & Overhead Goods) dan **${store.inventories.length} aset Inventaris Overhead** pada tanggal **${store.settings.reminderOpnameDay} bulan berjalan**.\n\nMohon perhatian rekan-rekan:\n1. Pengajuan pengambilan barang melalui Portal Pengambilan HR mohon diselesaikan sebelum pukul 14.00 WIB pada hari pelaksanaan.\n2. Saat ini terdapat **${pendingRequests.length} permintaan** berstatus Menunggu Approval yang akan diselesaikan terlebih dahulu.\n3. Hasil opname akan diserahkan kepada **${smUser?.name || 'Section Manager HR'}** untuk verifikasi sebelum penerbitan laporan bulanan A3.\n\nTerima kasih atas kerja samanya.`,
          `**Internal Announcement Draft — Monthly Stock Opname Schedule**\n\n**To:** All Human Resources Department Staff (HR Development & Administration & Operation)\n**From:** Supply PIC — ${store.settings.department}\n**Site:** ${store.settings.companyName} (${store.settings.factoryName})\n\nDear Team,\nTo prepare for monthly inventory closing, a **Physical Stock Opname** covering **${activeItems.length} active items** (Office Supplies & Overhead Goods) and **${store.inventories.length} Overhead Inventory assets** will be conducted on day **${store.settings.reminderOpnameDay}** of this month.\n\nPlease note:\n1. Submit any supply requests via the HR Request Portal before 14:00 WIB on opname day.\n2. Currently **${pendingRequests.length} pending request(s)** will be cleared beforehand.\n3. Results will be submitted to **${smUser?.name || 'HR Section Manager'}** for verification prior to monthly A3 report issuance.\n\nThank you for your cooperation.`
        ),
        followUpSuggestions: [
          t('Tampilkan hasil Stock Opname terakhir beserta selisihnya', 'Show latest Stock Opname results & variances'),
          t('Buatkan checklist persiapan laporan bulanan HR Dept', 'Create monthly report preparation checklist'),
        ],
      };
    }

    // 2b. Catatan Selisih Opname untuk Section Manager
    if (q.includes('selisih') || q.includes('variance') || (q.includes('opname') && (q.includes('catatan') || q.includes('memo') || q.includes('manager')))) {
      const diffText =
        opDiffs.length > 0
          ? opDiffs
              .map(
                (d, idx) =>
                  `${idx + 1}. **${d.itemName}** (\`${d.codeItem}\`): Sistem ${d.systemStock} ${d.uom} vs Fisik ${d.physicalStock} ${d.uom} → **Selisih ${d.diff > 0 ? `+${d.diff}` : d.diff} ${d.uom}** *(Alasan: ${d.reason || 'Dalam penelusuran'})*`
              )
              .join('\n')
          : t('Tidak ditemukan selisih antara stok sistem dan fisik pada sesi opname terakhir.', 'No variances found between system and physical stock in the latest opname session.');

      return {
        reply: t(
          `**Memo Resmi Penjelasan Selisih Stock Opname**\n\n**Kepada Yth.:** ${smUser?.name || 'Section Manager HR'} (${smUser?.jabatan || 'Section Manager'})\n**Tembusan:** ${deptUser?.name || 'Dept. Manager HR'}\n**Perihal:** Laporan Selisih Stock Opname Periode ${latestOpname?.period || 'Berjalan'}\n\nDengan hormat,\nBerdasarkan hasil pemeriksaan fisik pada sesi opname **${latestOpname?.id || '-'}** (${latestOpname?.jenis || 'OFFICE_SUPPLIES'}, total ${latestOpname?.lines.length ?? 0} item diperiksa), tercatat **${opDiffs.length} item** dengan selisih:\n\n${diffText}\n\nMohon arahan dan persetujuan Bapak/Ibu untuk penyesuaian saldo sistem (OPNAME_ADJ) agar laporan bulanan A3 dapat segera diterbitkan.\n\nHormat kami,\n${currentUser?.name || 'PIC HR SupplyHub'}`,
          `**Official Stock Opname Variance Note**\n\n**To:** ${smUser?.name || 'HR Section Manager'} (${smUser?.jabatan || 'Section Manager'})\n**Cc:** ${deptUser?.name || 'HR Dept. Manager'}\n**Subject:** Stock Opname Variance Report — Period ${latestOpname?.period || 'Current'}\n\nDear Sir/Madam,\nBased on physical inspection in opname session **${latestOpname?.id || '-'}** (${latestOpname?.jenis || 'OFFICE_SUPPLIES'}, ${latestOpname?.lines.length ?? 0} items checked), **${opDiffs.length} variance(s)** were recorded:\n\n${diffText}\n\nWe kindly request your review and approval to apply system stock adjustments (OPNAME_ADJ) prior to issuing the monthly A3 report.\n\nBest regards,\n${currentUser?.name || 'HR SupplyHub PIC'}`
        ),
        visualData:
          opDiffs.length > 0
            ? {
                title: t('Daftar Selisih Opname Terakhir', 'Latest Opname Variances'),
                kind: 'TABLE',
                items: opDiffs.slice(0, 8).map((d) => ({
                  label: d.itemName,
                  value: d.diff,
                  secondary: `Sistem: ${d.systemStock} · Fisik: ${d.physicalStock} ${d.uom} · ${d.reason || '-'}`,
                })),
              }
            : null,
        followUpSuggestions: [
          t('Tampilkan seluruh sesi Stock Opname di sistem', 'Show all Stock Opname sessions'),
          t('Siapa saja yang belum tanda tangan laporan?', 'Who has not signed reports yet?'),
        ],
      };
    }

    // 2c. Checklist Persiapan Laporan Bulanan
    if (q.includes('checklist') || q.includes('daftar periksa') || q.includes('persiapan laporan')) {
      return {
        reply: t(
          `**Checklist Persiapan Laporan Bulanan HR SupplyHub** *(Status Live Saat Ini)*\n\n1. **[${pendingRequests.length === 0 ? '✓' : ' '}] Selesaikan Permintaan Karyawan Pending:** Saat ini tersisa **${pendingRequests.length} permintaan** menunggu approval PIC.\n2. **[${outOfStockItems.length === 0 ? '✓' : ' '}] Verifikasi Item Habis & Kritis:** Terdapat **${outOfStockItems.length} item habis (0)** dan **${criticalItems.length} item ≤ minimum** yang perlu dimasukkan ke Rolling Forecast GA.\n3. **[${store.opnames.some((o) => o.status === 'DISETUJUI') ? '✓' : ' '}] Stock Opname & Approval SM:** Total ${store.opnames.length} sesi tercatat (${store.opnames.filter((o) => o.status === 'MENUNGGU_SM').length} menunggu persetujuan SM).\n4. **[ ] Perbarui Rolling Forecast GA (${store.rollingForecast.activeMonth}):** Saat ini **${store.rollingForecast.rows.filter((r) => (r.months[store.rollingForecast.activeMonth] || 0) > 0).length} item** terisi untuk dikirim ke GA Dept.\n5. **[${pendingReports.length === 0 ? '✓' : ' '}] Penerbitan & Tanda Tangan Digital A3:** Tersisa **${pendingReports.length} laporan** yang masih menunggu tanda tangan lengkap.\n6. **[ ] Export PDF A3 & Arsip Dokumen:** Simpan salinan PDF Final di modul Arsip Dokumen Sistem (saat ini ${store.documents.length} dokumen terarsip).`,
          `**HR SupplyHub Monthly Report Preparation Checklist** *(Live System Status)*\n\n1. **[${pendingRequests.length === 0 ? '✓' : ' '}] Clear Pending Employee Requests:** Currently **${pendingRequests.length} request(s)** awaiting PIC approval.\n2. **[${outOfStockItems.length === 0 ? '✓' : ' '}] Review Out-of-Stock & Critical Items:** **${outOfStockItems.length} out-of-stock** and **${criticalItems.length} ≤ minimum** items to include in GA Rolling Forecast.\n3. **[${store.opnames.some((o) => o.status === 'DISETUJUI') ? '✓' : ' '}] Stock Opname & SM Sign-Off:** ${store.opnames.length} session(s) logged (${store.opnames.filter((o) => o.status === 'MENUNGGU_SM').length} awaiting SM approval).\n4. **[ ] Update GA Rolling Forecast (${store.rollingForecast.activeMonth}):** **${store.rollingForecast.rows.filter((r) => (r.months[store.rollingForecast.activeMonth] || 0) > 0).length} items** currently populated.\n5. **[${pendingReports.length === 0 ? '✓' : ' '}] A3 Digital Signatures:** **${pendingReports.length} report(s)** still pending complete signatures.\n6. **[ ] Export A3 PDF & Archive:** Store signed copies in Document Archive (${store.documents.length} archived).`
        ),
        followUpSuggestions: [
          t('Siapa saja yang belum tanda tangan laporan?', 'Who has not signed reports yet?'),
          t('Lihat daftar permintaan karyawan yang menunggu approval', 'View pending employee requests'),
        ],
      };
    }

    // 2d. Draf Pengingat Tanda Tangan
    if (q.includes('pengingat') || q.includes('tanda tangan') || q.includes('reminder') || q.includes('signer')) {
      const firstPending = pendingReports[0];
      const pendingLines = pendingReports.map((r) => {
        const slots = r.signatureGroups.flatMap((g) => g.slots.filter((s) => s.status === 'PENDING'));
        return `- **${r.title} (${r.periodLabel})** [${r.status}] → Menunggu: ${slots.map((s) => `${s.name} (${s.jabatan})`).join(', ')}`;
      });
      return {
        reply:
          pendingReports.length === 0
            ? t(
                'Seluruh laporan saat ini sudah berstatus **FINAL** dan ditandatangani lengkap — tidak ada penanda tangan yang perlu diingatkan.',
                'All reports are currently **FINAL** and fully signed — no reminders needed.'
              )
            : t(
                `**Daftar Laporan Menunggu Tanda Tangan (${pendingReports.length} dokumen):**\n${pendingLines.join('\n')}\n\n**Draf Pesan Pengingat (Siap Salin ke WA / Email):**\n> *"Selamat pagi/siang Bapak/Ibu, mohon berkenan meluangkan waktu untuk meninjau dan memberikan tanda tangan digital pada dokumen **${firstPending.title} (${firstPending.periodLabel} — ${firstPending.documentId})** di sistem HR SupplyHub agar laporan bulanan Dept. HR dapat segera disahkan (FINAL) dan diarsipkan. Terima kasih banyak atas perhatiannya."*`,
                `**Reports Awaiting Signatures (${pendingReports.length} document(s)):**\n${pendingLines.join('\n')}\n\n**Reminder Message Draft (Ready to Copy):**\n> *"Dear Sir/Madam, kindly review and digitally sign **${firstPending.title} (${firstPending.periodLabel} — ${firstPending.documentId})** in HR SupplyHub so the monthly HR Dept. report can be finalized and archived. Thank you very much."*`
              ),
        actionProposal: firstPending
          ? {
              type: 'SEND_REMINDER',
              title: t(`Kirim Notifikasi Pengingat (${firstPending.documentId})`, `Send Reminder Notification (${firstPending.documentId})`),
              description: t(
                `Mengirim notifikasi in-app ke seluruh penanda tangan pending pada ${firstPending.title}.`,
                `Sends in-app notification to all pending signers on ${firstPending.title}.`
              ),
              payloadJson: JSON.stringify({ reportId: firstPending.id }),
            }
          : null,
        followUpSuggestions: [
          t('Tampilkan status semua laporan bulanan', 'Show status of all monthly reports'),
          t('Ringkasan operasional HR SupplyHub hari ini', 'Today’s HR SupplyHub operational summary'),
        ],
      };
    }
  }

  // =========================================================================
  // 3. PERMINTAAN PENGAMBILAN BARANG KARYAWAN (itemRequests)
  // =========================================================================
  if (
    /\b(permintaan|pengambilan|request|pending approval|menunggu approval|ditolak|disetujui)\b/i.test(q) &&
    !q.includes('forecast') &&
    !q.includes('tanda tangan')
  ) {
    let filtered: ItemRequest[] = store.itemRequests;
    let filterLabel = t('Semua Status', 'All Statuses');

    if (q.includes('menunggu') || q.includes('pending') || q.includes('belum diproses')) {
      filtered = store.itemRequests.filter((r) => r.status === 'MENUNGGU');
      filterLabel = t('Menunggu Approval', 'Pending Approval');
    } else if (q.includes('disetujui') || q.includes('approved')) {
      filtered = store.itemRequests.filter((r) => r.status === 'DISETUJUI');
      filterLabel = t('Disetujui', 'Approved');
    } else if (q.includes('ditolak') || q.includes('rejected')) {
      filtered = store.itemRequests.filter((r) => r.status === 'DITOLAK');
      filterLabel = t('Ditolak', 'Rejected');
    }

    if (q.includes('hr development') || q.includes('hr dev')) {
      filtered = filtered.filter((r) => r.requesterSection === 'HR Development');
      filterLabel += ' · HR Development';
    } else if (q.includes('administration') || q.includes('operation')) {
      filtered = filtered.filter((r) => r.requesterSection === 'Administration & Operation');
      filterLabel += ' · Administration & Operation';
    }

    const totalPending = store.itemRequests.filter((r) => r.status === 'MENUNGGU').length;
    const totalApproved = store.itemRequests.filter((r) => r.status === 'DISETUJUI').length;
    const totalRejected = store.itemRequests.filter((r) => r.status === 'DITOLAK').length;

    const listText =
      filtered.length === 0
        ? t('Tidak ada data permintaan pada filter tersebut.', 'No requests found matching that filter.')
        : filtered
            .slice(0, 8)
            .map(
              (r) =>
                `- **${r.requesterName}** (${r.requesterSection}, ${r.requestDate}) — **${r.status}**: ${r.items
                  .map((i) => `${i.itemName} (${i.qty} ${i.uom})`)
                  .join(', ')}${r.note ? ` · *${r.note}*` : ''}`
            )
            .join('\n');

    const firstPending = filtered.find((r) => r.status === 'MENUNGGU');

    return {
      reply: t(
        `**Rekap Permintaan Pengambilan Barang Karyawan Dept. HR (${filterLabel}):**\n- Total tercatat: **${store.itemRequests.length}** (**${totalPending}** Menunggu, **${totalApproved}** Disetujui, **${totalRejected}** Ditolak)\n\n${listText}`,
        `**HR Dept. Employee Supply Requests (${filterLabel}):**\n- Total logged: **${store.itemRequests.length}** (**${totalPending}** Pending, **${totalApproved}** Approved, **${totalRejected}** Rejected)\n\n${listText}`
      ),
      visualData:
        filtered.length > 0
          ? {
              title: t(`Daftar Permintaan (${filterLabel})`, `Requests (${filterLabel})`),
              kind: 'TABLE',
              items: filtered.slice(0, 8).map((r) => ({
                label: `${r.requesterName} (${r.status})`,
                value: r.items.reduce((s, i) => s + i.qty, 0),
                secondary: `${r.requesterSection} · ${r.requestDate} · ${r.items.map((i) => `${i.itemName} x${i.qty}`).join(', ')}`,
              })),
            }
          : null,
      actionProposal: firstPending
        ? {
            type: 'APPROVE_REQUEST',
            title: t(`Setujui Permintaan ${firstPending.requesterName}`, `Approve Request from ${firstPending.requesterName}`),
            description: `${firstPending.requesterSection} · ${firstPending.items.map((i) => `${i.itemName} (${i.qty} ${i.uom})`).join(', ')}`,
            payloadJson: JSON.stringify({ requestId: firstPending.id }),
          }
        : null,
      followUpSuggestions: [
        t('Berapa jumlah karyawan di HR Development vs Administration & Operation?', 'How many employees are in HR Development vs Administration & Operation?'),
        t('Item apa yang paling sering dipakai?', 'Which items are consumed the most?'),
      ],
    };
  }

  // =========================================================================
  // 4. DATABASE KARYAWAN DEPT. HR (employees)
  // =========================================================================
  if (/\b(karyawan|pegawai|employee|staff hr|daftar nama|seksi hr|hr development|administration)\b/i.test(q) && !q.includes('inventaris') && !q.includes('laporan')) {
    const activeEmps = store.employees.filter((e) => e.active);
    let filteredEmps: HrEmployee[] = activeEmps;
    let subtitle = t('Seluruh Departemen HR', 'All HR Department');

    const mentionsHrDev = q.includes('hr development') || q.includes('hr dev');
    const mentionsAdminOps = q.includes('administration') || q.includes('operation');
    if (mentionsHrDev && !mentionsAdminOps) {
      filteredEmps = activeEmps.filter((e) => e.section === 'HR Development');
      subtitle = 'Seksi HR Development';
    } else if (mentionsAdminOps && !mentionsHrDev) {
      filteredEmps = activeEmps.filter((e) => e.section === 'Administration & Operation');
      subtitle = 'Seksi Administration & Operation';
    }

    const hrDevCount = activeEmps.filter((e) => e.section === 'HR Development').length;
    const adminOpsCount = activeEmps.filter((e) => e.section === 'Administration & Operation').length;

    return {
      reply: t(
        `**Database Karyawan Departemen HR (${subtitle}):**\n- Total Karyawan Aktif: **${activeEmps.length} orang** (HR Development: **${hrDevCount}**, Administration & Operation: **${adminOpsCount}**)\n\n${filteredEmps
          .slice(0, 10)
          .map((e) => `- **${e.name}** (\`NIK: ${e.nik}\`) — ${e.jabatan} · *${e.section}*`)
          .join('\n')}${filteredEmps.length > 10 ? `\n\n*...dan ${filteredEmps.length - 10} karyawan lainnya.*` : ''}`,
        `**HR Department Employee Directory (${subtitle}):**\n- Active Employees: **${activeEmps.length}** (HR Development: **${hrDevCount}**, Administration & Operation: **${adminOpsCount}**)\n\n${filteredEmps
          .slice(0, 10)
          .map((e) => `- **${e.name}** (\`NIK: ${e.nik}\`) — ${e.jabatan} · *${e.section}*`)
          .join('\n')}`
      ),
      visualData: {
        title: t('Distribusi Karyawan per Seksi HR', 'Employee Distribution by HR Section'),
        kind: 'BAR',
        items: [
          { label: 'HR Development', value: hrDevCount },
          { label: 'Admin & Operation', value: adminOpsCount },
        ],
      },
      followUpSuggestions: [
        t('Tampilkan permintaan barang dari karyawan yang masih pending', 'Show pending employee supply requests'),
        t('Siapa saja PIC dan Manager penanda tangan di sistem?', 'Who are the system PICs and signing Managers?'),
      ],
    };
  }

  // =========================================================================
  // 5. INVENTARIS OVERHEAD (inventories: MCH / ELC / ATK, BAGUS / RUSAK)
  // =========================================================================
  if (/\b(inventaris|aset|asset|rusak|bagus|mch|elc|mesin|elektronik|peralatan)\b/i.test(q)) {
    let list: OverheadInventoryItem[] = store.inventories;
    let label = t('Seluruh Aset Inventaris Overhead', 'All Overhead Inventory Assets');

    if (q.includes('rusak') || q.includes('damaged') || q.includes('broken')) {
      list = list.filter((i) => i.condition === 'RUSAK');
      label = t('Aset Kondisi RUSAK', 'DAMAGED Assets');
    } else if (q.includes('bagus') || q.includes('good')) {
      list = list.filter((i) => i.condition === 'BAGUS');
      label = t('Aset Kondisi BAGUS', 'GOOD Condition Assets');
    }
    if (q.includes('mch') || q.includes('mesin')) {
      list = list.filter((i) => i.prefix === 'MCH');
      label += ' (MCH)';
    } else if (q.includes('elc') || q.includes('elektronik')) {
      list = list.filter((i) => i.prefix === 'ELC');
      label += ' (ELC)';
    }

    const totalBagus = store.inventories.filter((i) => i.condition === 'BAGUS').length;
    const totalRusak = store.inventories.filter((i) => i.condition === 'RUSAK').length;
    const mchCount = store.inventories.filter((i) => i.prefix === 'MCH').length;
    const elcCount = store.inventories.filter((i) => i.prefix === 'ELC').length;
    const atkCount = store.inventories.filter((i) => i.prefix === 'ATK').length;

    return {
      reply: t(
        `**${label}** *(Total database: ${store.inventories.length} aset — ${totalBagus} BAGUS, ${totalRusak} RUSAK | MCH: ${mchCount}, ELC: ${elcCount}, ATK: ${atkCount})*:\n\n${
          list.length === 0
            ? 'Tidak ada aset yang cocok dengan filter tersebut.'
            : list
                .slice(0, 10)
                .map(
                  (inv) =>
                    `- **\`${inv.partId}\` ${inv.itemName}** — ${inv.qty} ${inv.uom} · Kondisi: **${inv.condition}** · Lokasi: ${inv.location}${inv.notes ? ` *(${inv.notes})*` : ''}`
                )
                .join('\n')
        }`,
        `**${label}** *(Database total: ${store.inventories.length} assets — ${totalBagus} GOOD, ${totalRusak} DAMAGED | MCH: ${mchCount}, ELC: ${elcCount}, ATK: ${atkCount})*:\n\n${
          list.length === 0
            ? 'No assets matched that filter.'
            : list
                .slice(0, 10)
                .map(
                  (inv) =>
                    `- **\`${inv.partId}\` ${inv.itemName}** — ${inv.qty} ${inv.uom} · Condition: **${inv.condition}** · Location: ${inv.location}`
                )
                .join('\n')
        }`
      ),
      visualData:
        list.length > 0
          ? {
              title: label,
              kind: list.length <= 4 ? 'TABLE' : 'BAR',
              items:
                list.length <= 4
                  ? list.map((inv) => ({
                      label: `${inv.partId} · ${inv.itemName}`,
                      value: inv.qty,
                      secondary: `${inv.condition} · ${inv.location}`,
                    }))
                  : [
                      { label: 'MCH (Mesin)', value: mchCount },
                      { label: 'ELC (Elektronik)', value: elcCount },
                      { label: 'ATK (Alat Kerja)', value: atkCount },
                      { label: 'BAGUS', value: totalBagus },
                      { label: 'RUSAK', value: totalRusak },
                    ],
            }
          : null,
      followUpSuggestions: [
        t('Aset inventaris apa saja yang kondisinya RUSAK?', 'Which inventory assets are DAMAGED?'),
        t('Cek lokasi penyimpanan setiap lemari', 'Check storage locations across cabinets'),
      ],
    };
  }

  // =========================================================================
  // 6. ROLLING FORECAST GA
  // =========================================================================
  if (/\b(forecast|ga dept|proyeksi|r\/m|rm stock|order ga|usulan ga)\b/i.test(q)) {
    const rf = store.rollingForecast;

    // 6a. R/M Stock = 0
    if (q.includes('rm') || q.includes('r/m') || q.includes('kosong') || q.includes('nol') || q.includes('0')) {
      const zeroRows = rf.rows.filter((r) => r.rmStock === 0);
      return {
        reply: t(
          `Pada katalog **Rolling Forecast GA (${rf.fiscalYearLabel})**, terdapat **${zeroRows.length} item** dengan **R/M Stock = 0** (perlu perhatian ekstra saat pengajuan order):\n\n${zeroRows
            .slice(0, 10)
            .map((r) => `- \`${r.codeItem}\` **${r.itemName}** (${r.jenis}, ${r.uom}) — Order ${rf.activeMonth}: **${r.months[rf.activeMonth] || 0}**`)
            .join('\n')}${zeroRows.length > 10 ? `\n\n*...dan ${zeroRows.length - 10} item lainnya.*` : ''}`,
          `In the **GA Rolling Forecast (${rf.fiscalYearLabel})**, **${zeroRows.length} catalog items** have **R/M Stock = 0**:\n\n${zeroRows
            .slice(0, 10)
            .map((r) => `- \`${r.codeItem}\` **${r.itemName}** (${r.jenis}, ${r.uom}) — ${rf.activeMonth} Order: **${r.months[rf.activeMonth] || 0}**`)
            .join('\n')}`
        ),
        visualData: {
          title: t('Item Katalog GA dengan R/M Stock = 0', 'GA Catalog Items with 0 R/M Stock'),
          kind: 'TABLE',
          items: zeroRows.slice(0, 8).map((r) => ({
            label: r.itemName,
            value: r.months[rf.activeMonth] || 0,
            secondary: `Kode ${r.codeItem} · ${r.jenis} · Order ${rf.activeMonth}`,
          })),
        },
        followUpSuggestions: [
          t(`Isi otomatis Rolling Forecast GA bulan ${rf.activeMonth}`, `Auto-fill GA Rolling Forecast for ${rf.activeMonth}`),
          t('Tampilkan tren total order Rolling Forecast 12 bulan', 'Show 12-month Rolling Forecast order trend'),
        ],
      };
    }

    // 6b. Specific month or active month forecast
    const targetMonth: ForecastMonthKey = detectedMonth?.forecastKey || rf.activeMonth;
    const filledInMonth = rf.rows.filter((r) => (r.months[targetMonth] || 0) > 0);
    const totalUnitsMonth = filledInMonth.reduce((s, r) => s + (r.months[targetMonth] || 0), 0);
    const monthBars = FORECAST_MONTH_KEYS.map((mk) => ({
      label: mk,
      value: rf.rows.reduce((s, r) => s + (r.months[mk] || 0), 0),
    }));

    return {
      reply: t(
        `**Rolling Forecast Office Supplies ke GA Dept (${rf.fiscalYearLabel} · ${rf.periodRangeLabel}):**\n- **Bulan Ditinjau:** **${targetMonth}** ${targetMonth === rf.activeMonth ? '*(Bulan Aktif)*' : ''}\n- **Total Katalog GA:** ${rf.rows.length} item\n- **Item Terisi di ${targetMonth}:** **${filledInMonth.length} item** (**${totalUnitsMonth} unit**)\n- **Riwayat Kirim ke GA:** ${rf.submissions.length} kali pengiriman\n\n${
          filledInMonth.length > 0
            ? `**Rincian Item Usulan ${targetMonth}:**\n${filledInMonth
                .slice(0, 8)
                .map((r) => `- **${r.itemName}** (\`${r.codeItem}\`): **${r.months[targetMonth]} ${r.uom}** · R/M Stock: ${r.rmStock ?? '-'}`)
                .join('\n')}`
            : `Belum ada angka usulan terisi pada bulan ${targetMonth}. Anda dapat mengisi otomatis dari daftar item kritis.`
        }`,
        `**GA Dept Office Supplies Rolling Forecast (${rf.fiscalYearLabel}):**\n- **Month Reviewed:** **${targetMonth}** ${targetMonth === rf.activeMonth ? '*(Active Month)*' : ''}\n- **GA Catalog Rows:** ${rf.rows.length}\n- **Items Filled in ${targetMonth}:** **${filledInMonth.length} items** (**${totalUnitsMonth} units**)\n- **GA Submissions Logged:** ${rf.submissions.length}\n\n${
          filledInMonth.length > 0
            ? filledInMonth
                .slice(0, 8)
                .map((r) => `- **${r.itemName}** (\`${r.codeItem}\`): **${r.months[targetMonth]} ${r.uom}** · R/M Stock: ${r.rmStock ?? '-'}`)
                .join('\n')
            : `No quantities filled for ${targetMonth} yet.`
        }`
      ),
      visualData: {
        title: t('Tren Total Unit Rolling Forecast GA (12 Bulan)', '12-Month GA Rolling Forecast Trend (Units)'),
        kind: 'BAR',
        items: monthBars,
      },
      actionProposal:
        criticalItems.length > 0
          ? {
              type: 'UPDATE_ROLLING_FORECAST',
              title: t(`Isi Item Kritis ke Forecast ${targetMonth}`, `Prefill Critical Items into ${targetMonth} Forecast`),
              description: t(
                `Perbarui kolom ${targetMonth} secara otomatis berdasarkan ${criticalItems.length} item kritis.`,
                `Auto-populate ${targetMonth} based on ${criticalItems.length} critical stock items.`
              ),
              payloadJson: JSON.stringify({ month: targetMonth }),
            }
          : null,
      followUpSuggestions: [
        t('Item katalog GA mana saja yang R/M Stock-nya 0?', 'Which GA catalog items have 0 R/M stock?'),
        t('Item apa yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
      ],
    };
  }

  // =========================================================================
  // 7. LAPORAN BULANAN & TANDA TANGAN DIGITAL
  // =========================================================================
  if (/\b(tanda tangan|ttd|sign|signature|laporan|report|belum ttd|penanda tangan|final)\b/i.test(q)) {
    const filteredReports = detectedMonth
      ? store.reports.filter((r) => r.period === detectedMonth.ym || r.periodLabel.toLowerCase().includes(detectedMonth.idLabel.split(' ')[0].toLowerCase()))
      : store.reports;

    const listToShow = filteredReports.length > 0 ? filteredReports : store.reports;
    const firstPending = listToShow.find((r) => !r.locked) || pendingReports[0];

    const reportLines = listToShow.map((r) => {
      const pendingSlots = r.signatureGroups.flatMap((g) => g.slots.filter((s) => s.status === 'PENDING'));
      const signedCount = r.signatureGroups.flatMap((g) => g.slots.filter((s) => s.status === 'SIGNED')).length;
      const totalSlots = r.signatureGroups.flatMap((g) => g.slots).length;
      return `- **${r.title} (${r.periodLabel})** \`${r.documentId}\` — Status: **${r.status}** (${signedCount}/${totalSlots} TTD)${
        pendingSlots.length > 0
          ? ` → Menunggu: ${pendingSlots.map((s) => `${s.name} (${s.jabatan})`).join(', ')}`
          : ' ✓ Lengkap'
      }`;
    });

    return {
      reply: t(
        `**Status Laporan Bulanan & Tanda Tangan Digital (${listToShow.length} dokumen):**\n- Total Final: **${store.reports.filter((r) => r.locked).length}** · Menunggu TTD: **${pendingReports.length}**\n\n${reportLines.join('\n')}`,
        `**Monthly Reports & Digital Signature Status (${listToShow.length} document(s)):**\n- Finalized: **${store.reports.filter((r) => r.locked).length}** · Pending Signatures: **${pendingReports.length}**\n\n${reportLines.join('\n')}`
      ),
      visualData: {
        title: t('Progres Tanda Tangan Laporan', 'Report Signature Progress'),
        kind: 'TABLE',
        items: listToShow.slice(0, 8).map((r) => {
          const signedCount = r.signatureGroups.flatMap((g) => g.slots.filter((s) => s.status === 'SIGNED')).length;
          const totalSlots = r.signatureGroups.flatMap((g) => g.slots).length;
          return {
            label: `${r.title} (${r.periodLabel})`,
            value: signedCount,
            secondary: `${r.status} · ${signedCount}/${totalSlots} TTD · ${r.documentId}`,
          };
        }),
      },
      actionProposal: firstPending
        ? {
            type: 'SEND_REMINDER',
            title: t(`Kirim Pengingat TTD (${firstPending.documentId})`, `Send Signature Reminder (${firstPending.documentId})`),
            description: t(
              `Kirim notifikasi pengingat kepada penanda tangan pending pada ${firstPending.title} (${firstPending.periodLabel}).`,
              `Send reminder notification to pending signers on ${firstPending.title} (${firstPending.periodLabel}).`
            ),
            payloadJson: JSON.stringify({ reportId: firstPending.id }),
          }
        : null,
      followUpSuggestions: [
        t('Buatkan draf pesan pengingat penanda tangan', 'Draft a signer reminder message'),
        t('Buatkan draft laporan Office Supplies bulan ini', 'Create this month’s Office Supplies draft report'),
      ],
    };
  }

  // =========================================================================
  // 8. STOCK OPNAME & SELISIH
  // =========================================================================
  if (/\b(opname|selisih|fisik|variance|discrepancy)\b/i.test(q)) {
    const allDiffs = store.opnames.flatMap((op) =>
      op.lines
        .filter((l) => l.diff !== 0)
        .map((l) => ({ ...l, period: op.period, opStatus: op.status }))
    );
    return {
      reply: t(
        `**Ringkasan Stock Opname (${store.opnames.length} sesi tercatat):**\n${store.opnames
          .slice(0, 6)
          .map((op) => {
            const dCount = op.lines.filter((l) => l.diff !== 0).length;
            return `- **Periode ${op.period} (${op.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'})** — Status: **${op.status}** · ${op.lines.length} item diperiksa · **${dCount} selisih** (oleh ${op.createdByName})`;
          })
          .join('\n')}${
          allDiffs.length > 0
            ? `\n\n**Rincian Item Selisih:**\n${allDiffs
                .slice(0, 6)
                .map(
                  (d) =>
                    `- **${d.itemName}** (${d.period}): Sistem ${d.systemStock} vs Fisik ${d.physicalStock} ${d.uom} → **Selisih ${d.diff > 0 ? `+${d.diff}` : d.diff}** *(${d.reason || '-'})*`
                )
                .join('\n')}`
            : ''
        }`,
        `**Stock Opname Summary (${store.opnames.length} session(s)):**\n${store.opnames
          .slice(0, 6)
          .map((op) => {
            const dCount = op.lines.filter((l) => l.diff !== 0).length;
            return `- **Period ${op.period} (${op.jenis})** — Status: **${op.status}** · ${op.lines.length} checked · **${dCount} variance(s)**`;
          })
          .join('\n')}`
      ),
      visualData:
        allDiffs.length > 0
          ? {
              title: t('Selisih Stock Opname', 'Stock Opname Variances'),
              kind: 'TABLE',
              items: allDiffs.slice(0, 8).map((d) => ({
                label: d.itemName,
                value: d.diff,
                secondary: `${d.period} · Sistem ${d.systemStock} → Fisik ${d.physicalStock} ${d.uom} · ${d.reason || '-'}`,
              })),
            }
          : null,
      followUpSuggestions: [
        t('Buatkan catatan resmi selisih stock opname untuk Section Manager', 'Draft official variance note for Section Manager'),
        t('Buatkan pengumuman internal jadwal Stock Opname', 'Draft internal Stock Opname schedule announcement'),
      ],
    };
  }

  // =========================================================================
  // 9. LOKASI PENYIMPANAN / LEMARI / RAK
  // =========================================================================
  const allLocations = Array.from(
    new Set([
      ...store.masterData.locations,
      ...activeItems.map((i) => i.location),
      ...store.inventories.map((i) => i.location),
    ])
  ).filter(Boolean);

  const exactLocation = allLocations.find((loc) => q.includes(normalizeText(loc)));
  const cabinetMatch = q.match(/\b((?:lemari|cabinet|rak|nob)\s*\d+(?:\s*baris\s*[\d-]+)?)\b/i);
  const partialLocations = !exactLocation && cabinetMatch
    ? allLocations.filter((loc) => normalizeText(loc).includes(normalizeText(cabinetMatch[1])))
    : [];
  const matchedLocations = exactLocation ? [exactLocation] : partialLocations;

  if (matchedLocations.length > 0 || /\b(lokasi|lemari|cabinet|rak|simpan|gudang|penyimpanan|storage)\b/i.test(q)) {
    if (matchedLocations.length > 0) {
      const matchedSet = new Set(matchedLocations.map((l) => normalizeText(l)));
      const locTitle = exactLocation || (cabinetMatch ? cabinetMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()) : matchedLocations.join(', '));
      const itemsAtLoc = activeItems.filter((i) => matchedSet.has(normalizeText(i.location)));
      const invAtLoc = store.inventories.filter((i) => matchedSet.has(normalizeText(i.location)));
      return {
        reply: t(
          `**Isi Lokasi Penyimpanan: ${locTitle}**${matchedLocations.length > 1 ? ` *(${matchedLocations.join(', ')})*` : ''}\n- Supply Items: **${itemsAtLoc.length} item** · Aset Inventaris Overhead: **${invAtLoc.length} aset**\n\n${
            itemsAtLoc.length > 0
              ? `**Daftar Barang:**\n${itemsAtLoc
                  .slice(0, 12)
                  .map((i) => `- **${i.itemName}** (\`${i.codeItem}\`): **${i.currentStock} ${i.uom}** (Min: ${i.minStock}) · ${i.location} · **${getStockStatus(i)}**`)
                  .join('\n')}`
              : ''
          }${
            invAtLoc.length > 0
              ? `\n\n**Aset Inventaris:**\n${invAtLoc
                  .map((inv) => `- \`${inv.partId}\` **${inv.itemName}** (${inv.qty} ${inv.uom} · ${inv.condition} · ${inv.location})`)
                  .join('\n')}`
              : ''
          }`,
          `**Storage Location Contents: ${locTitle}**\n- Supply Items: **${itemsAtLoc.length}** · Overhead Assets: **${invAtLoc.length}**\n\n${itemsAtLoc
            .slice(0, 12)
            .map((i) => `- **${i.itemName}** (\`${i.codeItem}\`): **${i.currentStock} ${i.uom}** (Min: ${i.minStock}) · ${i.location}`)
            .join('\n')}`
        ),
        visualData: {
          title: `${locTitle} (${itemsAtLoc.length} item)`,
          kind: 'TABLE',
          items: itemsAtLoc.slice(0, 8).map((i) => ({
            label: i.itemName,
            value: i.currentStock,
            secondary: `${i.location} · Min ${i.minStock} ${i.uom} · ${getStockStatus(i)}`,
          })),
        },
        followUpSuggestions: [
          t('Tampilkan ringkasan semua lokasi penyimpanan', 'Show summary of all storage locations'),
          t('Item apa saja yang di bawah minimum?', 'Which items are below minimum stock?'),
        ],
      };
    }

    // Location distribution overview
    const locMap = new Map<string, number>();
    for (const i of activeItems) locMap.set(i.location || 'Lainnya', (locMap.get(i.location || 'Lainnya') || 0) + 1);
    const locEntries = Array.from(locMap.entries()).sort((a, b) => b[1] - a[1]);
    return {
      reply: t(
        `**Distribusi Penyimpanan di ${locEntries.length} Lokasi / Lemari:**\n${locEntries
          .map(([loc, cnt]) => `- **${loc}**: **${cnt} item**`)
          .join('\n')}\n\nAnda dapat menanyakan isi lemari tertentu, misalnya *"Barang apa saja yang ada di ${locEntries[0]?.[0] || 'Lemari 1'}?"*`,
        `**Storage Distribution across ${locEntries.length} Locations:**\n${locEntries
          .map(([loc, cnt]) => `- **${loc}**: **${cnt} items**`)
          .join('\n')}`
      ),
      visualData: {
        title: t('Jumlah Item per Lokasi Simpan', 'Items per Storage Location'),
        kind: 'BAR',
        items: locEntries.slice(0, 8).map(([loc, cnt]) => ({ label: loc, value: cnt })),
      },
      followUpSuggestions: locEntries.slice(0, 2).map(([loc]) => t(`Barang apa saja di ${loc}?`, `What items are in ${loc}?`)),
    };
  }

  // =========================================================================
  // 10. TOP PEMAKAIAN & ANALITIK TRANSAKSI
  // =========================================================================
  if (/\b(pemakaian|terbanyak dipakai|sering dipakai|transaksi|riwayat|mutasi|barang masuk|barang keluar|top usage|consumption|terima|pakai)\b/i.test(q)) {
    const txs = detectedMonth
      ? store.transactions.filter((tx) => tx.period === detectedMonth.ym)
      : store.transactions;

    const totalTerima = txs.filter((x) => x.type === 'TERIMA').reduce((s, x) => s + x.qty, 0);
    const totalPakai = txs.filter((x) => x.type === 'PAKAI').reduce((s, x) => s + x.qty, 0);
    const usageByItem = new Map<string, { name: string; uom: string; qty: number }>();
    for (const tx of txs) {
      if (tx.type !== 'PAKAI') continue;
      const cur = usageByItem.get(tx.itemId) || { name: tx.itemName, uom: tx.uom, qty: 0 };
      cur.qty += tx.qty;
      usageByItem.set(tx.itemId, cur);
    }
    const topUsed = Array.from(usageByItem.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    const periodTitle = detectedMonth ? detectedMonth.idLabel : t('Keseluruhan Periode', 'All Periods');

    return {
      reply: t(
        `**Analitik Transaksi & Pemakaian (${periodTitle}):**\n- Total catatan transaksi: **${txs.length} transaksi**\n- Total Penerimaan (**TERIMA**): **+${totalTerima} unit**\n- Total Pemakaian (**PAKAI**): **-${totalPakai} unit**\n\n**Top Item Paling Banyak Dipakai:**\n${
          topUsed.length > 0
            ? topUsed.map((u, idx) => `${idx + 1}. **${u.name}**: **${u.qty} ${u.uom}**`).join('\n')
            : 'Belum ada transaksi pemakaian pada periode tersebut.'
        }`,
        `**Transaction & Usage Analytics (${periodTitle}):**\n- Total transactions: **${txs.length}**\n- Total Received (**TERIMA**): **+${totalTerima} units**\n- Total Used (**PAKAI**): **-${totalPakai} units**\n\n**Top Consumed Items:**\n${
          topUsed.length > 0
            ? topUsed.map((u, idx) => `${idx + 1}. **${u.name}**: **${u.qty} ${u.uom}**`).join('\n')
            : 'No usage transactions recorded in that period.'
        }`
      ),
      visualData:
        topUsed.length > 0
          ? {
              title: t(`Top Pemakaian (${periodTitle})`, `Top Consumption (${periodTitle})`),
              kind: 'BAR',
              items: topUsed.slice(0, 6).map((u) => ({
                label: u.name.length > 18 ? `${u.name.slice(0, 17)}…` : u.name,
                value: u.qty,
              })),
            }
          : null,
      followUpSuggestions: [
        t('Item apa saja yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
        t('Lihat status Rolling Forecast GA bulan aktif', 'Check active month GA Rolling Forecast'),
      ],
    };
  }

  // =========================================================================
  // 11. STOK HABIS / KRITIS / MINIMUM / TERTINGGI / KATEGORI
  // =========================================================================
  if (/\b(habis|kosong|stok 0|out of stock|zero stock)\b/i.test(q) && !q.includes('rm')) {
    return {
      reply:
        outOfStockItems.length === 0
          ? t(
              'Kabar baik! Saat ini **tidak ada item aktif yang stoknya 0 (habis)**.',
              'Good news! Currently **no active items are out of stock (0)**.'
            )
          : t(
              `Terdapat **${outOfStockItems.length} item aktif** dengan **stok 0 (HABIS)**:\n\n${outOfStockItems
                .map((i) => `- **${i.itemName}** (\`${i.codeItem}\`) — Min: ${i.minStock} ${i.uom} · Lokasi: ${i.location}`)
                .join('\n')}`,
              `There are **${outOfStockItems.length} active item(s)** currently **Out of Stock (0)**:\n\n${outOfStockItems
                .map((i) => `- **${i.itemName}** (\`${i.codeItem}\`) — Min: ${i.minStock} ${i.uom} · Location: ${i.location}`)
                .join('\n')}`
            ),
      visualData:
        outOfStockItems.length > 0
          ? {
              title: t('Daftar Item Stok Habis (0)', 'Out-of-Stock Items (0)'),
              kind: 'TABLE',
              items: outOfStockItems.slice(0, 8).map((i) => ({
                label: i.itemName,
                value: i.currentStock,
                secondary: `Min ${i.minStock} ${i.uom} · ${i.location}`,
              })),
            }
          : null,
      actionProposal:
        outOfStockItems.length > 0
          ? {
              type: 'UPDATE_ROLLING_FORECAST',
              title: t(`Isi Rolling Forecast GA (${store.rollingForecast.activeMonth})`, `Fill GA Rolling Forecast (${store.rollingForecast.activeMonth})`),
              description: t(
                `Perbarui usulan order GA Dept pada bulan ${store.rollingForecast.activeMonth} untuk seluruh item habis & kritis.`,
                `Update GA Dept order proposals in ${store.rollingForecast.activeMonth} for out-of-stock & critical items.`
              ),
              payloadJson: JSON.stringify({ month: store.rollingForecast.activeMonth }),
            }
          : null,
      followUpSuggestions: [
        t('Tampilkan semua item di bawah stok minimum', 'Show all items below minimum stock'),
        t('Lihat status Rolling Forecast GA', 'View GA Rolling Forecast status'),
      ],
    };
  }

  if (/\b(minimum|kritis|menipis|low stock|critical|below|restock|kurang)\b/i.test(q)) {
    const officeCrit = criticalItems.filter((i) => i.jenis === 'OFFICE_SUPPLIES').length;
    const overheadCrit = criticalItems.filter((i) => i.jenis === 'OVERHEAD_GOODS').length;
    return {
      reply: t(
        `Terdapat **${criticalItems.length} item kritis** (stok ≤ minimum: **${officeCrit}** Office Supplies, **${overheadCrit}** Overhead Goods; termasuk **${outOfStockItems.length}** item stok 0):\n\n${criticalItems
          .slice(0, 10)
          .map(
            (c) =>
              `- **${c.itemName}** (\`${c.codeItem}\`): **${c.currentStock}/${c.minStock} ${c.uom}** · ${c.location} · **${getStockStatus(c)}**`
          )
          .join('\n')}${criticalItems.length > 10 ? `\n\n*...dan ${criticalItems.length - 10} item kritis lainnya.*` : ''}`,
        `There are **${criticalItems.length} critical items** (stock ≤ minimum: **${officeCrit}** Office Supplies, **${overheadCrit}** Overhead Goods; including **${outOfStockItems.length}** out-of-stock):\n\n${criticalItems
          .slice(0, 10)
          .map(
            (c) =>
              `- **${c.itemName}** (\`${c.codeItem}\`): **${c.currentStock}/${c.minStock} ${c.uom}** · ${c.location}`
          )
          .join('\n')}`
      ),
      visualData: {
        title: t('Item Stok Kritis Teratas', 'Top Critical Stock Items'),
        kind: 'TABLE',
        items: criticalItems.slice(0, 8).map((c) => ({
          label: c.itemName,
          value: c.currentStock,
          secondary: `Min: ${c.minStock} ${c.uom} · ${c.location} · ${getStockStatus(c)}`,
        })),
      },
      actionProposal:
        criticalItems.length > 0
          ? {
              type: 'UPDATE_ROLLING_FORECAST',
              title: t(
                `Isi Rolling Forecast GA (${store.rollingForecast.activeMonth})`,
                `Fill GA Rolling Forecast (${store.rollingForecast.activeMonth})`
              ),
              description: t(
                `Perbarui usulan order ke GA Dept pada bulan aktif ${store.rollingForecast.activeMonth} berdasarkan ${criticalItems.length} item kritis.`,
                `Update order proposals for GA Dept in active month ${store.rollingForecast.activeMonth} based on ${criticalItems.length} critical items.`
              ),
              payloadJson: JSON.stringify({ month: store.rollingForecast.activeMonth }),
            }
          : null,
      followUpSuggestions: [
        t('Item apa yang paling sering dipakai?', 'Which items are used the most?'),
        t('Tampilkan Rolling Forecast GA bulan aktif', 'Show active month GA Rolling Forecast'),
      ],
    };
  }

  if (/\b(terbanyak|tertinggi|highest|most stock|paling banyak stok)\b/i.test(q)) {
    const topStock = [...activeItems].sort((a, b) => b.currentStock - a.currentStock).slice(0, 8);
    return {
      reply: t(
        `**Top 8 Item dengan Stok Terbanyak Saat Ini:**\n${topStock
          .map((i, idx) => `${idx + 1}. **${i.itemName}** (\`${i.codeItem}\`): **${i.currentStock} ${i.uom}** (Min: ${i.minStock}) · ${i.location}`)
          .join('\n')}`,
        `**Top 8 Items with Highest Current Stock:**\n${topStock
          .map((i, idx) => `${idx + 1}. **${i.itemName}** (\`${i.codeItem}\`): **${i.currentStock} ${i.uom}** (Min: ${i.minStock}) · ${i.location}`)
          .join('\n')}`
      ),
      visualData: {
        title: t('Stok Tertinggi Saat Ini', 'Highest Current Stock'),
        kind: 'BAR',
        items: topStock.slice(0, 6).map((i) => ({
          label: i.itemName.length > 16 ? `${i.itemName.slice(0, 15)}…` : i.itemName,
          value: i.currentStock,
        })),
      },
      followUpSuggestions: [
        t('Item apa yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
        t('Distribusi item berdasarkan kategori', 'Item distribution by category'),
      ],
    };
  }

  // Category breakdown
  if (/\b(kategori|category|categories|office supplies vs|perbandingan jenis)\b/i.test(q)) {
    const catMap = new Map<string, { count: number; totalStock: number; crit: number }>();
    for (const item of activeItems) {
      const cur = catMap.get(item.kategori) || { count: 0, totalStock: 0, crit: 0 };
      cur.count += 1;
      cur.totalStock += item.currentStock;
      if (item.currentStock <= item.minStock) cur.crit += 1;
      catMap.set(item.kategori, cur);
    }
    const cats = Array.from(catMap.entries()).sort((a, b) => b[1].count - a[1].count);
    return {
      reply: t(
        `**Distribusi Katalog Berdasarkan Kategori (${cats.length} kategori · ${activeItems.length} item aktif):**\n- Office Supplies: **${activeItems.filter((i) => i.jenis === 'OFFICE_SUPPLIES').length} item** · Overhead Goods: **${activeItems.filter((i) => i.jenis === 'OVERHEAD_GOODS').length} item**\n\n${cats
          .map(([cat, v]) => `- **${cat}**: **${v.count} item** (${v.totalStock} total unit · ${v.crit} kritis)`)
          .join('\n')}`,
        `**Catalog Distribution by Category (${cats.length} categories · ${activeItems.length} active items):**\n${cats
          .map(([cat, v]) => `- **${cat}**: **${v.count} items** (${v.totalStock} units · ${v.crit} critical)`)
          .join('\n')}`
      ),
      visualData: {
        title: t('Jumlah Item per Kategori', 'Items per Category'),
        kind: 'BAR',
        items: cats.slice(0, 8).map(([cat, v]) => ({
          label: cat.length > 16 ? `${cat.slice(0, 15)}…` : cat,
          value: v.count,
        })),
      },
      followUpSuggestions: [
        t('Item apa yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
        t('Tampilkan distribusi lokasi lemari', 'Show storage cabinet distribution'),
      ],
    };
  }

  // =========================================================================
  // 12. ARSIP DOKUMEN SISTEM
  // =========================================================================
  if (/\b(arsip|dokumen|pdf|excel|file|upload|unggah|document)\b/i.test(q)) {
    return {
      reply:
        store.documents.length === 0
          ? t('Belum ada dokumen yang diunggah pada modul Arsip Dokumen Sistem.', 'No documents uploaded in the Document Archive yet.')
          : t(
              `**Arsip Dokumen Sistem (${store.documents.length} dokumen terunggah):**\n\n${store.documents
                .slice(0, 10)
                .map((d) => `- **${d.title}** (\`${d.fileName}\`) — Kategori: ${d.category} · Periode: ${d.period} · oleh ${d.uploadedByName}`)
                .join('\n')}`,
              `**System Document Archive (${store.documents.length} uploaded):**\n\n${store.documents
                .slice(0, 10)
                .map((d) => `- **${d.title}** (\`${d.fileName}\`) — Category: ${d.category} · Period: ${d.period} · by ${d.uploadedByName}`)
                .join('\n')}`
            ),
      visualData:
        store.documents.length > 0
          ? {
              title: t('Daftar Arsip Dokumen', 'Archived Documents'),
              kind: 'TABLE',
              items: store.documents.slice(0, 8).map((d, idx) => ({
                label: d.title,
                value: idx + 1,
                secondary: `${d.period} · ${d.fileName} · ${d.uploadedByName}`,
              })),
            }
          : null,
      followUpSuggestions: [
        t('Status laporan bulanan & tanda tangan', 'Monthly reports & signatures status'),
        t('Lihat audit log aktivitas terbaru', 'View latest audit log activities'),
      ],
    };
  }

  // =========================================================================
  // 13. AUDIT LOG AKTIVITAS
  // =========================================================================
  if (/\b(audit|log|aktivitas|riwayat perubahan|siapa yang mengubah|activity)\b/i.test(q)) {
    const logs = store.auditLogs.slice(0, 10);
    return {
      reply: t(
        `**Audit Log Aktivitas Terbaru (${store.auditLogs.length} total catatan):**\n\n${logs
          .map((a) => `- **[${a.action}]** ${a.objectType} — **${a.objectLabel}** oleh *${a.userName}* (${a.timestamp.slice(0, 16).replace('T', ' ')})`)
          .join('\n')}`,
        `**Latest System Audit Log (${store.auditLogs.length} total entries):**\n\n${logs
          .map((a) => `- **[${a.action}]** ${a.objectType} — **${a.objectLabel}** by *${a.userName}* (${a.timestamp.slice(0, 16).replace('T', ' ')})`)
          .join('\n')}`
      ),
      followUpSuggestions: [
        t('Siapa saja user & PIC aktif di sistem?', 'Who are the active users & PICs in the system?'),
        t('Tampilkan ringkasan transaksi terbaru', 'Show latest transactions summary'),
      ],
    };
  }

  // =========================================================================
  // 14. PENGGUNA, PIC & MANAGER (users)
  // =========================================================================
  if (/\b(user|pengguna|akun|pic|admin|section manager|dept manager|approver)\b/i.test(q)) {
    const activeUsers = store.users.filter((u) => u.active);
    return {
      reply: t(
        `**Daftar Akun Pengguna & Struktur Approval (${activeUsers.length} aktif):**\n\n${activeUsers
          .map((u) => `- **${u.name}** — *${u.jabatan}* (${u.seksi}) · Role: \`${u.role}\``)
          .join('\n')}`,
        `**Active Users & Approval Roster (${activeUsers.length} active):**\n\n${activeUsers
          .map((u) => `- **${u.name}** — *${u.jabatan}* (${u.seksi}) · Role: \`${u.role}\``)
          .join('\n')}`
      ),
      followUpSuggestions: [
        t('Siapa saja yang belum tanda tangan laporan bulan ini?', 'Who hasn’t signed this month’s reports?'),
        t('Tampilkan daftar karyawan Departemen HR', 'Show HR Department employee list'),
      ],
    };
  }

  // =========================================================================
  // 15. FUZZY CROSS-MODULE SPECIFIC LOOKUP (Item / Asset / Employee / GA Row)
  // =========================================================================
  if (tokens.length > 0) {
    const matchedItems = activeItems
      .map((item) => ({
        item,
        score: scoreMatch(tokens, `${item.itemName} ${item.codeItem} ${item.kategori} ${item.notes}`, q),
      }))
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score);

    const matchedInv = store.inventories
      .map((inv) => ({
        inv,
        score: scoreMatch(tokens, `${inv.partId} ${inv.itemName} ${inv.kategori} ${inv.notes}`, q),
      }))
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score);

    const matchedEmp = store.employees
      .map((emp) => ({
        emp,
        score: scoreMatch(tokens, `${emp.name} ${emp.nik} ${emp.jabatan} ${emp.section}`, q),
      }))
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score);

    const matchedRfRows: Array<{ row: RollingForecastRow; score: number }> = store.rollingForecast.rows
      .map((row) => ({
        row,
        score: scoreMatch(tokens, `${row.itemName} ${row.codeItem} ${row.itemDescription}`, q),
      }))
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score);

    // 15a. Matched Supply Items
    if (matchedItems.length > 0 && matchedItems[0].score >= (matchedEmp[0]?.score ?? 0) && matchedItems[0].score >= (matchedInv[0]?.score ?? 0)) {
      const top = matchedItems.slice(0, 8).map((x) => x.item);
      const primary = top[0];
      const itemTxs = store.transactions.filter((tx) => tx.itemId === primary.id);
      const totalPakai = itemTxs.filter((tx) => tx.type === 'PAKAI').reduce((s, tx) => s + tx.qty, 0);
      const totalTerima = itemTxs.filter((tx) => tx.type === 'TERIMA').reduce((s, tx) => s + tx.qty, 0);
      const rfRow = store.rollingForecast.rows.find(
        (r) => r.codeItem === primary.codeItem || normalizeText(r.itemName) === normalizeText(primary.itemName)
      );

      if (top.length === 1) {
        return {
          reply: t(
            `**Detail Item: ${primary.itemName}** (\`${primary.codeItem}\`)\n- **Jenis & Kategori:** ${primary.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'} · ${primary.kategori}\n- **Stok Saat Ini:** **${primary.currentStock} ${primary.uom}** (Minimum: ${primary.minStock} ${primary.uom}) → Status: **${getStockStatus(primary)}**\n- **Lokasi Simpan:** ${primary.location}\n- **Riwayat Transaksi:** ${itemTxs.length} transaksi (Total Terima: +${totalTerima}, Total Pakai: -${totalPakai} ${primary.uom})${
              rfRow
                ? `\n- **Rolling Forecast GA (${store.rollingForecast.activeMonth}):** Order **${rfRow.months[store.rollingForecast.activeMonth] || 0} ${rfRow.uom}** · R/M Stock GA: ${rfRow.rmStock ?? '-'}`
                : ''
            }${primary.notes ? `\n- **Catatan:** ${primary.notes}` : ''}`,
            `**Item Detail: ${primary.itemName}** (\`${primary.codeItem}\`)\n- **Type & Category:** ${primary.jenis} · ${primary.kategori}\n- **Current Stock:** **${primary.currentStock} ${primary.uom}** (Min: ${primary.minStock} ${primary.uom}) → Status: **${getStockStatus(primary)}**\n- **Location:** ${primary.location}\n- **Transactions:** ${itemTxs.length} logged (+${totalTerima} received, -${totalPakai} used)`
          ),
          visualData:
            itemTxs.length > 0
              ? {
                  title: t(`Riwayat Transaksi: ${primary.itemName}`, `Transaction History: ${primary.itemName}`),
                  kind: 'TABLE',
                  items: itemTxs.slice(0, 6).map((tx) => ({
                    label: `${tx.date} · ${tx.type}`,
                    value: tx.qty,
                    secondary: `${tx.recordedByName} · ${tx.note || '-'}`,
                  })),
                }
              : null,
          followUpSuggestions: [
            t(`Catat pakai 1 ${primary.itemName}`, `Record usage of 1 ${primary.itemName}`),
            t(`Barang apa saja yang ada di ${primary.location}?`, `What else is stored in ${primary.location}?`),
          ],
        };
      }

      return {
        reply: t(
          `Ditemukan **${matchedItems.length} item** yang cocok dengan pencarian Anda:\n\n${top
            .map(
              (i) =>
                `- **${i.itemName}** (\`${i.codeItem}\`): **${i.currentStock} ${i.uom}** (Min: ${i.minStock}) · **${getStockStatus(i)}** · ${i.location}`
            )
            .join('\n')}`,
          `Found **${matchedItems.length} matching item(s)**:\n\n${top
            .map(
              (i) =>
                `- **${i.itemName}** (\`${i.codeItem}\`): **${i.currentStock} ${i.uom}** (Min: ${i.minStock}) · **${getStockStatus(i)}** · ${i.location}`
            )
            .join('\n')}`
        ),
        visualData: {
          title: t('Posisi Stok Item Terkait', 'Related Items Stock Level'),
          kind: 'BAR',
          items: top.slice(0, 6).map((i) => ({
            label: i.itemName.length > 18 ? `${i.itemName.slice(0, 17)}…` : i.itemName,
            value: i.currentStock,
          })),
        },
        followUpSuggestions: [
          t(`Catat pakai 1 ${primary.itemName}`, `Record usage of 1 ${primary.itemName}`),
          t('Item apa saja yang di bawah minimum?', 'Which items are below minimum stock?'),
        ],
      };
    }

    // 15b. Matched Employee
    if (matchedEmp.length > 0 && matchedEmp[0].score >= (matchedInv[0]?.score ?? 0)) {
      const emp = matchedEmp[0].emp;
      const empReqs = store.itemRequests.filter(
        (r) => r.employeeId === emp.id || normalizeText(r.requesterName) === normalizeText(emp.name)
      );
      return {
        reply: t(
          `**Profil Karyawan Dept. HR:**\n- **Nama:** **${emp.name}** (\`NIK: ${emp.nik}\`)\n- **Seksi:** ${emp.section}\n- **Jabatan:** ${emp.jabatan}\n- **Status:** ${emp.active ? 'Aktif' : 'Non-Aktif'}\n- **Riwayat Pengambilan Barang:** **${empReqs.length} permintaan**${
            empReqs.length > 0
              ? `\n\n${empReqs
                  .slice(0, 5)
                  .map(
                    (r) =>
                      `- ${r.requestDate} (**${r.status}**): ${r.items.map((i) => `${i.itemName} (${i.qty} ${i.uom})`).join(', ')}`
                  )
                  .join('\n')}`
              : ''
          }`,
          `**HR Employee Profile:**\n- **Name:** **${emp.name}** (\`NIK: ${emp.nik}\`)\n- **Section:** ${emp.section}\n- **Position:** ${emp.jabatan}\n- **Supply Requests:** **${empReqs.length}**`
        ),
        actionProposal: empReqs.find((r) => r.status === 'MENUNGGU')
          ? {
              type: 'APPROVE_REQUEST',
              title: t(`Setujui Permintaan ${emp.name}`, `Approve Request for ${emp.name}`),
              description: empReqs
                .find((r) => r.status === 'MENUNGGU')!
                .items.map((i) => `${i.itemName} (${i.qty} ${i.uom})`)
                .join(', '),
              payloadJson: JSON.stringify({ requestId: empReqs.find((r) => r.status === 'MENUNGGU')!.id }),
            }
          : null,
        followUpSuggestions: [
          t(`Tampilkan semua karyawan seksi ${emp.section}`, `Show all employees in ${emp.section}`),
          t('Lihat permintaan karyawan yang masih menunggu approval', 'View pending employee requests'),
        ],
      };
    }

    // 15c. Matched Overhead Inventory Asset
    if (matchedInv.length > 0) {
      const topInv = matchedInv.slice(0, 6).map((x) => x.inv);
      return {
        reply: t(
          `**Ditemukan ${matchedInv.length} Aset Inventaris Overhead:**\n\n${topInv
            .map(
              (inv) =>
                `- \`${inv.partId}\` **${inv.itemName}** — ${inv.qty} ${inv.uom} · Kondisi: **${inv.condition}** · Lokasi: ${inv.location} · ${inv.mutations.length} mutasi`
            )
            .join('\n')}`,
          `**Found ${matchedInv.length} Overhead Inventory Asset(s):**\n\n${topInv
            .map(
              (inv) =>
                `- \`${inv.partId}\` **${inv.itemName}** — ${inv.qty} ${inv.uom} · Condition: **${inv.condition}** · Location: ${inv.location}`
            )
            .join('\n')}`
        ),
        visualData: {
          title: t('Aset Inventaris Terkait', 'Related Overhead Assets'),
          kind: 'TABLE',
          items: topInv.map((inv) => ({
            label: `${inv.partId} · ${inv.itemName}`,
            value: inv.qty,
            secondary: `${inv.condition} · ${inv.location}`,
          })),
        },
        followUpSuggestions: [
          t('Tampilkan semua aset Inventaris Overhead yang RUSAK', 'Show all DAMAGED Overhead Inventory assets'),
          t('Ringkasan keseluruhan HR SupplyHub', 'Overall HR SupplyHub summary'),
        ],
      };
    }

    // 15d. Matched GA Rolling Forecast Row
    if (matchedRfRows.length > 0) {
      const topRf = matchedRfRows.slice(0, 6).map((x) => x.row);
      const am = store.rollingForecast.activeMonth;
      return {
        reply: t(
          `**Ditemukan ${matchedRfRows.length} Item di Katalog Rolling Forecast GA:**\n\n${topRf
            .map(
              (r) =>
                `- \`${r.codeItem}\` **${r.itemName}** (${r.jenis}) — R/M Stock: **${r.rmStock ?? '-'}** · Order ${am}: **${r.months[am] || 0} ${r.uom}**`
            )
            .join('\n')}`,
          `**Found ${matchedRfRows.length} item(s) in GA Rolling Forecast Catalog:**\n\n${topRf
            .map(
              (r) =>
                `- \`${r.codeItem}\` **${r.itemName}** (${r.jenis}) — R/M Stock: **${r.rmStock ?? '-'}** · ${am} Order: **${r.months[am] || 0} ${r.uom}**`
            )
            .join('\n')}`
        ),
        followUpSuggestions: [
          t(`Tampilkan seluruh Rolling Forecast GA bulan ${am}`, `Show full GA Rolling Forecast for ${am}`),
          t('Item apa yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
        ],
      };
    }
  }

  // =========================================================================
  // 16. EXECUTIVE SYSTEM OVERVIEW (Default Comprehensive Summary)
  // =========================================================================
  const activeRfFilled = store.rollingForecast.rows.filter(
    (r) => (r.months[store.rollingForecast.activeMonth] || 0) > 0
  );
  const activeRfUnits = activeRfFilled.reduce((s, r) => s + (r.months[store.rollingForecast.activeMonth] || 0), 0);
  const invRusakCount = store.inventories.filter((i) => i.condition === 'RUSAK').length;

  return {
    reply: t(
      `**Ringkasan Eksekutif Live — HR SupplyHub (${store.settings.factoryName}):**\n- **Katalog Aktif:** **${activeItems.length} item** (${activeItems.filter((i) => i.jenis === 'OFFICE_SUPPLIES').length} Office Supplies, ${activeItems.filter((i) => i.jenis === 'OVERHEAD_GOODS').length} Overhead Goods)\n- **Kesehatan Stok:** **${criticalItems.length} item kritis** (termasuk **${outOfStockItems.length} habis**)\n- **Permintaan Karyawan HR:** **${pendingRequests.length} menunggu approval** dari total ${store.itemRequests.length} permintaan (${store.employees.filter((e) => e.active).length} karyawan aktif)\n- **Inventaris Overhead:** **${store.inventories.length} aset** (${invRusakCount} kondisi RUSAK)\n- **Rolling Forecast GA (${store.rollingForecast.activeMonth}):** **${activeRfFilled.length} item** terisi (**${activeRfUnits} unit**)\n- **Laporan Bulanan A3:** **${store.reports.filter((r) => r.locked).length} Final**, **${pendingReports.length} menunggu tanda tangan**\n- **Stock Opname & Arsip:** ${store.opnames.length} sesi opname · ${store.documents.length} dokumen arsip\n\n*Tip: Anda bisa menanyakan stok barang/kode tertentu, isi lemari, riwayat karyawan, aset rusak, forecast bulan tertentu, hingga meminta saya mencatat transaksi atau menyetujui permintaan!*`,
      `**Live Executive Overview — HR SupplyHub (${store.settings.factoryName}):**\n- **Active Catalog:** **${activeItems.length} items** (${activeItems.filter((i) => i.jenis === 'OFFICE_SUPPLIES').length} Office Supplies, ${activeItems.filter((i) => i.jenis === 'OVERHEAD_GOODS').length} Overhead Goods)\n- **Stock Health:** **${criticalItems.length} critical** (including **${outOfStockItems.length} out-of-stock**)\n- **HR Employee Requests:** **${pendingRequests.length} pending approval** out of ${store.itemRequests.length} total (${store.employees.filter((e) => e.active).length} active employees)\n- **Overhead Inventory:** **${store.inventories.length} assets** (${invRusakCount} DAMAGED)\n- **GA Rolling Forecast (${store.rollingForecast.activeMonth}):** **${activeRfFilled.length} items** filled (**${activeRfUnits} units**)\n- **A3 Monthly Reports:** **${store.reports.filter((r) => r.locked).length} Final**, **${pendingReports.length} pending signatures**\n- **Opname & Archive:** ${store.opnames.length} sessions · ${store.documents.length} archived documents`
    ),
    visualData: {
      title: t('Ringkasan Indikator Operasional HR SupplyHub', 'HR SupplyHub Operational Snapshot'),
      kind: 'BAR',
      items: [
        { label: t('Item Aktif', 'Active Items'), value: activeItems.length },
        { label: t('Kritis', 'Critical'), value: criticalItems.length },
        { label: t('Aset Overhead', 'Assets'), value: store.inventories.length },
        { label: t('Req Pending', 'Pending Req'), value: pendingRequests.length },
        { label: t('Laporan Pending', 'Pending Rep'), value: pendingReports.length },
      ],
    },
    followUpSuggestions: [
      t('Item apa saja yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
      t('Lihat permintaan karyawan yang masih menunggu approval', 'View pending employee requests'),
      t('Siapa saja yang belum tanda tangan laporan?', 'Who has not signed reports yet?'),
    ],
  };
}
