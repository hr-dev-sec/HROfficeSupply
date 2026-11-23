import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, FileCheck2, ShieldAlert } from 'lucide-react';
import { AppearanceControls } from '../components/common/AppearanceControls';
import { AjiuLogoBadge, HseLogoBadge } from '../components/common/BrandEmblems';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { formatDateTimeIndo, getStageLabel } from '../utils/format';

export const VerifyReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { store } = useSupplyHub();
  const { language, tr } = useLanguage();

  const report = store.reports.find((r) => r.documentId === id || r.id === id);

  return (
    <div className="min-h-screen bg-theme-canvas text-[#1F2328] dark:text-[#F1F3F5] py-8 sm:py-10 px-4 sm:px-6 lg:px-10 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <img
                src="/logo-ajinomoto.png"
                alt="Ajinomoto"
                className="h-9 w-auto bg-white rounded-lg p-1"
              />
              <AjiuLogoBadge size="sm" />
              <HseLogoBadge size="sm" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                {tr(
                  'Portal Verifikasi Keaslian Dokumen · HR SupplyHub',
                  'Document Authenticity Verification Portal · HR SupplyHub'
                )}
              </div>
              <h1 className="text-sm sm:text-base font-extrabold font-display leading-snug">
                PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AppearanceControls compact />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-white dark:hover:bg-neutral-800 whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              {tr('Beranda', 'Home')}
            </Link>
          </div>
        </div>

        {!report ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-[#171A1F] p-8 text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-lg font-bold">
              {tr('Dokumen Tidak Ditemukan', 'Document Not Found')}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {tr('ID dokumen', 'Document ID')}{' '}
              <span className="font-mono-num font-semibold">{id}</span>{' '}
              {tr(
                'tidak terdaftar dalam catatan resmi HR SupplyHub.',
                'is not registered in official HR SupplyHub records.'
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    report.status === 'FINAL'
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {report.status === 'FINAL' ? (
                    <FileCheck2 className="w-6 h-6" />
                  ) : (
                    <Clock className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {report.status === 'FINAL'
                      ? tr(
                          'DOKUMEN TERVERIFIKASI RESMI & TERKUNCI',
                          'OFFICIALLY VERIFIED & LOCKED DOCUMENT'
                        )
                      : `${tr('STATUS DOKUMEN', 'DOCUMENT STATUS')}: ${getStageLabel(
                          report.status,
                          language
                        ).toUpperCase()}`}
                  </div>
                  <h2 className="text-lg font-extrabold font-display mt-0.5">{report.title}</h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    {report.department} · {report.section}
                  </p>
                </div>
              </div>
              <div className="text-right font-mono-num text-xs space-y-1">
                <div className="font-bold">{report.documentId}</div>
                <div className="text-neutral-500">{report.docHash}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-neutral-500">{tr('Periode Laporan', 'Report Period')}</div>
                <div className="font-bold text-sm mt-1">{report.periodLabel}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-neutral-500">
                  {tr('Tempat & Tanggal Pengesahan', 'Place & Approval Date')}
                </div>
                <div className="font-bold text-sm mt-1">{report.placeDateText}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/70 dark:border-neutral-800">
                <div className="text-neutral-500">{tr('Versi Dokumen', 'Document Version')}</div>
                <div className="font-bold text-sm mt-1 font-mono-num">Rev. {report.version}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold">
                {tr('Daftar Penanda Tangan Digital', 'Digital Signatories')}
              </h3>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                {report.signatureGroups.flatMap((g) =>
                  g.slots.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs bg-white dark:bg-[#171A1F]"
                    >
                      <div>
                        <span className="text-neutral-500 mr-2">{g.label.replace(',', '')}:</span>
                        <span className="font-bold">{s.name}</span>
                        <span className="text-neutral-500 ml-2">({s.jabatan})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === 'SIGNED' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold font-mono-num">
                            <CheckCircle2 className="w-4 h-4" />
                            {tr('Sah', 'Valid')} · {formatDateTimeIndo(s.signedAt || '', language)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                            <Clock className="w-4 h-4" />
                            {tr('Menunggu TTD', 'Awaiting Signature')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
