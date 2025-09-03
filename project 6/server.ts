// server.ts – Express + Vite + WebPush + STT (Whisper/Gemini) + Gemini Planner + ICS
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import multer from 'multer';
import webpush from 'web-push';
import type { PushSubscription } from 'web-push';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// --- Inline-config (allows hardcoded fallback keys when env vars are missing)
const CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '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',
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || 'AIzaSyD-9tSrQWn_ZPybkST863oWSp3pzDxOK30',
  GOOGLE_GEMINI_MODEL: process.env.GOOGLE_GEMINI_MODEL || 'gemini-1.5-flash',
};

const openai = CONFIG.OPENAI_API_KEY ? new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY }) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 1234);

console.log('[startup] PORT=', PORT);
console.log('[startup] OPENAI key present:', !!CONFIG.OPENAI_API_KEY);
console.log('[startup] GOOGLE key present:', !!CONFIG.GOOGLE_API_KEY);
console.log('[startup] GEMINI model:', CONFIG.GOOGLE_GEMINI_MODEL);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// --- Upload (Audio)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// --- WebPush (optional, tolerant)
try {
  const pub = process.env.VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  if (pub && priv) {
    webpush.setVapidDetails('mailto:you@example.com', pub, priv);
    console.log('[webpush] enabled');
  } else {
    console.log('[webpush] disabled (no VAPID keys)');
  }
} catch (e) {
  console.warn('[webpush] init failed, disabled:', e);
}

// In-memory stores
const subscriptions = new Map<string, PushSubscription>();
const dayTimers = new Map<string, NodeJS.Timeout[]>();

type Prefs = { reminderHour: number; reminderMinute: number; tz: string };
const userPrefs = new Map<string, Prefs>();
function getUserPrefs(userId: string): Prefs {
  return userPrefs.get(userId) ?? { reminderHour: 22, reminderMinute: 0, tz: 'Europe/Berlin' };
}

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, port: PORT }));
// Key presence (ohne Secrets zu leaken)
app.get('/api/health/keys', (_req, res) => {
  res.json({
    hasOpenAI: !!CONFIG.OPENAI_API_KEY,
    hasGoogle: !!CONFIG.GOOGLE_API_KEY,
    model: CONFIG.GOOGLE_GEMINI_MODEL,
  });
});

// Posters (optional helper)
app.get('/api/posters', async (_req, res) => {
  try {
    const fsP = await import('node:fs/promises');
    const base = path.join(process.cwd(), 'public');
    const candidates = [path.join(base, 'posters'), path.join(base, 'Posters')];
    const files: { url: string; name: string }[] = [];
    for (const dir of candidates) {
      try {
        // @ts-ignore
        const dirents = await fsP.readdir(dir, { withFileTypes: true });
        for (const d of dirents) {
          const name = (d as any).name ?? d;
          if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
            const url = dir.endsWith('Posters') ? `/Posters/${name}` : `/posters/${name}`;
            files.push({ url, name });
          }
        }
      } catch (e: any) {
        if (e?.code === 'ENOENT') continue;
        throw e;
      }
    }
    res.json(files);
  } catch (e) {
    console.error('poster list error', e);
    res.status(500).json({ error: 'failed to list posters' });
  }
});

// Push helpers (optional)
function schedulePushAt(userId: string, when: Date, payload: { title: string; description?: string }) {
  const delay = Math.max(0, when.getTime() - Date.now());
  const timers = dayTimers.get(userId) ?? [];
  const t = setTimeout(async () => {
    try {
      const sub = subscriptions.get(userId);
      if (!sub) return;
      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title: `Bald: ${payload.title}`,
          body: (payload.description || 'Kleiner, klarer Startimpuls.').slice(0, 140),
          url: '/plan',
        })
      );
    } catch (e) {
      console.error('[push scheduled] error', e);
    }
  }, delay);
  timers.push(t);
  dayTimers.set(userId, timers);
}
function clearUserTimers(userId: string) {
  const old = dayTimers.get(userId) || [];
  old.forEach(clearTimeout);
  dayTimers.delete(userId);
}
app.post('/api/push/save-subscription', (req, res) => {
  const { userId, subscription } = req.body || {};
  if (!userId || !subscription) return res.status(400).json({ error: 'userId + subscription required' });
  subscriptions.set(userId, subscription);
  res.json({ ok: true });
});
app.post('/api/push/send', async (req, res) => {
  try {
    const { userId, title, body, url } = req.body || {};
    const sub = subscriptions.get(userId);
    if (!sub) return res.status(404).json({ error: 'no subscription for user' });
    await webpush.sendNotification(sub, JSON.stringify({ title: title || 'Test', body: body || 'Hallo', url: url || '/' }));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'push failed' });
  }
});

