import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import { exportRowsToExcel } from '../utils/exportUtils';
import { formatDateTimeIndo, getRoleLabel } from '../utils/format';

export const AuditLogPage: React.FC = () => {
  const { store } = useSupplyHub();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.auditLogs.filter((log) => {
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
      if (userFilter !== 'ALL' && log.userId !== userFilter) return false;
      if (q) {
        return (
          log.userName.toLowerCase().includes(q) ||
          log.objectType.toLowerCase().includes(q) ||
          log.objectLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [actionFilter, search, store.auditLogs, userFilter]);

  const handleExport = () => {
    exportRowsToExcel(
      filtered.map((l) => ({
        Waktu: formatDateTimeIndo(l.timestamp),
        Pengguna: l.userName,
        Peran: getRoleLabel(l.userRole),
        Aksi: l.action,
        Objek: l.objectType,
        Detail: l.objectLabel,
        'Nilai Lama': l.oldValue || '-',
        'Nilai Baru': l.newValue || '-',
      })),
      'Audit Log',
      'Audit_Log_HR_SupplyHub.xlsx'
    );
    toast('Audit log diekspor ke Excel', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">Audit Log Sistem</h2>
          <p className="text-xs text-neutral-500">
            Catatan kronologis setiap perubahan data, persetujuan, tanda tangan, dan ekspor laporan.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold"
        >
          <Download className="w-4 h-4" />
          Ekspor Audit Excel
        </button>
      </div>

      <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 w-full sm:min-w-[200px] min-w-0">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pengguna, objek, atau detail..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
        >
          <option value="ALL">Semua Aksi</option>
          {['LOGIN', 'CREATE', 'UPDATE', 'SIGN', 'REJECT', 'APPROVE', 'EXPORT', 'IMPORT', 'RESET'].map(
            (a) => (
              <option key={a} value={a}>
                {a}
              </option>
            )
          )}
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
        >
          <option value="ALL">Semua Pengguna</option>
          {store.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada entri audit" description="Ubah filter untuk melihat catatan aktivitas." />
      ) : (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-left text-neutral-500">
                  <th className="p-3 font-semibold">Waktu</th>
                  <th className="p-3 font-semibold">Pengguna</th>
                  <th className="p-3 font-semibold">Aksi</th>
                  <th className="p-3 font-semibold">Objek</th>
                  <th className="p-3 font-semibold">Nilai Lama → Baru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-mono-num whitespace-nowrap">
                      {formatDateTimeIndo(log.timestamp)}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{log.userName}</div>
                      <div className="text-[11px] text-neutral-500">{getRoleLabel(log.userRole)}</div>
                    </td>
                    <td className="p-3 font-mono-num font-bold text-[#E60012]">{log.action}</td>
                    <td className="p-3">
                      <div className="font-semibold">{log.objectType}</div>
                      <div className="text-neutral-500">{log.objectLabel}</div>
                    </td>
                    <td className="p-3 text-neutral-600 dark:text-neutral-400">
                      {log.oldValue ? `${log.oldValue} → ` : ''}
                      {log.newValue || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
