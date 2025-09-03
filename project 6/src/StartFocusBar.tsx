import { useState } from "react";
import { enablePushForUser } from "./pushClient";
import { Goal } from "./types";

type Props = { activeGoal: Goal | null };

export default function StartFocusBar({ activeGoal }: Props) {
  const [status, setStatus] = useState<string>("");

  const startDay = async () => {
    try {
      setStatus("Aktiviere Benachrichtigungen…");
      // Optional: nur beim ersten Mal nötig. Wenn schon erlaubt, läuft es einfach durch.
      await enablePushForUser("demo-user");

      if (!activeGoal) {
        setStatus("Kein Ziel gefunden.");
        return;
      }

      setStatus("Starte Tagesfokus…");
      const res = await fetch("/api/insights/start-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "demo-user",
          goal: {
            title: activeGoal.title,
            category: activeGoal.category,
            priority: activeGoal.priority,
            progress: activeGoal.progress,
            description: activeGoal.description
          }
        })
      });

      if (!res.ok) throw new Error("Start fehlgeschlagen");
      const data = await res.json();

      // Sofortiger Insight für die UI (zeige ihn kurz an)
      setStatus(`Insight: ${data.insight?.title || "—"}`);
      setTimeout(() => setStatus("Tagesfokus läuft ✅"), 1500);
    } catch (e: any) {
      setStatus(e?.message || "Fehler");
    }
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-2 rounded-xl text-white">
      <button
        onClick={startDay}
        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded transition"
      >
        Fokus-Tag starten
      </button>
      <span className="text-sm opacity-80">{status}</span>
    </div>
  );
}