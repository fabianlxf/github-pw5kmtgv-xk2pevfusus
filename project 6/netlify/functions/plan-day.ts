import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

type PlannedTask = {
  title: string;
  start: string;
  end: string;
  category?: string;
  location?: string;
  needsInput?: boolean;
  inputPrompts?: string[];
};

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

export const handler: Handler = async (event) => {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "GOOGLE_API_KEY fehlt" }) };
    }
    const body = event.body ? JSON.parse(event.body) : {};
    const description: string = String(body?.description || "").trim();
    if (!description) return { statusCode: 400, body: JSON.stringify({ error: "description required" }) };

    const day = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tz = "Europe/Berlin";
    const startH = 9, endH = 18;

    const prompt = `
Erstelle einen realistischen Zeitplan für den nächsten Tag. Gib NUR gültiges JSON zurück:
{
  "date":"YYYY-MM-DD",
  "timezone":"${tz}",
  "tasks":[
    {"title":"string","start":"${day}THH:MM:00","end":"${day}THH:MM:00","category":"fitness|finances|learning|personal|work|creativity|social|mind|org|impact|other"}
  ]
}
Regeln:
- Zeitfenster strikt: ${startH}:00–${endH}:00 lokal.
- Dauer pro Task 30–120 Min.
- Wenn keine Kategorie passt -> "other".
Nutzer-Notizen:
${description}`;

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GOOGLE_GEMINI_MODEL || "gemini-1.5-flash",
      generationConfig: { temperature: 0.3, maxOutputTokens: 900, responseMimeType: "application/json" },
    });

    const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const raw = resp.response.text();

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = { date: day, timezone: tz, tasks: [] }; }

    const tasksIn = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    let cursor = startH;
    const tasks: PlannedTask[] = tasksIn.map((t: any) => {
      let start = t?.start, end = t?.end;
      const sh = Number((start || "").slice(11, 13));
      const eh = Number((end || "").slice(11, 13));
      if (!Number.isFinite(sh) || !Number.isFinite(eh)) {
        const sH = clamp(cursor, startH, endH - 1);
        const eH = clamp(sH + 1, sH + 1, endH);
        start = `${day}T${String(sH).padStart(2, "0")}:00:00`;
        end   = `${day}T${String(eH).padStart(2, "0")}:00:00`;
        cursor = eH;
      } else {
        cursor = Math.max(cursor, eh);
      }
      const cat = String(t?.category || "other").toLowerCase();
      const ok = ["fitness","finances","learning","personal","work","creativity","social","mind","org","impact","other"].includes(cat);
      return {
        title: String(t?.title || "Task"),
        start, end,
        category: ok ? cat : "other",
      };
    });

    // Frontend erwartet { events: [...] }
    const events = tasks.map(t => ({
      title: t.title,
      start: t.start,
      end:   t.end,
      category: t.category || "other",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: parsed?.date || day, timezone: parsed?.timezone || tz, events }),
    };
  } catch (e: any) {
    console.error("[plan-day] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "Plan generation failed" }) };
  }
};
