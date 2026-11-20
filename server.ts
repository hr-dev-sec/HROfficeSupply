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
  app.use(express.json({ limit: '5mb' }));

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
        demoMode: true,
        message: 'GEMINI_API_KEY belum terkonfigurasi. Menggunakan mode demo berbasis data lokal.',
      });
    }

    try {
      const { message, history = [], context } = req.body as {
        message: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        context?: Record<string, unknown>;
      };

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `Anda adalah HR Assistant resmi untuk "HR SupplyHub" — Sistem Kontrol Office Supplies, Overhead Goods, Inventaris Overhead, dan Rolling Forecast GA Dept. Departemen Human Resources, PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (Seksi HR Development dan HR Adm. & Operation).

Aturan mutlak:
1. Selalu jawab dalam Bahasa Indonesia yang profesional, ringkas, akurat, dan terstruktur.
2. Gunakan hanya data konteks faktual yang diberikan dari inventaris, transaksi, Rolling Forecast GA Dept., laporan bulanan, dan status tanda tangan. Jangan pernah mengarang angka atau stok yang tidak ada di konteks.
3. HR Department tidak melakukan manajemen pembelian maupun pelaporan nominal biaya; pemesanan Office Supplies dilakukan melalui pembaruan Rolling Forecast bulanan ke GA Dept. Format tanggal gunakan gaya Indonesia (08 Oktober 2026).
4. Jika pengguna meminta melakukan aksi perubahan data (seperti mencatat pemakaian/pakai barang, memperbarui Rolling Forecast item kritis ke GA Dept., membuat draf laporan bulanan, atau mengirim pengingat ke penanda tangan), isi field "actionProposal" agar sistem dapat menampilkan kartu konfirmasi kepada pengguna sebelum mengeksekusi aksi.
5. Jika data dapat dirangkum dalam grafik batang/perbandingan kecil atau tabel singkat, isi "visualData" untuk memperkaya jawaban.
6. Untuk kebutuhan draf pesan pengingat, catatan selisih opname, pengumuman internal HR, atau checklist, tulis siap salin yang rapi.`;

      const historySnippet = history
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'Pengguna' : 'HR Assistant'}: ${h.content}`)
        .join('\n');

      const prompt = `KONTEKS SISTEM TERKINI (JSON):
${JSON.stringify(context ?? {}, null, 2)}

RIWAYAT PERCAKAPAN:
${historySnippet || '(percakapan baru)'}

PERTANYAAN / INSTRUKSI PENGGUNA:
${message}`;

      const response = await ai.models.generateContent({
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
                description: 'Jawaban utama HR Assistant dalam Bahasa Indonesia yang jelas dan rapi (boleh memakai markdown ringan seperti bullet list dan bold).',
              },
              visualData: {
                type: Type.OBJECT,
                nullable: true,
                description: 'Opsional: mini chart atau mini tabel pendukung jawaban.',
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
                description: 'Opsional: usulan aksi yang harus dikonfirmasi pengguna terlebih dahulu.',
                properties: {
                  type: {
                    type: Type.STRING,
                    description: 'RECORD_PAKAI | UPDATE_ROLLING_FORECAST | CREATE_DRAFT_REPORT | SEND_REMINDER',
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  payloadJson: {
                    type: Type.STRING,
                    description: 'JSON string berisi parameter aksi, misal {"itemId":"...","qty":2,"note":"..."} atau {"reportId":"..."} atau {"month":"Dec-26"}',
                  },
                },
              },
            },
            required: ['reply'],
          },
        },
      });

      const rawText = response.text ?? '{}';
      const parsed = JSON.parse(rawText);
      return res.json({
        demoMode: false,
        ...parsed,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Gagal menghubungi Gemini API';
      return res.status(500).json({
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
