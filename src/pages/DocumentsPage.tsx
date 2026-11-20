import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  Paperclip,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import {
  DOCUMENT_CATEGORY_OPTIONS,
  DocumentPreviewModal,
  DocumentUploadModal,
  downloadSystemDocument,
  formatFileSize,
  getDocumentCategoryLabel,
  renderDocumentIcon,
} from '../components/documents/DocumentModal';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import type { DocumentCategory, SystemDocument } from '../types';
import { formatDateTimeIndo, formatPeriodLong } from '../utils/format';

export const DocumentsPage: React.FC = () => {
  const { user, canEditOperational, isSuperAdmin } = useAuth();
  const { store, deleteDocument } = useSupplyHub();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | DocumentCategory>('ALL');
  const [periodFilter, setPeriodFilter] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SystemDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SystemDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemDocument | null>(null);

  const documents = store.documents || [];

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;
      if (periodFilter && d.period !== periodFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.notes.toLowerCase().includes(q) ||
        d.uploadedByName.toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, documents, periodFilter, search]);

  const stats = useMemo(() => {
    const reportDocs = documents.filter(
      (d) =>
        d.linkedReportId ||
        d.category === 'LAPORAN_OFFICE_SUPPLIES' ||
        d.category === 'LAPORAN_OVERHEAD_GOODS' ||
        d.category === 'LAPORAN_INVENTARIS'
    ).length;
    const forecastDocs = documents.filter((d) => d.category === 'ROLLING_FORECAST_GA').length;
    const opnameHandoverDocs = documents.filter(
      (d) => d.category === 'STOCK_OPNAME' || d.category === 'BUKTI_SERAH_TERIMA'
    ).length;
    return {
      total: documents.length,
      reportDocs,
      forecastDocs,
      opnameHandoverDocs,
    };
  }, [documents]);

  const handleConfirmDelete = () => {
    if (!user || !deleteTarget) return;
    deleteDocument(deleteTarget.id, user);
    toast('Dokumen dihapus dari arsip', 'success', deleteTarget.title);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">
            Arsip &amp; Upload Dokumen Terintegrasi
          </h2>
          <p className="text-xs text-neutral-500">
            Unggah scan laporan A3 bertanda tangan, file Excel/PDF Rolling Forecast GA Dept., berita acara Stock Opname, dan surat jalan langsung ke database &amp; Storage.
          </p>
        </div>

        {canEditOperational && (
          <button
            type="button"
            onClick={() => {
              setEditingDoc(null);
              setUploadOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold shrink-0 transition"
          >
            <Upload className="w-4 h-4" />
            Unggah Dokumen Baru
          </button>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Total Dokumen Arsip</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Dokumen Laporan Bulanan</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1 text-[#E60012]">
            {stats.reportDocs}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Dokumen Rolling Forecast GA</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1 text-emerald-600">
            {stats.forecastDocs}
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F]">
          <div className="text-[11px] font-semibold text-neutral-500">Opname &amp; Serah Terima</div>
          <div className="text-2xl font-extrabold font-mono-num mt-1 text-amber-600">
            {stats.opnameHandoverDocs}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul dokumen, nama berkas, catatan, atau pengunggah..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | DocumentCategory)}
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
        >
          <option value="ALL">Semua Kategori Dokumen</option>
          {DOCUMENT_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="month"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="flex-1 sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
          />
          {periodFilter && (
            <button
              type="button"
              onClick={() => setPeriodFilter('')}
              className="px-2.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <EmptyState
          title={
            documents.length === 0
              ? 'Belum ada dokumen yang diunggah'
              : 'Dokumen tidak ditemukan'
          }
          description={
            documents.length === 0
              ? 'Mulai unggah scan PDF laporan bulanan bertanda tangan, file Excel Rolling Forecast GA Dept., atau bukti serah terima barang agar tersimpan terpusat di database.'
              : 'Ubah kata kunci pencarian, kategori, atau filter periode bulan.'
          }
          actionLabel={canEditOperational ? 'Unggah Dokumen Pertama' : undefined}
          onAction={
            canEditOperational
              ? () => {
                  setEditingDoc(null);
                  setUploadOpen(true);
                }
              : undefined
          }
          icon={<FolderOpen className="w-6 h-6" />}
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-left text-neutral-500">
                  <th className="p-3 font-semibold">Dokumen &amp; Berkas</th>
                  <th className="p-3 font-semibold">Kategori</th>
                  <th className="p-3 font-semibold">Periode</th>
                  <th className="p-3 font-semibold">Tautan Laporan</th>
                  <th className="p-3 font-semibold">Diunggah Oleh</th>
                  <th className="p-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredDocs.map((doc) => {
                  const linkedReport = doc.linkedReportId
                    ? store.reports.find((r) => r.id === doc.linkedReportId)
                    : null;
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30"
                    >
                      <td className="p-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                            {renderDocumentIcon(doc, 'w-4 h-4')}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="font-bold text-left hover:text-[#E60012] transition line-clamp-1"
                            >
                              {doc.title}
                            </button>
                            <div className="text-[11px] text-neutral-500 font-mono-num truncate max-w-[280px]">
                              {doc.fileName} · {formatFileSize(doc.fileSize)}
                            </div>
                            {doc.notes && (
                              <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                                {doc.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-200">
                          <Paperclip className="w-3 h-3 text-[#E60012]" />
                          {getDocumentCategoryLabel(doc.category)}
                        </span>
                      </td>
                      <td className="p-3 font-mono-num whitespace-nowrap">
                        {formatPeriodLong(doc.period)}
                      </td>
                      <td className="p-3">
                        {linkedReport ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/app/reports?reportId=${linkedReport.id}`)}
                            className="inline-flex items-center gap-1 text-[#E60012] hover:underline font-mono-num font-semibold"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            {linkedReport.documentId}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium">{doc.uploadedByName}</div>
                        <div className="text-[11px] text-neutral-400 font-mono-num">
                          {formatDateTimeIndo(doc.uploadedAt)}
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            title="Pratinjau Dokumen"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#E60012]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSystemDocument(doc)}
                            title="Unduh Dokumen"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {canEditOperational && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDoc(doc);
                                setUploadOpen(true);
                              }}
                              title="Edit Metadata / Tautan Laporan"
                              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(isSuperAdmin || doc.uploadedByUserId === user?.id) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(doc)}
                              title="Hapus Dokumen"
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* Upload / Edit Modal */}
      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setEditingDoc(null);
        }}
        editingDoc={editingDoc}
      />

      {/* Preview Modal */}
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-base font-bold text-red-600">Hapus Dokumen Arsip?</h3>
            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Dokumen <strong>{deleteTarget.title}</strong> ({deleteTarget.fileName}) akan dihapus dari database dan penyimpanan arsip. Tindakan ini dicatat di Audit Log.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Hapus Dokumen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