// --- STT: Provider-Funktionen
async function transcribeWithWhisper(buf: Buffer, filename: string, mime: string): Promise<string> {
  if (!openai) throw new Error('OpenAI not configured');
  const NodeFile: any = (global as any).File || (await import('undici')).File;
  const file = new NodeFile([buf], filename, { type: mime || 'audio/webm' });
  const resp = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    temperature: 0,
  });
  return String((resp as any).text || '').trim();
}

const genAI = CONFIG.GOOGLE_API_KEY ? new GoogleGenerativeAI(CONFIG.GOOGLE_API_KEY) : null;
const geminiStt = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;
const geminiPlan = genAI
  ? genAI.getGenerativeModel({
      model: CONFIG.GOOGLE_GEMINI_MODEL,
      generationConfig: { temperature: 0.3, maxOutputTokens: 900, responseMimeType: 'application/json' },
    })
  : null;

async function transcribeWithGemini(buf: Buffer, mime: string): Promise<string> {
  if (!geminiStt) throw new Error('Gemini not configured');
  const b64 = buf.toString('base64');
  const resp = await geminiStt.generateContent({
    contents: [{ role: 'user', parts: [{ text: 'Transkribiere präzise auf Deutsch.' }, { inlineData: { data: b64, mimeType: mime } }] }],
  });
  return resp.response.text().trim();
}

// --- Gemeinsamer STT-Handler (Whisper > Gemini > Fehler)
async function sttHandler(req: any, res: any) {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'no audio file (field name must be "file")' });
    const mime = req.file.mimetype || 'audio/webm';
    const name = req.file.originalname || 'audio.webm';

    let text = '';
    if (CONFIG.OPENAI_API_KEY) {
      try {
        text = await transcribeWithWhisper(req.file.buffer, name, mime);
      } catch (e: any) {
        console.warn('[stt] whisper failed, trying gemini:', e?.message || e);
      }
    }
    if (!text && CONFIG.GOOGLE_API_KEY) {
      try {
        text = await transcribeWithGemini(req.file.buffer, mime);
      } catch (e: any) {
        console.warn('[stt] gemini failed:', e?.message || e);
      }
    }
    if (!text) {
      return res.status(501).json({ error: 'Kein STT Provider konfiguriert (OPENAI_API_KEY/GOOGLE_API_KEY).' });
    }
    return res.json({ text });
  } catch (e) {
    console.error('[stt] error', e);
    return res.status(500).json({ error: 'stt failed' });
  }
}

// --- Beide Routen auf denselben STT-Handler mappen
app.post('/api/stt', upload.single('file'), sttHandler);
app.post('/api/stt-gemini', upload.single('file'), sttHandler);

// --- Planning types/state
type PlannedTask = {
  title: string;
  start: string;
  end: string;
  category?: string;
  location?: string;
  needsInput?: boolean;
  inputPrompts?: string[];
};
type NextDayPlan = { date: string; timezone?: string; tasks: PlannedTask[] };
const plansByUser = new Map<string, NextDayPlan>();

