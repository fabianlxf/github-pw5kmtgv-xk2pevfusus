// netlify/functions/push-daily.ts
import type { Handler } from "@netlify/functions";
import webpush from "web-push";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Netlify setzt diese ENV in Site Settings → Environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:you@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const genAI = GOOGLE_API_KEY ? new GoogleGenerativeAI(GOOGLE_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// kleine Helfer
function fmtHM(d: Date, tz: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz
  }).format(d);
}

async function listKeys(prefix: string): Promise<string[]> {
  // @ts-ignore
  const { list } = await import("@netlify/blobs");
  const entries = await list({ prefix });
  return entries.blobs.map((b: any) => b.key);
}

async function getJSON<T=any>(key: string): Promise<T | null> {
  // @ts-ignore
  const { get } = await import("@netlify/blobs");
  const txt = await get(key, { type: "text" });
  if (!txt) return null;
  try { return JSON.parse(txt as string); } catch { return null; }
}

async function sendPush(subscription: any, payload: any) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error("[push] send error", e);
    return false;
  }
}

export const handler: Handler = async () => {
  try {
    if (!model) return { statusCode: 501, body: "GOOGLE_API_KEY not set" };
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { statusCode: 501, body: "VAPID keys missing" };

    // Alle gespeicherten Prefs laden
    const prefKeys = await listKeys("prefs/");
    const nowUTC = new Date();
    let sent = 0;

    for (const key of prefKeys) {
      // userId aus key ziehen
      // Beispiel key: "prefs/demo-user.json"
      const userId = key.replace(/^prefs\//, "").replace(/\.json$/, "");

      const prefs = await getJSON<{ wishText: string; times: string[]; tz: string }>(key);
      if (!prefs || !prefs.times?.length || !prefs.tz) continue;

      // lokale Uhrzeit dieses Users bestimmen
      const nowHM = fmtHM(nowUTC, prefs.tz); // "HH:MM"
      // Wenn *eine* der gewünschten Zeiten == aktuelle lokale Stunde:Minute ist → senden
      if (!prefs.times.includes(nowHM)) continue;

      // Abo laden
      const sub = await getJSON<any>(`subs/${userId}.json`);
      if (!sub) continue;

      // Gemini: kurzen Tipp generieren
      const prompt = `Erzeuge einen sehr kurzen, motivierenden Tagesimpuls basierend auf diesem Wunsch des Nutzers (max 250 Zeichen, sachlich, freundlich, DE):
Wunsch: ${prefs.wishText}
Formatiere als: Titel — ein kurzer Satz. Keine Emojis.`;

      const resp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      const full = resp.response.text().trim();
      const [titleRaw, ...rest] = full.split("—");
      const title = (titleRaw || "Tagesimpuls").trim();
      const body = rest.join("—").trim() || "Kleiner Schritt – jetzt starten.";

      // Push senden
      const ok = await sendPush(sub, {
        title,
        body,
        url: "/plan"
      });
      if (ok) sent++;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, sent }) };
  } catch (e: any) {
    console.error("[push-daily] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "failed", detail: e?.message }) };
  }
};
