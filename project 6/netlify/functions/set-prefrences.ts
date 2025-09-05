// netlify/functions/set-preferences.ts
import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

type Prefs = {
  userId: string;
  wishText: string;              // z.B. "Tägliche kurze Fitnesstipps"
  times?: string[];              // HH:mm, z.B. ["08:00","18:00"]
  tz?: string;                   // IANA TZ, z.B. "Europe/Berlin"
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST" };
  }

  try {
    const body = JSON.parse(event.body || "{}") as Partial<Prefs>;
    const userId = String(body.userId || "").trim();
    const wishText = String(body.wishText || "").trim();
    const times = Array.isArray(body.times) && body.times.length ? body.times.map(String) : ["08:00"];
    const tz = String(body.tz || "Europe/Berlin");

    if (!userId || !wishText) {
      return { statusCode: 400, body: JSON.stringify({ error: "userId & wishText required" }) };
    }

    const store = getStore({ name: "prefs" }); // Blob-Namespace „prefs“
    await store.setJSON(`prefs/${userId}.json`, { userId, wishText, times, tz });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e: any) {
    console.error("[set-preferences] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "failed" }) };
  }
};
