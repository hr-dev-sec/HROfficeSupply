import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Send, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import type { OpnameLine, SupplyType } from '../types';
import { formatDateTimeIndo, formatPeriodLong, getPrevPeriod } from '../utils/format';

export const OpnamePage: React.FC = () => {
  const { user, canEditOperational, canApproveSM } = useAuth();
  const { store, createOpnameSession, reviewOpnameSession } = useSupplyHub();
  const { toast } = useToast();

  const [period, setPeriod] = useState('2026-10');
  const [jenis, setJenis] = useState<SupplyType>('OFFICE_SUPPLIES');

  // Build baseline lines from items & transactions for selected period
  const baseLines = useMemo<OpnameLine[]>(() => {
    const prevPeriod = getPrevPeriod(period);
    const prevFinal = store.reports.find(
      (r) => r.jenis === jenis && r.period === prevPeriod && r.status === 'FINAL'
    );
    return store.items
      .filter((i) => !i.archived && i.jenis === jenis)
      .map((item) => {
        const txs = store.transactions.filter((t) => t.itemId === item.id && t.period === period);
        const terima = txs.filter((t) => t.type === 'TERIMA').reduce((s, t) => s + t.qty, 0);
        const pakai = txs.filter((t) => t.type === 'PAKAI').reduce((s, t) => s + t.qty, 0);
        const prevRow = prevFinal?.checkRows?.find((r) => r.itemId === item.id);
        const stokAwal = prevRow ? prevRow.stockAkhir : Math.max(0, item.currentStock - terima + pakai);
        const systemStock = stokAwal + terima - pakai;
        return {
          itemId: item.id,
          kategori: item.kategori,
          codeItem: item.codeItem,
          itemName: item.itemName,
          uom: item.uom,
          stokAwal,
          terima,
          pakai,
          systemStock,
          physicalStock: item.currentStock,
          diff: item.currentStock - systemStock,
          reason: '',
          balanced: stokAwal + terima - pakai === item.currentStock,
        };
      });
  }, [jenis, period, store.items, store.reports, store.transactions]);

  const [overrides, setOverrides] = useState<Record<string, { physicalStock: number; reason: string }>>({});

  const liveLines = useMemo(() => {
    return baseLines.map((line) => {
      const ov = overrides[line.itemId];
      const physicalStock = ov ? ov.physicalStock : line.physicalStock;
      const diff = physicalStock - line.systemStock;
      return {
        ...line,
        physicalStock,
        diff,
        reason: ov ? ov.reason : line.reason,
        balanced: diff === 0,
      };
    });
  }, [baseLines, overrides]);

  const unbalancedCount = liveLines.filter((l) => !l.balanced).length;

  const handleSubmitOpname = (submitToSM: boolean) => {
    if (!user) return;
    const missingReason = liveLines.find((l) => l.diff !== 0 && !l.reason.trim());
    if (missingReason) {
      toast(
        'Alasan selisih wajib diisi',
        'error',
        `Isi alasan selisih untuk item "${missingReason.itemName}".`
      );
      return;
    }
    createOpnameSession(period, jenis, liveLines, submitToSM, user);
    toast(
      submitToSM ? 'Opname diajukan ke Section Manager' : 'Draft opname disimpan',
      'success'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">Stock Opname Akhir Bulan</h2>
          <p className="text-xs text-neutral-500">
            Verifikasi fisik terhadap saldo sistem (Stok Awal + Terima - Pakai = Stock Akhir) sebelum laporan bulanan diterbitkan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="month"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setOverrides({});
            }}
            className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-mono-num"
          />
          <select
            value={jenis}
            onChange={(e) => {
              setJenis(e.target.value as SupplyType);
              setOverrides({});
            }}
            className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold"
          >
            <option value="OFFICE_SUPPLIES">Office Supplies</option>
            <option value="OVERHEAD_GOODS">Overhead Goods</option>
          </select>
        </div>
      </div>

      {/* Balance Summary Strip */}
      <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              unbalancedCount === 0
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
            }`}
          >
            {unbalancedCount === 0 ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-sm font-bold">
              {unbalancedCount === 0
                ? 'Status: Balance (Seluruh item sesuai)'
                : `Terdapat ${unbalancedCount} item dengan selisih fisik`}
            </div>
            <div className="text-xs text-neutral-500">
              Periode {formatPeriodLong(period)} · {liveLines.length} item diperiksa
            </div>
          </div>
        </div>

        {canEditOperational && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmitOpname(false)}
              className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmitOpname(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5" />
              Ajukan ke Section Manager
            </button>
          </div>
        )}
      </div>

      {/* Physical Count Table */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
        <div className="overflow-x-auto max-h-[62vh] min-h-[280px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
              <tr>
                <th className="p-3 font-semibold">Item</th>
                <th className="p-3 font-semibold text-right">Awal</th>
                <th className="p-3 font-semibold text-right">Terima</th>
                <th className="p-3 font-semibold text-right">Pakai</th>
                <th className="p-3 font-semibold text-right">Sistem</th>
                <th className="p-3 font-semibold text-center">Hitung Fisik</th>
                <th className="p-3 font-semibold text-right">Selisih</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Alasan (Wajib bila selisih)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {liveLines.map((line) => (
                <tr key={line.itemId} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                  <td className="p-3">
                    <div className="font-semibold">{line.itemName}</div>
                    <div className="text-[11px] text-neutral-500 font-mono-num">
                      {line.codeItem || '-'} · {line.kategori}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono-num">{line.stokAwal}</td>
                  <td className="p-3 text-right font-mono-num text-emerald-600">{line.terima}</td>
                  <td className="p-3 text-right font-mono-num text-[#E60012]">{line.pakai}</td>
                  <td className="p-3 text-right font-mono-num font-bold">{line.systemStock}</td>
                  <td className="p-3 text-center">
                    <input
                      type="number"
                      min={0}
                      disabled={!canEditOperational}
                      value={line.physicalStock}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setOverrides((prev) => ({
                          ...prev,
                          [line.itemId]: {
                            physicalStock: val,
                            reason: prev[line.itemId]?.reason || '',
                          },
                        }));
                      }}
                      className="w-16 text-center px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num font-semibold"
                    />
                  </td>
                  <td
                    className={`p-3 text-right font-mono-num font-bold ${
                      line.diff === 0 ? 'text-neutral-500' : 'text-[#E60012]'
                    }`}
                  >
                    {line.diff > 0 ? `+${line.diff}` : line.diff}
                  </td>
                  <td className="p-3">
                    {line.balanced ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Balance
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Selisih
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      disabled={!canEditOperational}
                      value={line.reason}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [line.itemId]: {
                            physicalStock: line.physicalStock,
                            reason: e.target.value,
                          },
                        }))
                      }
                      placeholder={line.diff !== 0 ? 'Wajib diisi...' : 'Opsional'}
                      className={`w-full px-2.5 py-1 rounded-lg border text-xs ${
                        line.diff !== 0 && !line.reason.trim()
                          ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114]'
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riwayat & Persetujuan Opname */}
      <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#E60012]" />
          Riwayat &amp; Persetujuan Stock Opname
        </h3>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {store.opnames.map((op) => {
            const diffCount = op.lines.filter((l) => l.diff !== 0).length;
            return (
              <div
                key={op.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold">
                    {op.jenis === 'OFFICE_SUPPLIES' ? 'Office Supplies' : 'Overhead Goods'} ·{' '}
                    {formatPeriodLong(op.period)}
                  </div>
                  <div className="text-neutral-500 mt-0.5">
                    Dibuat oleh {op.createdByName} · {formatDateTimeIndo(op.createdAt)} ·{' '}
                    {diffCount === 0 ? 'Semua balance' : `${diffCount} item selisih`}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${
                      op.status === 'DISETUJUI'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : op.status === 'DITOLAK'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {op.status === 'MENUNGGU_SM'
                      ? 'Menunggu Section Manager'
                      : op.status === 'DISETUJUI'
                      ? `Disetujui (${op.approvedByName})`
                      : op.status === 'DITOLAK'
                      ? 'Ditolak'
                      : 'Draft'}
                  </span>

                  {op.status === 'MENUNGGU_SM' && canApproveSM && user && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          reviewOpnameSession(op.id, true, user);
                          toast('Stock Opname disetujui & saldo disesuaikan', 'success');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          reviewOpnameSession(op.id, false, user, 'Mohon verifikasi ulang hitungan');
                          toast('Stock Opname dikembalikan', 'warning');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 font-semibold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
