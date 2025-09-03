import { useEffect, useRef, useState } from "react";

type ServerPlan =
  | { text?: string; icsUrl?: string; plan?: { date?: string; tasks?: any[] } }
  | Record<string, never>;

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const api = (p: string) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

export default function MicCapture({
  onPlan,
  maxSeconds = 120,
}: {
  onPlan?: (payload: { text?: string; plan?: any }) => void;
  maxSeconds?: number;
}) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [result, setResult] = useState<{ text?: string; icsUrl?: string } | null>(null);

  const chunks = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autostopRef = useRef<number | null>(null);

  function pickSupportedMime(): string {
    const MR: any = (window as any).MediaRecorder;
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    if (!MR?.isTypeSupported) return "";
    for (const t of candidates) if (MR.isTypeSupported(t)) return t;
    return "";
  }

  function clearStream() {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  }

  function clearAutostop() {
    if (autostopRef.current != null) {
      window.clearTimeout(autostopRef.current);
      autostopRef.current = null;
    }
  }

  async function fallbackToTextPlan(prefillMsg?: string) {
    const pre = prefillMsg ? `${prefillMsg}\n\n` : "";
    const desc = window.prompt(
      `${pre}Sprach-Upload nicht möglich. Bitte gib eine kurze Beschreibung deines Tages ein:`
    );
    if (!desc || !desc.trim()) return;

    try {
      setBusy(true);
      setStatus("Erzeuge Plan aus Text …");
      setError(null);

      const res = await fetch(api("/api/plan/day"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `plan/day failed ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));
      setResult({ text: desc, icsUrl: undefined });
      onPlan?.({ text: desc, plan: data });
    } catch (e) {
      console.error(e);
      setError("Text-Planer fehlgeschlagen.");
      alert("Text-Planer fehlgeschlagen.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  useEffect(() => {
    return () => {
      try {
        rec?.stop();
      } catch {}
      clearAutostop();
      clearStream();
    };
  }, [rec]);

  const start = async () => {
    try {
      setError(null);
      setResult(null);
      setStatus("Warte auf Mikrofonfreigabe …");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickSupportedMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

      chunks.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onerror = (ev) => {
        console.error("[MediaRecorder] error", ev);
        setError("Recorder-Fehler. Bitte nochmal versuchen.");
      };

      mr.onstop = async () => {
        setBusy(true);
        setStatus("Hochladen & Plan erstellen …");
        clearAutostop();

        try {
          const usedMime = (mr as any).mimeType || mime || "audio/webm";
          const blob = new Blob(chunks.current, { type: usedMime });
          const filename = usedMime.includes("mp4") ? "speech.m4a" : "speech.webm";

          const fd = new FormData();
          // WICHTIG: Feldname MUSS "file" sein
          fd.append("file", blob, filename);
          fd.append("userId", "demo-user");
          fd.append("includeInputs", "true");

          const ctrl = new AbortController();
          const to = window.setTimeout(() => ctrl.abort(), 30_000);

          let data: ServerPlan | null = null;
          try {
            const res = await fetch(api("/api/plan/from-speech"), {
              method: "POST",
              body: fd,
              signal: ctrl.signal,
            });
            window.clearTimeout(to);

            if (!res.ok) {
              const errText = await res.text().catch(() => "");

              // Nur bei 501 (serverseitig deaktiviert) auf Text-Fallback
              if (res.status === 501) {
                await fallbackToTextPlan("Sprach-Planer ist serverseitig aus.");
                return;
              }

              throw new Error(errText || `from-speech failed ${res.status}`);
            }

            data = (await res.json().catch(() => ({}))) as ServerPlan;
          } catch (netErr: any) {
            console.error("[from-speech] network/timeout", netErr);
            // Netzwerk-/Timeoutfehler ⇒ optionaler Fallback
            await fallbackToTextPlan("Verbindung zum Sprach-Planer fehlgeschlagen.");
            return;
          }

          // Erwartet: { text, plan: { tasks: [...] }, icsUrl? }
          const tasks = Array.isArray(data?.plan?.tasks) ? data!.plan!.tasks : [];

          setResult({ text: data?.text, icsUrl: data?.icsUrl });
          onPlan?.({ text: data?.text, plan: data?.plan });
          if (!tasks.length) {
            // Optional Info, falls leer zurückkam
            console.warn("[from-speech] Plan ohne Tasks empfangen");
          }
        } catch (e: any) {
          console.error(e);
          setError(e?.message || "Upload/Plan fehlgeschlagen.");
          alert("Upload/Plan fehlgeschlagen.");
        } finally {
          setBusy(false);
          setStatus(null);
          clearStream();
        }
      };

      mr.start();
      setRec(mr);
      setStatus("Aufnahme läuft …");

      // Auto-Stop nach maxSeconds
      autostopRef.current = window.setTimeout(() => {
        try {
          if (mr.state === "recording") mr.stop();
        } catch {}
      }, Math.max(3, maxSeconds) * 1000);
    } catch (e) {
      console.error(e);
      setStatus(null);
      setError("Mikrofon-Zugriff verweigert oder nicht verfügbar.");
      alert("Mikrofon-Zugriff verweigert oder nicht verfügbar.");
    }
  };

  const stop = () => {
    try {
      rec?.stop();
    } finally {
      setRec(null);
      setStatus("Verarbeite Aufnahme …");
    }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 text-center">
      <button
        onClick={rec ? stop : start}
        disabled={busy}
        className={`w-16 h-16 rounded-full ${
          rec ? "bg-red-600 animate-pulse" : "bg-indigo-600"
        } disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg`}
        aria-label="Tagesplan per Sprache eingeben"
      >
        {rec ? "■" : "🎤"}
      </button>

      {status && <div className="text-white text-xs mt-2 opacity-80">{status}</div>}
      {error && <div className="text-red-300 text-xs mt-1 px-2">{error}</div>}

      {result?.text ? (
        <div className="mt-2 max-w-xs text-center text-white/90 text-xs mx-auto">
          <div className="opacity-80">Transkript / Beschreibung:</div>
          <div className="line-clamp-3">{result.text}</div>
          {result.icsUrl ? (
            <div className="mt-1">
              <a className="text-sky-400 underline" href={result.icsUrl}>
                ICS herunterladen
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}