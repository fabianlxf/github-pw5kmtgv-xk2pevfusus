import type { Handler } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
    if (!GOOGLE_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "GOOGLE_API_KEY missing" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const description = String(body?.description || "").trim();
    if (!description) {
      return { statusCode: 400, body: JSON.stringify({ error: "description required" }) };
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const geminiPlan = genAI.getGenerativeModel({
      model: process.env.GOOGLE_GEMINI_MODEL || "gemini-1.5-flash",
      generationConfig: { temperature: 0.3, maxOutputTokens: 900, responseMimeType: "application/json" },
    });

    const day = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tz = "Europe/Berlin";
    const startH = 9; const endH = 18;

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
      "category":"fitness|finances|learning|personal|work|creativity|social|mind|org|impact|other"
    }
  ]
}
Regeln:
- Zeitfenster strikt: ${startH}:00–${endH}:00 lokal, inkl. kurzer Pausen.
- Dauer pro Task 30–120 Min. Keine leeren Felder.
- Wenn keine Kategorie passt, nimm "other".
Nutzer-Notizen:
${description}
`;

    const resp = await geminiPlan.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let parsed: any;
    try { parsed = JSON.parse(resp.response.text()); } catch { parsed = { date: day, timezone: tz, tasks: [] }; }

    const events = Array.isArray(parsed.tasks) ? parsed.tasks.map((t: any) => ({
      title: String(t?.title || "Task"),
      start: t?.start || `${day}T09:00:00`,
      end: t?.end || `${day}T10:00:00`,
      category: String(t?.category || "other"),
    })) : [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: parsed.date || day, timezone: parsed.timezone || tz, events }),
    };
  } catch (e: any) {
    console.error("[/api/plan/day] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "Plan generation failed" }) };
  }
};