// === Planner (Gemini)
async function generateNextDayPlan(
  userText: string,
  opts: { dayISO?: string; startHour?: number; endHour?: number; includeInputs?: boolean; tz?: string }
): Promise<NextDayPlan> {
  const day = opts.dayISO ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tz = opts.tz ?? 'Europe/Berlin';
  const startH = Number.isFinite(opts.startHour) ? opts.startHour! : 9;
  const endH = Number.isFinite(opts.endHour) ? opts.endHour! : 18;

  const prompt = `
Erstelle einen realistischen Zeitplan für den nächsten Tag. Passe die Uhrzeiten an das Beschriebene an.
Gib NUR gültiges JSON zurück (keinen Text außerhalb):
{
  "date":"YYYY-MM-DD",
  "timezone":"${tz}",
  "tasks":[
    {
      "title":"string (kurz, aktiv)",
      "start":"${day}THH:MM:00",
      "end":"${day}THH:MM:00",
      "category":"fitness|finances|learning|personal|work|creativity|social|mind|org|impact|other",
      "location":"optional",
      "needsInput":true|false,
      "inputPrompts":["optional strings"]
    }
  ]
}
Regeln:
- Zeitfenster strikt: ${startH}:00–${endH}:00 lokal, inkl. kurzer Pausen.
- Dauer pro Task 30–120 Min. Keine leeren Felder.
- Wenn keine Kategorie passt, nimm "other".
- includeInputs=${!!opts.includeInputs}: wenn false -> needsInput=false und inputPrompts weglassen.
- Respektiere feste Zeiten aus den Nutzer-Notizen.
Nutzer-Notizen:
${userText}
`;

  if (!geminiPlan) throw new Error('Gemini not configured');

  const resp = await geminiPlan.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const raw = resp.response.text();

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { date: day, timezone: tz, tasks: [] };
  }

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const tasksIn = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  let cursor = startH;
  const tasks: PlannedTask[] = tasksIn.map((t: any) => {
    let start = t?.start;
    let end = t?.end;
    const sh = Number((start || '').slice(11, 13));
    const eh = Number((end || '').slice(11, 13));
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) {
      const sH = clamp(cursor, startH, endH - 1);
      const eH = clamp(sH + 1, sH + 1, endH);
      start = `${day}T${String(sH).padStart(2, '0')}:00:00`;
      end = `${day}T${String(eH).padStart(2, '0')}:00:00`;
      cursor = eH;
    } else {
      cursor = Math.max(cursor, eh);
    }
    const cat = String(t?.category || 'other').toLowerCase();
    return {
      title: String(t?.title || 'Task'),
      start,
      end,
      category: ['fitness', 'finances', 'learning', 'personal', 'work', 'creativity', 'social', 'mind', 'org', 'impact', 'other'].includes(cat)
        ? cat
        : 'other',
      location: t?.location ? String(t.location) : undefined,
      needsInput: !!t?.needsInput && !!opts.includeInputs,
      inputPrompts: opts.includeInputs ? (Array.isArray(t?.inputPrompts) ? t.inputPrompts.map(String) : undefined) : undefined,
    };
  });

  return { date: parsed?.date || day, timezone: parsed?.timezone || tz, tasks };
}

