import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  GripVertical,
  PenTool,
  Plus,
  Save,
  Settings2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ReportStepper } from '../components/common/ReportStepper';
import { SignatureModal } from '../components/signatures/SignatureModal';
import { useAuth } from '../context/AuthContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useToast } from '../context/ToastContext';
import type { ReportType, SignatureSlot, SignatureTemplate } from '../types';
import { formatDateTimeIndo } from '../utils/format';

export const SignaturesPage: React.FC = () => {
  const { user, isSuperAdmin, verifyPassword } = useAuth();
  const {
    store,
    signReportSlot,
    rejectReport,
    sendReminderNotification,
    updateUserSavedSignature,
    upsertSignatureTemplate,
    applyTemplateToReport,
  } = useSupplyHub();
  const { toast } = useToast();

  const [tab, setTab] = useState<'QUEUE' | 'TEMPLATES'>('QUEUE');
  const [signModal, setSignModal] = useState<{
    reportId: string;
    groupId: string;
    groupLabel: string;
    slot: SignatureSlot;
  } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ reportId: string; title: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Template Builder State (Super Admin)
  const [editingTplId, setEditingTplId] = useState<string>(store.templates[0]?.id || '');
  const activeTemplate = useMemo(
    () => store.templates.find((t) => t.id === editingTplId) || store.templates[0],
    [editingTplId, store.templates]
  );
  const [draftTpl, setDraftTpl] = useState<SignatureTemplate>(() =>
    JSON.parse(JSON.stringify(activeTemplate))
  );

  const selectTemplateForEdit = (tplId: string) => {
    const found = store.templates.find((t) => t.id === tplId);
    if (!found) return;
    setEditingTplId(tplId);
    setDraftTpl(JSON.parse(JSON.stringify(found)));
  };

  const handleCreateNewTemplate = () => {
    const fresh: SignatureTemplate = {
      id: `tpl-${Date.now()}`,
      name: 'Template Kustom Baru',
      jenis: 'OFFICE_SUPPLIES',
      isDefault: false,
      groups: JSON.parse(JSON.stringify(store.templates[0].groups)),
    };
    setDraftTpl(fresh);
    setEditingTplId(fresh.id);
  };

  const pendingMyQueue = useMemo(() => {
    if (!user) return [];
    const results: Array<{
      reportId: string;
      documentId: string;
      reportTitle: string;
      periodLabel: string;
      groupId: string;
      groupLabel: string;
      slot: SignatureSlot;
    }> = [];

    store.reports
      .filter((r) => !r.locked)
      .forEach((rep) => {
        const dilGroup = rep.signatureGroups.find((g) => g.stage === 'DILAPORKAN');
        const dicGroup = rep.signatureGroups.find((g) => g.stage === 'DICHECK');
        const dilDone = !dilGroup || dilGroup.slots.every((s) => s.status === 'SIGNED');
        const dicDone = !dicGroup || dicGroup.slots.every((s) => s.status === 'SIGNED');

        rep.signatureGroups.forEach((g) => {
          const ready =
            g.stage === 'DILAPORKAN' ||
            (g.stage === 'DICHECK' && dilDone) ||
            (g.stage === 'MENGETAHUI' && dilDone && dicDone);
          if (!ready) return;

          g.slots.forEach((s) => {
            if (s.status === 'PENDING' && (isSuperAdmin || s.allowedUserId === user.id)) {
              results.push({
                reportId: rep.id,
                documentId: rep.documentId,
                reportTitle: rep.title,
                periodLabel: rep.periodLabel,
                groupId: g.id,
                groupLabel: g.label,
                slot: s,
              });
            }
          });
        });
      });

    return results;
  }, [isSuperAdmin, store.reports, user]);

  // Drag reorder helpers for template slots
  const moveSlot = (groupIdx: number, slotIdx: number, dir: -1 | 1) => {
    setDraftTpl((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as SignatureTemplate;
      const slots = next.groups[groupIdx].slots;
      const target = slotIdx + dir;
      if (target < 0 || target >= slots.length) return prev;
      const [moved] = slots.splice(slotIdx, 1);
      slots.splice(target, 0, moved);
      slots.forEach((s, i) => (s.order = i + 1));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold font-display">Tanda Tangan Digital &amp; Template</h2>
          <p className="text-xs text-neutral-500">
            Kelola antrean pengesahan berjenjang (Dilaporkan · Dicheck · Mengetahui) serta konfigurasi slot tanda tangan.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setTab('QUEUE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'QUEUE' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
            }`}
          >
            Antrean &amp; Alur ({pendingMyQueue.length})
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setTab('TEMPLATES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                tab === 'TEMPLATES' ? 'bg-white dark:bg-[#171A1F] shadow-sm' : 'text-neutral-500'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Template Tanda Tangan
            </button>
          )}
        </div>
      </div>

      {tab === 'QUEUE' ? (
        <div className="space-y-6">
          {/* Actionable Queue for Logged-in User */}
          <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#E60012]" />
              Menunggu Tanda Tangan Saya ({pendingMyQueue.length})
            </h3>
            {pendingMyQueue.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Tidak ada dokumen yang menunggu tanda tangan Anda pada tahap aktif saat ini.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {pendingMyQueue.map((item) => (
                  <div
                    key={`${item.reportId}-${item.slot.id}`}
                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{item.reportTitle}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {item.periodLabel} · {item.groupLabel.replace(',', '')} ({item.slot.name})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSignModal({
                          reportId: item.reportId,
                          groupId: item.groupId,
                          groupLabel: item.groupLabel,
                          slot: item.slot,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold shrink-0"
                    >
                      Tanda Tangani
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Reports Workflow List */}
          <div className="space-y-4">
            {store.reports.map((rep) => (
              <div
                key={rep.id}
                className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono-num text-neutral-500">
                      {rep.documentId} · Periode {rep.periodLabel}
                    </div>
                    <h4 className="text-sm font-bold mt-0.5">{rep.title}</h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!rep.locked && user && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            sendReminderNotification(rep.id, user);
                            toast('Pengingat terkirim ke penanda tangan yang masih pending', 'success');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        >
                          <Bell className="w-3.5 h-3.5 text-[#C9A24B]" />
                          Kirim Pengingat
                        </button>
                        {(user.role === 'SECTION_MANAGER' ||
                          user.role === 'DEPT_MANAGER' ||
                          isSuperAdmin) &&
                          rep.status !== 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModal({ reportId: rep.id, title: rep.title });
                                setRejectNote('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Tolak ke Draft
                            </button>
                          )}
                      </>
                    )}
                    {isSuperAdmin && !rep.locked && (
                      <select
                        value={rep.templateId}
                        onChange={(e) => {
                          if (!user) return;
                          applyTemplateToReport(rep.id, e.target.value, user);
                          toast('Template tanda tangan diterapkan ke laporan ini', 'info');
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
                      >
                        {store.templates
                          .filter((t) => t.jenis === rep.jenis)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              Template: {t.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <ReportStepper report={rep} />

                {/* Detailed Slot Grid */}
                <div className="grid md:grid-cols-3 gap-3 pt-2">
                  {rep.signatureGroups.map((g) => (
                    <div
                      key={g.id}
                      className="p-3.5 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/70 dark:border-neutral-800 space-y-2.5"
                    >
                      <div className="text-xs font-bold">{g.label}</div>
                      {g.slots.map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-lg bg-white dark:bg-[#171A1F] border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{s.name}</div>
                            <div className="text-[11px] text-neutral-500 truncate">{s.jabatan}</div>
                            {s.signedAt && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono-num">
                                {formatDateTimeIndo(s.signedAt)}
                              </div>
                            )}
                          </div>
                          {s.status === 'SIGNED' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : !rep.locked && user && (isSuperAdmin || s.allowedUserId === user.id) ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSignModal({
                                  reportId: rep.id,
                                  groupId: g.id,
                                  groupLabel: g.label,
                                  slot: s,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#E60012] text-white text-[11px] font-semibold shrink-0"
                            >
                              Sign
                            </button>
                          ) : (
                            <span className="text-[11px] text-neutral-400 shrink-0">Pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Super Admin Template Builder */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-4 min-w-0 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Preset Template</h3>
              <button
                type="button"
                onClick={handleCreateNewTemplate}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E60012] text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Baru
              </button>
            </div>
            <div className="space-y-2">
              {store.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => selectTemplateForEdit(tpl.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                    draftTpl.id === tpl.id
                      ? 'border-[#E60012] bg-[#E60012]/5'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="font-bold">{tpl.name}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {tpl.jenis} {tpl.isDefault ? '· Bawaan' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="xl:col-span-8 min-w-0 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-5">
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Template</label>
                <input
                  type="text"
                  value={draftTpl.name}
                  onChange={(e) => setDraftTpl({ ...draftTpl, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Jenis Laporan</label>
                <select
                  value={draftTpl.jenis}
                  onChange={(e) => setDraftTpl({ ...draftTpl, jenis: e.target.value as ReportType })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                >
                  <option value="OFFICE_SUPPLIES">Office Supplies</option>
                  <option value="OVERHEAD_GOODS">Overhead Goods</option>
                  <option value="INVENTARIS_OVERHEAD">Inventaris Overhead</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftTpl.isDefault}
                    onChange={(e) => setDraftTpl({ ...draftTpl, isDefault: e.target.checked })}
                  />
                  Jadikan preset bawaan
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {draftTpl.groups.map((grp, gIdx) => (
                <div
                  key={grp.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0F1114] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#E60012]">{grp.stage}</span>
                      <input
                        type="text"
                        value={grp.label}
                        onChange={(e) => {
                          const next = JSON.parse(JSON.stringify(draftTpl)) as SignatureTemplate;
                          next.groups[gIdx].label = e.target.value;
                          setDraftTpl(next);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = JSON.parse(JSON.stringify(draftTpl)) as SignatureTemplate;
                        const firstUser = store.users[1] || store.users[0];
                        next.groups[gIdx].slots.push({
                          id: `slot-${Date.now()}`,
                          name: firstUser.name,
                          jabatan: firstUser.jabatan,
                          allowedUserId: firstUser.id,
                          order: next.groups[gIdx].slots.length + 1,
                        });
                        setDraftTpl(next);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Slot
                    </button>
                  </div>

                  <div className="space-y-2">
                    {grp.slots.map((slot, sIdx) => (
                      <div
                        key={slot.id}
                        className="grid sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-white dark:bg-[#171A1F] border border-neutral-200 dark:border-neutral-800 text-xs"
                      >
                        <div className="sm:col-span-1 flex items-center gap-1 text-neutral-400">
                          <GripVertical className="w-4 h-4" />
                          <button
                            type="button"
                            onClick={() => moveSlot(gIdx, sIdx, -1)}
                            aria-label="Naik"
                            className="hover:text-neutral-700"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSlot(gIdx, sIdx, 1)}
                            aria-label="Turun"
                            className="hover:text-neutral-700"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(draftTpl)) as SignatureTemplate;
                              next.groups[gIdx].slots[sIdx].name = e.target.value;
                              setDraftTpl(next);
                            }}
                            placeholder="Nama Tercetak"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            value={slot.jabatan}
                            onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(draftTpl)) as SignatureTemplate;
                              next.groups[gIdx].slots[sIdx].jabatan = e.target.value;
                              setDraftTpl(next);
                            }}
                            placeholder="Jabatan"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <select
                            value={slot.allowedUserId}
                            onChange={(e) => {
                              const next = JSON.parse(JSON.stringify(draftTpl)) as SignatureTemplate;
                              next.groups[gIdx].slots[sIdx].allowedUserId = e.target.value;
                              setDraftTpl(next);
                            }}
                            className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114]"
                          >
                            {store.users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.username})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-1 text-right">
                          <button
                            type="button"
                            disabled={grp.slots.length <= 1}
                            onClick={() => {
                              const next = JSON.parse(JSON.stringify(draftTpl)) as SignatureTemplate;
                              next.groups[gIdx].slots.splice(sIdx, 1);
                              setDraftTpl(next);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!user) return;
                  upsertSignatureTemplate(draftTpl, user);
                  toast('Template tanda tangan disimpan', 'success', 'Perubahan tidak mengubah laporan Final lama.');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-xs font-semibold"
              >
                <Save className="w-4 h-4" />
                Simpan Preset Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Report Modal */}
      {rejectModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] p-6 space-y-4">
            <h3 className="text-base font-bold">Tolak &amp; Kembalikan ke Draft</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Menolak <strong>{rejectModal.title}</strong> akan mereset tanda tangan tahap berjalan dan mengembalikannya ke Draft.
            </p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Tuliskan alasan penolakan / catatan revisi..."
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectReport(rejectModal.reportId, rejectNote, user);
                  setRejectModal(null);
                  toast('Laporan dikembalikan ke Draft', 'warning');
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
              >
                Kembalikan ke Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal */}
      {user && (
        <SignatureModal
          open={Boolean(signModal)}
          onClose={() => setSignModal(null)}
          slot={signModal?.slot || null}
          groupLabel={signModal?.groupLabel || ''}
          currentUser={user}
          verifyPassword={verifyPassword}
          onConfirmSign={(dataUrl, saveToProfile) => {
            if (!signModal) return;
            if (saveToProfile) updateUserSavedSignature(user.id, dataUrl, user);
            const res = signReportSlot(
              signModal.reportId,
              signModal.groupId,
              signModal.slot.id,
              dataUrl,
              user
            );
            if (!res.ok) {
              toast('Gagal menandatangani', 'error', res.error);
              return;
            }
            setSignModal(null);
            toast('Tanda tangan digital berhasil dibubuhkan', 'success');
          }}
        />
      )}
    </div>
  );
};
