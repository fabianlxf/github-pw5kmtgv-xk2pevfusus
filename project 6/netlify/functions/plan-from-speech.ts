import type { Handler } from "@netlify/functions";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
    if (!OPENAI_API_KEY || !GOOGLE_API_KEY) {
      return { statusCode: 501, body: JSON.stringify({ error: "Keys missing" }) };
    }

    if (!event.body) return { statusCode: 400, body: JSON.stringify({ error: "no audio body" }) };

    const isBase64 = event.isBase64Encoded;
    const buf = Buffer.from(event.body, isBase64 ? "base64" : "utf8");
    const mime = event.headers["content-type"] || "audio/webm";

    // 1) STT (Whisper)
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const file = new File([buf], "speech.webm", { type: mime });
    const stt = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      temperature: 0,
    });
    const transcript = String((stt as any).text || "").trim();
    if (!transcript) return { statusCode: 422, body: JSON.stringify({ error: "Kein Text erkennbar." }) };

    // 2) Plan (Gemini)
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
Gib NUR gültiges JSON zurück (keinen Text außerhalb) für:
- date, timezone, tasks[{title,start,end,category}]
Nutzer-Notizen (Transkript):
${transcript}
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
      body: JSON.stringify({ text: transcript, date: parsed.date || day, timezone: parsed.timezone || tz, events }),
    };
  } catch (e: any) {
    console.error("[/api/plan/from-speech] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "plan-from-speech failed" }) };
  }
};