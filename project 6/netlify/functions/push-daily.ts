import type { Handler } from "@netlify/functions";
import webpush from "web-push";
import { getStore } from "@netlify/blobs";

const TIPS = [
  "Trinke direkt nach dem Aufstehen 300–500 ml Wasser.",
  "Kurze Mobility: 5× Schulterkreisen + 5× Hüftkreisen.",
  "10 Minuten zügig spazieren nach dem Mittagessen.",
  "Abends 5 Minuten leichtes Stretching für besseren Schlaf."
];

const BIBLE_VERSES = [
  { ref: "Psalm 23,1", text: "Der Herr ist mein Hirte; mir wird nichts mangeln." },
  { ref: "Matthäus 5,9", text: "Selig sind die Friedfertigen; denn sie werden Gottes Kinder heißen." },
  { ref: "Philipper 4,13", text: "Ich vermag alles durch den, der mich mächtig macht: Christus." }
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const handler: Handler = async () => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env as Record<string,string>;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return { statusCode: 500, body: "VAPID keys/subject missing" };
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const store = getStore({ name: "push-subs" });
  const subs = (await store.get("subscriptions.json", { type: "json" })) as any[] | null;
  if (!Array.isArray(subs) || subs.length === 0) {
    return { statusCode: 200, body: "no subscriptions" };
  }

  const tip = pick(TIPS);
  const verse = pick(BIBLE_VERSES);

  // 1) Morgens 08:00: Bibelvers (requireInteraction=true hält die Noti „dauerhaft“ sichtbar)
  const versePayload = JSON.stringify({
    title: `📖 Tagesvers (${verse.ref})`,
    body: verse.text,
    requireInteraction: true,
    data: { url: "/#bible" }
  });

  // 2) Später am Tag: Fitness-Tipp
  const tipPayload = JSON.stringify({
    title: "💪 Tipp des Tages",
    body: tip,
    data: { url: "/#tip" }
  });

  const sendAll = async (payload: string) => {
    await Promise.allSettled(
      subs.map(s => webpush.sendNotification(s, payload).catch(() => null))
    );
  };

  // Wir schicken hier beide direkt; wenn du exakte Uhrzeiten willst, lege 2 getrennte Scheduled Functions an.
  await sendAll(versePayload);
  await sendAll(tipPayload);

  return { statusCode: 200, body: "pushed" };
};
