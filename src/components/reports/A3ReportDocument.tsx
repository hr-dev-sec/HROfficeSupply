import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, PenTool } from 'lucide-react';
import type { MonthlyReport, ReportCheckRow, SignatureSlot } from '../../types';
import { formatDateTimeIndo } from '../../utils/format';

interface A3ReportDocumentProps {
  report: MonthlyReport;
  instructions: string[];
  logoUrl?: string;
  editable?: boolean;
  currentUserId?: string;
  isSuperAdmin?: boolean;
  onEditCheckRow?: (
    itemId: string,
    patch: Partial<Pick<ReportCheckRow, 'stokAwal' | 'terima' | 'pakai' | 'minStock' | 'notes'>>
  ) => void;
  onEditPlaceDate?: (val: string) => void;
  onClickSignSlot?: (groupId: string, slot: SignatureSlot) => void;
}

export const A3ReportDocument: React.FC<A3ReportDocumentProps> = ({
  report,
  instructions,
  logoUrl = '/logo-ajinomoto.png',
  editable = false,
  currentUserId,
  isSuperAdmin = false,
  onEditCheckRow,
  onEditPlaceDate,
  onClickSignSlot,
}) => {
  // Group checkRows by kategori preserving order for exact rowspan merge like PDF
  const groupedCheckRows = useMemo(() => {
    const rows = report.checkRows || [];
    const groups: Array<{ kategori: string; groupNo: number; rows: Array<ReportCheckRow & { itemNo: number }> }> = [];
    let currentCat = '';
    let groupCounter = 0;
    let itemCounter = 0;

    for (const row of rows) {
      itemCounter += 1;
      if (row.kategori !== currentCat) {
        groupCounter += 1;
        currentCat = row.kategori;
        groups.push({
          kategori: row.kategori,
          groupNo: groupCounter,
          rows: [{ ...row, itemNo: itemCounter }],
        });
      } else {
        groups[groups.length - 1].rows.push({ ...row, itemNo: itemCounter });
      }
    }
    return groups;
  }, [report.checkRows]);

  const sortedSigGroups = useMemo(
    () => [...report.signatureGroups].sort((a, b) => a.order - b.order),
    [report.signatureGroups]
  );

  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verifikasi/${report.documentId}`
      : `/verifikasi/${report.documentId}`;

  return (
    <div className="a3-report-sheet bg-white text-[#111827] border border-neutral-300 shadow-sm rounded-xl p-6 sm:p-8 min-w-[1060px] mx-auto">
      {/* Kop Laporan persis PDF */}
      <div className="relative flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Logo PT Ajinomoto Indonesia"
            referrerPolicy="no-referrer"
            className="h-10 w-auto object-contain"
          />
        </div>
        <div className="flex-1 text-center px-4">
          <h2 className="text-[17px] font-extrabold tracking-wide uppercase text-black font-display">
            {report.title}
          </h2>
        </div>
        <div className="text-right text-[10px] text-neutral-600 font-mono-num">
          <div>{report.documentId}</div>
          <div>Rev. {report.version}</div>
        </div>
      </div>

      {/* Metadata Kop */}
      <div className="grid grid-cols-[130px_12px_1fr] gap-y-0.5 text-[11px] font-medium text-black mb-3">
        <div>Departemen</div>
        <div>:</div>
        <div>{report.department}</div>
        <div>Seksi</div>
        <div>:</div>
        <div>{report.section}</div>
        <div>Periode Bulan</div>
        <div>:</div>
        <div className="font-semibold">{report.periodLabel}</div>
      </div>

      {/* Tabel Utama */}
      {report.jenis !== 'INVENTARIS_OVERHEAD' ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[10.5px] leading-tight">
            <thead>
              <tr className="bg-[#F3F4F6] text-black font-bold text-center">
                <th className="border border-black px-1.5 py-1.5 w-8">No.</th>
                <th className="border border-black px-2 py-1.5 w-36">Kategori</th>
                <th className="border border-black px-1.5 py-1.5 w-8">No.</th>
                <th className="border border-black px-1.5 py-1.5 w-16">Code Item</th>
                <th className="border border-black px-2 py-1.5 min-w-[200px] text-left">Item_Name</th>
                <th className="border border-black px-1.5 py-1.5 w-12">UOM</th>
                <th className="border border-black px-1.5 py-1.5 w-14">
                  Stok
                  <br />
                  Awal
                </th>
                <th className="border border-black px-1.5 py-1.5 w-14">Terima</th>
                <th className="border border-black px-1.5 py-1.5 w-14">Pakai</th>
                <th className="border border-black px-1.5 py-1.5 w-14">
                  Stock
                  <br />
                  Akhir
                </th>
                <th className="border border-black px-1.5 py-1.5 w-14">
                  Minimum
                  <br />
                  Stok
                </th>
                <th className="border border-black px-2 py-1.5 w-32">Lokasi Simpan</th>
                <th className="border border-black px-2 py-1.5 min-w-[100px]">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {groupedCheckRows.map((grp) =>
                grp.rows.map((row, rIdx) => {
                  const isCritical = row.stockAkhir <= row.minStock;
                  return (
                    <tr
                      key={row.itemId}
                      className={isCritical ? 'bg-red-50/70' : 'bg-white'}
                    >
                      {rIdx === 0 && (
                        <>
                          <td
                            rowSpan={grp.rows.length}
                            className="border border-black px-1.5 py-1 text-center align-middle font-semibold tabular-nums"
                          >
                            {grp.groupNo}
                          </td>
                          <td
                            rowSpan={grp.rows.length}
                            className="border border-black px-2 py-1 text-left align-middle font-medium"
                          >
                            {grp.kategori}
                          </td>
                        </>
                      )}
                      <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                        {row.itemNo}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-center font-mono-num">
                        {row.codeItem || ''}
                      </td>
                      <td className="border border-black px-2 py-1 text-left">
                        {row.itemName}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-center">
                        {row.uom}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                        {editable && !report.locked && onEditCheckRow ? (
                          <input
                            type="number"
                            min={0}
                            value={row.stokAwal}
                            onChange={(e) =>
                              onEditCheckRow(row.itemId, { stokAwal: Math.max(0, Number(e.target.value)) })
                            }
                            className="w-11 text-center bg-amber-50 border border-amber-300 rounded px-0.5 py-0.5 text-[10px]"
                          />
                        ) : (
                          row.stokAwal
                        )}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                        {editable && !report.locked && onEditCheckRow ? (
                          <input
                            type="number"
                            min={0}
                            value={row.terima}
                            onChange={(e) =>
                              onEditCheckRow(row.itemId, { terima: Math.max(0, Number(e.target.value)) })
                            }
                            className="w-11 text-center bg-amber-50 border border-amber-300 rounded px-0.5 py-0.5 text-[10px]"
                          />
                        ) : (
                          row.terima
                        )}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                        {editable && !report.locked && onEditCheckRow ? (
                          <input
                            type="number"
                            min={0}
                            value={row.pakai}
                            onChange={(e) =>
                              onEditCheckRow(row.itemId, { pakai: Math.max(0, Number(e.target.value)) })
                            }
                            className="w-11 text-center bg-amber-50 border border-amber-300 rounded px-0.5 py-0.5 text-[10px]"
                          />
                        ) : (
                          row.pakai
                        )}
                      </td>
                      <td
                        className={`border border-black px-1.5 py-1 text-center font-semibold tabular-nums ${
                          isCritical ? 'text-[#B91C1C]' : 'text-black'
                        }`}
                      >
                        {row.stockAkhir}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-center tabular-nums">
                        {row.minStock}
                      </td>
                      <td className="border border-black px-2 py-1 text-left">
                        {row.location}
                      </td>
                      <td className="border border-black px-2 py-1 text-left">
                        {editable && !report.locked && onEditCheckRow ? (
                          <input
                            type="text"
                            value={row.notes}
                            placeholder="-"
                            onChange={(e) => onEditCheckRow(row.itemId, { notes: e.target.value })}
                            className="w-full bg-amber-50 border border-amber-300 rounded px-1 py-0.5 text-[10px]"
                          />
                        ) : (
                          row.notes || (isCritical ? 'Stok min.' : '')
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Tabel Inventaris Overhead */
        <div>
          <table className="w-full border-collapse border border-black text-[11px] leading-tight">
            <thead>
              <tr className="bg-[#F3F4F6] text-black font-bold text-center">
                <th rowSpan={2} className="border border-black px-2 py-1.5 w-10">No.</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 w-28">Kategori</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 w-24">Part_Id</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 text-left">Item name</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 w-14">QTY</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 w-14">UOM</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 w-40">Lokasi Simpan</th>
                <th colSpan={2} className="border border-black px-2 py-1">Kondisi</th>
                <th rowSpan={2} className="border border-black px-2 py-1.5 min-w-[140px]">Keterangan</th>
              </tr>
              <tr className="bg-[#F3F4F6] text-black font-bold text-center">
                <th className="border border-black px-2 py-1 w-16">Bagus</th>
                <th className="border border-black px-2 py-1 w-16">Rusak</th>
              </tr>
            </thead>
            <tbody>
              {(report.inventoryRows || []).map((row, idx) => (
                <tr key={row.inventoryId} className="bg-white">
                  <td className="border border-black px-2 py-1 text-center tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="border border-black px-2 py-1 text-center">{row.kategori}</td>
                  <td className="border border-black px-2 py-1 text-center font-mono-num font-semibold">
                    {row.partId}
                  </td>
                  <td className="border border-black px-2 py-1 text-left">{row.itemName}</td>
                  <td className="border border-black px-2 py-1 text-center tabular-nums">{row.qty}</td>
                  <td className="border border-black px-2 py-1 text-center">{row.uom}</td>
                  <td className="border border-black px-2 py-1 text-left">{row.location}</td>
                  <td className="border border-black px-2 py-1 text-center">
                    <span className="inline-flex items-center justify-center w-4 h-4 border border-black bg-black text-white text-[10px]">
                      {row.condition === 'BAGUS' ? <Check className="w-3 h-3" /> : null}
                    </span>
                  </td>
                  <td className="border border-black px-2 py-1 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 border border-black ${
                        row.condition === 'RUSAK' ? 'bg-red-700 text-white' : 'bg-white'
                      }`}
                    >
                      {row.condition === 'RUSAK' ? <Check className="w-3 h-3" /> : null}
                    </span>
                  </td>
                  <td className="border border-black px-2 py-1 text-left">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-neutral-700 mt-1.5">
            Ketentuan kode Part_Id: <strong>ELC</strong> = Electronic · <strong>ATK</strong> = Alat Tulis Kantor · <strong>MCH</strong> = Merchandise
          </p>
        </div>
      )}

      {/* Blok Tanda Tangan Digital 3 Grup */}
      <div className="signature-print-block mt-7 grid grid-cols-3 gap-8 items-end text-[11px] text-black">
        {sortedSigGroups.map((group, gIdx) => {
          const isLastGroup = gIdx === sortedSigGroups.length - 1;
          return (
            <div key={group.id} className="flex flex-col">
              {isLastGroup ? (
                <div className="mb-0.5 text-center">
                  {editable && !report.locked && onEditPlaceDate ? (
                    <input
                      type="text"
                      value={report.placeDateText}
                      onChange={(e) => onEditPlaceDate(e.target.value)}
                      className="text-[11px] font-medium text-center border-b border-dashed border-neutral-400 bg-amber-50/70 px-2 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <span className="font-medium">{report.placeDateText}</span>
                  )}
                </div>
              ) : (
                <div className="h-4" />
              )}
              <div className="text-center font-medium mb-2">{group.label}</div>

              <div className="flex items-end justify-center gap-6 flex-wrap">
                {[...group.slots]
                  .sort((a, b) => a.order - b.order)
                  .map((slot) => {
                    const canUserSign =
                      !report.locked &&
                      slot.status === 'PENDING' &&
                      onClickSignSlot &&
                      (isSuperAdmin || slot.allowedUserId === currentUserId);

                    return (
                      <div key={slot.id} className="flex flex-col items-center min-w-[140px]">
                        <div className="h-16 flex items-center justify-center w-full">
                          {slot.status === 'SIGNED' && slot.signatureImageUrl ? (
                            <img
                              src={slot.signatureImageUrl}
                              alt={`Tanda tangan ${slot.name}`}
                              className="max-h-14 max-w-[140px] object-contain"
                            />
                          ) : canUserSign ? (
                            <button
                              type="button"
                              onClick={() => onClickSignSlot(group.id, slot)}
                              className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E60012] text-[#E60012] hover:bg-[#E60012] hover:text-white text-[11px] font-semibold transition-colors"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              Tanda Tangani
                            </button>
                          ) : (
                            <span className="text-[10px] italic text-neutral-400">
                              (Menunggu TTD)
                            </span>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="font-bold underline decoration-black underline-offset-2">
                            {slot.name}
                          </div>
                          <div className="font-semibold text-[10.5px]">{slot.jabatan}</div>
                          {slot.signedAt && (
                            <div className="text-[9px] text-neutral-500 mt-0.5 font-mono-num">
                              {formatDateTimeIndo(slot.signedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Petunjuk */}
      <div className="a3-footer-block mt-7 pt-3 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="text-[10.5px] text-black leading-relaxed">
          <div className="font-semibold mb-1">Petunjuk :</div>
          <ol className="list-decimal pl-5 space-y-0.5">
            {instructions.map((text, idx) => (
              <li key={idx}>{text}</li>
            ))}
          </ol>
        </div>

        {/* Kode QR Verifikasi Keaslian Dokumen */}
        <div className="flex items-center gap-3 border border-neutral-300 rounded-lg p-2.5 bg-neutral-50 shrink-0">
          <QRCodeSVG value={verifyUrl} size={62} level="M" />
          <div className="text-[9.5px] leading-snug text-neutral-700 font-mono-num">
            <div className="font-bold text-black">VERIFIKASI DOKUMEN</div>
            <div>ID: {report.documentId}</div>
            <div>Hash: {report.docHash}</div>
            <div>Status: {report.status}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
