import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  History,
  Lock,
  Paperclip,
  Plus,
  Printer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ReportStepper } from '../components/common/ReportStepper';
import {
  DocumentPreviewModal,
  DocumentUploadModal,
  downloadSystemDocument,
  formatFileSize,
  renderDocumentIcon,
} from '../components/documents/DocumentModal';
import { A3ReportDocument } from '../components/reports/A3ReportDocument';
import { SignatureModal } from '../components/signatures/SignatureModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import type { DocumentCategory, ReportCheckRow, ReportType, SignatureSlot, SystemDocument } from '../types';
import { exportElementToA3Pdf, exportReportToExcel } from '../utils/exportUtils';
import { formatDateTimeIndo, formatPeriodLong, getNextPeriod } from '../utils/format';

export const ReportsPage: React.FC = () => {
  const { user, canEditOperational, isSuperAdmin, verifyPassword } = useAuth();
  const { language, tr } = useLanguage();
  const {
    store,
    createMonthlyReport,
    updateReportPlaceDate,
    updateReportCheckRow,
    duplicateReportToNextMonth,
    signReportSlot,
    updateUserSavedSignature,
    deleteDocument,
    logAction,
  } = useSupplyHub();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [selectedReportId, setSelectedReportId] = useState<string>(
    searchParams.get('reportId') ||
      store.reports.find((r) => r.id === 'rep-os-2026-09')?.id ||
      store.reports[0]?.id ||
      ''
  );

  useEffect(() => {
    const paramId = searchParams.get('reportId');
    if (paramId && store.reports.some((r) => r.id === paramId)) {
      setSelectedReportId(paramId);
    }
  }, [searchParams, store.reports]);

  const [editMode, setEditMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<SystemDocument | null>(null);
  const [newJenis, setNewJenis] = useState<ReportType>('OFFICE_SUPPLIES');
  const [newPeriod, setNewPeriod] = useState('2026-10');
  const [newPlaceDate, setNewPlaceDate] = useState('Mojokerto, 05 November 2026');
  const [newTplId, setNewTplId] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Confirm reset signatures dialog when editing after signing
  const [pendingRowEdit, setPendingRowEdit] = useState<{
    itemId: string;
    patch: Partial<Pick<ReportCheckRow, 'stokAwal' | 'terima' | 'pakai' | 'minStock' | 'notes'>>;
  } | null>(null);

  // Signing modal
  const [signTarget, setSignTarget] = useState<{ groupId: string; slot: SignatureSlot; groupLabel: string } | null>(
    null
  );

  const reportRef = useRef<HTMLDivElement | null>(null);

  const report = useMemo(
    () => store.reports.find((r) => r.id === selectedReportId) || store.reports[0] || null,
    [selectedReportId, store.reports]
  );

  const instructions = useMemo(() => {
    if (!report) return store.settings.instructionsCheck;
    return report.jenis === 'INVENTARIS_OVERHEAD'
      ? store.settings.instructionsInventory
      : store.settings.instructionsCheck;
  }, [report, store.settings]);

  const attachedDocuments = useMemo(() => {
    if (!report) return [];
    return (store.documents || []).filter((d) => d.linkedReportId === report.id);
  }, [report, store.documents]);

  const defaultDocCategory: DocumentCategory = useMemo(() => {
    if (!report) return 'LAPORAN_OFFICE_SUPPLIES';
    if (report.jenis === 'OVERHEAD_GOODS') return 'LAPORAN_OVERHEAD_GOODS';
    if (report.jenis === 'INVENTARIS_OVERHEAD') return 'LAPORAN_INVENTARIS';
    return 'LAPORAN_OFFICE_SUPPLIES';
  }, [report]);

  const handlePrintA3 = () => {
    if (report && user) {
      logAction({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'EXPORT',
        objectType: 'Cetak Laporan A3',
        objectLabel: report.documentId,
      });
    }
    window.print();
  };

  const handleExportPdf = async () => {
    if (!reportRef.current || !report) return;
    try {
      setExportingPdf(true);
      await exportElementToA3Pdf(
        reportRef.current,
        `${report.documentId}_${report.period}.pdf`
      );
      if (user) {
        logAction({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'EXPORT',
          objectType: 'Ekspor PDF A3',
          objectLabel: report.documentId,
        });
      }
      toast(tr('PDF A3 Landscape berhasil diunduh', 'A3 Landscape PDF downloaded'), 'success');
    } catch {
      toast(tr('Gagal mengekspor PDF', 'Failed to export PDF'), 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!report) return;
    exportReportToExcel(report);
    if (user) {
      logAction({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'EXPORT',
        objectType: 'Ekspor Excel Laporan',
        objectLabel: report.documentId,
      });
    }
    toast(tr('Laporan Excel berhasil diunduh', 'Excel report downloaded'), 'success');
  };

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const created = createMonthlyReport(
      newJenis,
      newPeriod,
      newPlaceDate,
      newTplId || undefined,
      user
    );
    setSelectedReportId(created.id);
    setCreateOpen(false);
    toast(
      tr('Laporan bulanan baru dibuat', 'New monthly report created'),
      'success',
      tr(
        'Stok Awal otomatis disinkronkan dari laporan Final periode sebelumnya.',
        'Opening stock is automatically synced from the previous period Final report.'
      )
    );
  };

  const handleDuplicateNext = () => {
    if (!user || !report) return;
    const nextRep = duplicateReportToNextMonth(report.id, user);
    if (nextRep) {
      setSelectedReportId(nextRep.id);
      toast(
        tr(
          `Laporan diduplikasi ke ${formatPeriodLong(getNextPeriod(report.period), language)}`,
          `Report duplicated to ${formatPeriodLong(getNextPeriod(report.period), language)}`
        ),
        'success',
        tr(
          'Stock Akhir periode ini otomatis menjadi Stok Awal periode berikutnya.',
          'Closing stock from this period automatically becomes Opening stock for next period.'
        )
      );
    }
  };

  const handleEditRow = (
    itemId: string,
    patch: Partial<Pick<ReportCheckRow, 'stokAwal' | 'terima' | 'pakai' | 'minStock' | 'notes'>>
  ) => {
    if (!user || !report) return;
    const res = updateReportCheckRow(report.id, itemId, patch, user, false);
    if (res.requiresSignatureResetConfirm) {
      setPendingRowEdit({ itemId, patch });
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls Bar (hidden on print) */}
      <div className="no-print space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold font-display">
              {tr('Laporan Bulanan Standar A3', 'Standard A3 Monthly Reports')}
            </h2>
            <p className="text-xs text-neutral-500">
              {tr(
                'Format resmi PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory lengkap dengan merge kategori, tanda tangan digital, dan QR verifikasi.',
                'Official PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory format with merged categories, digital signatures, and verification QR.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditOperational && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                {tr('Buat Laporan Baru', 'Create New Report')}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrintA3}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50"
            >
              <Printer className="w-3.5 h-3.5" />
              {tr('Cetak A3', 'Print A3')}
            </button>
            <button
              type="button"
              disabled={exportingPdf || !report}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingPdf ? tr('Memproses PDF...', 'Processing PDF...') : tr('Ekspor PDF A3', 'Export A3 PDF')}
            </button>
            <button
              type="button"
              disabled={!report}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold hover:bg-neutral-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {tr('Ekspor Excel', 'Export Excel')}
            </button>
          </div>
        </div>

        {/* Report Selector & Tools */}
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              <select
                value={report?.id || ''}
                onChange={(e) => {
                  setSelectedReportId(e.target.value);
                  setEditMode(false);
                }}
                className="w-full sm:w-auto sm:min-w-[260px] max-w-full min-w-0 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs font-semibold"
              >
                {store.reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.periodLabel} · {r.title} ({r.status})
                  </option>
                ))}
              </select>

              {report?.locked && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Lock className="w-3.5 h-3.5" />
                  {tr('Final & Terkunci (Snapshot)', 'Final & Locked (Snapshot)')}
                </span>
              )}
            </div>

            {report && (
              <div className="flex flex-wrap items-center gap-2">
                {canEditOperational && !report.locked && report.jenis !== 'INVENTARIS_OVERHEAD' && (
                  <button
                    type="button"
                    onClick={() => setEditMode((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                      editMode
                        ? 'border-theme-primary bg-theme-primary-soft text-theme-primary'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {editMode ? tr('Selesai Ubah Data', 'Done Editing') : tr('Ubah Angka Laporan', 'Edit Report Numbers')}
                  </button>
                )}
                {canEditOperational && (
                  <button
                    type="button"
                    onClick={handleDuplicateNext}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {tr('Duplikat ke Bulan Berikutnya', 'Duplicate to Next Month')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <History className="w-3.5 h-3.5" />
                  {tr('Riwayat Versi', 'Version History')} ({report.versions.length})
                </button>
              </div>
            )}
          </div>

          {report && <ReportStepper report={report} />}

          {/* Lampiran Dokumen Laporan */}
          {report && (
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200">
                  <Paperclip className="w-3.5 h-3.5 text-theme-primary" />
                  {tr('Lampiran Dokumen Laporan', 'Report Document Attachments')} ({attachedDocuments.length})
                  <span className="font-normal text-[11px] text-neutral-500">
                    — {tr('Scan PDF bertanda tangan, file Excel, atau bukti pendukung', 'Signed PDF scans, Excel files, or supporting evidence')}
                  </span>
                </div>
                {canEditOperational && (
                  <button
                    type="button"
                    onClick={() => setUploadDocOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-theme-primary bg-theme-primary-soft text-theme-primary font-semibold transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {tr('Unggah Dokumen Laporan', 'Upload Report Document')}
                  </button>
                )}
              </div>

              {attachedDocuments.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {attachedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0F1114]"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="flex items-center gap-2 min-w-0 text-left flex-1 group"
                      >
                        {renderDocumentIcon(doc, 'w-4 h-4 shrink-0')}
                        <div className="min-w-0">
                          <div className="font-semibold truncate group-hover:text-theme-primary transition">
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono-num truncate">
                            {doc.fileName} · {formatFileSize(doc.fileSize)}
                          </div>
                        </div>
                      </button>
                      <div className="inline-flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          title={tr('Pratinjau', 'Preview')}
                          className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-800 text-theme-primary"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSystemDocument(doc)}
                          title={tr('Unduh', 'Download')}
                          className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-800"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {(isSuperAdmin || doc.uploadedByUserId === user?.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!user) return;
                              deleteDocument(doc.id, user);
                              toast(tr('Lampiran dokumen dihapus', 'Document attachment removed'), 'success');
                            }}
                            title={tr('Hapus Lampiran', 'Remove Attachment')}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Report Document A3 Canvas */}
      {!report ? (
        <EmptyState
          title={tr('Belum ada laporan bulanan', 'No monthly reports yet')}
          description={tr(
            'Buat laporan baru untuk Office Supplies, Overhead Goods, atau Inventaris Overhead.',
            'Create a new report for Office Supplies, Overhead Goods, or Overhead Inventory.'
          )}
          actionLabel={canEditOperational ? tr('Buat Laporan Baru', 'Create New Report') : undefined}
          onAction={canEditOperational ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="print-only-container overflow-x-auto pb-4">
          <div ref={reportRef}>
            <A3ReportDocument
              report={report}
              instructions={instructions}
              logoUrl={store.settings.logoUrl}
              editable={editMode}
              currentUserId={user?.id}
              isSuperAdmin={isSuperAdmin}
              onEditCheckRow={handleEditRow}
              onEditPlaceDate={(val) => user && updateReportPlaceDate(report.id, val, user)}
              onClickSignSlot={(groupId, slot) => {
                const grp = report.signatureGroups.find((g) => g.id === groupId);
                setSignTarget({ groupId, slot, groupLabel: grp?.label || '' });
              }}
            />
          </div>
        </div>
      )}

      {/* Modal: Create Report */}
      {createOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <form
            onSubmit={handleCreateReport}
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {tr('Buat Laporan Bulanan Baru', 'Create New Monthly Report')}
              </h3>
              <button type="button" onClick={() => setCreateOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block font-semibold mb-1">{tr('Jenis Laporan', 'Report Type')}</label>
              <select
                value={newJenis}
                onChange={(e) => setNewJenis(e.target.value as ReportType)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              >
                <option value="OFFICE_SUPPLIES">
                  {tr('List Pengechekan Office Supplies', 'Office Supplies Stock Check List')}
                </option>
                <option value="OVERHEAD_GOODS">
                  {tr('List Pengechekan Overhead Goods', 'Overhead Goods Stock Check List')}
                </option>
                <option value="INVENTARIS_OVERHEAD">
                  {tr('List Inventaris Overhead', 'Overhead Inventory List')}
                </option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">{tr('Periode Bulan', 'Month Period')}</label>
              <input
                type="month"
                required
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] font-mono-num"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                {tr('Tempat & Tanggal Tanda Tangan', 'Signature Place & Date')}
              </label>
              <input
                type="text"
                required
                value={newPlaceDate}
                onChange={(e) => setNewPlaceDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">{tr('Template Tanda Tangan', 'Signature Template')}</label>
              <select
                value={newTplId}
                onChange={(e) => setNewTplId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
              >
                <option value="">{tr('Template Bawaan Sesuai Jenis', 'Default Template by Type')}</option>
                {store.templates
                  .filter((t) => t.jenis === newJenis)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white font-semibold"
              >
                {tr('Buat Draf Laporan', 'Create Report Draft')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Version History */}
      {historyOpen && report && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {tr('Riwayat Versi & Penolakan', 'Version & Rejection History')}
              </h3>
              <button type="button" onClick={() => setHistoryOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
              {report.versions.map((v) => (
                <div
                  key={v.version}
                  className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{tr('Revisi', 'Revision')} {v.version}</span>
                    <span className="font-mono-num text-neutral-500">
                      {formatDateTimeIndo(v.savedAt, language)}
                    </span>
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-400 mt-1">
                    {tr('Oleh', 'By')} {v.savedBy}: {v.note}
                  </div>
                </div>
              ))}
              {report.rejectionHistory.length > 0 && (
                <div className="pt-2">
                  <div className="font-bold text-red-600 mb-1.5">
                    {tr('Riwayat Penolakan:', 'Rejection History:')}
                  </div>
                  {report.rejectionHistory.map((rj, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs"
                    >
                      <strong>{rj.byName}</strong> ({rj.stage}): {rj.note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Signature Reset on Edit */}
      {pendingRowEdit && report && user && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h3 className="text-base font-bold">
                  {tr('Konfirmasi Reset Tanda Tangan', 'Confirm Signature Reset')}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">
                  {tr(
                    'Laporan ini sudah memiliki tanda tangan digital. Mengubah data angka akan mengembalikan status ke Draft dan mereset seluruh tanda tangan yang sudah masuk. Lanjutkan?',
                    'This report already has digital signatures. Editing numbers will revert its status to Draft and reset all collected signatures. Continue?'
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRowEdit(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
              >
                {tr('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  updateReportCheckRow(report.id, pendingRowEdit.itemId, pendingRowEdit.patch, user, true);
                  setPendingRowEdit(null);
                  toast(
                    tr('Data diperbarui & tanda tangan direset ke Draft', 'Data updated & signatures reset to Draft'),
                    'warning'
                  );
                }}
                className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white text-xs font-semibold"
              >
                {tr('Ya, Ubah & Reset TTD', 'Yes, Edit & Reset Signatures')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signing Modal */}
      {user && report && (
        <SignatureModal
          open={Boolean(signTarget)}
          onClose={() => setSignTarget(null)}
          slot={signTarget?.slot || null}
          groupLabel={signTarget?.groupLabel || ''}
          currentUser={user}
          verifyPassword={verifyPassword}
          onConfirmSign={(dataUrl, saveToProfile) => {
            if (!signTarget) return;
            if (saveToProfile) {
              updateUserSavedSignature(user.id, dataUrl, user);
            }
            const res = signReportSlot(
              report.id,
              signTarget.groupId,
              signTarget.slot.id,
              dataUrl,
              user
            );
            if (!res.ok) {
              toast(tr('Gagal menandatangani', 'Signing failed'), 'error', res.error);
              return;
            }
            setSignTarget(null);
            toast(tr('Tanda tangan digital berhasil dibubuhkan', 'Digital signature applied successfully'), 'success');
          }}
        />
      )}
      {/* Upload & Preview Modals for Report Attachments */}
      {report && (
        <DocumentUploadModal
          open={uploadDocOpen}
          onClose={() => setUploadDocOpen(false)}
          defaultCategory={defaultDocCategory}
          defaultPeriod={report.period}
          defaultLinkedReportId={report.id}
          defaultLinkedModule="REPORTS"
        />
      )}
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
};
