import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const sub = JSON.parse(event.body || "{}");
    // Basic validation
    if (!sub || !sub.endpoint) return { statusCode: 400, body: "Invalid subscription" };

    // Store per site, key: subscriptions.json (array of unique endpoints)
    const store = getStore({ name: "push-subs" });
    const key = "subscriptions.json";
    const currentRaw = await store.get(key, { type: "json" }) as any[] | null;
    const current = Array.isArray(currentRaw) ? currentRaw : [];

    const exists = current.find((x) => x.endpoint === sub.endpoint);
    const next = exists
      ? current.map((x) => (x.endpoint === sub.endpoint ? sub : x))
      : [...current, sub];

    await store.setJSON(key, next);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "subscribe failed" };
  }
};
