import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  FORECAST_MONTH_KEYS,
  type MonthlyReport,
  type RollingForecastData,
  type SupplyItem,
} from '../types';

export async function exportElementToA3Pdf(element: HTMLElement, fileName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#FFFFFF',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 420 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
  const margin = 8;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  const imgRatio = canvas.width / canvas.height;
  let renderW = maxWidth;
  let renderH = renderW / imgRatio;

  if (renderH > maxHeight) {
    renderH = maxHeight;
    renderW = renderH * imgRatio;
  }

  const offsetX = (pageWidth - renderW) / 2;
  const offsetY = margin;

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH);
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

export async function exportElementsToMultiPageA3Pdf(
  elements: HTMLElement[],
  fileName: string
): Promise<void> {
  if (elements.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;

  for (let i = 0; i < elements.length; i++) {
    if (i > 0) pdf.addPage('a3', 'landscape');
    const canvas = await html2canvas(elements[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const imgRatio = canvas.width / canvas.height;
    let renderW = maxWidth;
    let renderH = renderW / imgRatio;
    if (renderH > maxHeight) {
      renderH = maxHeight;
      renderW = renderH * imgRatio;
    }
    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = margin;
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH);
  }

  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

// ============================================================================
// Excel Styling Helpers (Crisp Outline Borders, Merges & Print Layout)
// ============================================================================

const BLACK = { argb: 'FF000000' };
const THIN_BLACK: Partial<ExcelJS.Border> = { style: 'thin', color: BLACK };
const MEDIUM_BLACK: Partial<ExcelJS.Border> = { style: 'medium', color: BLACK };

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F4F6' },
};

const ACTIVE_MONTH_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
};

const CRITICAL_ROW_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFEF2F2' },
};

async function saveWorkbookAsXlsx(wb: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BORDER_RANK: Record<string, number> = {
  thin: 1,
  medium: 2,
  thick: 3,
};

function setCellEdgeBorder(
  cell: ExcelJS.Cell,
  side: 'top' | 'bottom' | 'left' | 'right',
  next: Partial<ExcelJS.Border>
): void {
  const target = cell.master || cell;
  const current = target.border || {};
  const curStyle = current[side]?.style;
  const curRank = curStyle ? BORDER_RANK[curStyle] || 1 : 0;
  const nextRank = next.style ? BORDER_RANK[next.style] || 1 : 0;
  if (nextRank >= curRank) {
    target.border = {
      ...current,
      [side]: next,
    };
  }
}

/**
 * Applies thin inner grid borders to every cell in [startRow..endRow, startCol..endCol]
 * and medium outer box outline + header separator border, safely handling merged cells.
 */
function applyTableOutlines(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  headerEndRow: number
): void {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      setCellEdgeBorder(cell, 'top', r === startRow ? MEDIUM_BLACK : THIN_BLACK);
      setCellEdgeBorder(
        cell,
        'bottom',
        r === endRow || r === headerEndRow ? MEDIUM_BLACK : THIN_BLACK
      );
      setCellEdgeBorder(cell, 'left', c === startCol ? MEDIUM_BLACK : THIN_BLACK);
      setCellEdgeBorder(cell, 'right', c === endCol ? MEDIUM_BLACK : THIN_BLACK);
    }
  }
}

/**
 * Adds medium top/bottom separator borders between category/jenis groups so each group block
 * has a distinct outer box outline matching the PDF.
 */
function applyGroupRowOutlines(
  ws: ExcelJS.Worksheet,
  groupStartRow: number,
  groupEndRow: number,
  startCol: number,
  endCol: number
): void {
  for (let c = startCol; c <= endCol; c++) {
    setCellEdgeBorder(ws.getCell(groupStartRow, c), 'top', MEDIUM_BLACK);
    setCellEdgeBorder(ws.getCell(groupEndRow, c), 'bottom', MEDIUM_BLACK);
  }
}

