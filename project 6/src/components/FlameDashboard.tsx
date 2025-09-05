import React, { useRef, useState } from "react";
import {
  Sun,
  Moon,
  Plus,
  Check,
  X,
  Dumbbell,
  DollarSign,
  Brain,
  BookOpen,
  Flame,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Calendar,
} from "lucide-react";

export type Category = {
  id: string;
  name: string;
  lastActiveISO?: string;
  backgroundImage?: string;
  icon: string; // Icon name
  color: string;
};

export type FlameState = "active" | "grace" | "off";

export type PlanEvent = {
  id: string;
  title: string;
  time: string;
  category: string;
  completed: boolean;
  description?: string;
  date?: string;
  reminderMinutes?: number; // 15, 30, 60, 120 minutes before
};

export function getFlameState(
  lastActiveISO?: string,
  graceHours = 10,
  now: Date = new Date()
): FlameState {
  if (!lastActiveISO) return "off";
  const last = new Date(lastActiveISO);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfGrace = new Date(startOfToday.getTime() + (24 + graceHours) * 60 * 60 * 1000);

  if (last.getTime() >= startOfToday.getTime()) return "active";
  if (now.getTime() <= endOfGrace.getTime()) return "grace";
  return "off";
}

// kleine Helfer
const genId = () => `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
// falls du später eine andere API-Base willst, einfach hier anpassen:
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const api = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
console.log('[FlameDashboard] API_BASE =', API_BASE || '(empty)');

// VAPID Public Key for Web Push (Base64URL). Set this in your environment: VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();

// Helper: convert Base64URL string to Uint8Array (needed for applicationServerKey)
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Service Worker registration
async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    console.log("[push] SW registered:", reg);
    return reg;
  } catch (e) {
    console.warn("[push] SW registration failed", e);
    return null;
  }
}

// Get existing push subscription (if any)
async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

// Subscribe for push and send subscription to backend
async function enablePushOnBackend(sub: PushSubscription) {
  try {
    const res = await callApi("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    if (!res.ok) {
      console.warn("[push] /api/subscribe failed", await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("[push] subscribe backend error", e);
  }
}

async function subscribeForPush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push-Benachrichtigungen werden von deinem Browser nicht unterstützt.");
    return null;
  }
  if (!VAPID_PUBLIC) {
    alert("VAPID Public Key fehlt (VITE_VAPID_PUBLIC_KEY).");
    return null;
  }
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
  if (!reg) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Benachrichtigungen wurden nicht erlaubt.");
    return null;
  }

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    console.log("[push] already subscribed");
    await enablePushOnBackend(existing);
    return existing;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  });
  console.log("[push] subscribed", sub);
  await enablePushOnBackend(sub);
  return sub;
}

async function unsubscribePush() {
  const sub = await getExistingSubscription();
  if (!sub) return false;
  await sub.unsubscribe();
  console.log("[push] unsubscribed");
  return true;
}


// Explizites Mapping von SPA-Pfaden ("/api/*") zu Netlify Functions ("/.netlify/functions/*")
const FN_MAP: Record<string, string> = {
  "/api/stt": "/.netlify/functions/stt",
  "/api/plan/day": "/.netlify/functions/plan-day",
  "/api/plan/from-speech": "/.netlify/functions/plan-from-speech",
};

// Intelligenter API-Caller: versucht zuerst /api/* (Redirect), fällt bei 404/HTML auf /.netlify/functions/* zurück (mit Mapping)
async function callApi(inputPath: string, init?: RequestInit): Promise<Response> {
  const primary = `${API_BASE}${inputPath}`;
  const headers = new Headers(init?.headers || {});
  if (!headers.has("accept")) headers.set("accept", "application/json, */*");

  let res: Response | undefined;
  try {
    res = await fetch(primary, { ...init, headers });
  } catch (e) {
    res = undefined;
  }

  const contentType = res?.headers?.get("content-type") || "";
  const looksHtml = contentType.includes("text/html");

  if (!res || res.status === 404 || looksHtml) {
    const mapped = FN_MAP[inputPath] || inputPath.replace(/^\/api\//, "/.netlify/functions/");
    const fallback = `${API_BASE}${mapped}`;
    console.warn(`[callApi] 404/HTML on ${primary}, trying fallback ${fallback}`);
    res = await fetch(fallback, { ...init, headers });
  }

  return res!;
}

function pickSupportedMime(): string {
  const MR: any = (window as any).MediaRecorder;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (!MR?.isTypeSupported) return "";
  for (const t of candidates) if (MR.isTypeSupported(t)) return t;
  return "";
}

export default function FlameDashboard({
  categories,
  graceHours = 10,
  dayPlan = [],
  onToggleEvent,
  onAddCustomEvent,
  onCategoryClick,
  isDarkMode,
  onToggleTheme,
  onPlanGenerated,
}: {
  categories: Category[];
  graceHours?: number;
  dayPlan?: PlanEvent[];
  onToggleEvent?: (eventId: string) => void;
  onAddCustomEvent?: (title: string, category: string) => void;
  onCategoryClick?: (categoryId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onPlanGenerated?: (events: PlanEvent[]) => void;
}) {
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventCategory, setNewEventCategory] = useState("fitness");
  const [recording, setRecording] = useState(false);
  const [planningBusy, setPlanningBusy] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ category: string; tasks: string[] }[]>([]);
  const [showMiniTasks, setShowMiniTasks] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [pushSupported, setPushSupported] = useState<boolean>(false);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(false);
  const [checkingPush, setCheckingPush] = useState<boolean>(true);

  React.useEffect(() => {
    const support = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(support);
    (async () => {
      if (!support) return setCheckingPush(false);
      // Ensure SW is registered (idempotent)
      await registerSW();
      const sub = await getExistingSubscription();
      setNotifEnabled(!!sub);
      setCheckingPush(false);
    })();
  }, []);

  async function handleEnableNotifications() {
    setCheckingPush(true);
    const sub = await subscribeForPush();
    setNotifEnabled(!!sub);
    setCheckingPush(false);
  }

  async function handleDisableNotifications() {
    setCheckingPush(true);
    await unsubscribePush();
    setNotifEnabled(false);
    setCheckingPush(false);
  }

  const backgroundImages: Record<string, string> = {
    fitness: "/posters/fitness.png",
    finanzen: "/posters/persoenlichkeit.png",
    mindset: "/posters/mindset.png",
    wisdom: "/posters/wisdom.jpeg",
  };

  const getFlameIntensity = (categoryId: string, hoursToday: number): number => {
    switch (categoryId) {
      case "fitness":
        if (hoursToday >= 2) return 100;
        if (hoursToday >= 1.5) return 80;
        if (hoursToday >= 1) return 60;
        if (hoursToday >= 0.5) return 40;
        return 0;
      case "finanzen":
        if (hoursToday >= 10) return 100;
        if (hoursToday >= 5) return 70;
        if (hoursToday >= 3) return 50;
        if (hoursToday >= 1) return 30;
        return 0;
      case "wisdom":
        if (hoursToday >= 1) return 100;
        if (hoursToday >= 0.5) return 80;
        if (hoursToday >= 0.25) return 60;
        return 0;
      case "mindset":
        if (hoursToday >= 0.33) return 100;
        if (hoursToday >= 0.17) return 70;
        if (hoursToday >= 0.08) return 50;
        return 0;
      default:
        return 0;
    }
  };

  const generateAISuggestions = async () => {
    const emptyCats = categories.filter((cat) => dayPlan.filter((e) => e.category === cat.id).length === 0);
    if (emptyCats.length === 0) return;

    const suggestions: { category: string; tasks: string[] }[] = [];
    for (const cat of emptyCats) {
      let tasks: string[] = [];
      switch (cat.id) {
        case "fitness":
          tasks = ["30 Push-ups", "Kalt duschen (2-3 Min)", "20 Min Spaziergang", "10 Min Stretching"];
          break;
        case "mindset":
          tasks = ["5 Min Meditation", "Dankbarkeits-Journal", "Atemübung (4-7-8)", "Positive Affirmationen"];
          break;
        case "wisdom":
          tasks = ["20 Min lesen", "Podcast hören", "Dokumentation schauen", "Neues lernen"];
          break;
        case "finanzen":
          tasks = ["Ausgaben checken", "Budget überprüfen", "Investitionen analysieren", "Sparziele setzen"];
          break;
      }
      suggestions.push({ category: cat.id, tasks });
    }
    setAiSuggestions(suggestions);
  };

  const acceptSuggestion = (category: string, task: string) => {
    if (onAddCustomEvent) onAddCustomEvent(task, category);
    setAiSuggestions((prev) =>
      prev
        .map((s) => (s.category === category ? { ...s, tasks: s.tasks.filter((t) => t !== task) } : s))
        .filter((s) => s.tasks.length > 0)
    );
  };

  const rejectSuggestion = (category: string, task: string) => {
    setAiSuggestions((prev) =>
      prev
        .map((s) => (s.category === category ? { ...s, tasks: s.tasks.filter((t) => t !== task) } : s))
        .filter((s) => s.tasks.length > 0)
    );
  };

  const miniTasks = [
    { title: "Kalt duschen", category: "fitness", icon: "🚿", time: "2-3 Min" },
    { title: "30 Push-ups", category: "fitness", icon: "💪", time: "5 Min" },
    { title: "5 Min Meditation", category: "mindset", icon: "🧘", time: "5 Min" },
    { title: "20 Min lesen", category: "wisdom", icon: "📚", time: "20 Min" },
    { title: "Ausgaben checken", category: "finanzen", icon: "💰", time: "10 Min" },
    { title: "10 Min Stretching", category: "fitness", icon: "🤸", time: "10 Min" },
    { title: "Dankbarkeits-Journal", category: "mindset", icon: "📝", time: "5 Min" },
    { title: "Podcast hören", category: "wisdom", icon: "🎧", time: "30 Min" },
  ];

  const getCategoryHoursToday = (categoryId: string): number => {
    const categoryEvents = dayPlan.filter((e) => e.category === categoryId && e.completed);
    return categoryEvents.length * 0.5;
  };

  const now = new Date();
  const states = categories.map((c) => {
    const hoursToday = getCategoryHoursToday(c.id);
    const intensity = getFlameIntensity(c.id, hoursToday);
    return {
      ...c,
      state: getFlameState(c.lastActiveISO, graceHours, now),
      backgroundImage: backgroundImages[c.id as keyof typeof backgroundImages],
      intensity,
      hoursToday,
      date: new Date().toISOString().slice(0, 10),
      reminderMinutes: 30 // Default 30 min reminder
    };
  });

  const masterPercent = Math.round(states.reduce((sum, c) => sum + c.intensity, 0) / Math.max(1, categories.length));
  const completedEvents = dayPlan.filter((e) => e.completed).length;
  const totalEvents = dayPlan.length;
  const planProgress = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

  const getFlameAnimation = (percent: number) => {
    if (percent >= 80) return "animate-bounce";
    if (percent >= 60) return "animate-pulse";
    if (percent >= 40) return "animate-ping";
    return "";
  };

  const getFlameSize = (percent: number) => {
    if (percent >= 80) return "text-4xl";
    if (percent >= 60) return "text-3xl";
    if (percent >= 40) return "text-2xl";
    return "text-xl";
  };

  const handleAddEvent = () => {
    if (newEventTitle.trim() && onAddCustomEvent) {
      onAddCustomEvent(newEventTitle.trim(), newEventCategory);
      setNewEventTitle("");
      setShowAddEvent(false);
    }
  };

  const getCategoryByName = (name: string) => {
    return categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) || categories[0];
  };

  // === Verbesserte Kategorie-Zuordnung ===
  // - deckt Admin/Orga/Kommunikation ab (E-Mail, Anrufe, Termine etc.)
  // - deckt Lernen/Content-Konsum ab
  // - Finanzen bleibt wie gehabt
  // - Default Fallback jetzt "wisdom" (statt "fitness"), damit „neutrale Arbeit“ nicht in Fitness landet
  const mapTaskToCategory = (title: string): string => {
    const t = title.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").trim();

    // --- Fitness
    if (
      /\b(push|liegestuetz|workout|gym|laufen|joggen|laufen gehen|sport|training|duschen|shower|fitness|krafttraining|cardio|stretching|yoga|schwimmen|radfahren|fahrrad|wandern|exercise|sauna|spa|spaaziergang|spaziergang)\b/.test(
        t
      )
    ) return "fitness";

    // --- Mindset (Achtsamkeit / Reflexion / Journal)
    if (
      /\b(meditation|meditieren|achtsam|mindfulness|reflexion|dankbar|affirmation|mindset|mental|journal|tagebuch|selbstreflexion|atemuebung|breathing|entspannung|visualisierung)\b/.test(
        t
      )
    ) return "mindset";

    // --- Finanzen
    if (
      /\b(geld|finanz|budget|ausgaben|investition|sparen|bank|rechnung|finance|aktien|portfolio|steuer|versicherung|kredit|einkommen|buchhaltung|abrechnung)\b/.test(
        t
      )
    ) return "finanzen";

    // --- Admin/Kommunikation/Organisation → „wisdom“ (beste Annäherung bei deinen 4 Kategorien)
    // Emails, Nachrichten, Antworten, Termine, Planen, Organisieren, Calls, Meetings
    if (
      /\b(email|e-mail|mail|inbox|posteingang|nachrichten|dm|antworten|reply|kontaktieren|kundenmail|supportmail|termin|meeting|call|telefon|zoom|teams|organisieren|organisation|planen|planung|todo|aufgaben|notizen|brief|schreiben|dokument|pdf|angebot|rechnung senden)\b/.test(
        t
      )
    ) return "wisdom";

    // --- Lernen/Content (bleibt wisdom)
    if (
      /\b(lese|lesen|buch|lernen|studieren|podcast|doku|dokumentation|wissen|bildung|kurs|research|recherche|artikel|video|tutorial|weiterbildung|skill|vortrag|vorlesung|kursmodul)\b/.test(
        t
      )
    ) return "wisdom";

    // Fallback: wisdom (neutral/arbeit)
    return "wisdom";
  };

  // ===== Recording → Upload Speech → fallback zu Text-Planer (Gemini) =====
// ===== Recording → Whisper (/api/stt) → Gemini (/api/plan/day) =====
async function startPlanningWithSpeech() {
  try {
    // Mic holen
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const supportedMime = pickSupportedMime() || "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType: supportedMime });
    mediaRecorderRef.current = recorder;
    chunks.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };

    recorder.onstop = async () => {
      setPlanningBusy(true);
      try {
        // 1) Audio → /api/stt (Whisper)
        const blob = new Blob(chunks.current, { type: supportedMime });
        const filename = supportedMime.includes("mp4") ? "speech.m4a" : "speech.webm";

        const fd = new FormData();
        fd.append("file", blob, filename);

        const sttCtrl = new AbortController();
        const sttTO = window.setTimeout(() => sttCtrl.abort(), 35_000);

        console.log("[stt] sending FormData:", { type: blob.type, size: blob.size, filename });
        const sttRes = await callApi("/api/stt", {
          method: "POST",
          body: fd,
          signal: sttCtrl.signal,
        }).catch(() => {
          throw new Error("STT Netzfehler");
        });
        window.clearTimeout(sttTO);
        console.log('[stt] status:', sttRes?.status, sttRes?.headers?.get('content-type'));
        if (sttRes && sttRes.status === 404) console.warn('[stt] 404 from primary path, fallback should have been tried.');

        // Fallback: manuelle Texteingabe, falls STT scheitert
        const fallbackToTextPlan = async () => {
          const desc = window.prompt("Konnte Sprache nicht erkennen. Bitte beschreibe kurz deinen Tag:");
          if (!desc || !desc.trim()) return;

          const planRes = await callApi("/api/plan/day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: desc }),
          });
          if (!planRes.ok) throw new Error(await planRes.text().catch(() => "plan/day failed"));

          const planJson = await planRes.json().catch(() => ({} as any));
          console.log('[plan] payload:', planJson);
          const raw = Array.isArray(planJson?.events) ? planJson.events : [];
          const events: PlanEvent[] = raw.map((ev: any) => {
            const title = String(ev?.title || "Aufgabe");
            const time = ev?.start
              ? new Date(ev.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
              : "09:00";
            const category = String(ev?.category || mapTaskToCategory(title));
            return {
              id: genId(),
              title,
              time,
              category,
              completed: false,
              description: ev?.location || undefined,
              date: new Date().toISOString().slice(0, 10),
              reminderMinutes: 30,
            };
          });
          if (onPlanGenerated && events.length) onPlanGenerated(events);
        };

        if (!sttRes.ok) {
          console.warn("[/api/stt] failed:", sttRes.status, await sttRes.text().catch(() => ""));
          await fallbackToTextPlan();
          return;
        }

        const sttJson = await sttRes.json().catch(() => ({} as any));
        console.log('[stt] payload:', sttJson);
        const transcript: string = String(sttJson?.text || "").trim();
        if (!transcript) {
          await fallbackToTextPlan();
          return;
        }

        console.log('[plan] calling /api/plan/day with transcript length:', transcript.length);
        // 2) Transkript → /api/plan/day (Gemini)
        const planRes = await callApi("/api/plan/day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: transcript }),
        });
        console.log('[plan] status:', planRes?.status, planRes?.headers?.get('content-type'));
        if (planRes && planRes.status === 404) console.warn('[plan] 404 from primary path, fallback should have been tried.');
        if (!planRes.ok) throw new Error(await planRes.text().catch(() => "plan/day failed"));

        const planJson = await planRes.json().catch(() => ({} as any));
        console.log('[plan] payload:', planJson);
        const raw = Array.isArray(planJson?.events) ? planJson.events : [];
        const events: PlanEvent[] = raw.map((ev: any) => {
          const title = String(ev?.title || "Aufgabe");
          const time = ev?.start
            ? new Date(ev.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
            : "09:00";
          // Server-Kategorie nutzen, sonst lokales Mapping
          const category = String(ev?.category || mapTaskToCategory(title));
          return {
            id: genId(),
            title,
            time,
            category,
            completed: false,
            description: ev?.location || undefined,
            date: new Date().toISOString().slice(0, 10),
            reminderMinutes: 30,
          };
        });
        if (onPlanGenerated && events.length) onPlanGenerated(events);
      } catch (err) {
        console.error("Plan generation error:", err);
        alert("Fehler beim Erstellen des Plans.");
      } finally {
        setPlanningBusy(false);
        try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
        streamRef.current = null;
        setRecording(false);
      }
    };

    recorder.start();
    setRecording(true);
  } catch (err) {
    console.error("Mic access error:", err);
    alert("Mikrofon-Zugriff verweigert oder nicht verfügbar.");
    setPlanningBusy(false);
    setRecording(false);
  }
}
function stopRecording() {
  try {
    mediaRecorderRef.current?.stop();
  } catch (err) {
    console.error("Stop recording error:", err);
  } finally {
    setRecording(false);
  }
}
  function handlePlanningClick() {
    if (recording) {
      stopRecording();
    } else if (!planningBusy) {
      startPlanningWithSpeech();
    }
  }

  const handleManualAddEvent = () => {
    if (!recording && !planningBusy) setShowMiniTasks(true);
  };

  const handleAddEventSubmit = () => {
    if (newEventTitle.trim() && onAddCustomEvent) {
      onAddCustomEvent(newEventTitle.trim(), newEventCategory);
      setNewEventTitle("");
      setShowAddEvent(false);
    }
  };

  const handleMiniTaskSelect = (task: (typeof miniTasks)[0]) => {
    if (onAddCustomEvent) onAddCustomEvent(task.title, task.category);
    setShowMiniTasks(false);
  };

  const getIconComponent = (iconName: string, className: string = "w-6 h-6") => {
    switch (iconName) {
      case "Dumbbell":
        return <Dumbbell className={className} />;
      case "DollarSign":
        return <DollarSign className={className} />;
      case "Brain":
        return <Brain className={className} />;
      case "BookOpen":
        return <BookOpen className={className} />;
      default:
        return <Brain className={className} />;
    }
  };

  const getLiveTask = (): PlanEvent | null => {
    const now = new Date();
    return (
      dayPlan.find((event) => {
        const eventTime = new Date(`${now.toDateString()} ${event.time}`);
        const diffMinutes = Math.abs(now.getTime() - eventTime.getTime()) / (1000 * 60);
        return diffMinutes <= 30 && !event.completed;
      }) || null
    );
  };

  const liveTask = getLiveTask();

  // ====== UI ======
  return (
    <div
      className={`min-h-screen transition-all duration-300 ${
        isDarkMode ? "bg-gradient-to-br from-gray-900 via-black to-gray-900" : "bg-gradient-to-br from-gray-50 via-white to-gray-100"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-6 pt-12">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full ${
                isDarkMode ? "bg-gradient-to-br from-orange-500/20 to-red-600/20 border-2 border-orange-400/40" : "bg-gradient-to-br from-orange-200/60 to-red-300/60 border-2 border-orange-400/60"
              } flex items-center justify-center backdrop-blur-md shadow-2xl ${getFlameAnimation(masterPercent)}`}
            >
              <span
                className={`${getFlameSize(masterPercent)} filter drop-shadow-lg`}
                style={{
                  animation:
                    masterPercent >= 80
                      ? "flameIntense 0.8s ease-in-out infinite alternate"
                      : masterPercent >= 60
                      ? "flameMedium 1.2s ease-in-out infinite alternate"
                      : masterPercent >= 40
                      ? "flameGentle 1.8s ease-in-out infinite alternate"
                      : "none",
                }}
              >
                <Flame className="w-8 h-8 text-orange-400" />
              </span>
            </div>
            {masterPercent >= 60 && (
              <div className="absolute inset-0 rounded-full bg-orange-400/30 blur-2xl -z-10" style={{ animation: "glow 2s ease-in-out infinite alternate" }} />
            )}
          </div>

          <div>
            <div
              className={`text-3xl font-bold bg-gradient-to-r ${isDarkMode ? "from-orange-300 to-red-300" : "from-orange-600 to-red-600"} bg-clip-text text-transparent`}
            >
              {masterPercent}%
            </div>
            <div className={`text-sm font-medium ${isDarkMode ? "text-orange-200/90" : "text-orange-700"}`}>on fire</div>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className={`p-3 rounded-2xl transition-all duration-300 ${
            isDarkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/10 hover:bg-black/20 text-black"
          } backdrop-blur-md shadow-lg hover:scale-105`}
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
        {/* Push Notification Toggle */}
        {pushSupported && (
          <button
            onClick={notifEnabled ? handleDisableNotifications : handleEnableNotifications}
            disabled={checkingPush}
            className={`ml-3 p-3 rounded-2xl transition-all duration-300 ${
              isDarkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/10 hover:bg-black/20 text-black"
            } backdrop-blur-md shadow-lg hover:scale-105 disabled:opacity-50`}
            title={notifEnabled ? "Benachrichtigungen deaktivieren" : "Benachrichtigungen aktivieren"}
          >
            {checkingPush ? "…" : notifEnabled ? "🔔" : "🔕"}
          </button>
        )}
      </div>

      {/* Live Task */}
      {liveTask && (
        <div className="px-6 mb-6">
          <div className={`rounded-2xl p-4 border-2 border-green-400/50 bg-green-500/20 backdrop-blur-md animate-pulse`}>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              <div className="flex-1">
                <div className="text-green-300 font-bold text-lg">🔴 LIVE: {liveTask.title}</div>
                <div className="text-green-400/80 text-sm">{liveTask.time} • Jetzt aktiv</div>
              </div>
              <button
                onClick={() => onToggleEvent?.(liveTask.id)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors font-medium"
              >
                Erledigt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Plan */}
      <div className="px-6 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Tagesplan</h2>
          <div className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            {completedEvents}/{totalEvents} erledigt ({planProgress}%)
          </div>
        </div>

        {/* Nur Live Task anzeigen */}
        {liveTask && (
          <div className="mb-6">
            <div className={`rounded-2xl p-4 border-2 border-green-400/50 bg-green-500/20 backdrop-blur-md animate-pulse`}>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
                <div className="flex-1">
                  <div className="text-green-300 font-bold text-lg">🔴 LIVE: {liveTask.title}</div>
                  <div className="text-green-400/80 text-sm">{liveTask.time} • Jetzt aktiv</div>
                </div>
                <button
                  onClick={() => onToggleEvent?.(liveTask.id)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors font-medium"
                >
                  Erledigt
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Hinweis wenn kein Live Task */}
        {!liveTask && dayPlan.length > 0 && (
          <div className="mb-6">
            <div className={`rounded-2xl p-4 border backdrop-blur-md ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'
            }`}>
              <div className="text-center">
                <Calendar className={`w-8 h-8 mx-auto mb-2 ${
                  isDarkMode ? 'text-white/40' : 'text-gray-400'
                }`} />
                <p className={`text-sm ${
                  isDarkMode ? 'text-white/70' : 'text-gray-600'
                }`}>
                  Kein aktiver Task • Gehe zur Tagesplan-Seite für alle Events
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KI-Empfehlungen */}
        {aiSuggestions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className={`w-5 h-5 ${isDarkMode ? "text-yellow-400" : "text-yellow-600"}`} />
              <h3 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>KI-Empfehlungen</h3>
            </div>

            <div className="space-y-3">
              {aiSuggestions.map((suggestion) => {
                const cat = categories.find((c) => c.id === suggestion.category);
                return (
                  <div
                    key={suggestion.category}
                    className={`rounded-2xl p-4 backdrop-blur-md border ${isDarkMode ? "bg-yellow-500/10 border-yellow-400/30" : "bg-yellow-100/80 border-yellow-300/50"}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {cat && getIconComponent(cat.icon, "w-5 h-5")}
                      <span className={`font-medium ${isDarkMode ? "text-yellow-300" : "text-yellow-700"}`}>{cat?.name} fehlt heute</span>
                    </div>

                    <div className="space-y-2">
                      {suggestion.tasks.slice(0, 2).map((task) => (
                        <div key={task} className="flex items-center justify-between">
                          <span className={`text-sm ${isDarkMode ? "text-white/80" : "text-gray-700"}`}>{task}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => acceptSuggestion(suggestion.category, task)}
                              className="p-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => rejectSuggestion(suggestion.category, task)}
                              className="p-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mini-Tasks */}
        {showMiniTasks && (
          <div className="mb-6">
            <div className={`rounded-2xl p-4 backdrop-blur-md border ${isDarkMode ? "bg-white/10 border-white/20" : "bg-black/10 border-black/20"}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Mini-Aufgaben wählen</h3>
                <button
                  onClick={() => setShowMiniTasks(false)}
                  className={`p-2 rounded-xl transition-colors ${isDarkMode ? "hover:bg-white/10 text-white/60" : "hover:bg-black/10 text-black/60"}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {miniTasks.map((task, index) => {
                  const cat = categories.find((c) => c.id === task.category);
                  return (
                    <button
                      key={index}
                      onClick={() => handleMiniTaskSelect(task)}
                      className={`p-3 rounded-xl text-left transition-all duration-300 backdrop-blur-md border ${
                        isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/15 hover:scale-105" : "bg-black/5 border-black/10 hover:bg-black/15 hover:scale-105"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{task.icon}</span>
                        <div className={`w-4 h-4 rounded-full ${cat?.color || "bg-gray-500"}`} />
                      </div>
                      <div className={`font-medium text-sm mb-1 ${isDarkMode ? "text-white" : "text-gray-900"}`}>{task.title}</div>
                      <div className={`text-xs ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>{task.time} • {cat?.name}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => setShowAddEvent(true)}
                  className={`w-full p-3 rounded-xl border-2 border-dashed transition-all duration-300 ${
                    isDarkMode ? "border-white/30 hover:border-white/50 text-white/70 hover:text-white/90" : "border-black/30 hover:border-black/50 text-black/70 hover:text-black/90"
                  }`}
                >
                  <Plus className="w-5 h-5 inline mr-2" />
                  Eigenes Event erstellen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Planning Controls */}
        {recording ? (
          <div className={`rounded-2xl p-6 border ${isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-gray-200"} backdrop-blur-md text-center`}>
            <div className="mb-4">
              <button
                onClick={stopRecording}
                className={`w-20 h-20 rounded-full bg-red-600 animate-pulse text-white flex items-center justify-center shadow-lg mx-auto transition-all duration-300 hover:scale-105`}
              >
                ■
              </button>
            </div>
            <p className={`text-sm mb-4 ${isDarkMode ? "text-white/70" : "text-gray-600"}`}>Aufnahme läuft... Klicken zum Stoppen</p>
            {/* Info hint for notifications */}
            {pushSupported && !notifEnabled && (
              <div className={`text-xs text-center ${isDarkMode ? "text-white/60" : "text-gray-600"}`}>
                Tipp: Aktiviere 🔔 Benachrichtigungen oben, damit Live-Tasks &amp; Daily-Tipps auch im Hintergrund ankommen.
              </div>
            )}
            <button
              onClick={stopRecording}
              className={`px-4 py-2 rounded-xl transition-colors ${
                isDarkMode ? "bg-red-500/20 hover:bg-red-500/30 text-red-400" : "bg-red-100 hover:bg-red-200 text-red-600"
              }`}
            >
              <X className="w-4 h-4 inline mr-2" />
              Abbrechen
            </button>
          </div>
        ) : showAddEvent ? (
          <div className={`rounded-2xl p-4 border ${isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-gray-200"} backdrop-blur-md`}>
            <input
              type="text"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Neues Ereignis hinzufügen..."
              className={`w-full p-3 rounded-xl border mb-3 ${
                isDarkMode ? "bg-white/10 border-white/20 text-white placeholder-white/60" : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
              } backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-orange-500`}
            />
            <div className="flex items-center space-x-2">
              <select
                value={newEventCategory}
                onChange={(e) => setNewEventCategory(e.target.value)}
                className={`flex-1 p-3 rounded-xl border ${isDarkMode ? "bg-white/10 border-white/20 text-white" : "bg-gray-50 border-gray-300 text-gray-900"} backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-orange-500`}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className={isDarkMode ? "bg-gray-800" : "bg-white"}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button onClick={handleAddEvent} className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors">
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowAddEvent(false)}
                className={`p-3 rounded-xl transition-colors ${isDarkMode ? "bg-red-500/20 hover:bg-red-500/30 text-red-400" : "bg-red-100 hover:bg-red-200 text-red-600"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handlePlanningClick}
              disabled={planningBusy}
              className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 ${
                recording
                  ? "border-red-500 bg-red-500/20 text-red-400 animate-pulse"
                  : planningBusy
                  ? isDarkMode
                    ? "border-white/10 bg-white/5 text-white/40"
                    : "border-gray-200 bg-gray-100 text-gray-400"
                  : isDarkMode
                  ? "border-white/20 hover:border-white/40 text-white/60 hover:text-white/80 hover:bg-white/5 border-dashed"
                  : "border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-dashed"
              } disabled:cursor-not-allowed`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full mb-2 flex items-center justify-center ${
                    recording ? "bg-red-500/30" : planningBusy ? (isDarkMode ? "bg-white/10" : "bg-gray-200") : isDarkMode ? "bg-indigo-600/20" : "bg-indigo-100"
                  }`}
                >
                  {recording ? "■" : planningBusy ? "⏳" : "🎤"}
                </div>
                <span className="font-medium">
                  {recording ? "Aufnahme stoppen" : planningBusy ? "Erstelle Plan..." : "Tag planen (Sprache → Plan)"}
                </span>
                {!recording && !planningBusy && <span className="text-xs opacity-70 mt-1">Tippen, sprechen, dann „Stop“</span>}
              </div>
            </button>

            <button
              onClick={handleManualAddEvent}
              disabled={recording || planningBusy}
              className={`w-full p-4 rounded-xl transition-all duration-300 ${
                recording || planningBusy
                  ? isDarkMode
                    ? "bg-white/5 text-white/40"
                    : "bg-gray-100 text-gray-400"
                  : isDarkMode
                  ? "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 border border-white/20"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300"
              } disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                <span className="font-medium">Manuell hinzufügen</span>
              </div>
            </button>

            {dayPlan.length > 0 && (
              <button
                onClick={generateAISuggestions}
                className={`w-full p-3 rounded-xl transition-all duration-300 mt-3 ${
                  isDarkMode ? "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-400/30" : "bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300"
                }`}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                KI-Empfehlungen für fehlende Kategorien
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kategorien */}
      <div className="px-6 pb-32">
        <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>Kategorien</h2>

        <div className="grid grid-cols-2 gap-4">
          {states.slice(0, 4).map((c) => {
            const intensity = (c as any).intensity as number;
            const isActive = intensity >= 80;
            const isGrace = intensity >= 40 && intensity < 80;
            const isWarm = intensity > 0 && intensity < 40;

            return (
              <div
                key={c.id}
                className="relative overflow-hidden rounded-3xl h-36 group cursor-pointer transform transition-all duration-500 hover:scale-[1.08] hover:shadow-2xl hover:-translate-y-3 perspective-1000"
                onClick={() => onCategoryClick?.(c.id)}
                style={{
                  backgroundImage: backgroundImages[c.id as keyof typeof backgroundImages]
                    ? `url("${encodeURI(backgroundImages[c.id as keyof typeof backgroundImages])}")`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: c.id === "wisdom" || c.id === "mindset" ? "50% 80%" : "center",
                  transform: "rotateX(5deg) rotateY(-5deg)",
                  boxShadow:
                    "0 25px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent ${
                    isActive
                      ? isDarkMode
                        ? "bg-gradient-to-r from-orange-600/30 to-red-600/30"
                        : "bg-gradient-to-r from-orange-400/40 to-red-500/40"
                      : isGrace
                      ? isDarkMode
                        ? "bg-gradient-to-r from-amber-600/30 to-orange-600/30"
                        : "bg-gradient-to-r from-amber-400/40 to-orange-500/40"
                      : isWarm
                      ? isDarkMode
                        ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/30"
                        : "bg-gradient-to-r from-blue-400/40 to-indigo-500/40"
                      : isDarkMode
                      ? "bg-gradient-to-r from-gray-900/50 to-gray-800/50"
                      : "bg-gradient-to-r from-gray-600/40 to-gray-700/40"
                  }`}
                />
                {(isActive || isGrace || isWarm) && (
                  <div
                    className={`absolute inset-0 rounded-3xl border-2 ${
                      isActive ? "border-orange-400/80 shadow-orange-400/30" : isGrace ? "border-amber-400/80 shadow-amber-400/30" : "border-blue-400/80 shadow-blue-400/30"
                    } shadow-2xl`}
                  />
                )}

                <div className="relative z-10 px-4 h-full flex flex-col items-center justify-end text-center pb-4">
                  <div className="flex flex-col items-center space-y-2">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 shadow-xl ${
                        isActive
                          ? "bg-orange-500/50 border-orange-400/70"
                          : isGrace
                          ? "bg-amber-500/50 border-amber-400/70"
                          : isWarm
                          ? "bg-blue-500/50 border-blue-400/70"
                          : isDarkMode
                          ? "bg-gray-700/70 border-gray-600/70"
                          : "bg-white/70 border-gray-300/70"
                      }`}
                    >
                      <div className="relative">
                        <Flame
                          className={`w-6 h-6 transition-all duration-300 ${
                            isActive
                              ? "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]"
                              : isGrace
                              ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                              : isWarm
                              ? "text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.4)]"
                              : "text-gray-400 opacity-50"
                          } ${
                            isActive ? "animate-pulse" : isGrace ? "animate-bounce" : isWarm ? "animate-pulse" : ""
                          }`}
                          style={{
                            filter: isActive
                              ? "brightness(1.3) saturate(1.4)"
                              : isGrace
                              ? "brightness(1.2) saturate(1.2)"
                              : isWarm
                              ? "brightness(1.1) saturate(1.1)"
                              : "brightness(0.7) saturate(0.8)",
                            animation:
                              isActive
                                ? "flameIntense 0.8s ease-in-out infinite alternate"
                                : isGrace
                                ? "flameMedium 1.2s ease-in-out infinite alternate"
                                : isWarm
                                ? "flameGentle 1.8s ease-in-out infinite alternate"
                                : "none",
                          }}
                        />

                        {(isActive || isGrace || isWarm) && (
                          <div
                            className={`absolute inset-0 rounded-full blur-sm -z-10 ${
                              isActive ? "bg-orange-400/40" : isGrace ? "bg-amber-400/30" : "bg-blue-400/20"
                            }`}
                            style={{
                              animation:
                                isActive
                                  ? "glow 1s ease-in-out infinite alternate"
                                  : isGrace
                                  ? "glow 1.5s ease-in-out infinite alternate"
                                  : "glow 2s ease-in-out infinite alternate",
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-lg text-white drop-shadow-lg mb-1">{c.name}</div>
                      <div
                        className={`text-xs font-medium drop-shadow ${
                          isActive ? "text-orange-200" : isGrace ? "text-amber-200" : isWarm ? "text-blue-200" : "text-gray-200"
                        }`}
                      >
                        {isActive
                          ? `${(c as any).intensity}% (${(c as any).hoursToday.toFixed(1)}h) - Brennt!`
                          : isGrace
                          ? `${(c as any).intensity}% (${(c as any).hoursToday.toFixed(1)}h) - Warm`
                          : isWarm
                          ? `${(c as any).intensity}% (${(c as any).hoursToday.toFixed(1)}h) - Glimmt`
                          : "Inaktiv"}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`absolute top-3 right-3 w-4 h-4 rounded-full shadow-lg ${
                      isActive
                        ? "bg-orange-400 shadow-orange-400/60"
                        : isGrace
                        ? "bg-amber-400 shadow-amber-400/60"
                        : isWarm
                        ? "bg-blue-400 shadow-blue-400/60"
                        : isDarkMode
                        ? "bg-gray-500 shadow-gray-500/60"
                        : "bg-gray-400 shadow-gray-400/60"
                    } ${isActive || isGrace || isWarm ? "animate-pulse" : ""}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-32"></div>

      <style jsx>{`
        @keyframes flameIntense {
          0% {
            transform: scale(1) rotate(-3deg);
          }
          100% {
            transform: scale(1.15) rotate(3deg);
          }
        }
        @keyframes flameMedium {
          0% {
            transform: scale(1) rotate(-2deg);
          }
          100% {
            transform: scale(1.08) rotate(2deg);
          }
        }
        @keyframes flameGentle {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.03);
          }
        }
        @keyframes glow {
          0% {
            opacity: 0.3;
            transform: scale(1);
          }
          100% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }
        .perspective-1000 {
          perspective: 1000px;
        }
        .border-3 {
          border-width: 3px;
        }
      `}</style>
    </div>
  );
}
