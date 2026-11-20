import React from 'react';
import { Check, Clock } from 'lucide-react';
import type { MonthlyReport, WorkflowStage } from '../../types';
import { formatDateTimeIndo } from '../../utils/format';

interface ReportStepperProps {
  report: MonthlyReport;
}

const STAGES: Array<{ key: WorkflowStage; label: string }> = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'DILAPORKAN', label: 'Dilaporkan' },
  { key: 'DICHECK', label: 'Dicheck' },
  { key: 'MENGETAHUI', label: 'Mengetahui' },
  { key: 'FINAL', label: 'Final' },
];

export const ReportStepper: React.FC<ReportStepperProps> = ({ report }) => {
  const dilGroup = report.signatureGroups.find((g) => g.stage === 'DILAPORKAN');
  const dicGroup = report.signatureGroups.find((g) => g.stage === 'DICHECK');
  const menGroup = report.signatureGroups.find((g) => g.stage === 'MENGETAHUI');

  const dilDone = Boolean(dilGroup && dilGroup.slots.every((s) => s.status === 'SIGNED'));
  const dicDone = Boolean(dicGroup && dicGroup.slots.every((s) => s.status === 'SIGNED'));
  const menDone = Boolean(menGroup && menGroup.slots.every((s) => s.status === 'SIGNED'));
  const isFinal = report.status === 'FINAL';

  const getStepMeta = (key: WorkflowStage) => {
    if (key === 'DRAFT') {
      return {
        done: true,
        active: report.status === 'DRAFT',
        names: report.versions[0]?.savedBy || 'Staff HR',
        sub: formatDateTimeIndo(report.createdAt),
      };
    }
    if (key === 'DILAPORKAN') {
      const names = dilGroup?.slots.map((s) => s.name).join(', ') || 'PIC HR';
      const signedAt = dilGroup?.slots.find((s) => s.signedAt)?.signedAt;
      return {
        done: dilDone,
        active: report.status === 'DRAFT' || report.status === 'DILAPORKAN',
        names,
        sub: dilDone && signedAt ? formatDateTimeIndo(signedAt) : 'Menunggu PIC',
      };
    }
    if (key === 'DICHECK') {
      const names = dicGroup?.slots.map((s) => s.name).join(' & ') || 'Section Manager';
      const signedCount = dicGroup?.slots.filter((s) => s.status === 'SIGNED').length || 0;
      const totalCount = dicGroup?.slots.length || 0;
      return {
        done: dicDone,
        active: report.status === 'DICHECK',
        names,
        sub: dicDone ? 'Lengkap disetujui' : `${signedCount}/${totalCount} tanda tangan`,
      };
    }
    if (key === 'MENGETAHUI') {
      const names = menGroup?.slots.map((s) => s.name).join(', ') || 'Dept. Manager';
      const signedAt = menGroup?.slots.find((s) => s.signedAt)?.signedAt;
      return {
        done: menDone,
        active: report.status === 'MENGETAHUI',
        names,
        sub: menDone && signedAt ? formatDateTimeIndo(signedAt) : 'Menunggu DM HR',
      };
    }
    return {
      done: isFinal,
      active: isFinal,
      names: 'Arsip HR Dept',
      sub: isFinal ? 'Terkunci & Terverifikasi' : 'Belum Final',
    };
  };

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="min-w-[640px] grid grid-cols-5 gap-3">
        {STAGES.map((stage, idx) => {
          const meta = getStepMeta(stage.key);
          return (
            <div key={stage.key} className="relative flex flex-col">
              {idx < STAGES.length - 1 && (
                <div
                  className={`hidden sm:block absolute top-4 left-[56%] right-[-44%] h-[2px] ${
                    meta.done
                      ? 'bg-emerald-500/70'
                      : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}
                />
              )}
              <div className="flex items-center gap-2.5 z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-semibold transition-colors ${
                    meta.done
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : meta.active
                      ? 'bg-[#E60012]/10 border-[#E60012] text-[#E60012]'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-500'
                  }`}
                >
                  {meta.done ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    meta.done
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : meta.active
                      ? 'text-[#E60012]'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              <div className="mt-2 pl-1">
                <p className="text-xs font-medium text-[#1F2328] dark:text-neutral-200 truncate" title={meta.names}>
                  {meta.names}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {meta.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