function estimateWrappedRowHeight(texts: Array<{ value: string; colWidth: number }>, baseHeight = 17): number {
  let maxLines = 1;
  texts.forEach(({ value, colWidth }) => {
    if (!value) return;
    const explicitLines = value.split(/\r?\n/);
    let totalLines = 0;
    const effectiveCharsPerLine = Math.max(8, Math.floor(colWidth * 0.92));
    explicitLines.forEach((line) => {
      totalLines += Math.max(1, Math.ceil(line.length / effectiveCharsPerLine));
    });
    if (totalLines > maxLines) maxLines = totalLines;
  });
  return Math.max(baseHeight, maxLines * 13.5 + 4);
}

// ============================================================================
// 1. Laporan Bulanan Excel (Meniru PDF Laporan Bulanan + Garis Outline Lengkap)
// ============================================================================

export async function exportReportToExcel(report: MonthlyReport): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HR SupplyHub - PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory';
  wb.created = new Date();

  const ws = wb.addWorksheet('Laporan', {
    pageSetup: {
      paperSize: 8 as ExcelJS.PaperSize, // A3
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: true }],
  });

  const isCheckTable = report.jenis !== 'INVENTARIS_OVERHEAD';
  const totalCols = isCheckTable ? 13 : 9;

  // Kop Laporan
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = report.title.toUpperCase();
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: BLACK };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  const metaRows: Array<[string, string, string]> = [
    ['Departemen', ':', report.department],
    ['Seksi', ':', report.section],
    ['Periode Bulan', ':', report.periodLabel],
    ['ID Dokumen', ':', `${report.documentId} (Status: ${report.status})`],
  ];
  metaRows.forEach(([label, sep, val], idx) => {
    const r = 3 + idx;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, bold: true, color: BLACK };
    ws.getCell(r, 2).value = sep;
    ws.getCell(r, 2).alignment = { horizontal: 'center' };
    ws.mergeCells(r, 3, r, 6);
    ws.getCell(r, 3).value = val;
    ws.getCell(r, 3).font = { name: 'Calibri', size: 10, bold: idx >= 2, color: BLACK };
    ws.getRow(r).height = 17;
  });

  const headerRowIdx = 8;

  if (isCheckTable) {
    const headers = [
      'No.',
      'Kategori',
      'No.',
      'Code Item',
      'Item_Name',
      'UOM',
      'Stok Awal',
      'Terima',
      'Pakai',
      'Stock Akhir',
      'Minimum Stok',
      'Lokasi Simpan',
      'Keterangan',
    ];
    const colWidths = [5, 22, 5, 11, 34, 7, 10, 9, 9, 11, 11, 20, 24];
    ws.columns = colWidths.map((w) => ({ width: w }));

    const hRow = ws.getRow(headerRowIdx);
    hRow.height = 26;
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: BLACK };
      cell.fill = HEADER_FILL;
      cell.alignment = {
        horizontal: i === 4 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });

    const rows = report.checkRows || [];
    const dataStartRow = headerRowIdx + 1;
    let catNo = 0;
    let lastCat = '';
    let groupStartRow = dataStartRow;

    rows.forEach((row, idx) => {
      const rIdx = dataStartRow + idx;
      if (row.kategori !== lastCat) {
        if (idx > 0) {
          if (rIdx - 1 > groupStartRow) {
            ws.mergeCells(groupStartRow, 1, rIdx - 1, 1);
            ws.mergeCells(groupStartRow, 2, rIdx - 1, 2);
          }
          applyGroupRowOutlines(ws, groupStartRow, rIdx - 1, 1, totalCols);
        }
        catNo += 1;
        lastCat = row.kategori;
        groupStartRow = rIdx;
      }

      const isCritical = row.stockAkhir <= row.minStock;
      const excelRow = ws.getRow(rIdx);
      const values: Array<string | number> = [
        catNo,
        row.kategori,
        idx + 1,
        row.codeItem || '',
        row.itemName,
        row.uom,
        row.stokAwal,
        row.terima,
        row.pakai,
        row.stockAkhir,
        row.minStock,
        row.location,
        row.notes || (isCritical ? 'Stok min.' : ''),
      ];

      values.forEach((v, cIdx) => {
        const cell = excelRow.getCell(cIdx + 1);
        cell.value = v;
        cell.font = {
          name: 'Calibri',
          size: 9.5,
          bold: cIdx === 0 || cIdx === 9,
          color: isCritical && cIdx === 9 ? { argb: 'FFB91C1C' } : BLACK,
        };
        if (isCritical) cell.fill = CRITICAL_ROW_FILL;
        cell.alignment = {
          horizontal:
            cIdx === 1 || cIdx === 4 || cIdx === 11 || cIdx === 12 ? 'left' : 'center',
          vertical: 'middle',
          wrapText: true,
        };
      });

      excelRow.height = estimateWrappedRowHeight([
        { value: row.itemName, colWidth: colWidths[4] },
        { value: row.notes || '', colWidth: colWidths[12] },
      ]);
    });

    const dataEndRow = dataStartRow + rows.length - 1;
    if (rows.length > 0) {
      if (dataEndRow > groupStartRow) {
        ws.mergeCells(groupStartRow, 1, dataEndRow, 1);
        ws.mergeCells(groupStartRow, 2, dataEndRow, 2);
      }
      applyTableOutlines(ws, headerRowIdx, dataEndRow, 1, totalCols, headerRowIdx);
      applyGroupRowOutlines(ws, groupStartRow, dataEndRow, 1, totalCols);
    } else {
      applyTableOutlines(ws, headerRowIdx, headerRowIdx, 1, totalCols, headerRowIdx);
    }

    // Blok Tanda Tangan di bawah tabel
    const sigStartRow = Math.max(headerRowIdx + 2, dataEndRow + 2);
    ws.getCell(sigStartRow, 10).value = report.placeDateText || '';
    ws.getCell(sigStartRow, 10).font = { name: 'Calibri', size: 9.5, bold: true, color: BLACK };

    const sigBlockRow = sigStartRow + 1;
    const sortedGroups = [...report.signatureGroups].sort((a, b) => a.order - b.order);
    let colCursor = 1;
    sortedGroups.forEach((grp) => {
      const span = Math.max(2, grp.slots.length * 2);
      const endCol = Math.min(totalCols, colCursor + span - 1);
      ws.mergeCells(sigBlockRow, colCursor, sigBlockRow, endCol);
      const gHeader = ws.getCell(sigBlockRow, colCursor);
      gHeader.value = grp.label;
      gHeader.font = { name: 'Calibri', size: 9.5, bold: true, color: BLACK };
      gHeader.fill = HEADER_FILL;
      gHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      grp.slots.forEach((slot, sIdx) => {
        const slotStart = colCursor + sIdx * 2;
        const slotEnd = Math.min(endCol, slotStart + 1);
        if (slotEnd > slotStart) {
          ws.mergeCells(sigBlockRow + 1, slotStart, sigBlockRow + 1, slotEnd);
          ws.mergeCells(sigBlockRow + 2, slotStart, sigBlockRow + 2, slotEnd);
        }
        const statusCell = ws.getCell(sigBlockRow + 1, slotStart);
        statusCell.value =
          slot.status === 'SIGNED'
            ? `TTD Digital\n(${slot.signedAt ? slot.signedAt.slice(0, 10) : 'Sah'})`
            : 'Menunggu TTD';
        statusCell.font = {
          name: 'Calibri',
          size: 8.5,
          italic: slot.status !== 'SIGNED',
          color: slot.status === 'SIGNED' ? { argb: 'FF047857' } : { argb: 'FF6B7280' },
        };
        statusCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        const nameCell = ws.getCell(sigBlockRow + 2, slotStart);
        nameCell.value = `${slot.name}\n${slot.jabatan}`;
        nameCell.font = { name: 'Calibri', size: 8.5, bold: true, color: BLACK };
        nameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      ws.getRow(sigBlockRow).height = 20;
      ws.getRow(sigBlockRow + 1).height = 34;
      ws.getRow(sigBlockRow + 2).height = 28;
      applyTableOutlines(ws, sigBlockRow, sigBlockRow + 2, colCursor, endCol, sigBlockRow);
      colCursor = endCol + 2;
    });
  } else {
    const headers = [
      'No.',
      'Kategori',
      'Part_Id',
      'Item name',
      'QTY',
      'UOM',
      'Lokasi Simpan',
      'Kondisi',
      'Keterangan',
    ];
    const colWidths = [5, 22, 16, 36, 9, 8, 22, 12, 28];
    ws.columns = colWidths.map((w) => ({ width: w }));

    const hRow = ws.getRow(headerRowIdx);
    hRow.height = 24;
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: BLACK };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: i === 3 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    });

    const rows = report.inventoryRows || [];
    const dataStartRow = headerRowIdx + 1;
    let groupStartRow = dataStartRow;
    let lastCat = '';

    rows.forEach((row, idx) => {
      const rIdx = dataStartRow + idx;
      if (row.kategori !== lastCat) {
        if (idx > 0 && rIdx - 1 > groupStartRow) {
          ws.mergeCells(groupStartRow, 2, rIdx - 1, 2);
          applyGroupRowOutlines(ws, groupStartRow, rIdx - 1, 1, totalCols);
        }
        lastCat = row.kategori;
        groupStartRow = rIdx;
      }

      const excelRow = ws.getRow(rIdx);
      const values: Array<string | number> = [
        idx + 1,
        row.kategori,
        row.partId,
        row.itemName,
        row.qty,
        row.uom,
        row.location,
        row.condition === 'BAGUS' ? 'Bagus' : 'Rusak',
        row.notes || '',
      ];
      values.forEach((v, cIdx) => {
        const cell = excelRow.getCell(cIdx + 1);
        cell.value = v;
        cell.font = { name: 'Calibri', size: 9.5, bold: cIdx === 2, color: BLACK };
        cell.alignment = {
          horizontal: cIdx === 1 || cIdx === 3 || cIdx === 6 || cIdx === 8 ? 'left' : 'center',
          vertical: 'middle',
          wrapText: true,
        };
      });
      excelRow.height = estimateWrappedRowHeight([
        { value: row.itemName, colWidth: colWidths[3] },
        { value: row.notes || '', colWidth: colWidths[8] },
      ]);
    });

    const dataEndRow = dataStartRow + rows.length - 1;
    if (rows.length > 0) {
      if (dataEndRow > groupStartRow) {
        ws.mergeCells(groupStartRow, 2, dataEndRow, 2);
      }
      applyTableOutlines(ws, headerRowIdx, dataEndRow, 1, totalCols, headerRowIdx);
      applyGroupRowOutlines(ws, groupStartRow, dataEndRow, 1, totalCols);
    } else {
      applyTableOutlines(ws, headerRowIdx, headerRowIdx, 1, totalCols, headerRowIdx);
    }
  }

  await saveWorkbookAsXlsx(wb, `${report.documentId}_${report.period}.xlsx`);
}

