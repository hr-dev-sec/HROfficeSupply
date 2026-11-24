import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    });
  });

  app.post('/api/assistant', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return res.json({
        noServerKey: true,
        demoMode: true,
        message: 'GEMINI_API_KEY belum terkonfigurasi di server.',
      });
    }

    try {
      const { message, history = [], context, language = 'id' } = req.body as {
        message: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        context?: Record<string, unknown>;
        language?: 'id' | 'en';
      };

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const langDirective =
        language === 'en'
          ? 'Default response language: professional, concise English (unless the user writes in Indonesian, in which case reply in Bahasa Indonesia).'
          : 'Bahasa jawaban utama: Bahasa Indonesia yang profesional, ringkas, akurat, dan terstruktur (kecuali pengguna bertanya dalam Bahasa Inggris, balas dalam Bahasa Inggris).';

      const systemInstruction = `Anda adalah **HR Assistant SupplyHub**, asisten analis data & operasional resmi untuk Departemen Human Resources (Seksi HR Development dan Administration & Operation), PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.

Anda memiliki akses penuh ke seluruh data sistem terkini yang dikirim dalam JSON konteks:
1. Master Item (Office Supplies & Overhead Goods: kode, kategori, stok saat ini, minimum stok, satuan/UOM, lokasi simpan/lemari, status HABIS/KRITIS/AMAN, catatan, item arsip).
2. Ringkasan kategori, ringkasan lokasi simpan, dan analitik pemakaian/penerimaan transaksi.
3. Riwayat transaksi Terima, Pakai, dan Penyesuaian Opname.
4. Permintaan Pengambilan Barang Karyawan Dept. HR (status MENUNGGU, DISETUJUI, DITOLAK, nama pemohon, NIK, seksi, daftar barang, keperluan, PIC pemroses, alasan penolakan).
5. Database Karyawan Departemen HR (NIK, nama, seksi HR Development / Administration & Operation, jabatan, status aktif).
6. Inventaris Overhead (aset MCH/ELC/ATK, Part_Id, QTY, lokasi, kondisi BAGUS/RUSAK, riwayat mutasi).
7. Rolling Forecast Office Supplies ke GA Dept. (FY2026, bulan aktif, proyeksi 12 bulan Apr-26 s.d. Mar-27, R/M Stock, estimasi pemakaian, riwayat pengiriman ke GA).
8. Laporan Bulanan Standar A3 (Office Supplies, Overhead Goods, Inventaris Overhead: nomor dokumen, periode, status workflow, versi, penanda tangan yang sudah TTD & yang masih pending).
9. Stock Opname Akhir Bulan (sesi opname, status persetujuan SM, item yang mengalami selisih beserta alasan).
10. Arsip Dokumen Sistem (PDF/Excel/Word terunggah), Daftar Akun Pengguna & Peran (PIC/Admin/SM/Dept Manager), dan Audit Log aktivitas terbaru.

Aturan Mutlak:
1. ${langDirective}
2. Jawab HANYA berdasarkan data faktual di JSON konteks. Lakukan perhitungan, pengelompokan, perbandingan, penyaringan, dan lintas-referensi (misal menghubungkan stok item -> lokasi lemari -> riwayat pemakaian -> forecast GA -> permintaan karyawan pending) secara tepat. Jangan pernah mengarang data yang tidak ada; jika suatu item/karyawan/periode tidak ditemukan di data, nyatakan dengan jujur dan tawarkan alternatif yang mendekati.
3. HR Department TIDAK mengelola pembelian/vendor dan TIDAK mencatat nominal harga/uang. Pemesanan Office Supplies dilakukan melalui pembaruan Rolling Forecast bulanan ke GA Dept. Jangan pernah mencantumkan harga atau istilah pembelian/purchasing.
4. Gunakan format markdown rapi (**bold** untuk angka & nama penting, bullet list atau daftar bernomor agar mudah dipindai). Jangan buat jawaban terlalu bertele-tele, namun tetap lengkap dan informatif.
5. Kapan pun jawaban mencakup perbandingan angka, daftar item kritis, top pemakaian, distribusi per kategori/seksi/bulan, atau daftar data terstruktur (3+ item), selalu sertakan "visualData" (kind: "BAR" untuk perbandingan numerik/grafik atau "TABLE" untuk daftar detail dengan keterangan sekunder).
6. Jika pengguna secara eksplisit meminta menjalankan aksi pada sistem (mencatat pakai barang, mencatat terima barang, menyetujui permintaan karyawan tertentu, mengisi Rolling Forecast item kritis ke GA, membuat draf laporan bulanan, atau mengirim pengingat tanda tangan), isi "actionProposal" dengan ID yang PERSIS cocok dari konteks agar pengguna dapat mengonfirmasi sebelum eksekusi.
7. Selalu sertakan 2-3 saran pertanyaan lanjutan yang relevan dan spesifik pada "followUpSuggestions" agar pengguna dapat menggali data lebih dalam dengan 1 klik.`;

      const historySnippet = history
        .slice(-10)
        .map((h) => `${h.role === 'user' ? 'Pengguna' : 'HR Assistant'}: ${h.content}`)
        .join('\n');

      const prompt = `KONTEKS DATA SISTEM TERKINI (JSON):
${JSON.stringify(context ?? {})}

RIWAYAT PERCAKAPAN SEBELUMNYA:
${historySnippet || '(percakapan baru)'}

PERTANYAAN / INSTRUKSI PENGGUNA:
${message}`;

      const invokeGemini = async () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: {
                  type: Type.STRING,
                  description:
                    'Jawaban lengkap, akurat, dan terstruktur menggunakan markdown ringan (**bold**, bullet list, daftar bernomor).',
                },
                visualData: {
                  type: Type.OBJECT,
                  nullable: true,
                  description: 'Opsional: mini grafik batang (BAR) atau tabel ringkas (TABLE) pendukung jawaban.',
                  properties: {
                    title: { type: Type.STRING },
                    kind: { type: Type.STRING, description: 'BAR atau TABLE' },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          value: { type: Type.NUMBER },
                          secondary: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
                actionProposal: {
                  type: Type.OBJECT,
                  nullable: true,
                  description: 'Opsional: usulan aksi sistem yang harus dikonfirmasi pengguna terlebih dahulu.',
                  properties: {
                    type: {
                      type: Type.STRING,
                      description:
                        'RECORD_PAKAI | RECORD_TERIMA | APPROVE_REQUEST | UPDATE_ROLLING_FORECAST | CREATE_DRAFT_REPORT | SEND_REMINDER',
                    },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    payloadJson: {
                      type: Type.STRING,
                      description:
                        'JSON string parameter aksi persis dari konteks: {"itemId":"...","qty":2,"note":"..."} atau {"requestId":"..."} atau {"reportId":"..."} atau {"month":"Dec-26"} atau {"jenis":"OFFICE_SUPPLIES","period":"2026-10"}',
                    },
                  },
                },
                followUpSuggestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2-3 saran pertanyaan lanjutan singkat dan spesifik berdasarkan jawaban ini.',
                },
              },
              required: ['reply'],
            },
          },
        });

      let response;
      try {
        response = await invokeGemini();
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : '';
        // Single short retry for transient 503/network hiccups
        if (/503|UNAVAILABLE|fetch failed|ECONNRESET|timeout/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 900));
          response = await invokeGemini();
        } else {
          throw firstErr;
        }
      }

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      return res.json({
        demoMode: false,
        noServerKey: false,
        ...parsed,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Gagal menghubungi Gemini API';
      const status =
        /403|PERMISSION_DENIED/i.test(errMsg)
          ? 403
          : /429|RESOURCE_EXHAUSTED/i.test(errMsg)
          ? 429
          : /400|API_KEY_INVALID/i.test(errMsg)
          ? 400
          : 500;
      return res.status(status).json({
        error: errMsg,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HR SupplyHub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
