import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSupplyHub } from '../context/SupplyHubContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import type {
  AssistantActionProposal,
  AssistantMessage,
  ForecastMonthKey,
  ReportType,
} from '../types';
import {
  buildComprehensiveAssistantContext,
  runLocalHrAssistant,
} from '../utils/hrAssistantEngine';

type PromptCategoryKey = 'STOK' | 'REQUEST' | 'FORECAST' | 'LAPORAN';

/**
 * Pure-React safe inline formatter for **bold**, *italic*, and `code` tokens.
 * Never uses dangerouslySetInnerHTML.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-bold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`i-${keyIdx++}`} className="italic opacity-90">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/**
 * Pure-React Markdown block renderer for Assistant replies.
 */
function renderAssistantMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      elements.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      const heading = line.replace(/^#{2,3}\s+/, '');
      elements.push(
        <div key={`h-${idx}`} className="font-bold text-[13px] pt-1">
          {renderInlineMarkdown(heading)}
        </div>
      );
      return;
    }

    if (line.startsWith('> ')) {
      elements.push(
        <div
          key={`q-${idx}`}
          className="pl-3 py-1 my-1 border-l-2 border-theme-primary/70 bg-black/[0.03] dark:bg-white/[0.04] rounded-r-lg italic"
        >
          {renderInlineMarkdown(line.slice(2))}
        </div>
      );
      return;
    }

    if (/^[-*•]\s+/.test(line)) {
      const body = line.replace(/^[-*•]\s+/, '');
      elements.push(
        <div key={`ul-${idx}`} className="flex items-start gap-2 pl-1">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-theme-primary shrink-0" />
          <div className="flex-1 min-w-0">{renderInlineMarkdown(body)}</div>
        </div>
      );
      return;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={`ol-${idx}`} className="flex items-start gap-2 pl-1">
          <span className="font-mono-num font-bold text-theme-primary shrink-0">
            {numMatch[1]}.
          </span>
          <div className="flex-1 min-w-0">{renderInlineMarkdown(numMatch[2])}</div>
        </div>
      );
      return;
    }

    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
}

