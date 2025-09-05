// netlify/functions/set-preferences.ts
import type { Handler } from '@netlify/functions';
import { set as blobSet } from '@netlify/blobs';

type Prefs = {
  userId: string;
  wishText: string;     // z.B. "2 kurze Fitnesstipps morgens + 1 Bibelvers abends"
  times: string[];      // lokale Zeiten: ["08:00","20:00"]
  tz: string;           // z.B. "Europe/Berlin"
};

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  // Optional: CORS/Preflight erlauben, falls du es später cross-origin brauchst
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}') as Partial<Prefs>;
    const { userId, wishText, times, tz } = body;

    if (!userId || !wishText || !Array.isArray(times) || !tz) {
      return json(400, { error: 'userId, wishText, times[], tz required' });
    }

    // Zeiten normalisieren → "HH:MM"
    const normTimes = times
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(t);
        if (!m) return null;
        let h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
        let mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
        return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      })
      .filter((x): x is string => !!x);

    const key = `prefs/${encodeURIComponent(userId)}.json`;

    await blobSet(
      key,
      JSON.stringify({ wishText: String(wishText), times: normTimes, tz: String(tz) }),
      { contentType: 'application/json' }
    );

    return json(200, { ok: true, key, count: normTimes.length });
  } catch (e: any) {
    console.error('[set-preferences] error', e);
    return json(500, { error: 'failed to save preferences' });
  }
};
