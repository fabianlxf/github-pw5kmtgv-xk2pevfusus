// netlify/functions/server.ts
import 'dotenv/config';
import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// ENV (kommen aus Netlify "Environment variables")
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GOOGLE_GEMINI_MODEL || 'gemini-1.5-flash';

// Clients
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const genAI = GOOGLE_API_KEY ? new GoogleGenerativeAI(GOOGLE_API_KEY) : null;
const geminiPlan = genAI?.getGenerativeModel({
  model: GEMINI_MODEL,
  generationConfig: { temperature: 0.3, maxOutputTokens: 900, responseMimeType: 'application/json' },
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Upload (Audio)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, env: { hasOpenAI: !!OPENAI_API_KEY, hasGoogle: !!GOOGLE_API_KEY } }));

// --- STT (Whisper bevorzugt, sonst Gemini)
async function transcribeWhisper(buf: Buffer, name: string, mime: string): Promise<string> {
  if (!openai) throw new Error('OpenAI not configured');
  const NodeFile: any = (global as any).File || (await import('undici')).File;
  const file = new NodeFile([buf], name, { type: mime || 'audio/webm' });
  const resp = await openai.audio.transcriptions.create({ file, model: 'whisper-1', temperature: 0 });
  return String((resp as any).text || '').trim();
}
async function transcribeGemini(buf: Buffer, mime: string): Promise<string> {
  if (!genAI) throw new Error('Gemini not configured');
  const stt = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const b64 = buf.toString('base64');
  const r = await stt.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Transkribiere präzise auf Deutsch.' }, { inlineData: { data: b64, mimeType: mime } }] }],
  });
  return r.response.text().trim();
}
app.post('/api/stt', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'no audio (field "file")' });
    const mime = req.file.mimetype || 'audio/webm';
    const name = req.file.originalname || 'audio.webm';
    let text = '';
    if (OPENAI_API_KEY) {
      try { text = await transcribeWhisper(req.file.buffer, name, mime); } catch (e) { console.warn('whisper failed, try gemini', e); }
    }
    if (!text && GOOGLE_API_KEY) {
      try { text = await transcribeGemini(req.file.buffer, mime); } catch (e) { console.warn('gemini stt failed', e); }
    }
    if (!text) return res.status(501).json({ error: 'no STT provider configured' });
    res.json({ text });
  } catch (e: any) {
    console.error('[/api/stt] error', e);
    res.status(500).json({ error: 'stt failed' });
  }
});

// --- Planner (Text → Tagesplan)
type PlannedTask = { title: string; start: string; end: string; category?: string; location?: string };
async function generatePlan(desc: string) {
  if (!geminiPlan) throw new Error('Gemini not configured');
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const prompt = `Erstelle einen realistischen Zeitplan für den nächsten Tag als JSON:
{ "date":"YYYY-MM-DD", "timezone":"Europe/Berlin",
  "tasks":[{ "title":"...", "start":"${day}THH:MM:00", "end":"${day}THH:MM:00", "category":"fitness|finances|learning|personal|work|creativity|social|mind|org|impact|other" }]}
Nutzer-Notizen:\n${desc}`;
  const r = await geminiPlan.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  let parsed: any; try { parsed = JSON.parse(r.response.text()); } catch { parsed = { date: day, tasks: [] }; }
  return parsed;
}
app.post('/api/plan/day', async (req, res) => {
  try {
    const description = String(req.body?.description || '').trim();
    if (!description) return res.status(400).json({ error: 'description required' });
    if (!GOOGLE_API_KEY) return res.status(501).json({ error: 'Gemini not configured' });
    const plan = await generatePlan(description);
    const events = (Array.isArray(plan.tasks) ? plan.tasks : []).map((t: PlannedTask) => ({
      title: t.title || 'Task',
      start: t.start, end: t.end, category: t.category || 'other',
    }));
    res.json({ date: plan.date, timezone: plan.timezone, events });
  } catch (e) {
    console.error('[/api/plan/day] error', e);
    res.status(500).json({ error: 'Plan generation failed' });
  }
});

// Netlify braucht den Handler:
export const handler = serverless(app);
