import React, { useMemo } from 'react';
import { FORECAST_MONTH_KEYS, type RollingForecastData, type RollingForecastRow } from '../../types';

interface RollingForecastDocumentProps {
  data: RollingForecastData;
  logoUrl?: string;
}

interface GroupedCategory {
  jenisNo: number;
  jenis: string;
  rows: RollingForecastRow[];
}

function groupByJenis(rows: RollingForecastRow[]): GroupedCategory[] {
  const sorted = [...rows].sort((a, b) => a.itemNo - b.itemNo);
  const groups: GroupedCategory[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (!last || last.jenisNo !== row.jenisNo || last.jenis !== row.jenis) {
      groups.push({ jenisNo: row.jenisNo, jenis: row.jenis, rows: [row] });
    } else {
      last.rows.push(row);
    }
  }
  return groups;
}

export const RollingForecastDocument: React.FC<RollingForecastDocumentProps> = ({
  data,
  logoUrl = '/logo-ajinomoto.png',
}) => {
  const pages = useMemo(() => {
    const groups = groupByJenis(data.rows);
    // Split naturally into ~2 balanced pages (same split point as PDF: Jenis 1..28 on Page 1, 29+ on Page 2)
    const page1: GroupedCategory[] = [];
    const page2: GroupedCategory[] = [];
    let p1Rows = 0;

    for (const grp of groups) {
      if (grp.jenisNo <= 28 && p1Rows < 72) {
        page1.push(grp);
        p1Rows += grp.rows.length;
      } else {
        page2.push(grp);
      }
    }

    return page2.length > 0 ? [page1, page2] : [page1];
  }, [data.rows]);

  return (
    <div className="space-y-6">
      {pages.map((pageGroups, pageIdx) => (
        <div
          key={pageIdx}
          data-rf-page={pageIdx + 1}
          className="bg-white text-[#111827] border border-neutral-300 shadow-sm rounded-xl p-6 sm:p-7 min-w-[1180px] mx-auto"
        >
          {/* Kop Rolling Forecast persis PDF */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h2 className="text-[16px] font-extrabold text-black leading-tight font-display">
                Rolling Forecast Office Supplies {data.fiscalYearLabel}
              </h2>
              <div className="text-[13px] font-semibold text-neutral-800 mt-0.5">
                {data.periodRangeLabel}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-[10px] text-neutral-500 font-mono-num">
                <div>Hal. {pageIdx + 1} / {pages.length}</div>
                <div>Update: {data.activeMonth}</div>
              </div>
              <img
                src={logoUrl}
                alt="Logo PT Ajinomoto Indonesia"
                referrerPolicy="no-referrer"
                className="h-9 w-auto object-contain"
              />
            </div>
          </div>

          {/* Metadata Departemen & Seksi */}
          <div className="grid grid-cols-[110px_12px_1fr] gap-y-0.5 text-[11px] font-medium text-black mb-3">
            <div>Departemen</div>
            <div>:</div>
            <div className="font-semibold">{data.department}</div>
            <div>Seksi</div>
            <div>:</div>
            <div className="font-semibold">{data.section}</div>
          </div>

          {/* Tabel Rolling Forecast persis PDF GA Dept */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-[9.5px] leading-tight">
              <thead>
                <tr className="bg-[#F3F4F6] text-black font-bold text-center">
                  <th rowSpan={2} className="border border-black px-1 py-1 w-7">
                    No.
                  </th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 w-32">
                    Jenis
                  </th>
                  <th rowSpan={2} className="border border-black px-1 py-1 w-7">
                    No.
                  </th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 w-12">
                    Code
                  </th>
                  <th rowSpan={2} className="border border-black px-2 py-1 min-w-[205px]">
                    item_description
                  </th>
                  <th rowSpan={2} className="border border-black px-1 py-1 w-10">
                    UOM
                  </th>
                  <th rowSpan={2} className="border border-black px-1 py-1 w-11">
                    R/M
                    <br />
                    Stock
                  </th>
                  <th
                    colSpan={FORECAST_MONTH_KEYS.length}
                    className="border border-black px-1 py-1 bg-[#E5E7EB]"
                  >
                    RF {data.fiscalYearLabel}
                  </th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 w-36">
                    Est. Pemakaian per bulan
                  </th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 min-w-[155px]">
                    Keterangan
                  </th>
                </tr>
                <tr className="bg-[#F3F4F6] text-black font-bold text-center">
                  {FORECAST_MONTH_KEYS.map((m) => (
                    <th
                      key={m}
                      className={`border border-black px-1 py-1 w-10 whitespace-nowrap ${
                        m === data.activeMonth ? 'bg-[#FDE047] text-black' : ''
                      }`}
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((grp) =>
                  grp.rows.map((row, rIdx) => (
                    <tr key={row.id} className="bg-white">
                      {rIdx === 0 && (
                        <>
                          <td
                            rowSpan={grp.rows.length}
                            className="border border-black px-1 py-0.5 text-center align-middle font-semibold tabular-nums"
                          >
                            {grp.jenisNo}
                          </td>
                          <td
                            rowSpan={grp.rows.length}
                            className="border border-black px-1.5 py-0.5 text-left align-middle font-medium"
                          >
                            {grp.jenis}
                          </td>
                        </>
                      )}
                      <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                        {row.itemNo}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center font-mono-num">
                        {row.codeItem}
                      </td>
                      <td className="border border-black px-1.5 py-0.5 text-left">
                        {row.itemDescription}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center">
                        {row.uom}
                      </td>
                      <td className="border border-black px-1 py-0.5 text-center tabular-nums">
                        {row.rmStock === null ? '' : row.rmStock}
                      </td>
                      {FORECAST_MONTH_KEYS.map((m) => {
                        const qty = row.months[m];
                        const isActive = m === data.activeMonth;
                        return (
                          <td
                            key={m}
                            className={`border border-black px-1 py-0.5 text-center tabular-nums ${
                              isActive ? 'bg-[#FEF08A] font-bold' : ''
                            }`}
                          >
                            {qty !== undefined && qty > 0 ? qty : ''}
                          </td>
                        );
                      })}
                      <td className="border border-black px-1.5 py-0.5 text-left">
                        {row.estPemakaian}
                      </td>
                      <td className="border border-black px-1.5 py-0.5 text-left whitespace-pre-line">
                        {row.keterangan}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
