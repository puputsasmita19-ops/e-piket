import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable CORS and preflight handling for all /api endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Shared Gemini client utility on the server with user agent telemetry
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: AI Health and Status (Multiple route aliases)
const handleAiStatus = (req: express.Request, res: express.Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    model: 'gemini-3.8-flash',
    apiKeyConfigured: hasKey,
    provider: 'Google Gemini AI Studio'
  });
};
app.get('/api/ai/status', handleAiStatus);
app.get('/api/status', handleAiStatus);
app.get('/api/health', handleAiStatus);
app.get('/health', handleAiStatus);

// API: Executive Summary generation using Gemini 3.8 Flash
const handleExecutiveSummary = async (req: express.Request, res: express.Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi pada server.',
        fallbackRequired: true
      });
    }

    const { schoolName, dateStr, schedules = [], incidents = [], logbooks = [] } = req.body;

    const totalPetugas = schedules.length;
    const hadir = schedules.filter((s: any) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
    const terlambat = schedules.filter((s: any) => s.status === 'terlambat').length;
    const belumCheckin = schedules.filter((s: any) => s.status === 'belum_checkin').length;

    const prompt = `
Anda adalah Asisten Eksekutif Kepala Sekolah untuk aplikasi e-Piket Digital di ${schoolName || 'Sekolah'}.
Buatkan ringkasan eksekutif (Executive Summary) profesional, padat, dan terstruktur untuk Kepala Sekolah berdasarkan data piket tanggal ${dateStr} berikut:

Data Kehadiran:
- Total Petugas Terjadwal: ${totalPetugas}
- Hadir/Bertugas: ${hadir}
- Terlambat: ${terlambat}
- Belum Check-in: ${belumCheckin}

Daftar Petugas:
${schedules.map((s: any) => `- ${s.userName} (${s.postName}) : Status ${s.status}`).join('\n')}

Kejadian yang Tercatat (${incidents.length} kejadian):
${incidents.map((inc: any) => `- [${(inc.prioritas || 'sedang').toUpperCase()}] ${inc.lokasi || '-'} (${inc.waktu || '-'}): ${inc.deskripsi} -> Tindakan: ${inc.tindakanAwal || '-'}`).join('\n')}

Catatan Buku Piket:
${logbooks.map((l: any) => `- ${l.userName} (${l.postName}): Kondisi: ${l.kondisiSelamaBertugas || '-'}. Tindak Lanjut: ${l.tindakLanjut || '-'}`).join('\n')}

Berikan respon dalam format JSON murni tanpa markdown pembungkus (backticks):
{
  "headline": "Ringkasan 1 kalimat tajam situasi sekolah hari ini",
  "attendanceSummary": "Analisis kedisiplinan dan kehadiran petugas pos piket",
  "incidentAnalysis": "Analisis kejadian, ketertiban siswa, dan hal-hal yang butuh atensi pimpinan",
  "actionItems": ["Tindakan 1 yang perlu diambil pimpinan/guru", "Tindakan 2", "Tindakan 3"],
  "praiseNotes": "Apresiasi untuk pos/petugas yang bertugas dengan baik"
}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch {
      // Clean possible markdown code fence
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedData = JSON.parse(cleanJson);
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error in /api/ai/executive-summary:', error);
    return res.status(500).json({
      error: error.message || 'Gagal menghasilkan ringkasan AI',
      fallbackRequired: true
    });
  }
};
app.post('/api/ai/executive-summary', handleExecutiveSummary);
app.post('/api/executive-summary', handleExecutiveSummary);
app.post('/api/ai/summary', handleExecutiveSummary);
app.post('/api/summary', handleExecutiveSummary);

// Fallback for unmatched /api requests so they return standard JSON instead of 404 HTML
app.all('/api/*', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'e-Piket Digital API service is online',
    path: req.path
  });
});

// Setup dev server with Vite middlewares or static files for production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: Number(PORT),
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
