import React, { useMemo, useState } from 'react';
import { Check, Edit3, Eye, History, Image as ImageIcon, Plus, Search, Trash2, Upload, X, ZoomIn } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { processAndUploadImage } from '../services/mediaStorageService';
import type { OverheadInventoryItem, PartPrefix } from '../types';
import { formatDateIndo } from '../utils/format';

export const OverheadInventoryPage: React.FC = () => {
  const { user, canEditOperational } = useAuth();
  const { language, tr } = useLanguage();
  const { store, getNextPartId, upsertInventoryItem, recordInventoryMutation } = useSupplyHub();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [prefixFilter, setPrefixFilter] = useState<'ALL' | PartPrefix>('ALL');
  const [condFilter, setCondFilter] = useState<'ALL' | 'BAGUS' | 'RUSAK'>('ALL');

  const [editModal, setEditModal] = useState<Partial<OverheadInventoryItem> | null>(null);
  const [previewPhotoInv, setPreviewPhotoInv] = useState<OverheadInventoryItem | null>(null);
  const [mutationModal, setMutationModal] = useState<OverheadInventoryItem | null>(null);
  const [mutType, setMutType] = useState<'IN' | 'OUT' | 'KONDISI'>('IN');
  const [mutQty, setMutQty] = useState(1);
  const [mutCond, setMutCond] = useState<'BAGUS' | 'RUSAK'>('BAGUS');
  const [mutNote, setMutNote] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.inventories.filter((inv) => {
      if (prefixFilter !== 'ALL' && inv.prefix !== prefixFilter) return false;
      if (condFilter !== 'ALL' && inv.condition !== condFilter) return false;
      if (q) {
        return (
          inv.partId.toLowerCase().includes(q) ||
          inv.itemName.toLowerCase().includes(q) ||
          inv.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [condFilter, prefixFilter, search, store.inventories]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editModal) return;
    if (!editModal.itemName?.trim()) {
      toast(tr('Nama item wajib diisi', 'Item name is required'), 'error');
      return;
    }
    const saved = upsertInventoryItem(
      {
        id: editModal.id,
        partId: editModal.partId,
        prefix: editModal.prefix || 'MCH',
        kategori: 'Overhead',
        itemName: editModal.itemName.trim(),
        qty: Math.max(0, Number(editModal.qty ?? 0)),
        uom: editModal.uom || 'PC',
        location: editModal.location || 'Cabinet 5 Baris 1',
        condition: editModal.condition || 'BAGUS',
        notes: editModal.notes || '',
        photoUrl: editModal.photoUrl,
      },
      user
    );
    toast(tr(`Inventaris ${saved.partId} disimpan`, `Asset ${saved.partId} saved`), 'success');
    setEditModal(null);
  };

  const handleInventoryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast(tr('Berkas harus berupa gambar (JPG, PNG, WebP)', 'File must be an image (JPG, PNG, WebP)'), 'error');
      return;
    }
    try {
      const entityId = editModal?.id || editModal?.partId || `inv-${Date.now()}`;
      const { url, uploadedToCloud } = await processAndUploadImage(file, 'inventories', entityId);
      setEditModal((prev) => (prev ? { ...prev, photoUrl: url } : prev));
      toast(
        uploadedToCloud
          ? tr('Foto aset diunggah ke Supabase Storage', 'Asset photo uploaded to Supabase Storage')
          : tr('Foto aset berhasil dimuat', 'Asset photo loaded'),
        'success',
        tr('Klik "Simpan Aset" untuk menyimpan perubahan.', 'Click "Save Asset" to apply changes.')
      );
    } catch {
      toast(tr('Gagal memproses foto aset', 'Failed to process asset photo'), 'error');
    }
    e.target.value = '';
  };

  const handleMutationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mutationModal) return;
    recordInventoryMutation(
      mutationModal.id,
      mutType,
      mutType === 'KONDISI' ? 0 : Math.max(1, mutQty),
      mutCond,
      mutNote,
      user
    );
    toast(tr(`Mutasi ${mutationModal.partId} dicatat`, `Mutation for ${mutationModal.partId} recorded`), 'success');
    setMutationModal(null);
    setMutNote('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">
            {tr('Inventaris Overhead', 'Overhead Inventory')}
          </h2>
          <p className="text-xs text-neutral-500">
            {tr('Ketentuan kode Part_Id:', 'Part_Id code rules:')}{' '}
            <strong>MCH</strong> = Merchandise · <strong>ELC</strong> = Electronic · <strong>ATK</strong> ={' '}
            {tr('Alat Tulis Kantor', 'Office Stationery')}
          </p>
        </div>

        {canEditOperational && (
          <button
            type="button"
            onClick={() =>
              setEditModal({
                prefix: 'MCH',
                partId: getNextPartId('MCH'),
                kategori: 'Overhead',
                itemName: '',
                qty: 1,
                uom: 'PC',
                location: 'Cabinet 5 Baris 1',
                condition: 'BAGUS',
                notes: '',
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            {tr('Tambah Aset Inventaris', 'Add Inventory Asset')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-[220px] min-w-0">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Cari Part_Id, nama aset, atau lokasi...', 'Search Part_Id, asset name, or location...')}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
          />
        </div>
        <select
          value={prefixFilter}
          onChange={(e) => setPrefixFilter(e.target.value as 'ALL' | PartPrefix)}
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
        >
          <option value="ALL">{tr('Semua Kode (MCH, ELC, ATK)', 'All Codes (MCH, ELC, ATK)')}</option>
          <option value="MCH">MCH · Merchandise</option>
          <option value="ELC">ELC · Electronic</option>
          <option value="ATK">{tr('ATK · Alat Tulis Kantor', 'ATK · Office Stationery')}</option>
        </select>
        <select
          value={condFilter}
          onChange={(e) => setCondFilter(e.target.value as 'ALL' | 'BAGUS' | 'RUSAK')}
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
        >
          <option value="ALL">{tr('Semua Kondisi', 'All Conditions')}</option>
          <option value="BAGUS">{tr('Bagus', 'Good')}</option>
          <option value="RUSAK">{tr('Rusak', 'Damaged')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={tr('Aset inventaris tidak ditemukan', 'No inventory assets found')}
          description={tr(
            'Coba ubah filter atau tambahkan item inventaris overhead baru.',
            'Try adjusting filters or add a new overhead inventory asset.'
          )}
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-left text-neutral-500">
                  <th className="p-3 font-semibold">No.</th>
                  <th className="p-3 font-semibold">{tr('Foto', 'Photo')}</th>
                  <th className="p-3 font-semibold">Part_Id</th>
                  <th className="p-3 font-semibold">{tr('Item Name', 'Item Name')}</th>
                  <th className="p-3 font-semibold text-right">QTY</th>
                  <th className="p-3 font-semibold">UOM</th>
                  <th className="p-3 font-semibold">{tr('Lokasi Simpan', 'Storage Location')}</th>
                  <th className="p-3 font-semibold text-center">{tr('Bagus', 'Good')}</th>
                  <th className="p-3 font-semibold text-center">{tr('Rusak', 'Damaged')}</th>
                  <th className="p-3 font-semibold">{tr('Keterangan', 'Notes')}</th>
                  <th className="p-3 font-semibold text-right">{tr('Aksi', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filtered.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-mono-num">{idx + 1}</td>
                    <td className="p-3">
                      {inv.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoInv(inv)}
                          title={tr('Klik untuk memperbesar foto', 'Click to enlarge photo')}
                          className="group relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 shrink-0 block"
                        >
                          <img
                            src={inv.photoUrl}
                            alt={inv.itemName}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <ZoomIn className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      ) : canEditOperational ? (
                        <button
                          type="button"
                          onClick={() => setEditModal(inv)}
                          title={tr('Unggah foto aset', 'Upload asset photo')}
                          className="w-10 h-10 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-400 hover:border-theme-primary hover:text-theme-primary transition"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-300 dark:text-neutral-700">
                          <ImageIcon className="w-4 h-4" />
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono-num font-bold text-theme-primary">{inv.partId}</td>
                    <td className="p-3 font-semibold">{inv.itemName}</td>
                    <td className="p-3 text-right font-mono-num font-bold">{inv.qty}</td>
                    <td className="p-3">{inv.uom}</td>
                    <td className="p-3">{inv.location}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                          inv.condition === 'BAGUS'
                            ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white dark:text-black'
                            : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {inv.condition === 'BAGUS' && <Check className="w-3 h-3" />}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                          inv.condition === 'RUSAK'
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                      >
                        {inv.condition === 'RUSAK' && <Check className="w-3 h-3" />}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-500">{inv.notes || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {inv.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoInv(inv)}
                            title={tr('Lihat Foto Aset', 'View Asset Photo')}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-theme-primary"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMutationModal(inv);
                            setMutCond(inv.condition);
                            setMutType('IN');
                            setMutQty(1);
                          }}
                          title={tr('Riwayat & Mutasi In/Out', 'In/Out Mutation & History')}
                          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {canEditOperational && (
                          <button
                            type="button"
                            onClick={() => setEditModal(inv)}
                            title={tr('Ubah Aset', 'Edit Asset')}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add/Edit */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editModal.id
                  ? tr(`Ubah ${editModal.partId}`, `Edit ${editModal.partId}`)
                  : tr('Tambah Aset Inventaris Overhead', 'Add Overhead Inventory Asset')}
              </h3>
              <button type="button" onClick={() => setEditModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">{tr('Kelompok Kode (Part_Id)', 'Code Group (Part_Id)')}</label>
                <select
                  disabled={Boolean(editModal.id)}
                  value={editModal.prefix || 'MCH'}
                  onChange={(e) => {
                    const p = e.target.value as PartPrefix;
                    setEditModal({ ...editModal, prefix: p, partId: getNextPartId(p) });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  <option value="MCH">MCH (Merchandise)</option>
                  <option value="ELC">ELC (Electronic)</option>
                  <option value="ATK">{tr('ATK (Alat Tulis Kantor)', 'ATK (Office Stationery)')}</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{tr('Part_Id Otomatis', 'Auto Part_Id')}</label>
                <input
                  type="text"
                  value={editModal.partId || ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 font-mono-num font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">{tr('Nama Barang', 'Item Name')}</label>
                <input
                  type="text"
                  required
                  value={editModal.itemName || ''}
                  onChange={(e) => setEditModal({ ...editModal, itemName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">QTY</label>
                <input
                  type="number"
                  min={0}
                  value={editModal.qty ?? 1}
                  onChange={(e) => setEditModal({ ...editModal, qty: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">UOM</label>
                <select
                  value={editModal.uom || 'PC'}
                  onChange={(e) => setEditModal({ ...editModal, uom: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {store.masterData.uoms.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{tr('Lokasi Simpan', 'Storage Location')}</label>
                <select
                  value={editModal.location || ''}
                  onChange={(e) => setEditModal({ ...editModal, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {store.masterData.locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{tr('Kondisi', 'Condition')}</label>
                <select
                  value={editModal.condition || 'BAGUS'}
                  onChange={(e) =>
                    setEditModal({ ...editModal, condition: e.target.value as 'BAGUS' | 'RUSAK' })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  <option value="BAGUS">{tr('Bagus', 'Good')}</option>
                  <option value="RUSAK">{tr('Rusak', 'Damaged')}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">{tr('Keterangan', 'Notes')}</label>
                <input
                  type="text"
                  value={editModal.notes || ''}
                  onChange={(e) => setEditModal({ ...editModal, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1.5">{tr('Foto Aset (Opsional)', 'Asset Photo (Optional)')}</label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114]">
                  {editModal.photoUrl ? (
                    <img
                      src={editModal.photoUrl}
                      alt={tr('Pratinjau foto aset', 'Asset photo preview')}
                      className="w-16 h-16 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-400 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] font-semibold cursor-pointer hover:border-theme-primary transition">
                        <Upload className="w-3.5 h-3.5" />
                        {editModal.photoUrl ? tr('Ganti Foto', 'Change Photo') : tr('Unggah Foto', 'Upload Photo')}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleInventoryPhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {editModal.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditModal({ ...editModal, photoUrl: undefined })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {tr('Hapus', 'Remove')}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      {tr(
                        'Foto otomatis dikompresi dan tersinkronisasi ke bucket Storage Supabase saat terhubung.',
                        'Photos are automatically compressed and synced to the Supabase Storage bucket when connected.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white font-semibold"
              >
                {tr('Simpan Aset', 'Save Asset')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {previewPhotoInv && previewPhotoInv.photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setPreviewPhotoInv(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="text-[11px] font-mono-num font-bold text-theme-primary">
                  {previewPhotoInv.partId} · {previewPhotoInv.location}
                </div>
                <h3 className="text-sm font-bold">{previewPhotoInv.itemName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoInv(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-neutral-100 dark:bg-[#0F1114] flex items-center justify-center max-h-[65vh]">
              <img
                src={previewPhotoInv.photoUrl}
                alt={previewPhotoInv.itemName}
                className="max-h-[60vh] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="px-5 py-3 flex items-center justify-between text-xs border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500">
                QTY: <strong className="text-neutral-900 dark:text-white">{previewPhotoInv.qty} {previewPhotoInv.uom}</strong> ·{' '}
                {tr('Kondisi', 'Condition')}:{' '}
                <strong className={previewPhotoInv.condition === 'BAGUS' ? 'text-emerald-600' : 'text-red-600'}>
                  {previewPhotoInv.condition === 'BAGUS' ? tr('Bagus', 'Good') : tr('Rusak', 'Damaged')}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                {canEditOperational && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = previewPhotoInv;
                      setPreviewPhotoInv(null);
                      setEditModal(target);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 font-semibold"
                  >
                    {tr('Ganti Foto', 'Change Photo')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPhotoInv(null)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black font-semibold"
                >
                  {tr('Tutup', 'Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mutation & History Modal */}
      {mutationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono-num font-bold text-theme-primary">
                  {mutationModal.partId}
                </span>
                <h3 className="text-base font-bold">{mutationModal.itemName}</h3>
              </div>
              <button type="button" onClick={() => setMutationModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {canEditOperational && (
              <form
                onSubmit={handleMutationSubmit}
                className="p-4 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200 dark:border-neutral-800 space-y-3"
              >
                <div className="font-bold">
                  {tr('Catat Mutasi In / Out / Update Kondisi', 'Record In / Out Mutation / Condition Update')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={mutType}
                    onChange={(e) => setMutType(e.target.value as typeof mutType)}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F]"
                  >
                    <option value="IN">{tr('Barang Masuk (+)', 'Stock In (+)')}</option>
                    <option value="OUT">{tr('Barang Keluar (-)', 'Stock Out (-)')}</option>
                    <option value="KONDISI">{tr('Ubah Kondisi', 'Update Condition')}</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    disabled={mutType === 'KONDISI'}
                    value={mutQty}
                    onChange={(e) => setMutQty(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] font-mono-num"
                  />
                  <select
                    value={mutCond}
                    onChange={(e) => setMutCond(e.target.value as 'BAGUS' | 'RUSAK')}
                    className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F]"
                  >
                    <option value="BAGUS">{tr('Bagus', 'Good')}</option>
                    <option value="RUSAK">{tr('Rusak', 'Damaged')}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mutNote}
                    onChange={(e) => setMutNote(e.target.value)}
                    placeholder={tr('Keterangan mutasi...', 'Mutation notes...')}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-theme-primary bg-theme-primary-hover text-white font-semibold"
                  >
                    {tr('Catat', 'Record')}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              <div className="font-bold">{tr('Riwayat Mutasi', 'Mutation History')}</div>
              {mutationModal.mutations.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {m.type} {m.qty > 0 ? `(${m.qty})` : ''} · {m.note}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {formatDateIndo(m.date, language)} · {m.byName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
