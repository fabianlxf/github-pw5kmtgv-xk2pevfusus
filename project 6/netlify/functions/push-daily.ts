// netlify/functions/push-daily.ts
import type { Handler } from "@netlify/functions";
import { getStore, list } from "@netlify/blobs";
import webpush from "web-push";
import { GoogleGenerativeAI } from "@google/generative-ai";

type PrefFile = {
  userId: string;
  wishText: string;
  times: string[];   // ["08:00","18:00"]
  tz: string;        // "Europe/Berlin"
};

type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
};

const genAI = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

webpush.setVapidDetails(
  "mailto:you@example.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

function nowInTZ(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return `${parts.hour}:${parts.minute}`;
}

async function generateTip(wishText: string): Promise<string> {
  if (!genAI) return "Täglicher Impuls.";
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
Erzeuge einen sehr kurzen, motivierenden Impuls (max. 2 Sätze, <= 220 Zeichen) zum Thema:
"${wishText}".

Format:
- Kein Disclaimer, keine Emojis, keine Einleitung.
- Direkt der Inhalt, knackig, alltagsnah.
  `.trim();

  const r = await model.generateContent(prompt);
  const text = (r.response.text() || "").trim();
  return text || "Bleib dran – ein kleiner Schritt zählt.";
}

export const handler: Handler = async () => {
  try {
    // 1) Alle Pref-Files holen
    const prefsStore = getStore({ name: "prefs" });
    const listed = await list({ prefix: "prefs/" }); // listet alle keys in diesem Namespace
    const prefKeys = listed.blobs.map((b) => b.key);

    // 2) Jetztige Zeit je User-TZ prüfen + ggf. pushen
    const subsStore = getStore({ name: "subs" }); // hier liegen Push-Subscriptions userweise
    let pushed = 0;

    for (const key of prefKeys) {
      const pref = (await prefsStore.getJSON(key)) as PrefFile | null;
      if (!pref) continue;

      const localNowHHMM = nowInTZ(pref.tz || "Europe/Berlin");
      const shouldSend = (pref.times || ["08:00"]).some((t) => t === localNowHHMM);
      if (!shouldSend) continue;

      // Gemini-Text erzeugen
      const body = await generateTip(pref.wishText || "Täglicher Fokus-Impuls");

      // Subscriptions des Users laden (einfaches Beispiel: eine JSON-Datei pro User)
      const subKey = `subs/${pref.userId}.json`;
      const subJson = (await subsStore.getJSON(subKey)) as { subs: PushSub[] } | null;
      const subs = subJson?.subs || [];
      if (!subs.length) continue;

      // Push senden
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: s.keys } as any,
              JSON.stringify({
                title: "Dein täglicher Impuls",
                body,
                url: "/plan", // Zielseite in deiner App
              })
            );
            pushed++;
          } catch (e) {
            console.warn("[push] failed for", s.endpoint, e);
          }
        })
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, pushed }),
    };
  } catch (e: any) {
    console.error("[push-daily] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "failed" }) };
  }
};
