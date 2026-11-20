import React, { useEffect, useState } from 'react';
import {
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSupplyHub } from '../../context/SupplyHubContext';
import { useToast } from '../../context/ToastContext';
import {
  ALLOWED_DOCUMENT_ACCEPT,
  uploadDocumentFile,
} from '../../services/mediaStorageService';
import type {
  DocumentCategory,
  DocumentLinkedModule,
  SystemDocument,
} from '../../types';
import { formatDateTimeIndo, formatPeriodLong } from '../../utils/format';

export const DOCUMENT_CATEGORY_OPTIONS: Array<{
  value: DocumentCategory;
  label: string;
  defaultModule: DocumentLinkedModule;
}> = [
  {
    value: 'LAPORAN_OFFICE_SUPPLIES',
    label: 'Laporan Bulanan — Office Supplies',
    defaultModule: 'REPORTS',
  },
  {
    value: 'LAPORAN_OVERHEAD_GOODS',
    label: 'Laporan Bulanan — Overhead Goods',
    defaultModule: 'REPORTS',
  },
  {
    value: 'LAPORAN_INVENTARIS',
    label: 'Laporan Bulanan — Inventaris Overhead',
    defaultModule: 'REPORTS',
  },
  {
    value: 'ROLLING_FORECAST_GA',
    label: 'Rolling Forecast GA Dept.',
    defaultModule: 'FORECAST',
  },
  {
    value: 'STOCK_OPNAME',
    label: 'Berita Acara / Lampiran Stock Opname',
    defaultModule: 'OPNAME',
  },
  {
    value: 'BUKTI_SERAH_TERIMA',
    label: 'Bukti Serah Terima / Surat Jalan GA',
    defaultModule: 'TRANSACTIONS',
  },
  {
    value: 'SOP_MEMO',
    label: 'SOP Internal HR / Memo Re-organisasi',
    defaultModule: 'GENERAL',
  },
];

export function getDocumentCategoryLabel(cat: DocumentCategory): string {
  return DOCUMENT_CATEGORY_OPTIONS.find((o) => o.value === cat)?.label || cat;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getDocumentKind(doc: Pick<SystemDocument, 'fileType' | 'fileName'>): 'PDF' | 'EXCEL' | 'WORD' | 'IMAGE' | 'OTHER' {
  const mime = (doc.fileType || '').toLowerCase();
  const name = (doc.fileName || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  ) {
    return 'EXCEL';
  }
  if (mime.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) return 'WORD';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/.test(name)) return 'IMAGE';
  return 'OTHER';
}

export function renderDocumentIcon(doc: Pick<SystemDocument, 'fileType' | 'fileName'>, className = 'w-5 h-5') {
  const kind = getDocumentKind(doc);
  if (kind === 'PDF') return <FileText className={`${className} text-red-600`} />;
  if (kind === 'EXCEL') return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  if (kind === 'IMAGE') return <ImageIcon className={`${className} text-blue-600`} />;
  if (kind === 'WORD') return <FileText className={`${className} text-sky-600`} />;
  return <FileIcon className={`${className} text-neutral-500`} />;
}

