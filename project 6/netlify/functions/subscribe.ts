import type { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/**
 * POST /.netlify/functions/subscribe
 * Body: JSON Web PushSubscription
 * Stores unique subscriptions in a single JSON array: "subscriptions.json" (within the named store "push-subs").
 * Adds basic CORS + validation and makes the function idempotent for the same endpoint.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler: Handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
  }

  try {
    // Content-type hint (not strictly required, but helps debugging)
    const ct = (event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
    if (ct && !ct.includes("application/json")) {
      // We still try to parse, but warn in response
      // (Netlify fetch from browser will send correct header)
    }

    const bodyRaw = event.body || "";
    let sub: any = null;
    try {
      sub = JSON.parse(bodyRaw);
    } catch {
      return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid JSON" };
    }

    // Basic validation of PushSubscription shape
    if (!sub || typeof sub !== "object" || !sub.endpoint || typeof sub.endpoint !== "string") {
      return { statusCode: 400, headers: CORS_HEADERS, body: "Invalid subscription" };
    }
    // Optional sanity limit to avoid oversized payloads
    const payloadSize = bodyRaw.length;
    if (payloadSize > 64 * 1024) {
      return { statusCode: 413, headers: CORS_HEADERS, body: "Payload too large" };
    }

    // Named store keeps things organized in the dashboard
    const store = getStore({ name: "push-subs" });
    const key = "subscriptions.json";

    // Read existing list (if any)
    const currentRaw = (await store.get(key, { type: "json" })) as any[] | null;
    const current = Array.isArray(currentRaw) ? currentRaw : [];

    // Deduplicate by endpoint (idempotent upsert)
    const existsIdx = current.findIndex((x) => x && x.endpoint === sub.endpoint);
    if (existsIdx >= 0) {
      current[existsIdx] = sub;
    } else {
      current.push(sub);
    }

    // Optional: Cap list to a reasonable size (safety)
    const MAX_SUBS = 5000;
    const trimmed = current.slice(-MAX_SUBS);

    await store.setJSON(key, trimmed);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, count: trimmed.length }),
    };
  } catch (e: any) {
    // Avoid leaking internals but keep message
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: e?.message || "subscribe failed",
    };
  }
};
