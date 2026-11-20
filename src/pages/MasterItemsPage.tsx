import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import {
  Archive,
  Copy,
  Download,
  Edit3,
  Eye,
  Grid,
  Image as ImageIcon,
  List,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import type { SupplyItem, SupplyType } from '../types';
import { processAndUploadImage } from '../services/mediaStorageService';
import { exportItemsToExcel } from '../utils/exportUtils';

export const MasterItemsPage: React.FC = () => {
  const { user, canEditOperational } = useAuth();
  const {
    store,
    upsertItem,
    bulkUpdateItems,
    toggleArchiveItem,
    duplicateItem,
    importItemsBatch,
    getRecommendedMinStock,
    updateMasterData,
  } = useSupplyHub();
  const { toast } = useToast();

  const [tab, setTab] = useState<'ITEMS' | 'MASTER_DATA'>('ITEMS');
  const [viewMode, setViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState<'ALL' | SupplyType>('ALL');
  const [catFilter, setCatFilter] = useState('ALL');
  const [locFilter, setLocFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'AKTIF' | 'KRITIS' | 'ARSIP'>('AKTIF');
  const [sortBy, setSortBy] = useState<'NAME' | 'STOCK_ASC' | 'STOCK_DESC'>('NAME');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkLoc, setBulkLoc] = useState('');
  const [bulkMin, setBulkMin] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<SupplyItem> | null>(null);

  const [qrModalItems, setQrModalItems] = useState<SupplyItem[] | null>(null);
  const [previewPhotoItem, setPreviewPhotoItem] = useState<SupplyItem | null>(null);

  // Excel Import State
  const [importOpen, setImportOpen] = useState(false);
  const [rawExcelRows, setRawExcelRows] = useState<Array<Record<string, unknown>>>([]);
  const [excelCols, setExcelCols] = useState<string[]>([]);
  const [colMap, setColMap] = useState({
    kategori: '',
    codeItem: '',
    itemName: '',
    uom: '',
    currentStock: '',
    minStock: '',
    location: '',
  });

  // Master Data Add State
  const [newCat, setNewCat] = useState('');
  const [newUom, setNewUom] = useState('');
  const [newLoc, setNewLoc] = useState('');

  const allCategories = useMemo(
    () => Array.from(new Set([...store.masterData.categoriesOffice, ...store.masterData.categoriesOverhead])),
    [store.masterData]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.items
      .filter((item) => {
        if (statusFilter === 'ARSIP' && !item.archived) return false;
        if (statusFilter !== 'ARSIP' && item.archived) return false;
        if (statusFilter === 'KRITIS' && item.currentStock > item.minStock) return false;
        if (jenisFilter !== 'ALL' && item.jenis !== jenisFilter) return false;
        if (catFilter !== 'ALL' && item.kategori !== catFilter) return false;
        if (locFilter !== 'ALL' && item.location !== locFilter) return false;
        if (q) {
          return (
            item.itemName.toLowerCase().includes(q) ||
            item.codeItem.toLowerCase().includes(q) ||
            item.kategori.toLowerCase().includes(q) ||
            item.location.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'STOCK_ASC') return a.currentStock - b.currentStock;
        if (sortBy === 'STOCK_DESC') return b.currentStock - a.currentStock;
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.itemName.localeCompare(b.itemName);
      });
  }, [catFilter, jenisFilter, locFilter, search, sortBy, statusFilter, store.items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  const openCreateModal = () => {
    setEditingItem({
      jenis: 'OFFICE_SUPPLIES',
      kategori: store.masterData.categoriesOffice[0] || 'Cutter',
      codeItem: '',
      itemName: '',
      uom: 'PC',
      minStock: 1,
      currentStock: 0,
      location: store.masterData.locations[0] || 'Lemari 6 Baris 2',
      notes: '',
      archived: false,
    });
    setEditModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingItem) return;
    if (!editingItem.itemName?.trim() || !editingItem.kategori?.trim()) {
      toast('Nama item dan kategori wajib diisi', 'error');
      return;
    }
    upsertItem(
      {
        id: editingItem.id,
        jenis: editingItem.jenis || 'OFFICE_SUPPLIES',
        kategori: editingItem.kategori,
        codeItem: editingItem.codeItem || '',
        itemName: editingItem.itemName.trim(),
        uom: editingItem.uom || 'PC',
        minStock: Math.max(0, Number(editingItem.minStock || 1)),
        currentStock: Math.max(0, Number(editingItem.currentStock || 0)),
        location: editingItem.location || '',
        notes: editingItem.notes || '',
        photoUrl: editingItem.photoUrl,
        archived: Boolean(editingItem.archived),
      },
      user
    );
    toast(editingItem.id ? 'Item diperbarui' : 'Item baru ditambahkan', 'success');
    setEditModalOpen(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Berkas harus berupa gambar (JPG, PNG, WebP)', 'error');
      return;
    }
    try {
      const entityId = editingItem?.id || editingItem?.codeItem || `item-${Date.now()}`;
      const { url, uploadedToCloud } = await processAndUploadImage(file, 'items', entityId);
      setEditingItem((prev) => (prev ? { ...prev, photoUrl: url } : prev));
      toast(
        uploadedToCloud ? 'Foto diunggah ke Supabase Storage' : 'Foto berhasil dimuat',
        'success',
        'Klik "Simpan Item" untuk menyimpan perubahan.'
      );
    } catch {
      toast('Gagal memproses foto item', 'error');
    }
    e.target.value = '';
  };

  const handleApplyRecommended = (item: SupplyItem) => {
    if (!user) return;
    const rec = getRecommendedMinStock(item.id);
    upsertItem({ ...item, minStock: rec }, user);
    toast('Minimum stok diperbarui', 'success', `${item.itemName}: Min. Stok menjadi ${rec} ${item.uom} (±120%)`);
  };

  const handleBulkSave = () => {
    if (!user || selectedIds.length === 0) return;
    const patch: Partial<Pick<SupplyItem, 'location' | 'minStock'>> = {};
    if (bulkLoc) patch.location = bulkLoc;
    if (bulkMin !== '') patch.minStock = Math.max(0, Number(bulkMin));
    if (Object.keys(patch).length === 0) {
      toast('Pilih minimal satu kolom untuk diubah massal', 'warning');
      return;
    }
    bulkUpdateItems(selectedIds, patch, user);
    toast(`${selectedIds.length} item berhasil diperbarui massal`, 'success');
    setBulkModalOpen(false);
    setSelectedIds([]);
  };

  const handleExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (rows.length === 0) {
        toast('File Excel kosong', 'error');
        return;
      }
      const cols = Object.keys(rows[0]);
      setRawExcelRows(rows);
      setExcelCols(cols);
      const findCol = (keys: string[]) =>
        cols.find((c) => keys.some((k) => c.toLowerCase().includes(k))) || '';
      setColMap({
        kategori: findCol(['kategori', 'category']),
        codeItem: findCol(['code', 'kode']),
        itemName: findCol(['item_name', 'item', 'nama']),
        uom: findCol(['uom', 'satuan']),
        currentStock: findCol(['akhir', 'stok', 'qty']),
        minStock: findCol(['min']),
        location: findCol(['lokasi', 'location']),
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const parsedImportValidation = useMemo(() => {
    const valid: Array<Omit<SupplyItem, 'id' | 'createdAt' | 'updatedAt' | 'archived'>> = [];
    const errors: string[] = [];
    rawExcelRows.forEach((r, idx) => {
      const name = String(r[colMap.itemName] || '').trim();
      const cat = String(r[colMap.kategori] || 'Umum').trim();
      if (!name) {
        errors.push(`Baris ${idx + 2}: Nama item kosong.`);
        return;
      }
      valid.push({
        jenis: cat.toUpperCase().includes('OVERHEAD') ? 'OVERHEAD_GOODS' : 'OFFICE_SUPPLIES',
        kategori: cat,
        codeItem: String(r[colMap.codeItem] || '').trim(),
        itemName: name,
        uom: String(r[colMap.uom] || 'PC').trim().toUpperCase(),
        currentStock: Math.max(0, Number(r[colMap.currentStock] || 0)),
        minStock: Math.max(1, Number(r[colMap.minStock] || 1)),
        location: String(r[colMap.location] || 'Lemari 6 Baris 2').trim(),
        notes: 'Impor Excel',
      });
    });
    return { valid, errors };
  }, [colMap, rawExcelRows]);

  const handleConfirmImport = () => {
    if (!user || parsedImportValidation.valid.length === 0) return;
    const count = importItemsBatch(parsedImportValidation.valid, user);
    toast(`${count} item berhasil diimpor dari Excel`, 'success');
    setImportOpen(false);
    setRawExcelRows([]);
  };

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">Master Item &amp; Data Referensi</h2>
          <p className="text-xs text-neutral-500">
            Kelola katalog Office Supplies, Overhead Goods, label QR, dan rekomendasi stok minimum ±120%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setTab('ITEMS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'ITEMS' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
              }`}
            >
              Katalog Item ({store.items.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('MASTER_DATA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'MASTER_DATA' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
              }`}
            >
              Kategori · UOM · Lokasi
            </button>
          </div>
        </div>
      </div>

      {tab === 'ITEMS' ? (
        <>
          {/* Action Toolbar */}
          <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:min-w-[220px] min-w-0">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari nama item, kode barang, kategori, atau lokasi..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportItemsToExcel(filteredItems)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Ekspor Excel
                </button>
                {canEditOperational && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImportOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Impor Excel
                    </button>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Item
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={jenisFilter}
                  onChange={(e) => setJenisFilter(e.target.value as 'ALL' | SupplyType)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="ALL">Semua Jenis</option>
                  <option value="OFFICE_SUPPLIES">Office Supplies</option>
                  <option value="OVERHEAD_GOODS">Overhead Goods</option>
                </select>
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="ALL">Semua Kategori</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={locFilter}
                  onChange={(e) => setLocFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="ALL">Semua Lokasi</option>
                  {store.masterData.locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'AKTIF' | 'KRITIS' | 'ARSIP')}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="AKTIF">Status: Aktif</option>
                  <option value="KRITIS">Status: Stok Kritis</option>
                  <option value="ARSIP">Status: Arsip</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                >
                  <option value="NAME">Urut: Standar PDF</option>
                  <option value="STOCK_ASC">Stok Terkecil</option>
                  <option value="STOCK_DESC">Stok Terbesar</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setQrModalItems(store.items.filter((i) => selectedIds.includes(i.id)))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Cetak QR ({selectedIds.length})
                    </button>
                    {canEditOperational && (
                      <button
                        type="button"
                        onClick={() => setBulkModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold"
                      >
                        Edit Massal ({selectedIds.length})
                      </button>
                    )}
                  </>
                )}
                <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('TABLE')}
                    aria-label="Tampilan tabel"
                    className={`p-1.5 rounded-md ${
                      viewMode === 'TABLE' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : ''
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    aria-label="Tampilan grid"
                    className={`p-1.5 rounded-md ${
                      viewMode === 'GRID' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : ''
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Data Display */}
          {pagedItems.length === 0 ? (
            <EmptyState
              title="Tidak ada item yang cocok"
              description="Ubah filter pencarian atau tambahkan item baru ke katalog."
              actionLabel={canEditOperational ? 'Tambah Item Baru' : undefined}
              onAction={canEditOperational ? openCreateModal : undefined}
            />
          ) : viewMode === 'TABLE' ? (
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-left text-neutral-500">
                      <th className="p-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            pagedItems.length > 0 &&
                            pagedItems.every((i) => selectedIds.includes(i.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(pagedItems.map((i) => i.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="p-3 font-semibold w-16 text-center">Foto</th>
                      <th className="p-3 font-semibold">Kode · Item</th>
                      <th className="p-3 font-semibold">Kategori</th>
                      <th className="p-3 font-semibold">UOM</th>
                      <th className="p-3 font-semibold text-right">Stok</th>
                      <th className="p-3 font-semibold text-right">Min · Saran 120%</th>
                      <th className="p-3 font-semibold">Lokasi</th>
                      <th className="p-3 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {pagedItems.map((item) => {
                      const isCrit = item.currentStock <= item.minStock;
                      const recMin = getRecommendedMinStock(item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 ${
                            isCrit ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, item.id]
                                    : prev.filter((x) => x !== item.id)
                                )
                              }
                            />
                          </td>
                          <td className="p-3 text-center">
                            {item.photoUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoItem(item)}
                                title={`Lihat foto ${item.itemName}`}
                                className="group relative inline-flex items-center justify-center w-11 h-11 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white shadow-xs hover:ring-2 hover:ring-[#E60012]/60 transition-all cursor-pointer"
                              >
                                <img
                                  src={item.photoUrl}
                                  alt={item.itemName}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <ZoomIn className="w-4 h-4 text-white" />
                                </span>
                              </button>
                            ) : canEditOperational ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditModalOpen(true);
                                }}
                                title="Unggah foto item"
                                className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-[#E60012] hover:text-[#E60012] transition-colors cursor-pointer"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400">
                                <ImageIcon className="w-4 h-4" />
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-semibold">{item.itemName}</div>
                              <div className="text-[11px] text-neutral-500 font-mono-num">
                                {item.codeItem || 'Tanpa kode'} ·{' '}
                                {item.jenis === 'OFFICE_SUPPLIES' ? 'Office' : 'Overhead'}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-neutral-600 dark:text-neutral-300">
                            {item.kategori}
                          </td>
                          <td className="p-3 font-mono-num">{item.uom}</td>
                          <td
                            className={`p-3 text-right font-mono-num font-bold ${
                              isCrit ? 'text-[#E60012]' : ''
                            }`}
                          >
                            {item.currentStock}
                          </td>
                          <td className="p-3 text-right font-mono-num">
                            <span>{item.minStock}</span>
                            {canEditOperational && recMin !== item.minStock && (
                              <button
                                type="button"
                                onClick={() => handleApplyRecommended(item)}
                                title={`Terima saran ±120% rata-rata pemakaian (${recMin})`}
                                className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#C9A24B] hover:underline"
                              >
                                <Sparkles className="w-3 h-3" />
                                Saran: {recMin}
                              </button>
                            )}
                          </td>
                          <td className="p-3 text-neutral-600 dark:text-neutral-400">
                            {item.location}
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {item.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhotoItem(item)}
                                  title="Lihat Foto Item"
                                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sky-600 dark:text-sky-400"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setQrModalItems([item])}
                                title="Cetak Label QR"
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                              {canEditOperational && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setEditModalOpen(true);
                                    }}
                                    title="Ubah Item"
                                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!user) return;
                                      duplicateItem(item.id, user);
                                      toast('Item diduplikasi', 'success');
                                    }}
                                    title="Duplikat"
                                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!user) return;
                                      toggleArchiveItem(item.id, !item.archived, user);
                                      toast(
                                        item.archived ? 'Item dipulihkan' : 'Item diarsipkan',
                                        'info'
                                      );
                                    }}
                                    title={item.archived ? 'Pulihkan' : 'Arsipkan'}
                                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-amber-600"
                                  >
                                    {item.archived ? (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    ) : (
                                      <Archive className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pagedItems.map((item) => {
                const isCrit = item.currentStock <= item.minStock;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-3">
                      {item.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoItem(item)}
                          className="group relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0F1114] block cursor-pointer"
                        >
                          <img
                            src={item.photoUrl}
                            alt={item.itemName}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                          <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-semibold transition-opacity">
                            <ZoomIn className="w-4 h-4" />
                            Perbesar Foto
                          </span>
                        </button>
                      ) : (
                        <div className="w-full aspect-[16/10] rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114]/60 flex flex-col items-center justify-center gap-1 text-neutral-400">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[11px]">Belum ada foto</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono-num text-neutral-500 truncate">
                            {item.codeItem || 'Tanpa Kode'} · {item.kategori}
                          </div>
                          <h4 className="text-sm font-bold mt-0.5">{item.itemName}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQrModalItems([item])}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 shrink-0"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          Stok:{' '}
                          <strong className={`font-mono-num ${isCrit ? 'text-[#E60012]' : ''}`}>
                            {item.currentStock} {item.uom}
                          </strong>
                        </span>
                        <span className="text-neutral-500 font-mono-num">Min: {item.minStock}</span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {item.location}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      {item.photoUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoItem(item)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lihat Foto
                        </button>
                      ) : (
                        <span />
                      )}
                      {canEditOperational && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditModalOpen(true);
                          }}
                          className="text-xs font-semibold text-[#E60012] hover:underline"
                        >
                          Ubah Item
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              Menampilkan {pagedItems.length} dari {filteredItems.length} item
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="font-mono-num">
                Hal {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Master Data Manager (Kategori, UOM, Lokasi) */
        <div className="grid md:grid-cols-3 gap-5">
          {/* Kategori */}
          <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
            <h3 className="text-sm font-bold">Master Kategori ({store.masterData.categoriesOffice.length})</h3>
            {canEditOperational && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="Tambah kategori baru..."
                  className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!user || !newCat.trim()) return;
                    updateMasterData(
                      {
                        ...store.masterData,
                        categoriesOffice: [...store.masterData.categoriesOffice, newCat.trim()],
                      },
                      user
                    );
                    setNewCat('');
                    toast('Kategori ditambahkan', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
                >
                  Tambah
                </button>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {store.masterData.categoriesOffice.map((c) => (
                <div key={c} className="py-2 flex items-center justify-between">
                  <span>{c}</span>
                  {canEditOperational && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        updateMasterData(
                          {
                            ...store.masterData,
                            categoriesOffice: store.masterData.categoriesOffice.filter((x) => x !== c),
                          },
                          user
                        );
                      }}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* UOM */}
          <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
            <h3 className="text-sm font-bold">Master Satuan / UOM ({store.masterData.uoms.length})</h3>
            {canEditOperational && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUom}
                  onChange={(e) => setNewUom(e.target.value)}
                  placeholder="Contoh: BOX"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!user || !newUom.trim()) return;
                    updateMasterData(
                      {
                        ...store.masterData,
                        uoms: Array.from(new Set([...store.masterData.uoms, newUom.trim().toUpperCase()])),
                      },
                      user
                    );
                    setNewUom('');
                    toast('UOM ditambahkan', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
                >
                  Tambah
                </button>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {store.masterData.uoms.map((u) => (
                <div key={u} className="py-2 flex items-center justify-between font-mono-num">
                  <span>{u}</span>
                  {canEditOperational && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        updateMasterData(
                          {
                            ...store.masterData,
                            uoms: store.masterData.uoms.filter((x) => x !== u),
                          },
                          user
                        );
                      }}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Lokasi */}
          <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
            <h3 className="text-sm font-bold">Master Lokasi Simpan ({store.masterData.locations.length})</h3>
            {canEditOperational && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLoc}
                  onChange={(e) => setNewLoc(e.target.value)}
                  placeholder="Contoh: Lemari 8 Baris 1"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!user || !newLoc.trim()) return;
                    updateMasterData(
                      {
                        ...store.masterData,
                        locations: [...store.masterData.locations, newLoc.trim()],
                      },
                      user
                    );
                    setNewLoc('');
                    toast('Lokasi ditambahkan', 'success');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
                >
                  Tambah
                </button>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {store.masterData.locations.map((l) => (
                <div key={l} className="py-2 flex items-center justify-between">
                  <span>{l}</span>
                  {canEditOperational && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) return;
                        updateMasterData(
                          {
                            ...store.masterData,
                            locations: store.masterData.locations.filter((x) => x !== l),
                          },
                          user
                        );
                      }}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={handleSaveItem}
            className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-bold">
                {editingItem.id ? 'Ubah Data Item' : 'Tambah Item Baru'}
              </h3>
              <button type="button" onClick={() => setEditModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Jenis</label>
                <select
                  value={editingItem.jenis}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, jenis: e.target.value as SupplyType })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  <option value="OFFICE_SUPPLIES">Office Supplies</option>
                  <option value="OVERHEAD_GOODS">Overhead Goods</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Kategori</label>
                <select
                  value={editingItem.kategori}
                  onChange={(e) => setEditingItem({ ...editingItem, kategori: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Code Item</label>
                <input
                  type="text"
                  value={editingItem.codeItem || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, codeItem: e.target.value })}
                  placeholder="Contoh: 20355"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nama Item (Item_Name)</label>
                <input
                  type="text"
                  required
                  value={editingItem.itemName || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, itemName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">UOM</label>
                <select
                  value={editingItem.uom}
                  onChange={(e) => setEditingItem({ ...editingItem, uom: e.target.value })}
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
                <label className="block font-semibold mb-1">Stok Saat Ini</label>
                <input
                  type="number"
                  min={0}
                  value={editingItem.currentStock ?? 0}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, currentStock: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Minimum Stok</label>
                <input
                  type="number"
                  min={0}
                  value={editingItem.minStock ?? 1}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, minStock: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Lokasi Simpan</label>
                <select
                  value={editingItem.location}
                  onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  {store.masterData.locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Keterangan</label>
                <input
                  type="text"
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <label className="block font-semibold">Foto Item / Dokumentasi (Opsional)</label>
                {editingItem.photoUrl ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]">
                    <img
                      src={editingItem.photoUrl}
                      alt={editingItem.itemName || 'Pratinjau foto item'}
                      className="w-24 h-24 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 bg-white shrink-0"
                    />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Foto siap disimpan · akan tampil di kolom Foto (Tabel) &amp; kartu Grid
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-[11px] font-semibold cursor-pointer hover:border-[#E60012]">
                          <Upload className="w-3.5 h-3.5" />
                          Ganti Foto
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, photoUrl: undefined })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-[11px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/70 dark:bg-[#0F1114] hover:border-[#E60012] transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#171A1F] border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-400 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-700 dark:text-neutral-200">
                        Klik untuk unggah foto barang (JPG, PNG, WebP)
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Foto otomatis dikompresi agar ringan dan langsung tampil di tabel &amp; tampilan Grid.
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
              >
                Simpan Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4">
            <h3 className="text-base font-bold">Edit Massal ({selectedIds.length} item)</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Ubah Lokasi Simpan (opsional)</label>
                <select
                  value={bulkLoc}
                  onChange={(e) => setBulkLoc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  <option value="">-- Tidak diubah --</option>
                  {store.masterData.locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Ubah Minimum Stok (opsional)</label>
                <input
                  type="number"
                  min={0}
                  value={bulkMin}
                  onChange={(e) => setBulkMin(e.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkSave}
                className="px-4 py-2 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
              >
                Terapkan Massal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Label Print Modal */}
      {qrModalItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="no-print flex items-center justify-between">
              <h3 className="text-base font-bold">Label QR Item ({qrModalItems.length} label)</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Label
                </button>
                <button type="button" onClick={() => setQrModalItems(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {qrModalItems.map((it) => (
                <div
                  key={it.id}
                  className="p-3 rounded-xl border border-neutral-300 bg-white text-black flex items-center gap-3"
                >
                  <QRCodeSVG
                    value={JSON.stringify({ id: it.id, code: it.codeItem, name: it.itemName })}
                    size={64}
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-mono-num font-bold text-[#E60012]">
                      {it.codeItem || it.id}
                    </div>
                    <div className="font-bold truncate">{it.itemName}</div>
                    <div className="text-[11px] text-neutral-600">
                      {it.location} · Min: {it.minStock} {it.uom}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Impor Master Item dari Excel (.xlsx / .csv)</h3>
              <button type="button" onClick={() => setImportOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFile} className="text-xs" />
            {excelCols.length > 0 && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(colMap) as Array<keyof typeof colMap>).map((field) => (
                    <div key={field}>
                      <label className="block font-semibold mb-1 capitalize">{field}</label>
                      <select
                        value={colMap[field]}
                        onChange={(e) => setColMap({ ...colMap, [field]: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                      >
                        <option value="">-- Abaikan --</option>
                        {excelCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800">
                  <div>
                    Valid siap impor: <strong>{parsedImportValidation.valid.length}</strong> baris ·
                    Error: <strong className="text-red-600">{parsedImportValidation.errors.length}</strong>
                  </div>
                  {parsedImportValidation.errors.slice(0, 3).map((err, i) => (
                    <div key={i} className="text-red-600 mt-1">
                      {err}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setImportOpen(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={parsedImportValidation.valid.length === 0}
                    onClick={handleConfirmImport}
                    className="px-4 py-2 rounded-xl bg-[#E60012] text-white font-semibold disabled:opacity-40"
                  >
                    Impor {parsedImportValidation.valid.length} Item
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox Preview Modal */}
      {previewPhotoItem && previewPhotoItem.photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setPreviewPhotoItem(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
              <div className="min-w-0">
                <div className="text-[11px] font-mono-num text-neutral-500 truncate">
                  {previewPhotoItem.codeItem || 'Tanpa Kode'} · {previewPhotoItem.kategori}
                </div>
                <h3 className="text-sm sm:text-base font-bold truncate">
                  {previewPhotoItem.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoItem(null)}
                aria-label="Tutup pratinjau foto"
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 bg-neutral-100/80 dark:bg-[#0F1114] flex items-center justify-center">
              <img
                src={previewPhotoItem.photoUrl}
                alt={previewPhotoItem.itemName}
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-sm bg-white"
              />
            </div>

            <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-neutral-600 dark:text-neutral-400">
                Stok:{' '}
                <strong className="font-mono-num text-[#1F2328] dark:text-white">
                  {previewPhotoItem.currentStock} {previewPhotoItem.uom}
                </strong>{' '}
                · Lokasi: <strong>{previewPhotoItem.location}</strong>
              </div>
              <div className="flex items-center gap-2">
                {canEditOperational && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = previewPhotoItem;
                      setPreviewPhotoItem(null);
                      setEditingItem(target);
                      setEditModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold hover:border-[#E60012]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Ganti / Ubah Foto
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPhotoItem(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#E60012] text-white font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