export function downloadSystemDocument(doc: SystemDocument) {
  const a = document.createElement('a');
  a.href = doc.fileUrl;
  a.download = doc.fileName;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
}

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  editingDoc?: SystemDocument | null;
  defaultCategory?: DocumentCategory;
  defaultPeriod?: string;
  defaultLinkedReportId?: string;
  defaultLinkedModule?: DocumentLinkedModule;
  onUploaded?: (doc: SystemDocument) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  open,
  onClose,
  editingDoc,
  defaultCategory = 'LAPORAN_OFFICE_SUPPLIES',
  defaultPeriod = '2026-10',
  defaultLinkedReportId = '',
  defaultLinkedModule = 'REPORTS',
  onUploaded,
}) => {
  const { user } = useAuth();
  const { store, isSupabaseConnected, addDocument, updateDocument } = useSupplyHub();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [period, setPeriod] = useState(defaultPeriod);
  const [linkedReportId, setLinkedReportId] = useState(defaultLinkedReportId);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingDoc) {
      setTitle(editingDoc.title);
      setCategory(editingDoc.category);
      setPeriod(editingDoc.period);
      setLinkedReportId(editingDoc.linkedReportId || '');
      setNotes(editingDoc.notes || '');
      setSelectedFile(null);
    } else {
      setTitle('');
      setCategory(defaultCategory);
      setPeriod(defaultPeriod);
      setLinkedReportId(defaultLinkedReportId);
      setNotes('');
      setSelectedFile(null);
    }
  }, [open, editingDoc, defaultCategory, defaultPeriod, defaultLinkedReportId]);

  if (!open || !user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!title.trim()) {
      const cleanTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(cleanTitle);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast('Judul dokumen wajib diisi', 'error');
      return;
    }

    const catMeta = DOCUMENT_CATEGORY_OPTIONS.find((o) => o.value === category);
    const resolvedModule: DocumentLinkedModule = linkedReportId
      ? 'REPORTS'
      : catMeta?.defaultModule || defaultLinkedModule;

    if (editingDoc) {
      updateDocument(
        editingDoc.id,
        {
          title: title.trim(),
          category,
          period,
          linkedModule: resolvedModule,
          linkedReportId: linkedReportId || undefined,
          notes: notes.trim(),
        },
        user
      );
      toast('Metadata dokumen diperbarui', 'success');
      onClose();
      return;
    }

    if (!selectedFile) {
      toast('Pilih berkas dokumen terlebih dahulu', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const uploaded = await uploadDocumentFile(selectedFile, category, docId);
      const saved = addDocument(
        {
          id: docId,
          title: title.trim(),
          category,
          period,
          linkedModule: resolvedModule,
          linkedReportId: linkedReportId || undefined,
          fileName: selectedFile.name,
          fileType: uploaded.fileType,
          fileSize: uploaded.fileSize,
          fileUrl: uploaded.fileUrl,
          storagePath: uploaded.storagePath,
          notes: notes.trim(),
        },
        user
      );
      toast(
        uploaded.uploadedToCloud
          ? 'Dokumen diunggah ke Supabase Storage & Database'
          : 'Dokumen berhasil diunggah & disimpan',
        'success',
        `${saved.title} (${formatFileSize(saved.fileSize)})`
      );
      onUploaded?.(saved);
      onClose();
    } catch (err) {
      toast(
        'Gagal mengunggah dokumen',
        'error',
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 text-xs max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#E60012]" />
              {editingDoc ? 'Edit Metadata Dokumen' : 'Unggah Dokumen ke Database'}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isSupabaseConnected
                ? 'Berkas otomatis tersimpan ke Supabase Storage (supplyhub-documents) & tabel system_documents (maks. 15 MB).'
                : 'Mendukung PDF, Excel (.xlsx/.xls/.csv), Word (.docx), dan Scan Gambar — otomatis tersinkron ke Supabase saat terhubung.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Picker (Only on Upload New) */}
        {!editingDoc && (
          <div>
            <label className="block font-semibold mb-1.5">Pilih Berkas Dokumen *</label>
            <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-[#E60012] bg-neutral-50/70 dark:bg-[#0F1114] cursor-pointer transition text-center">
              <Upload className="w-6 h-6 text-[#E60012]" />
              {selectedFile ? (
                <div className="space-y-0.5">
                  <div className="font-bold text-neutral-900 dark:text-white break-all">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold">
                    Siap diunggah · {formatFileSize(selectedFile.size)} (Klik untuk mengganti file)
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="font-semibold text-neutral-700 dark:text-neutral-200">
                    Klik untuk memilih file PDF, Excel, Word, atau Scan Gambar
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Format: .pdf, .xlsx, .xls, .csv, .docx, .doc, .jpg, .png, .webp
                  </div>
                </div>
              )}
              <input
                type="file"
                accept={ALLOWED_DOCUMENT_ACCEPT}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block font-semibold mb-1">Judul Dokumen *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Scan Laporan Office Supplies Sep-26 Bertanda Tangan"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Kategori Dokumen *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            >
              {DOCUMENT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Periode Bulan *</label>
            <input
              type="month"
              required
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold mb-1">
              Tautkan ke Laporan Bulanan (Opsional)
            </label>
            <select
              value={linkedReportId}
              onChange={(e) => setLinkedReportId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            >
              <option value="">-- Tidak ditautkan ke laporan tertentu --</option>
              {store.reports.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.documentId} · {rep.periodLabel} · {rep.title} ({rep.status})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold mb-1">Keterangan / Nomor Referensi</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Scan basah ttd SM & DM HR, atau balasan konfirmasi RF dari GA Dept."
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] disabled:opacity-60 text-white font-semibold"
          >
            <Upload className="w-3.5 h-3.5" />
            {submitting
              ? 'Mengunggah...'
              : editingDoc
              ? 'Simpan Perubahan'
              : 'Unggah & Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface DocumentPreviewModalProps {
  doc: SystemDocument | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ doc, onClose }) => {
  const { store } = useSupplyHub();
  if (!doc) return null;

  const kind = getDocumentKind(doc);
  const linkedReport = doc.linkedReportId
    ? store.reports.find((r) => r.id === doc.linkedReportId)
    : null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {renderDocumentIcon(doc, 'w-5 h-5 shrink-0')}
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">{doc.title}</h3>
              <div className="text-[11px] text-neutral-500 truncate">
                {doc.fileName} · {formatFileSize(doc.fileSize)} · Periode{' '}
                {formatPeriodLong(doc.period)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => downloadSystemDocument(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-neutral-100 dark:bg-[#0F1114] p-4 flex items-center justify-center min-h-[320px]">
          {kind === 'IMAGE' ? (
            <img
              src={doc.fileUrl}
              alt={doc.title}
              className="max-h-[65vh] w-auto object-contain rounded-lg shadow"
            />
          ) : kind === 'PDF' ? (
            <iframe
              src={doc.fileUrl}
              title={doc.title}
              className="w-full h-[65vh] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white"
            />
          ) : (
            <div className="max-w-md text-center space-y-3 p-6 rounded-2xl bg-white dark:bg-[#171A1F] border border-neutral-200 dark:border-neutral-800">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto">
                {renderDocumentIcon(doc, 'w-7 h-7')}
              </div>
              <div className="font-bold text-sm break-all">{doc.fileName}</div>
              <p className="text-xs text-neutral-500">
                Pratinjau langsung tidak tersedia di browser untuk format {kind}. Klik tombol <strong>Unduh</strong> di atas untuk membuka file dengan aplikasi Excel / Word.
              </p>
              <button
                type="button"
                onClick={() => downloadSystemDocument(doc)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E60012] text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Berkas ({formatFileSize(doc.fileSize)})
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#171A1F]">
          <div className="text-neutral-500 space-x-2">
            <span>
              Kategori: <strong className="text-neutral-800 dark:text-neutral-200">{getDocumentCategoryLabel(doc.category)}</strong>
            </span>
            {linkedReport && (
              <span>
                · Laporan: <strong className="text-[#E60012] font-mono-num">{linkedReport.documentId}</strong>
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400">
            Diunggah oleh {doc.uploadedByName} · {formatDateTimeIndo(doc.uploadedAt)}
          </div>
        </div>
      </div>
    </div>
  );
};
