import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Download,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { exportRowsToExcel } from '../utils/exportUtils';
import { formatDateIndo, formatPeriodShort } from '../utils/format';

interface DraftTxLine {
  key: string;
  itemId: string;
  type: 'TERIMA' | 'PAKAI';
  qty: number;
  note: string;
}

export const TransactionsPage: React.FC = () => {
  const { user, canEditOperational } = useAuth();
  const { language, tr } = useLanguage();
  const { store, recordTransactions } = useSupplyHub();
  const { toast } = useToast();

  const [txDate, setTxDate] = useState('2026-10-14');
  const [globalType, setGlobalType] = useState<'TERIMA' | 'PAKAI'>('PAKAI');
  const [lines, setLines] = useState<DraftTxLine[]>([
    {
      key: 'line-1',
      itemId: store.items[0]?.id || '',
      type: 'PAKAI',
      qty: 1,
      note: '',
    },
  ]);

  // Camera QR scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Logbook Filters
  const [logSearch, setLogSearch] = useState('');
  const [logType, setLogType] = useState<'ALL' | 'TERIMA' | 'PAKAI' | 'OPNAME_ADJ'>('ALL');
  const [logPeriod, setLogPeriod] = useState('ALL');
  const [logItem, setLogItem] = useState('ALL');

  const activeItems = useMemo(
    () => store.items.filter((i) => !i.archived),
    [store.items]
  );

  const periods = useMemo(
    () => Array.from(new Set(store.transactions.map((t) => t.period))).sort().reverse(),
    [store.transactions]
  );

  const filteredTxs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return store.transactions.filter((t) => {
      if (logType !== 'ALL' && t.type !== logType) return false;
      if (logPeriod !== 'ALL' && t.period !== logPeriod) return false;
      if (logItem !== 'ALL' && t.itemId !== logItem) return false;
      if (q) {
        return (
          t.itemName.toLowerCase().includes(q) ||
          t.codeItem.toLowerCase().includes(q) ||
          t.note.toLowerCase().includes(q) ||
          t.recordedByName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logItem, logPeriod, logSearch, logType, store.transactions]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const openScanner = async () => {
    setScannerOpen(true);
    setCameraError('');
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setCameraError(
          tr(
            'Browser tidak mendukung akses kamera langsung. Gunakan input kode QR manual di bawah.',
            'Browser does not support direct camera access. Use the manual QR code input below.'
          )
        );
      }
    } catch {
      setCameraError(
        tr(
          'Izin kamera belum tersedia di pratinjau ini. Gunakan pemindai kode manual di bawah.',
          'Camera permission is unavailable in this preview. Use the manual code scanner below.'
        )
      );
    }
  };

  const handleScanLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const q = scanCodeInput.trim().toLowerCase();
    const found = activeItems.find(
      (i) =>
        i.codeItem.toLowerCase() === q ||
        i.id.toLowerCase() === q ||
        i.itemName.toLowerCase().includes(q)
    );
    if (!found) {
      toast(tr('Kode QR / item tidak ditemukan', 'QR code / item not found'), 'error');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}`,
        itemId: found.id,
        type: globalType,
        qty: 1,
        note: tr('Dipindai via QR/Barcode', 'Scanned via QR/Barcode'),
      },
    ]);
    setScanCodeInput('');
    stopCamera();
    setScannerOpen(false);
    toast(tr(`Item ditambahkan: ${found.itemName}`, `Item added: ${found.itemName}`), 'success');
  };

  const handleSubmitTransactions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const res = recordTransactions(
      lines.map((l) => ({
        itemId: l.itemId,
        type: l.type,
        qty: Number(l.qty),
        date: txDate,
        note: l.note,
      })),
      user
    );
    if (!res.ok) {
      toast(tr('Validasi transaksi gagal', 'Transaction validation failed'), 'error', res.error);
      return;
    }
    toast(
      tr(
        `${lines.length} transaksi berhasil dicatat ke buku log`,
        `${lines.length} transaction(s) recorded to logbook`
      ),
      'success'
    );
    setLines([
      {
        key: `line-${Date.now()}`,
        itemId: activeItems[0]?.id || '',
        type: globalType,
        qty: 1,
        note: '',
      },
    ]);
  };

  const handleExportLog = async () => {
    try {
      await exportRowsToExcel(
        filteredTxs.map((t) => ({
          [tr('Tanggal', 'Date')]: formatDateIndo(t.date, language),
          [tr('Periode', 'Period')]: formatPeriodShort(t.period, language),
          [tr('Tipe', 'Type')]: t.type,
          [tr('Kode', 'Code')]: t.codeItem || '-',
          Item: t.itemName,
          [tr('Jumlah', 'Qty')]: t.qty,
          UOM: t.uom,
          [tr('Pencatat', 'Recorded By')]: t.recordedByName,
          [tr('Catatan', 'Notes')]: t.note,
        })),
        tr('Buku Log Transaksi', 'Transaction Logbook'),
        'Buku_Log_Transaksi_HR_SupplyHub.xlsx'
      );
      toast(tr('Buku log berhasil diekspor ke Excel', 'Logbook exported to Excel'), 'success');
    } catch (err) {
      console.error('[HR SupplyHub] Export transaction logbook failed:', err);
      toast(tr('Gagal mengekspor buku log ke Excel', 'Failed to export logbook to Excel'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold font-display">
          {tr('Transaksi Terima & Pakai', 'Receive & Issue Transactions')}
        </h2>
        <p className="text-xs text-neutral-500">
          {tr(
            'Catat kedatangan dan pengambilan barang sekaligus dalam satu formulir; pemakaian otomatis divalidasi terhadap stok tersedia.',
            'Record incoming stock and item usage in a single form; usage is automatically validated against available stock.'
          )}
        </p>
      </div>

      {/* Multi-item Quick Transaction Form */}
      {canEditOperational && (
        <form
          onSubmit={handleSubmitTransactions}
          className="p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setGlobalType('PAKAI');
                    setLines((prev) => prev.map((l) => ({ ...l, type: 'PAKAI' })));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    globalType === 'PAKAI'
                      ? 'bg-theme-primary text-white'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {tr('Ambil / Pakai Barang', 'Issue / Use Stock')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGlobalType('TERIMA');
                    setLines((prev) => prev.map((l) => ({ ...l, type: 'TERIMA' })));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    globalType === 'TERIMA'
                      ? 'bg-emerald-600 text-white'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {tr('Kedatangan / Terima Barang', 'Receive / Stock In')}
                </button>
              </div>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs font-mono-num"
              />
            </div>

            <button
              type="button"
              onClick={openScanner}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <QrCode className="w-4 h-4 text-theme-primary" />
              {tr('Pindai QR / Barcode', 'Scan QR / Barcode')}
            </button>
          </div>

          <div className="space-y-2.5">
            {lines.map((line) => {
              const selected = activeItems.find((i) => i.id === line.itemId);
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center p-3 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/70 dark:border-neutral-800 text-xs"
                >
                  <div className="md:col-span-5">
                    <select
                      value={line.itemId}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) => (l.key === line.key ? { ...l, itemId: e.target.value } : l))
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F]"
                    >
                      {activeItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.codeItem ? `[${it.codeItem}] ` : ''}
                          {it.itemName} ({tr('Stok', 'Stock')}: {it.currentStock} {it.uom})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={line.type}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? { ...l, type: e.target.value as 'TERIMA' | 'PAKAI' }
                              : l
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] font-semibold"
                    >
                      <option value="PAKAI">{tr('Pakai (-)', 'Use (-)')}</option>
                      <option value="TERIMA">{tr('Terima (+)', 'Receive (+)')}</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={line.type === 'PAKAI' ? selected?.currentStock ?? 9999 : 9999}
                      value={line.qty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, qty: Math.max(1, Number(e.target.value)) } : l
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] font-mono-num"
                    />
                    <span className="text-neutral-500 font-mono-num shrink-0">
                      {selected?.uom || ''}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={line.note}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) => (l.key === line.key ? { ...l, note: e.target.value } : l))
                        )
                      }
                      placeholder={tr('Catatan keperluan...', 'Purpose / notes...')}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F]"
                    />
                  </div>
                  <div className="md:col-span-1 text-right">
                    <button
                      type="button"
                      disabled={lines.length <= 1}
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="p-2 rounded-lg text-neutral-400 hover:text-red-600 disabled:opacity-30"
                      aria-label={tr('Hapus baris', 'Remove row')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    key: `line-${Date.now()}`,
                    itemId: activeItems[0]?.id || '',
                    type: globalType,
                    qty: 1,
                    note: '',
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:border-theme-primary"
            >
              <Plus className="w-4 h-4" />
              {tr('Tambah Baris Item', 'Add Item Row')}
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-theme-primary bg-theme-primary-hover text-white text-xs font-semibold transition-colors"
            >
              {tr('Simpan Transaksi ke Buku Log', 'Save Transactions to Logbook')} ({lines.length})
            </button>
          </div>
        </form>
      )}

      {/* Digital Logbook */}
      <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">
              {tr('Buku Log Digital Transaksi', 'Digital Transaction Logbook')} ({filteredTxs.length})
            </h3>
            <p className="text-xs text-neutral-500">
              {tr(
                'Rekam jejak seluruh barang masuk, keluar, dan penyesuaian opname',
                'Complete trail of all incoming stock, usage, and stocktake adjustments'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportLog}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Download className="w-3.5 h-3.5" />
            {tr('Ekspor Buku Log', 'Export Logbook')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 w-full sm:min-w-[200px] min-w-0">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder={tr('Cari item, pencatat, atau catatan...', 'Search item, recorder, or notes...')}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
            />
          </div>
          <select
            value={logType}
            onChange={(e) => setLogType(e.target.value as typeof logType)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
          >
            <option value="ALL">{tr('Semua Tipe', 'All Types')}</option>
            <option value="TERIMA">{tr('Terima (+)', 'Receive (+)')}</option>
            <option value="PAKAI">{tr('Pakai (-)', 'Use (-)')}</option>
            <option value="OPNAME_ADJ">{tr('Penyesuaian Opname', 'Opname Adjustment')}</option>
          </select>
          <select
            value={logPeriod}
            onChange={(e) => setLogPeriod(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
          >
            <option value="ALL">{tr('Semua Periode', 'All Periods')}</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {formatPeriodShort(p, language)}
              </option>
            ))}
          </select>
          <select
            value={logItem}
            onChange={(e) => setLogItem(e.target.value)}
            className="w-full sm:w-auto sm:max-w-[220px] min-w-0 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
          >
            <option value="ALL">{tr('Semua Item', 'All Items')}</option>
            {activeItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.itemName}
              </option>
            ))}
          </select>
        </div>

        {filteredTxs.length === 0 ? (
          <EmptyState
            title={tr('Belum ada transaksi sesuai filter', 'No transactions match this filter')}
            description={tr(
              'Ubah filter periode atau kata kunci pencarian untuk melihat catatan buku log.',
              'Adjust the period filter or search keywords to view logbook records.'
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-neutral-500">
                  <th className="py-2.5 pr-3 font-semibold">{tr('Tanggal', 'Date')}</th>
                  <th className="py-2.5 px-2 font-semibold">{tr('Tipe', 'Type')}</th>
                  <th className="py-2.5 px-2 font-semibold">{tr('Kode · Item', 'Code · Item')}</th>
                  <th className="py-2.5 px-2 font-semibold text-right">{tr('Jumlah', 'Qty')}</th>
                  <th className="py-2.5 px-2 font-semibold">{tr('Pencatat', 'Recorded By')}</th>
                  <th className="py-2.5 pl-2 font-semibold">{tr('Catatan', 'Notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredTxs.slice(0, 60).map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                    <td className="py-2.5 pr-3 font-mono-num whitespace-nowrap">
                      {formatDateIndo(t.date, language)}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          t.type === 'TERIMA'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : t.type === 'PAKAI'
                            ? 'text-theme-primary'
                            : 'text-amber-600'
                        }`}
                      >
                        {t.type === 'TERIMA' ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                        {t.type === 'TERIMA'
                          ? tr('TERIMA', 'RECEIVE')
                          : t.type === 'PAKAI'
                          ? tr('PAKAI', 'USE')
                          : tr('OPNAME', 'OPNAME')}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-semibold">{t.itemName}</span>
                      <span className="text-neutral-400 font-mono-num ml-1.5">
                        {t.codeItem || ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono-num font-bold">
                      {t.type === 'TERIMA' ? '+' : t.type === 'PAKAI' ? '-' : ''}
                      {t.qty} {t.uom}
                    </td>
                    <td className="py-2.5 px-2">{t.recordedByName}</td>
                    <td className="py-2.5 pl-2 text-neutral-600 dark:text-neutral-400">
                      {t.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Camera QR Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-theme-primary" />
                {tr('Pemindai QR / Barcode Item', 'Item QR / Barcode Scanner')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setScannerOpen(false);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {cameraError ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                {cameraError}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-48 rounded-xl bg-black object-cover"
              />
            )}
            <form onSubmit={handleScanLookup} className="space-y-3 text-xs">
              <label className="block font-semibold">
                {tr(
                  'Atau masukkan Code Item / Nama Barang hasil pindai:',
                  'Or enter scanned Item Code / Item Name:'
                )}
              </label>
              <input
                type="text"
                value={scanCodeInput}
                onChange={(e) => setScanCodeInput(e.target.value)}
                placeholder={tr('Contoh: 20355 atau Cutter', 'Example: 20355 or Cutter')}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-theme-primary bg-theme-primary-hover text-white font-semibold"
              >
                {tr('Tambahkan ke Form Transaksi', 'Add to Transaction Form')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
