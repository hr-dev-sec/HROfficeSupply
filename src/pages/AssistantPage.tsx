import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bot, CheckCircle2, FileText, Send, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import type { AssistantActionProposal, AssistantMessage, AssistantVisualData, ForecastMonthKey } from '../types';

export const AssistantPage: React.FC = () => {
  const { user } = useAuth();
  const { tr } = useLanguage();
  const { activePreset } = useTheme();
  const {
    store,
    recordTransactions,
    prefillCriticalForecast,
    createMonthlyReport,
    sendReminderNotification,
  } = useSupplyHub();
  const { toast } = useToast();

  const quickPrompts = [
    tr('Item apa yang di bawah minimum?', 'Which items are below minimum stock?'),
    tr('Pemakaian spidol 3 bulan terakhir?', 'Marker stock & usage over the last 3 months?'),
    tr('Siapa yang belum tanda tangan laporan bulan ini?', 'Who hasn’t signed this month’s reports yet?'),
    tr('Buatkan ringkasan laporan September', 'Create a September report summary'),
    tr('Buatkan draf pesan pengingat penanda tangan', 'Draft a signer reminder message'),
  ];

  const draftPrompts = [
    tr(
      'Buatkan pengumuman internal HR tentang jadwal Stock Opname akhir bulan',
      'Draft an internal HR announcement for the month-end Stock Opname schedule'
    ),
    tr(
      'Buatkan catatan resmi selisih stock opname untuk Section Manager',
      'Draft an official stock opname variance note for the Section Manager'
    ),
    tr(
      'Buatkan daftar periksa (checklist) persiapan laporan bulanan HR Dept',
      'Create a monthly report preparation checklist for the HR Dept'
    ),
  ];

  const welcomeText = tr(
    'Halo! Saya **HR Assistant SupplyHub**. Saya terhubung langsung dengan data stok Office Supplies, Overhead Goods, Inventaris Overhead, Rolling Forecast GA, transaksi, dan status tanda tangan laporan. Silakan ajukan pertanyaan atau minta saya menyiapkan draf pengingat maupun pengisian Rolling Forecast GA.',
    'Hello! I am **HR Assistant SupplyHub**. I am directly connected to Office Supplies, Overhead Goods, Overhead Inventory, GA Rolling Forecast, transactions, and report signature statuses. Ask any question or request reminder drafts and GA Rolling Forecast updates.'
  );

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      content: welcomeText,
    },
  ]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHasApiKey(Boolean(d.hasGeminiKey)))
      .catch(() => setHasApiKey(false));
  }, []);

  const liveContext = useMemo(() => {
    const critical = store.items
      .filter((i) => !i.archived && i.currentStock <= i.minStock)
      .map((i) => ({
        id: i.id,
        code: i.codeItem,
        name: i.itemName,
        stock: i.currentStock,
        min: i.minStock,
        uom: i.uom,
        location: i.location,
      }));

    const pendingSignatures = store.reports
      .filter((r) => !r.locked)
      .map((r) => ({
        reportId: r.id,
        documentId: r.documentId,
        title: r.title,
        period: r.periodLabel,
        status: r.status,
        pendingSlots: r.signatureGroups.flatMap((g) =>
          g.slots
            .filter((s) => s.status === 'PENDING')
            .map((s) => ({ group: g.label, name: s.name, jabatan: s.jabatan }))
        ),
      }));

    const recentTx = store.transactions.slice(0, 35).map((t) => ({
      date: t.date,
      type: t.type,
      item: t.itemName,
      qty: t.qty,
      uom: t.uom,
    }));

    const rfMonth = store.rollingForecast.activeMonth;
    const rfFilledRows = store.rollingForecast.rows.filter(
      (r) => (r.months[rfMonth] || 0) > 0
    );

    return {
      totalItems: store.items.filter((i) => !i.archived).length,
      criticalItems: critical,
      rollingForecast: {
        activeMonth: rfMonth,
        totalCatalogRows: store.rollingForecast.rows.length,
        filledCount: rfFilledRows.length,
        totalUnits: rfFilledRows.reduce((s, r) => s + (r.months[rfMonth] || 0), 0),
      },
      pendingSignatures,
      reportsSummary: store.reports.map((r) => ({
        id: r.id,
        docId: r.documentId,
        title: r.title,
        period: r.periodLabel,
        status: r.status,
      })),
      recentTransactions: recentTx,
    };
  }, [store.items, store.reports, store.rollingForecast, store.transactions]);

  // Rule-based intelligent Demo Mode fallback when GEMINI_API_KEY is absent
  const runDemoFallback = (
    prompt: string
  ): {
    reply: string;
    visualData?: AssistantVisualData | null;
    actionProposal?: AssistantActionProposal | null;
  } => {
    const q = prompt.toLowerCase();

    if (q.includes('minimum') || q.includes('kritis') || q.includes('habis') || q.includes('below') || q.includes('low')) {
      const crit = liveContext.criticalItems;
      return {
        reply: tr(
          `Terdapat **${crit.length} item** yang stoknya berada pada atau di bawah Minimum Stok. Item paling mendesak antara lain: ${crit
            .slice(0, 6)
            .map((c) => `${c.name} (${c.stock}/${c.min} ${c.uom})`)
            .join(', ')}.`,
          `There are **${crit.length} items** at or below Minimum Stock. Most urgent items include: ${crit
            .slice(0, 6)
            .map((c) => `${c.name} (${c.stock}/${c.min} ${c.uom})`)
            .join(', ')}.`
        ),
        visualData: {
          title: tr('Item Stok Kritis Teratas', 'Top Critical Stock Items'),
          kind: 'TABLE',
          items: crit.slice(0, 6).map((c) => ({
            label: c.name,
            value: c.stock,
            secondary: `Min: ${c.min} ${c.uom} · ${c.location}`,
          })),
        },
        actionProposal:
          crit.length > 0
            ? {
                type: 'UPDATE_ROLLING_FORECAST',
                title: tr(
                  `Isi Rolling Forecast GA (${liveContext.rollingForecast.activeMonth})`,
                  `Fill GA Rolling Forecast (${liveContext.rollingForecast.activeMonth})`
                ),
                description: tr(
                  `Perbarui usulan order ke GA Dept pada bulan aktif ${liveContext.rollingForecast.activeMonth} berdasarkan item kritis.`,
                  `Update order proposals for GA Dept in active month ${liveContext.rollingForecast.activeMonth} based on critical items.`
                ),
                payloadJson: JSON.stringify({ month: liveContext.rollingForecast.activeMonth }),
              }
            : null,
      };
    }

    if (q.includes('spidol') || q.includes('marker')) {
      const spidolItems = store.items.filter((i) =>
        i.itemName.toLowerCase().includes('spidol')
      );
      return {
        reply: tr(
          `Berikut posisi stok dan pemakaian **Spidol Board Marker & Permanent**: seluruh warna tersedia aman (Biru: ${
            spidolItems.find((s) => s.itemName.includes('Biru'))?.currentStock ?? 0
          } PC, Hijau: ${
            spidolItems.find((s) => s.itemName.includes('Hijau'))?.currentStock ?? 0
          } PC, Hitam: ${
            spidolItems.find((s) => s.itemName.includes('Hitam'))?.currentStock ?? 0
          } PC, Merah: ${
            spidolItems.find((s) => s.itemName.includes('Merah'))?.currentStock ?? 0
          } PC).`,
          `Current stock position for **Board & Permanent Markers**: all colors are healthy (Blue: ${
            spidolItems.find((s) => s.itemName.includes('Biru'))?.currentStock ?? 0
          } PC, Green: ${
            spidolItems.find((s) => s.itemName.includes('Hijau'))?.currentStock ?? 0
          } PC, Black: ${
            spidolItems.find((s) => s.itemName.includes('Hitam'))?.currentStock ?? 0
          } PC, Red: ${
            spidolItems.find((s) => s.itemName.includes('Merah'))?.currentStock ?? 0
          } PC).`
        ),
        visualData: {
          title: tr('Stok Spidol Saat Ini (PC)', 'Current Marker Stock (PC)'),
          kind: 'BAR',
          items: spidolItems.slice(0, 6).map((s) => ({
            label: s.itemName.replace('Spidol Board Marker ', ''),
            value: s.currentStock,
          })),
        },
      };
    }

    if (q.includes('tanda tangan') || q.includes('belum') || q.includes('pengingat') || q.includes('sign') || q.includes('reminder')) {
      const pending = liveContext.pendingSignatures;
      const pendingReportId = pending[0]?.reportId || '';
      return {
        reply:
          pending.length === 0
            ? tr(
                'Semua laporan periode berjalan sudah berstatus **Final** dan ditandatangani lengkap.',
                'All reports for the current period are **Final** and fully signed.'
              )
            : tr(
                `Berikut laporan yang masih menunggu tanda tangan:\n\n${pending
                  .map(
                    (p) =>
                      `- **${p.title} (${p.period})** [Status: ${p.status}] → Menunggu: ${p.pendingSlots
                        .map((s) => `${s.name} (${s.jabatan})`)
                        .join(', ')}`
                  )
                  .join('\n')}\n\n**Draf Pesan Pengingat:**\n*"Yth. Bapak/Ibu Manager HR, mohon berkenan meninjau dan menandatangani laporan bulanan HR SupplyHub periode berjalan agar dapat segera disahkan dan diarsipkan. Terima kasih."*`,
                `Reports currently awaiting signatures:\n\n${pending
                  .map(
                    (p) =>
                      `- **${p.title} (${p.period})** [Status: ${p.status}] → Waiting for: ${p.pendingSlots
                        .map((s) => `${s.name} (${s.jabatan})`)
                        .join(', ')}`
                  )
                  .join('\n')}\n\n**Reminder Message Draft:**\n*"Dear HR Manager, kindly review and sign the monthly HR SupplyHub report so it can be finalized and archived. Thank you."*`
              ),
        actionProposal: pendingReportId
          ? {
              type: 'SEND_REMINDER',
              title: tr('Kirim Notifikasi Pengingat Tanda Tangan', 'Send Signature Reminder Notification'),
              description: tr(
                `Kirim pengingat dalam aplikasi ke penanda tangan yang masih pending pada ${pending[0].documentId}.`,
                `Send an in-app reminder to pending signers on ${pending[0].documentId}.`
              ),
              payloadJson: JSON.stringify({ reportId: pendingReportId }),
            }
          : null,
      };
    }

    if (
      q.includes('ringkasan') ||
      q.includes('summary') ||
      q.includes('oktober') ||
      q.includes('september') ||
      q.includes('forecast')
    ) {
      return {
        reply: tr(
          `**Ringkasan Operasional HR SupplyHub:**\n- Total katalog aktif: **${liveContext.totalItems} item** tanpa pencatatan nominal harga.\n- Item di bawah stok minimum: **${liveContext.criticalItems.length} item**.\n- **Rolling Forecast GA (${liveContext.rollingForecast.activeMonth})**: **${liveContext.rollingForecast.filledCount} item** terisi (**${liveContext.rollingForecast.totalUnits} unit**) dari ${liveContext.rollingForecast.totalCatalogRows} katalog GA.\n- Laporan yang masih menunggu tanda tangan: **${liveContext.pendingSignatures.length} laporan**.`,
          `**HR SupplyHub Operational Summary:**\n- Active catalog total: **${liveContext.totalItems} items** (non-monetary tracking).\n- Items below minimum stock: **${liveContext.criticalItems.length} items**.\n- **GA Rolling Forecast (${liveContext.rollingForecast.activeMonth})**: **${liveContext.rollingForecast.filledCount} items** filled (**${liveContext.rollingForecast.totalUnits} units**) out of ${liveContext.rollingForecast.totalCatalogRows} GA catalog items.\n- Reports pending signatures: **${liveContext.pendingSignatures.length} report(s)**.`
        ),
      };
    }

    return {
      reply: tr(
        `Berdasarkan data HR SupplyHub saat ini: terdapat **${liveContext.totalItems} item aktif**, **${liveContext.criticalItems.length} item di bawah minimum**, **${liveContext.rollingForecast.filledCount} item** terisi pada Rolling Forecast GA (${liveContext.rollingForecast.activeMonth}), dan **${liveContext.pendingSignatures.length} laporan** yang menunggu tanda tangan. Anda bisa menanyakan detail stok item tertentu, ringkasan laporan, atau meminta pengisian Rolling Forecast GA.`,
        `Based on current HR SupplyHub data: **${liveContext.totalItems} active items**, **${liveContext.criticalItems.length} items below minimum**, **${liveContext.rollingForecast.filledCount} items** filled in GA Rolling Forecast (${liveContext.rollingForecast.activeMonth}), and **${liveContext.pendingSignatures.length} report(s)** awaiting signatures. You can ask about specific stock items, report summaries, or GA Rolling Forecast updates.`
      ),
    };
  };

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || loading) return;

    const userMsg: AssistantMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          context: liveContext,
        }),
      });

      const data = await res.json();
      if (data.demoMode || !res.ok) {
        const fallback = runDemoFallback(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-a-${Date.now()}`,
            role: 'assistant',
            content: fallback.reply,
            timestamp: new Date().toISOString(),
            visualData: fallback.visualData,
            actionProposal: fallback.actionProposal,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-a-${Date.now()}`,
            role: 'assistant',
            content: data.reply || tr('Permintaan telah diproses.', 'Request processed.'),
            timestamp: new Date().toISOString(),
            visualData: data.visualData || null,
            actionProposal: data.actionProposal || null,
          },
        ]);
      }
    } catch {
      const fallback = runDemoFallback(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          content: fallback.reply,
          timestamp: new Date().toISOString(),
          visualData: fallback.visualData,
          actionProposal: fallback.actionProposal,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const executeProposal = (msgId: string, proposal: AssistantActionProposal) => {
    if (!user) return;
    try {
      const payload = JSON.parse(proposal.payloadJson || '{}');
      if (proposal.type === 'UPDATE_ROLLING_FORECAST') {
        const month = (payload.month || store.rollingForecast.activeMonth) as ForecastMonthKey;
        const updatedCount = prefillCriticalForecast(month, user);
        toast(
          tr(
            `Rolling Forecast ${month} diperbarui (${updatedCount} item kritis)`,
            `Rolling Forecast ${month} updated (${updatedCount} critical items)`
          ),
          'success'
        );
      } else if (proposal.type === 'SEND_REMINDER') {
        const repId = payload.reportId || store.reports.find((r) => !r.locked)?.id;
        if (repId) {
          sendReminderNotification(repId, user);
          toast(tr('Pengingat tanda tangan terkirim', 'Signature reminder sent'), 'success');
        }
      } else if (proposal.type === 'CREATE_DRAFT_REPORT') {
        const rep = createMonthlyReport(
          payload.jenis || 'OFFICE_SUPPLIES',
          payload.period || '2026-10',
          'Mojokerto, 05 November 2026',
          undefined,
          user
        );
        toast(
          tr(`Draft laporan ${rep.documentId} dibuat`, `Draft report ${rep.documentId} created`),
          'success'
        );
      } else if (proposal.type === 'RECORD_PAKAI' && payload.itemId) {
        const res = recordTransactions(
          [
            {
              itemId: payload.itemId,
              type: 'PAKAI',
              qty: Number(payload.qty || 1),
              date: new Date().toISOString().slice(0, 10),
              note: payload.note || tr('Dicatat via HR Assistant', 'Recorded via HR Assistant'),
            },
          ],
          user
        );
        if (!res.ok) {
          toast(tr('Gagal mencatat transaksi', 'Failed to record transaction'), 'error', res.error);
          return;
        }
        toast(tr('Transaksi Pakai berhasil dicatat', 'Usage transaction recorded'), 'success');
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.actionProposal
            ? { ...m, actionProposal: { ...m.actionProposal, executed: true } }
            : m
        )
      );
    } catch {
      toast(tr('Gagal mengeksekusi aksi', 'Failed to execute action'), 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:h-[calc(100vh-132px)] xl:min-h-[480px]">
      {/* Chat Panel */}
      <div className="xl:col-span-8 min-w-0 min-h-[420px] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-theme-primary text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">HR Assistant SupplyHub</h2>
              <p className="text-[11px] text-neutral-500">
                {hasApiKey === false
                  ? tr('Mode Demo Berbasis Aturan (data lokal)', 'Rule-Based Demo Mode (local data)')
                  : tr(
                      'Terhubung dengan Gemini API & data inventaris langsung',
                      'Connected to Gemini API & live inventory data'
                    )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMessages((prev) => prev.slice(0, 1))}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {tr('Bersihkan', 'Clear')}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-theme-primary text-white rounded-tr-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800/90 text-[#1F2328] dark:text-neutral-100 rounded-tl-sm'
                }`}
              >
                {m.id === 'msg-welcome' ? welcomeText : m.content}
              </div>

              {/* Mini Visual Chart/Table */}
              {m.visualData && m.visualData.items.length > 0 && (
                <div className="mt-2.5 w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] p-4 space-y-2">
                  <div className="text-xs font-bold">{m.visualData.title}</div>
                  {m.visualData.kind === 'BAR' ? (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={m.visualData.items}>
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill={activePreset.primary} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                      {m.visualData.items.map((row, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold">{row.label}</div>
                            {row.secondary && (
                              <div className="text-neutral-500">{row.secondary}</div>
                            )}
                          </div>
                          <span className="font-mono-num font-bold text-theme-primary">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation Card before mutating data */}
              {m.actionProposal && (
                <div className="mt-2.5 w-full max-w-lg rounded-2xl border border-[#C9A24B]/50 bg-[#C9A24B]/10 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Sparkles className="w-4 h-4 text-[#C9A24B]" />
                    {tr('Konfirmasi Aksi:', 'Confirm Action:')} {m.actionProposal.title}
                  </div>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300">
                    {m.actionProposal.description}
                  </p>
                  {m.actionProposal.executed ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      {tr('Aksi telah dijalankan', 'Action executed')}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => executeProposal(m.id, m.actionProposal!)}
                      className="px-4 py-2 rounded-xl bg-theme-primary bg-theme-primary-hover text-white text-xs font-semibold cursor-pointer"
                    >
                      {tr('Konfirmasi & Jalankan', 'Confirm & Execute')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="text-xs text-neutral-500 animate-pulse">
              {tr('HR Assistant sedang menganalisis data...', 'HR Assistant is analyzing data...')}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tr(
              'Tanyakan stok, pemakaian, status tanda tangan, atau minta buatkan draf...',
              'Ask about stock, usage, signature statuses, or request a draft...'
            )}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs focus:outline-none focus:border-theme-primary"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-theme-primary bg-theme-primary-hover disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {tr('Kirim', 'Send')}
          </button>
        </form>
      </div>

      {/* Right Panel: Quick Prompts & Draft Generators */}
      <div className="xl:col-span-4 min-w-0 space-y-4 xl:overflow-y-auto">
        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
          <h3 className="text-sm font-bold">{tr('Saran Pertanyaan Cepat', 'Quick Prompts')}</h3>
          <div className="space-y-2">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-theme-primary text-xs font-medium transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A24B]" />
            {tr('Pembuat Draf Dokumen HR', 'HR Document Draft Generator')}
          </h3>
          <div className="space-y-2">
            {draftPrompts.map((draftPrompt) => (
              <button
                key={draftPrompt}
                type="button"
                onClick={() => handleSend(draftPrompt)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/70 dark:border-neutral-800 hover:border-[#C9A24B] text-xs transition-colors cursor-pointer"
              >
                {draftPrompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