function formatMojokertoPlaceDate(): string {
  const now = new Date();
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const day = String(now.getDate()).padStart(2, '0');
  return `Mojokerto, ${day} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

export const AssistantPage: React.FC = () => {
  const { user, canEditOperational } = useAuth();
  const { language, tr } = useLanguage();
  const { activePreset } = useTheme();
  const {
    store,
    recordTransactions,
    processItemRequest,
    prefillCriticalForecast,
    createMonthlyReport,
    sendReminderNotification,
  } = useSupplyHub();
  const { toast } = useToast();

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [promptTab, setPromptTab] = useState<PromptCategoryKey>('STOK');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const welcomeText = tr(
    'Halo! Saya **HR Assistant SupplyHub** yang terhubung langsung ke **seluruh 14 modul data aktif** sistem (Master Item Office Supplies & Overhead Goods, Lokasi Lemari, Transaksi & Analitik Pemakaian, Permintaan Pengambilan Karyawan HR, Database Karyawan HR, Inventaris Overhead MCH/ELC/ATK, Rolling Forecast GA 12 Bulan, Laporan Bulanan A3 & Status Tanda Tangan, Stock Opname, Arsip Dokumen, serta Audit Log).\n\nSilakan tanyakan data apa pun, analisis perbandingan, pencarian item/karyawan/lemari spesifik, pembuatan draf memo HR, atau instruksikan eksekusi transaksi & approval.',
    'Hello! I am **HR Assistant SupplyHub**, connected directly to **all 14 live system modules** (Office Supplies & Overhead Goods catalog, storage cabinets, transactions & consumption analytics, HR employee supply requests, HR employee roster, MCH/ELC/ATK Overhead Inventory, 12-month GA Rolling Forecast, A3 monthly reports & digital signatures, Stock Opname, document archive, and audit logs).\n\nAsk any analytical question, look up specific items/employees/cabinets, generate HR document drafts, or instruct operational actions.'
  );

  const initialFollowUps = useMemo(
    () => [
      tr('Ringkasan eksekutif seluruh data HR SupplyHub hari ini', 'Executive summary of all HR SupplyHub data today'),
      tr('Item apa saja yang stoknya di bawah minimum?', 'Which items are below minimum stock?'),
      tr('Lihat permintaan karyawan HR yang menunggu approval', 'View pending HR employee supply requests'),
    ],
    [tr]
  );

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      content: welcomeText,
      followUpSuggestions: initialFollowUps,
    },
  ]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : { hasGeminiKey: false }))
      .then((d) => setHasApiKey(Boolean(d.hasGeminiKey)))
      .catch(() => setHasApiKey(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  // Comprehensive live snapshot across all 14 SupplyHub modules
  const liveContext = useMemo(
    () => buildComprehensiveAssistantContext(store, user),
    [store, user]
  );

  // Live index summary metrics for right panel
  const indexStats = useMemo(() => {
    const activeItems = store.items.filter((i) => !i.archived);
    const pendingReq = store.itemRequests.filter((r) => r.status === 'MENUNGGU').length;
    const pendingRep = store.reports.filter((r) => !r.locked).length;
    const critical = activeItems.filter((i) => i.currentStock <= i.minStock).length;
    return {
      activeItems: activeItems.length,
      critical,
      transactions: store.transactions.length,
      requests: store.itemRequests.length,
      pendingReq,
      employees: store.employees.filter((e) => e.active).length,
      inventories: store.inventories.length,
      forecastRows: store.rollingForecast.rows.length,
      reports: store.reports.length,
      pendingRep,
      opnames: store.opnames.length,
      documents: store.documents.length,
    };
  }, [store]);

  const categorizedPrompts = useMemo<Record<PromptCategoryKey, string[]>>(
    () => ({
      STOK: [
        tr('Item apa saja yang stoknya di bawah minimum atau habis?', 'Which items are below minimum or out of stock?'),
        tr('Item apa yang paling banyak dipakai berdasarkan transaksi?', 'Which items have the highest consumption?'),
        tr('Tampilkan distribusi barang di setiap lokasi lemari simpan', 'Show item distribution across all storage cabinets'),
        tr('Bandingkan jumlah item & stok Office Supplies vs Overhead Goods', 'Compare Office Supplies vs Overhead Goods counts and stock'),
      ],
      REQUEST: [
        tr('Tampilkan permintaan pengambilan barang karyawan yang menunggu approval', 'Show employee supply requests awaiting approval'),
        tr('Berapa jumlah karyawan di seksi HR Development vs Administration & Operation?', 'How many employees are in HR Development vs Administration & Operation?'),
        tr('Setujui permintaan pengambilan barang karyawan yang sedang pending', 'Approve the pending employee supply request'),
        tr('Siapa saja akun PIC, Admin, dan Manager aktif di sistem?', 'Who are the active PIC, Admin, and Manager accounts?'),
      ],
      FORECAST: [
        tr(
          `Rincian Rolling Forecast GA bulan aktif (${store.rollingForecast.activeMonth}) & tren 12 bulan`,
          `Active month (${store.rollingForecast.activeMonth}) GA Rolling Forecast details & 12-month trend`
        ),
        tr('Item katalog GA mana saja yang R/M Stock-nya 0?', 'Which GA catalog items have 0 R/M Stock?'),
        tr('Aset Inventaris Overhead apa saja yang kondisinya RUSAK?', 'Which Overhead Inventory assets are DAMAGED?'),
        tr(
          `Isi otomatis Rolling Forecast GA bulan ${store.rollingForecast.activeMonth} dari item kritis`,
          `Auto-fill ${store.rollingForecast.activeMonth} GA Rolling Forecast from critical items`
        ),
      ],
      LAPORAN: [
        tr('Siapa saja yang belum tanda tangan laporan bulanan saat ini?', 'Who has not signed current monthly reports yet?'),
        tr('Tampilkan hasil Stock Opname terakhir beserta item yang selisih', 'Show latest Stock Opname results and variances'),
        tr('Daftar dokumen yang sudah diunggah di Arsip Dokumen Sistem', 'List uploaded files in the System Document Archive'),
        tr('Tampilkan audit log aktivitas perubahan data terbaru', 'Show latest audit log system changes'),
      ],
    }),
    [store.rollingForecast.activeMonth, tr]
  );

  const draftPrompts = useMemo(
    () => [
      tr(
        'Buatkan pengumuman internal HR tentang jadwal Stock Opname akhir bulan',
        'Draft an internal HR announcement for the month-end Stock Opname schedule'
      ),
      tr(
        'Buatkan catatan resmi selisih stock opname untuk Section Manager',
        'Draft an official stock opname variance note for the Section Manager'
      ),
      tr(
        'Buatkan draf pesan pengingat penanda tangan laporan bulanan',
        'Draft a monthly report signer reminder message'
      ),
      tr(
        'Buatkan daftar periksa (checklist) persiapan laporan bulanan HR Dept',
        'Create a monthly report preparation checklist for the HR Dept'
      ),
    ],
    [tr]
  );

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      toast(tr('Jawaban disalin ke clipboard', 'Reply copied to clipboard'), 'success');
      setTimeout(() => setCopiedId((cur) => (cur === msgId ? null : cur)), 2000);
    } catch {
      toast(tr('Gagal menyalin teks', 'Failed to copy text'), 'error');
    }
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

    const historyForApi = messages
      .filter((m) => !m.isError && m.id !== 'msg-welcome')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput('');
    setLoading(true);

    const pushLocalReply = () => {
      const local = runLocalHrAssistant(text, store, language, user);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          content: local.reply,
          timestamp: new Date().toISOString(),
          visualData: local.visualData || null,
          actionProposal: local.actionProposal || null,
          followUpSuggestions: local.followUpSuggestions,
          sourceMode: 'LOCAL',
        },
      ]);
    };

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyForApi,
          context: liveContext,
          language,
        }),
      });

      // Static SPA host without Express /api/assistant backend -> use live local query engine
      if (res.status === 404) {
        setHasApiKey(false);
        pushLocalReply();
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setHasApiKey(false);
        pushLocalReply();
        return;
      }

      const data = await res.json();

      // Server explicitly has no GEMINI_API_KEY configured -> use live local query engine
      if (res.ok && (data.noServerKey || data.demoMode)) {
        setHasApiKey(false);
        pushLocalReply();
        return;
      }

      // Upstream Gemini API returned a real error (400/403/429/500) -> surface transparently with Retry
      if (!res.ok) {
        const errMsg =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : tr(
                `Layanan AI mengembalikan status ${res.status}. Silakan coba lagi.`,
                `AI service returned status ${res.status}. Please try again.`
              );
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            content: tr(
              `Permintaan ke Gemini API gagal diproses: **${errMsg}**`,
              `Gemini API request failed: **${errMsg}**`
            ),
            timestamp: new Date().toISOString(),
            isError: true,
            retryPrompt: text,
          },
        ]);
        return;
      }

      setHasApiKey(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || tr('Permintaan telah diproses.', 'Request processed.'),
          timestamp: new Date().toISOString(),
          visualData: data.visualData || null,
          actionProposal: data.actionProposal || null,
          followUpSuggestions: Array.isArray(data.followUpSuggestions)
            ? data.followUpSuggestions.filter((s: unknown) => typeof s === 'string' && s.trim()).slice(0, 3)
            : undefined,
          sourceMode: 'GEMINI',
        },
      ]);
    } catch (err) {
      if (hasApiKey === true) {
        const msg = err instanceof Error ? err.message : tr('Koneksi jaringan terputus', 'Network error');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            content: tr(
              `Gagal menghubungi server HR Assistant: **${msg}**. Silakan coba lagi.`,
              `Failed to reach HR Assistant server: **${msg}**. Please try again.`
            ),
            timestamp: new Date().toISOString(),
            isError: true,
            retryPrompt: text,
          },
        ]);
      } else {
        pushLocalReply();
      }
    } finally {
      setLoading(false);
    }
  };

  const executeProposal = (msgId: string, proposal: AssistantActionProposal) => {
    if (!user) return;
    if (
      !canEditOperational &&
      proposal.type !== 'SEND_REMINDER'
    ) {
      toast(
        tr('Akses terbatas', 'Restricted access'),
        'error',
        tr(
          'Hanya PIC HR / Staff atau Super Admin yang dapat mengeksekusi perubahan data operasional.',
          'Only HR PIC / Staff or Super Admin can execute operational data mutations.'
        )
      );
      return;
    }

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
        if (!repId) {
          toast(tr('Tidak ada laporan pending untuk diingatkan', 'No pending report found'), 'error');
          return;
        }
        sendReminderNotification(repId, user);
        toast(tr('Pengingat tanda tangan terkirim', 'Signature reminder sent'), 'success');
      } else if (proposal.type === 'CREATE_DRAFT_REPORT') {
        const jenis = (payload.jenis || 'OFFICE_SUPPLIES') as ReportType;
        const period = payload.period || new Date().toISOString().slice(0, 7);
        const rep = createMonthlyReport(
          jenis,
          period,
          formatMojokertoPlaceDate(),
          undefined,
          user
        );
        toast(
          tr(`Draft laporan ${rep.documentId} dibuat`, `Draft report ${rep.documentId} created`),
          'success'
        );
      } else if (proposal.type === 'RECORD_PAKAI' || proposal.type === 'RECORD_TERIMA') {
        if (!payload.itemId) {
          toast(tr('ID item tidak ditemukan pada aksi', 'Item ID missing in action'), 'error');
          return;
        }
        const txType = proposal.type === 'RECORD_TERIMA' ? 'TERIMA' : 'PAKAI';
        const qty = Math.max(1, Number(payload.qty || 1));
        const res = recordTransactions(
          [
            {
              itemId: payload.itemId,
              type: txType,
              qty,
              date: new Date().toISOString().slice(0, 10),
              note:
                payload.note ||
                (txType === 'TERIMA'
                  ? tr('Penerimaan dicatat via HR Assistant', 'Receipt recorded via HR Assistant')
                  : tr('Pemakaian dicatat via HR Assistant', 'Usage recorded via HR Assistant')),
            },
          ],
          user
        );
        if (!res.ok) {
          toast(tr('Gagal mencatat transaksi', 'Failed to record transaction'), 'error', res.error);
          return;
        }
        toast(
          txType === 'TERIMA'
            ? tr('Transaksi Terima berhasil dicatat', 'Receipt transaction recorded')
            : tr('Transaksi Pakai berhasil dicatat', 'Usage transaction recorded'),
          'success'
        );
      } else if (proposal.type === 'APPROVE_REQUEST') {
        const reqId = payload.requestId || store.itemRequests.find((r) => r.status === 'MENUNGGU')?.id;
        if (!reqId) {
          toast(tr('Permintaan pending tidak ditemukan', 'Pending request not found'), 'error');
          return;
        }
        const res = processItemRequest(reqId, true, user);
        if (!res.ok) {
          toast(tr('Gagal menyetujui permintaan', 'Failed to approve request'), 'error', res.error);
          return;
        }
        toast(
          tr('Permintaan disetujui & stok otomatis terpotong', 'Request approved & stock deducted'),
          'success'
        );
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

  const handleClear = () => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        content: welcomeText,
        followUpSuggestions: initialFollowUps,
      },
    ]);
  };

  const tabItems: Array<{ key: PromptCategoryKey; label: string }> = [
    { key: 'STOK', label: tr('Stok & Lokasi', 'Stock & Loc') },
    { key: 'REQUEST', label: tr('Request & HR', 'Req & Staff') },
    { key: 'FORECAST', label: tr('GA & Aset', 'GA & Assets') },
    { key: 'LAPORAN', label: tr('Laporan & Log', 'Reports') },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:h-[calc(100vh-132px)] xl:min-h-[520px]">
      {/* Chat Panel */}
      <div className="xl:col-span-8 min-w-0 min-h-[460px] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-theme-primary text-white flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">HR Assistant SupplyHub</h2>
              <p className="text-[11px] text-neutral-500 truncate">
                {hasApiKey === false
                  ? tr(
                      'Mesin Analisis Data Langsung (14 modul aktif · tanpa kunci server AI)',
                      'Live Data Query Engine (14 active modules · no server AI key)'
                    )
                  : tr(
                      'Terhubung dengan Gemini AI & seluruh 14 modul data langsung SupplyHub',
                      'Connected to Gemini AI & all 14 live SupplyHub data modules'
                    )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {tr('Bersihkan', 'Clear')}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, idx) => {
            const isLastAssistant =
              m.role === 'assistant' && idx === messages.length - 1 && !loading;
            const displayContent = m.id === 'msg-welcome' ? welcomeText : m.content;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-theme-primary text-white rounded-tr-sm whitespace-pre-line'
                      : m.isError
                      ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-red-900 dark:text-red-200 rounded-tl-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800/90 text-[#1F2328] dark:text-neutral-100 rounded-tl-sm'
                  }`}
                >
                  {m.role === 'user' ? (
                    displayContent
                  ) : (
                    <div className="space-y-2">
                      {m.isError && (
                        <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {tr('Terjadi Kesalahan Koneksi AI', 'AI Connection Error')}
                        </div>
                      )}
                      {renderAssistantMarkdown(displayContent)}

                      {/* Footer controls on assistant messages */}
                      <div className="pt-1.5 flex items-center justify-between gap-3 border-t border-black/5 dark:border-white/10">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {m.sourceMode === 'GEMINI'
                            ? 'Gemini AI · Live Data'
                            : m.sourceMode === 'LOCAL'
                            ? tr('Analisis Data Lokal · Live', 'Local Live Engine')
                            : tr('Siap membantu', 'Ready to assist')}
                        </span>
                        <div className="flex items-center gap-2">
                          {m.isError && m.retryPrompt && (
                            <button
                              type="button"
                              onClick={() => handleSend(m.retryPrompt)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300 hover:underline cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {tr('Coba Lagi', 'Retry')}
                            </button>
                          )}
                          {!m.isError && m.id !== 'msg-welcome' && (
                            <button
                              type="button"
                              onClick={() => handleCopy(m.id, displayContent)}
                              className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-theme-primary transition-colors cursor-pointer"
                              title={tr('Salin jawaban', 'Copy reply')}
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">{tr('Tersalin', 'Copied')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>{tr('Salin', 'Copy')}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mini Visual Chart / Table */}
                {m.visualData && m.visualData.items.length > 0 && (
                  <div className="mt-2.5 w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] p-4 space-y-2.5">
                    <div className="text-xs font-bold">{m.visualData.title}</div>
                    {m.visualData.kind === 'BAR' ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={m.visualData.items} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill={activePreset.primary} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-[11px]">
                        {m.visualData.items.map((row, rIdx) => (
                          <div key={rIdx} className="py-1.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{row.label}</div>
                              {row.secondary && (
                                <div className="text-neutral-500 dark:text-neutral-400 text-[10px]">
                                  {row.secondary}
                                </div>
                              )}
                            </div>
                            <span className="font-mono-num font-bold text-theme-primary shrink-0">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmation Card before mutating system data */}
                {m.actionProposal && (
                  <div className="mt-2.5 w-full max-w-xl rounded-2xl border border-[#C9A24B]/50 bg-[#C9A24B]/10 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Sparkles className="w-4 h-4 text-[#C9A24B] shrink-0" />
                      <span>
                        {tr('Konfirmasi Aksi:', 'Confirm Action:')} {m.actionProposal.title}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300">
                      {m.actionProposal.description}
                    </p>
                    {m.actionProposal.executed ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        {tr('Aksi telah dijalankan & tersinkronisasi', 'Action executed & synced')}
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

                {/* Contextual follow-up suggestion buttons under the latest assistant reply */}
                {isLastAssistant && m.followUpSuggestions && m.followUpSuggestions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[90%]">
                    {m.followUpSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSend(s)}
                        className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#0F1114] hover:border-theme-primary text-[11px] font-medium text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer text-left"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 animate-pulse">
              <Bot className="w-4 h-4 text-theme-primary" />
              {tr(
                'HR Assistant sedang menganalisis seluruh data sistem...',
                'HR Assistant is analyzing live system data...'
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
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
              'Tanya stok item/kode, isi lemari, permintaan karyawan, aset rusak, forecast GA, atau catat transaksi...',
              'Ask about item stock/code, cabinet contents, employee requests, damaged assets, GA forecast, or log transactions...'
            )}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#0F1114] text-xs focus:outline-none focus:border-theme-primary"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-theme-primary bg-theme-primary-hover disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {tr('Kirim', 'Send')}
          </button>
        </form>
      </div>

      {/* Right Panel: Live Scope + Categorized Quick Prompts + Draft Generators */}
      <div className="xl:col-span-4 min-w-0 space-y-4 xl:overflow-y-auto">
        {/* Live Data Scope Card */}
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-theme-primary" />
              {tr('Cakupan Data Live Terhubung', 'Live Connected Data Scope')}
            </h3>
            <span className="text-[10px] font-mono-num text-neutral-500">
              14 {tr('Modul', 'Modules')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/60 dark:border-neutral-800">
              <div className="text-neutral-500 text-[10px]">{tr('Item Aktif', 'Active Items')}</div>
              <div className="font-mono-num font-bold text-sm">
                {indexStats.activeItems}
                <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 ml-1">
                  ({indexStats.critical} {tr('kritis', 'crit')})
                </span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/60 dark:border-neutral-800">
              <div className="text-neutral-500 text-[10px]">{tr('Request HR', 'HR Requests')}</div>
              <div className="font-mono-num font-bold text-sm">
                {indexStats.requests}
                <span className="text-[10px] font-normal text-theme-primary ml-1">
                  ({indexStats.pendingReq} {tr('pending', 'wait')})
                </span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/60 dark:border-neutral-800">
              <div className="text-neutral-500 text-[10px]">{tr('Karyawan', 'Employees')}</div>
              <div className="font-mono-num font-bold text-sm">{indexStats.employees}</div>
            </div>
            <div className="p-2 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/60 dark:border-neutral-800">
              <div className="text-neutral-500 text-[10px]">{tr('Aset Overhead', 'Assets')}</div>
              <div className="font-mono-num font-bold text-sm">{indexStats.inventories}</div>
            </div>
            <div className="p-2 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/60 dark:border-neutral-800">
              <div className="text-neutral-500 text-[10px]">{tr('Katalog GA', 'GA Catalog')}</div>
              <div className="font-mono-num font-bold text-sm">{indexStats.forecastRows}</div>
            </div>
            <div className="p-2 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/60 dark:border-neutral-800">
              <div className="text-neutral-500 text-[10px]">{tr('Laporan A3', 'A3 Reports')}</div>
              <div className="font-mono-num font-bold text-sm">
                {indexStats.reports}
                <span className="text-[10px] font-normal text-neutral-500 ml-1">
                  ({indexStats.pendingRep} TTD)
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-neutral-500 leading-relaxed">
            {tr(
              `${indexStats.transactions} transaksi · ${indexStats.opnames} sesi opname · ${indexStats.documents} arsip dokumen · audit log real-time.`,
              `${indexStats.transactions} transactions · ${indexStats.opnames} opname sessions · ${indexStats.documents} archived docs · live audit logs.`
            )}
          </p>
        </div>

        {/* Categorized Quick Prompts */}
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
          <h3 className="text-sm font-bold">{tr('Saran Pertanyaan Cepat', 'Quick Prompts')}</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {tabItems.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setPromptTab(tb.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  promptTab === tb.key
                    ? 'bg-theme-primary text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {categorizedPrompts[promptTab].map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => handleSend(q)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-theme-primary disabled:opacity-50 text-xs font-medium transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* HR Document Draft Generators */}
        <div className="p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#171A1F] space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A24B]" />
            {tr('Pembuat Draf Dokumen HR', 'HR Document Draft Generator')}
          </h3>
          <div className="space-y-2">
            {draftPrompts.map((draftPrompt) => (
              <button
                key={draftPrompt}
                type="button"
                disabled={loading}
                onClick={() => handleSend(draftPrompt)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#0F1114] border border-neutral-200/70 dark:border-neutral-800 hover:border-[#C9A24B] disabled:opacity-50 text-xs transition-colors cursor-pointer"
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
