import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, CheckCircle2, Plus, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { formatDateIndo } from '../utils/format';

export const RequestsPage: React.FC = () => {
  const { user, canEditOperational, canApproveSM } = useAuth();
  const { store, createItemRequest, processItemRequest } = useSupplyHub();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [reqName, setReqName] = useState('');
  const [reqSection, setReqSection] = useState('Production Dept.');
  const [reqItemId, setReqItemId] = useState(store.items[0]?.id || '');
  const [reqQty, setReqQty] = useState(1);
  const [reqNote, setReqNote] = useState('');

  const handleSubmitItemReq = (e: React.FormEvent) => {
    e.preventDefault();
    const item = store.items.find((i) => i.id === reqItemId);
    if (!item || !reqName.trim()) return;
    createItemRequest(
      {
        requesterName: reqName.trim(),
        requesterSection: reqSection,
        requestDate: new Date().toISOString().slice(0, 10),
        items: [{ itemId: item.id, itemName: item.itemName, uom: item.uom, qty: reqQty }],
        note: reqNote || 'Permintaan rutin seksi',
      },
      user || undefined
    );
    setReqName('');
    setReqNote('');
    toast('Permintaan barang berhasil diajukan', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">Permintaan Barang Seksi</h2>
          <p className="text-xs text-neutral-500">
            Persetujuan permintaan pengambilan barang seksi otomatis mencatat transaksi Pakai. Untuk pemesanan ke GA Dept, gunakan formulir Rolling Forecast GA.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/forecast')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#C9A24B]/50 bg-[#C9A24B]/10 hover:bg-[#C9A24B]/20 text-xs font-semibold transition-colors whitespace-nowrap"
        >
          <CalendarRange className="w-4 h-4 text-[#C9A24B]" />
          Buka Rolling Forecast GA
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Form Ajukan Permintaan Barang */}
        <form
          onSubmit={handleSubmitItemReq}
          className="xl:col-span-4 min-w-0 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3.5 text-xs h-fit"
        >
          <h3 className="text-sm font-bold">Ajukan Permintaan Barang Seksi</h3>
          <div>
            <label className="block font-semibold mb-1">Nama Pemohon</label>
            <input
              type="text"
              required
              value={reqName}
              onChange={(e) => setReqName(e.target.value)}
              placeholder="Contoh: Rina Wijaya"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Seksi / Departemen</label>
            <input
              type="text"
              required
              value={reqSection}
              onChange={(e) => setReqSection(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Pilih Barang</label>
            <select
              value={reqItemId}
              onChange={(e) => setReqItemId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            >
              {store.items
                .filter((i) => !i.archived)
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.itemName} (Tersedia: {it.currentStock} {it.uom})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Jumlah</label>
            <input
              type="number"
              min={1}
              value={reqQty}
              onChange={(e) => setReqQty(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Keperluan</label>
            <input
              type="text"
              value={reqNote}
              onChange={(e) => setReqNote(e.target.value)}
              placeholder="Keperluan..."
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#E60012] text-white font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Kirim Permintaan
          </button>
        </form>

        {/* Daftar Permintaan */}
        <div className="xl:col-span-8 min-w-0 space-y-3">
          {store.itemRequests.map((req) => (
            <div
              key={req.id}
              className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-wrap items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {req.requesterName} · <span className="text-neutral-500">{req.requesterSection}</span>
                </div>
                <div className="text-neutral-600 dark:text-neutral-300">
                  {req.items.map((it) => `${it.itemName} (${it.qty} ${it.uom})`).join(', ')}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {formatDateIndo(req.requestDate)} · {req.note}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {req.status === 'MENUNGGU' && (canEditOperational || canApproveSM) && user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const res = processItemRequest(req.id, true, user);
                        if (!res.ok) {
                          toast('Gagal menyetujui', 'error', res.error);
                          return;
                        }
                        toast('Permintaan disetujui & transaksi Pakai tercatat', 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Setujui &amp; Catat Pakai
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        processItemRequest(req.id, false, user);
                        toast('Permintaan ditolak', 'warning');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-300 text-red-600 font-semibold"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Tolak
                    </button>
                  </>
                ) : (
                  <span
                    className={`font-bold ${
                      req.status === 'DISETUJUI'
                        ? 'text-emerald-600'
                        : req.status === 'DITOLAK'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