// ============================================================================
// 2. Rolling Forecast GA FY2026 Excel (Persis 2 PDF GA + Garis Outline & Kuning)
// ============================================================================

export async function exportRollingForecastToExcel(rf: RollingForecastData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HR SupplyHub - PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory';
  wb.created = new Date();

  const sortedRows = [...rf.rows].sort((a, b) => a.itemNo - b.itemNo);

  // --------------------------------------------------------------------------
  // Sheet 1: RF FY2026 (Meniru persis RF Office Supplies request by GA Dept)
  // --------------------------------------------------------------------------
  const wsRf = wb.addWorksheet(`RF ${rf.fiscalYearLabel}`, {
    pageSetup: {
      paperSize: 8 as ExcelJS.PaperSize, // A3
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 9 }],
  });

  const rfColWidths = [
    5, // A: No. (Jenis)
    24, // B: Jenis
    5, // C: No. (Item)
    8.5, // D: Code
    36, // E: item_description
    6.5, // F: UOM
    8, // G: R/M Stock
    ...FORECAST_MONTH_KEYS.map(() => 7.5), // H..S: 12 months
    24, // T: Est. Pemakaian per bulan
    32, // U: Keterangan
  ];
  wsRf.columns = rfColWidths.map((w) => ({ width: w }));

  // Kop Dokumen (Rows 1..6)
  wsRf.mergeCells(1, 1, 1, 10);
  wsRf.getCell(1, 1).value = `Rolling Forecast Office Supplies ${rf.fiscalYearLabel}`;
  wsRf.getCell(1, 1).font = { name: 'Calibri', size: 13, bold: true, color: BLACK };
  wsRf.getRow(1).height = 20;

  wsRf.mergeCells(2, 1, 2, 10);
  wsRf.getCell(2, 1).value = rf.periodRangeLabel;
  wsRf.getCell(2, 1).font = { name: 'Calibri', size: 11, bold: true, color: BLACK };
  wsRf.getRow(2).height = 17;

  wsRf.getRow(3).height = 8;

  const rfMeta: Array<[string, string, string]> = [
    ['Departemen', ':', rf.department],
    ['Seksi', ':', rf.section],
    ['Bulan Aktif Update', ':', rf.activeMonth],
  ];
  rfMeta.forEach(([lbl, sep, val], idx) => {
    const r = 4 + idx;
    wsRf.getCell(r, 1).value = lbl;
    wsRf.getCell(r, 1).font = { name: 'Calibri', size: 9.5, color: BLACK };
    wsRf.getCell(r, 2).value = sep;
    wsRf.getCell(r, 2).alignment = { horizontal: 'right' };
    wsRf.mergeCells(r, 3, r, 10);
    wsRf.getCell(r, 3).value = val;
    wsRf.getCell(r, 3).font = { name: 'Calibri', size: 9.5, bold: idx === 2, color: BLACK };
    wsRf.getRow(r).height = 15;
  });

  wsRf.getRow(7).height = 8;

  // Header Table (Rows 8..9)
  const hRow1 = wsRf.getRow(8);
  const hRow2 = wsRf.getRow(9);
  hRow1.height = 18;
  hRow2.height = 18;

  const fixedHeaders: Array<{ col: number; label: string }> = [
    { col: 1, label: 'No.' },
    { col: 2, label: 'Jenis' },
    { col: 3, label: 'No.' },
    { col: 4, label: 'Code' },
    { col: 5, label: 'item_description' },
    { col: 6, label: 'UOM' },
    { col: 7, label: 'R/M\nStock' },
    { col: 20, label: 'Est. Pemakaian per bulan' },
    { col: 21, label: 'Keterangan' },
  ];

  fixedHeaders.forEach(({ col, label }) => {
    wsRf.mergeCells(8, col, 9, col);
    const c = wsRf.getCell(8, col);
    c.value = label;
    c.font = { name: 'Calibri', size: 9, bold: true, color: BLACK };
    c.fill = HEADER_FILL;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    wsRf.getCell(9, col).fill = HEADER_FILL;
  });

  // Group header RF FY2026 across cols 8..19
  wsRf.mergeCells(8, 8, 8, 19);
  const rfGroupHeader = wsRf.getCell(8, 8);
  rfGroupHeader.value = `RF ${rf.fiscalYearLabel}`;
  rfGroupHeader.font = { name: 'Calibri', size: 9, bold: true, color: BLACK };
  rfGroupHeader.fill = HEADER_FILL;
  rfGroupHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  const activeMonthIdx = FORECAST_MONTH_KEYS.indexOf(rf.activeMonth);
  const activeMonthCol = activeMonthIdx >= 0 ? 8 + activeMonthIdx : -1;

  FORECAST_MONTH_KEYS.forEach((monthKey, mIdx) => {
    const col = 8 + mIdx;
    const cell = hRow2.getCell(col);
    cell.value = monthKey;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: BLACK };
    cell.fill = col === activeMonthCol ? ACTIVE_MONTH_FILL : HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Data Rows (starting Row 10)
  const rfDataStart = 10;
  let rfGroupStart = rfDataStart;

  sortedRows.forEach((row, idx) => {
    const rIdx = rfDataStart + idx;
    const excelRow = wsRf.getRow(rIdx);

    const rowValues: Array<string | number> = [
      row.jenisNo,
      row.jenis,
      row.itemNo,
      row.codeItem,
      row.itemDescription,
      row.uom,
      row.rmStock === null ? '' : row.rmStock,
      ...FORECAST_MONTH_KEYS.map((m) => (row.months[m] !== undefined ? row.months[m]! : '')),
      row.estPemakaian || '',
      row.keterangan || '',
    ];

    rowValues.forEach((val, cZero) => {
      const col = cZero + 1;
      const cell = excelRow.getCell(col);
      cell.value = val;
      cell.font = {
        name: 'Calibri',
        size: 9,
        bold: col === 1 || (col === activeMonthCol && val !== ''),
        color: BLACK,
      };
      if (col === activeMonthCol) {
        cell.fill = ACTIVE_MONTH_FILL;
      }
      cell.alignment = {
        horizontal: col === 2 || col === 5 || col === 20 || col === 21 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });

    excelRow.height = estimateWrappedRowHeight(
      [
        { value: row.itemDescription, colWidth: rfColWidths[4] },
        { value: row.estPemakaian || '', colWidth: rfColWidths[19] },
        { value: row.keterangan || '', colWidth: rfColWidths[20] },
      ],
      16.5
    );

    const next = sortedRows[idx + 1];
    if (!next || next.jenisNo !== row.jenisNo || next.jenis !== row.jenis) {
      if (rIdx > rfGroupStart) {
        wsRf.mergeCells(rfGroupStart, 1, rIdx, 1);
        wsRf.mergeCells(rfGroupStart, 2, rIdx, 2);
      }
      rfGroupStart = rIdx + 1;
    }
  });

  const rfDataEnd = rfDataStart + sortedRows.length - 1;
  applyTableOutlines(wsRf, 8, Math.max(9, rfDataEnd), 1, 21, 9);

  // Add crisp horizontal outline between each Jenis group matching PDF blocks
  let outlineGroupStart = rfDataStart;
  sortedRows.forEach((row, idx) => {
    const rIdx = rfDataStart + idx;
    const next = sortedRows[idx + 1];
    if (!next || next.jenisNo !== row.jenisNo || next.jenis !== row.jenis) {
      applyGroupRowOutlines(wsRf, outlineGroupStart, rIdx, 1, 21);
      outlineGroupStart = rIdx + 1;
    }
  });

  // --------------------------------------------------------------------------
  // Sheet 2: List Item GA (Meniru persis List Item Office Supplies PDF)
  // --------------------------------------------------------------------------
  const wsCat = wb.addWorksheet('List Item GA', {
    pageSetup: {
      paperSize: 9 as ExcelJS.PaperSize, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }],
  });

  const catColWidths = [9, 24, 6, 11, 38, 38, 8];
  wsCat.columns = catColWidths.map((w) => ({ width: w }));

  wsCat.mergeCells(1, 1, 1, 7);
  const catTitle = wsCat.getCell(1, 1);
  catTitle.value = 'List Item Office Supplies (Request Melalui GA Dept.)';
  catTitle.font = { name: 'Calibri', size: 12, bold: true, color: BLACK };
  catTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsCat.getRow(1).height = 22;
  wsCat.getRow(2).height = 8;

  const catHeaders = ['No.\nurut', 'Jenis', 'No.', 'Code\nItem', 'Item_name', 'item_description', 'UOM'];
  const catHeaderRow = wsCat.getRow(3);
  catHeaderRow.height = 26;
  catHeaders.forEach((h, i) => {
    const cell = catHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: BLACK };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const catDataStart = 4;
  let catGroupStart = catDataStart;

  sortedRows.forEach((row, idx) => {
    const rIdx = catDataStart + idx;
    const excelRow = wsCat.getRow(rIdx);
    const vals: Array<string | number> = [
      row.jenisNo,
      row.jenis,
      row.itemNo,
      row.codeItem,
      row.itemName,
      row.itemDescription,
      row.uom,
    ];
    vals.forEach((v, cZero) => {
      const col = cZero + 1;
      const cell = excelRow.getCell(col);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 9.5, bold: col === 1, color: BLACK };
      cell.alignment = {
        horizontal: col === 2 || col === 5 || col === 6 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });
    excelRow.height = estimateWrappedRowHeight(
      [
        { value: row.itemName, colWidth: catColWidths[4] },
        { value: row.itemDescription, colWidth: catColWidths[5] },
      ],
      18
    );

    const next = sortedRows[idx + 1];
    if (!next || next.jenisNo !== row.jenisNo || next.jenis !== row.jenis) {
      if (rIdx > catGroupStart) {
        wsCat.mergeCells(catGroupStart, 1, rIdx, 1);
        wsCat.mergeCells(catGroupStart, 2, rIdx, 2);
      }
      catGroupStart = rIdx + 1;
    }
  });

  const catDataEnd = catDataStart + sortedRows.length - 1;
  applyTableOutlines(wsCat, 3, Math.max(3, catDataEnd), 1, 7, 3);

  let catOutlineStart = catDataStart;
  sortedRows.forEach((row, idx) => {
    const rIdx = catDataStart + idx;
    const next = sortedRows[idx + 1];
    if (!next || next.jenisNo !== row.jenisNo || next.jenis !== row.jenis) {
      applyGroupRowOutlines(wsCat, catOutlineStart, rIdx, 1, 7);
      catOutlineStart = rIdx + 1;
    }
  });

  await saveWorkbookAsXlsx(wb, `RF_Office_Supplies_GA_${rf.fiscalYearLabel}_${rf.activeMonth}.xlsx`);
}

// ============================================================================
// 3. Master Item & Generic Table Export (Dengan Garis Outline Lengkap)
// ============================================================================

export async function exportItemsToExcel(
  items: SupplyItem[],
  fileName = 'Master_Item_HR_SupplyHub.xlsx'
): Promise<void> {
  const rows = items.map((item, idx) => ({
    No: idx + 1,
    Jenis: item.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods',
    Kategori: item.kategori,
    'Code Item': item.codeItem,
    Item_Name: item.itemName,
    UOM: item.uom,
    'Stok Saat Ini': item.currentStock,
    'Minimum Stok': item.minStock,
    'Lokasi Simpan': item.location,
    Keterangan: item.notes,
    Status: item.archived ? 'Arsip' : 'Aktif',
  }));
  await exportRowsToExcel(rows, 'Master Item', fileName);
}

export async function exportRowsToExcel(
  rows: Array<Record<string, unknown>>,
  sheetName: string,
  fileName: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HR SupplyHub - PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9 as ExcelJS.PaperSize,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }],
  });

  if (rows.length === 0) {
    await saveWorkbookAsXlsx(wb, fileName);
    return;
  }

  const keys = Object.keys(rows[0]);
  const colWidths = keys.map((k) => {
    const maxDataLen = rows.reduce((max, r) => {
      const s = String(r[k] ?? '');
      return Math.max(max, Math.min(42, s.length));
    }, k.length);
    return Math.max(8, Math.min(44, maxDataLen + 4));
  });
  ws.columns = colWidths.map((w) => ({ width: w }));

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  keys.forEach((k, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = k;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: BLACK };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  rows.forEach((rowObj, rIdx) => {
    const excelRow = ws.getRow(rIdx + 2);
    keys.forEach((k, cIdx) => {
      const val = rowObj[k];
      const cell = excelRow.getCell(cIdx + 1);
      cell.value = (val ?? '') as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 9.5, color: BLACK };
      cell.alignment = {
        horizontal: typeof val === 'number' ? 'center' : 'left',
        vertical: 'middle',
        wrapText: true,
      };
    });
    excelRow.height = estimateWrappedRowHeight(
      keys.map((k, idx) => ({ value: String(rowObj[k] ?? ''), colWidth: colWidths[idx] })),
      18
    );
  });

  applyTableOutlines(ws, 1, rows.length + 1, 1, keys.length, 1);

  await saveWorkbookAsXlsx(wb, fileName);
}
