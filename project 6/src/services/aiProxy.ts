// src/services/aiProxy.ts
import type { Goal, Notification } from "../types";

// Optional: externe API-Basis (z. B. Netlify/Render). Wenn leer => relative Calls.
export const API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE ?? "";

function api(path: string) {
  return API_BASE ? `${API_BASE.replace(/\/+$/, "")}${path}` : path;
}

function toNotifications(suggestions: any[], goalId: string): Notification[] {
  return (suggestions || []).map((s: any, i: number) => ({
    id: `ai-${Date.now()}-${i}`,
    title: String(s?.title ?? "AI Insight"),
    content: String(s?.content ?? ""),
    // @ts-ignore - we sanitize to allowed types
    type: (["insight", "suggestion", "reminder"].includes(String(s?.type)) ? s.type : "insight"),
    goalId,
    source: String(s?.source ?? "AI"),
    timestamp: new Date().toISOString(),
    isRead: false,
    relevanceScore: Number.isFinite(Number(s?.relevanceScore)) ? Number(s.relevanceScore) : 0.8,
  }));
}

export async function fetchSuggestions(goals: Goal[], timeoutMs = 25_000): Promise<Notification[]> {
  const payloadGoals = goals?.length
    ? goals
    : [
        {
          id: "g1",
          title: "Sicher sprechen",
          description: "Redeangst überwinden",
          category: "mindset",
          priority: "high",
          progress: 20,
        },
      ];

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);

  const res = await fetch(api("/api/ai/suggestions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goals: payloadGoals }),
    signal: ctrl.signal,
  }).catch((e) => {
    throw new Error(`Netzwerkfehler: ${e?.message || e}`);
  });
  clearTimeout(to);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }

  const data = await res.json().catch(() => ({} as any));
  const goalId = payloadGoals[0]?.id || "";
  return toNotifications(data?.suggestions || [], goalId);
}

export async function analyzeGoalProgress(goal: Goal): Promise<{ insight: string; nextStep: string }> {
  const res = await fetch(api("/api/ai/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }
  return res.json();
}

export async function generateDayPlan(description: string) {
  const res = await fetch(api("/api/plan/day"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error("Plan generation failed");
  return res.json();
}

// === Audio-Upload -> Plan ===
export async function generateDayPlanFromSpeech(
  file: File,
  options?: {
    userId?: string;
    includeInputs?: boolean;
    startHour?: number;
    endHour?: number;
  }
) {
  const form = new FormData();
  form.append("file", file, file.name || "speech.webm");
  form.append("userId", options?.userId ?? "demo-user");
  form.append("includeInputs", String(options?.includeInputs ?? true));
  if (typeof options?.startHour === "number") form.append("startHour", String(options!.startHour));
  if (typeof options?.endHour === "number") form.append("endHour", String(options!.endHour));

  const res = await fetch(api("/api/plan/from-speech"), {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`from-speech failed ${res.status}`);
  // -> { text, plan:{date, timezone, tasks:[...]}, icsUrl }
  return res.json();
}