// netlify/functions/set-preferences.ts
import type { Handler } from "@netlify/functions";

type Prefs = {
  userId: string;
  wishText: string;     // z.B. "2 kurze Fitnesstipps morgens + 1 Bibelvers abends"
  times: string[];      // lokale Zeiten: ["08:00","20:00"]
  tz: string;           // z.B. "Europe/Berlin"
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const body = JSON.parse(event.body || "{}") as Partial<Prefs>;
    const { userId, wishText, times, tz } = body;

    if (!userId || !wishText || !Array.isArray(times) || !tz) {
      return { statusCode: 400, body: JSON.stringify({ error: "userId, wishText, times[], tz required" }) };
    }

    // @ts-ignore
    const store = await import("@netlify/blobs");
    await store.set(`prefs/${userId}.json`, JSON.stringify({ wishText, times, tz }), {
      contentType: "application/json",
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error("[set-preferences] error", e);
    return { statusCode: 500, body: JSON.stringify({ error: "failed to save preferences" }) };
  }
};