// ICS helpers
function pad2(n: number) { return n < 10 ? '0' + n : String(n); }
function toUtcBasic(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    'Z'
  );
}
function escapeICS(text: string) {
  return (text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function buildICS(userId: string, plan: NextDayPlan) {
  const now = new Date();
  const dtstamp = toUtcBasic(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Focus Coach//EN',
    'CALSCALE:GREGORIAN',
  ];
  plan.tasks.forEach((t, idx) => {
    const uid = `${userId}-${plan.date}-${idx}@focuscoach`;
    const s = new Date(t.start);
    const e = new Date(t.end);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toUtcBasic(s)}`,
      `DTEND:${toUtcBasic(e)}`,
      `SUMMARY:${escapeICS(t.title)}`,
      t.location ? `LOCATION:${escapeICS(t.location)}` : '',
      t.needsInput && t.inputPrompts?.length ? `DESCRIPTION:${escapeICS(t.inputPrompts.join(' | '))}` : '',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

// --- Audio -> (STT) -> (Gemini Plan) -> ICS
app.post('/api/plan/from-speech', upload.single('file'), async (req, res) => {
  const started = Date.now();
  try {
    const { userId = 'demo-user', includeInputs = 'true', startHour = '9', endHour = '18' } = req.body || {};
    if (!req.file?.buffer) return res.status(400).json({ error: 'no audio file (field name must be "file")' });

    // 1) STT (Whisper bevorzugt, sonst Gemini – identisch zu /api/stt)
    const mime = req.file.mimetype || 'audio/webm';
    const name = req.file.originalname || 'audio.webm';
    let text = '';
    if (CONFIG.OPENAI_API_KEY) {
      try {
        text = await transcribeWithWhisper(req.file.buffer, name, mime);
      } catch (e: any) {
        console.warn('[from-speech] whisper failed, trying gemini:', e?.message || e);
      }
    }
    if (!text && CONFIG.GOOGLE_API_KEY) {
      text = await transcribeWithGemini(req.file.buffer, mime);
    }
    if (!text) return res.status(501).json({ error: 'Kein STT Provider konfiguriert.' });

    // 2) Plan (Gemini)
    if (!CONFIG.GOOGLE_API_KEY) return res.status(501).json({ error: 'Gemini Planner nicht konfiguriert.' });
    let plan: NextDayPlan;
    try {
      plan = await generateNextDayPlan(text, {
        includeInputs: String(includeInputs) === 'true',
        startHour: Number(startHour),
        endHour: Number(endHour),
        tz: getUserPrefs(userId).tz,
      });
    } catch (err) {
      console.error('[from-speech] plan error:', err);
      return res.status(500).json({ error: 'plan generation failed' });
    }

    plansByUser.set(userId, plan);
    const icsUrl = `/api/plan/ics?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(plan.date)}`;
    console.log(`[from-speech] ok in ${Date.now() - started}ms, tasks=${plan.tasks?.length ?? 0}`);
    res.json({ text, plan, icsUrl });
  } catch (e) {
    console.error('[from-speech] fatal', e);
    res.status(500).json({ error: 'plan-from-speech failed' });
  }
});

// ICS download
app.get('/api/plan/ics', (req, res) => {
  const userId = String(req.query.userId || '');
  const date = String(req.query.date || '');
  if (!userId || !date) return res.status(400).send('userId and date required');
  const plan = plansByUser.get(userId);
  if (!plan || plan.date !== date) return res.status(404).send('plan not found');
  const ics = buildICS(userId, plan);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="plan-${date}.ics"`);
  res.send(ics);
});

// Reminder prefs
app.get('/api/reminder/prefs', (req, res) => {
  const userId = String(req.query.userId || 'demo-user');
  res.json(getUserPrefs(userId));
});
app.post('/api/reminder/prefs', (req, res) => {
  const { userId = 'demo-user', hour = 22, minute = 0, tz = 'Europe/Berlin' } = req.body || {};
  userPrefs.set(userId, { reminderHour: Number(hour), reminderMinute: Number(minute), tz });
  res.json({ ok: true });
});

// --- Vite Dev / Static
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await (await import('vite')).createServer({
      root: process.cwd(),
      server: { middlewareMode: true, host: true, port: PORT },
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) return next();
      try {
        const html = await vite.transformIndexHtml(
          req.originalUrl,
          `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0b1020" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <link rel="icon" href="/icon-192.png" />
    <title>Focus Coach</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
        );
        res.status(200).setHeader('Content-Type', 'text/html').end(html);
      } catch (e) {
        (vite as any).ssrFixStacktrace?.(e as Error);
        next(e);
      }
    });
  } else {
    const dist = path.resolve(__dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${PORT}`));
}
start();

// --- Text → Plan (Gemini)
app.post('/api/plan/day', async (req, res) => {
  try {
    if (!CONFIG.GOOGLE_API_KEY) return res.status(501).json({ error: 'Gemini nicht konfiguriert.' });
    const description = String(req.body?.description || '').trim();
    if (!description) return res.status(400).json({ error: 'description required' });

    const plan = await generateNextDayPlan(description, {
      includeInputs: true,
      startHour: 9,
      endHour: 18,
      tz: 'Europe/Berlin',
    });

    const events = plan.tasks.map((t) => ({
      title: t.title,
      start: t.start,
      end: t.end,
      category: t.category || 'other',
    }));
    plansByUser.set('demo-user', plan);
    res.json({ date: plan.date, timezone: plan.timezone, events });
  } catch (e) {
    console.error('plan/day error', e);
    res.status(500).json({ error: 'Plan generation failed' });
  }
});