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
  icon: string;
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
  reminderMinutes?: number;
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

const genId = () => `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const api = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

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

  // === Aufnahme starten → STT → Plan
  async function startPlanningWithSpeech() {
    try {
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
          const blob = new Blob(chunks.current, { type: supportedMime });
          const filename = (blob.type || "").includes("mp4") ? "speech.m4a" : "speech.webm";

          const fd = new FormData();
          fd.append("file", blob, filename);

          // === 1) STT ===
          const sttRes = await fetch(api("/api/stt"), { method: "POST", body: fd });
          if (!sttRes.ok) {
            await fallbackToTextPlan();
            return;
          }
          const sttJson = await sttRes.json().catch(() => ({} as any));
          const transcript: string = String(sttJson?.text || "").trim();
          if (!transcript) {
            await fallbackToTextPlan();
            return;
          }

          // === 2) Transcript → Plan
          const planRes = await fetch(api("/api/plan/day"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: transcript }),
          });
          if (!planRes.ok) throw new Error("Plan/day failed");

          const planJson = await planRes.json();
          const raw = Array.isArray(planJson?.events) ? planJson.events : [];
          const events: PlanEvent[] = raw.map((ev: any) => ({
            id: genId(),
            title: String(ev?.title || "Aufgabe"),
            time: ev?.start
              ? new Date(ev.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
              : "09:00",
            category: String(ev?.category || "wisdom"),
            completed: false,
            description: ev?.location || undefined,
            date: new Date().toISOString().slice(0, 10),
            reminderMinutes: 30,
          }));
          if (events.length) onPlanGenerated?.(events);
        } catch (err) {
          console.error("Plan generation error:", err);
          alert("Fehler beim Erstellen des Plans.");
        } finally {
          setPlanningBusy(false);
          try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
          } catch {}
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

  async function fallbackToTextPlan() {
    const desc = window.prompt("Konnte Sprache nicht erkennen. Bitte beschreibe kurz deinen Tag:");
    if (!desc || !desc.trim()) return;

    const planRes = await fetch(api("/api/plan/day"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc }),
    });
    if (!planRes.ok) throw new Error("Plan/day failed");
    const planJson = await planRes.json();
    const raw = Array.isArray(planJson?.events) ? planJson.events : [];
    const events: PlanEvent[] = raw.map((ev: any) => ({
      id: genId(),
      title: String(ev?.title || "Aufgabe"),
      time: ev?.start
        ? new Date(ev.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
        : "09:00",
      category: String(ev?.category || "wisdom"),
      completed: false,
      description: ev?.location || undefined,
      date: new Date().toISOString().slice(0, 10),
      reminderMinutes: 30,
    }));
    if (events.length) onPlanGenerated?.(events);
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

  // UI …
  return (
    <div>
      <button onClick={handlePlanningClick}>
        {recording ? "Aufnahme stoppen" : planningBusy ? "Erstelle Plan..." : "🎤 Tag planen"}
      </button>
    </div>
  );
}