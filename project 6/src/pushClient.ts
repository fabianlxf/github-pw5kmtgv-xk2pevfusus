const PUBLIC_VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function enablePushForUser(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push wird nicht unterstützt.');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Benachrichtigungen abgelehnt.');

  const reg = await navigator.serviceWorker.register('/sw.js');

  const existing = await reg.pushManager.getSubscription();
  const subscription = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID)
  });

  const res = await fetch('/api/push/save-subscription', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ userId, subscription })
  });
  if (!res.ok) throw new Error('Subscription speichern fehlgeschlagen.');
}

export async function sendTestPush(userId: string) {
  const res = await fetch('/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      userId,
      title: 'Fokus-Impuls',
      body: 'Mini-Schritt: 5 Minuten jetzt 👀',
      url: '/today'
    })
  });
  if (!res.ok) throw new Error('Push senden fehlgeschlagen.');
}