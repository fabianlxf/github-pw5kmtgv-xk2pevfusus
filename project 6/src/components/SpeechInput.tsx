import { useEffect, useRef, useState } from "react";

// Helper: den besten Mime-Type finden
function pickMime(candidates: string[]) {
  for (const t of candidates) {
    // @ts-ignore
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return "";
}

type PlanFromSpeechResult = {
  text?: string;
  plan?: any;
  icsUrl?: string;
};

export default function SpeechInput({
  onPlan,          // optional Callback mit Server-Antwort (Plan etc.)
  onError,         // optional Fehler-Callback
  userId = "demo-user",
  includeInputs = true,
  startHour,
  endHour,
}: {
  onPlan?: (r: PlanFromSpeechResult) => void;
  onError?: (err: Error | string) => void;
  userId?: string;
  includeInputs?: boolean;
  startHour?: number;
  endHour?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastText, setLastText] = useState<string>("");
  const [icsUrl, setIcsUrl] = useState<string | undefined>(undefined);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<any>(null);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      try { mediaRecRef.current?.stop(); } catch {}
      try { recognitionRef.current?.stop?.(); } catch {}
    };
  }, []);

  const hasMediaRecorder =
    typeof window !== "undefined" && !!(window as any).MediaRecorder;

  const hasWebSpeech =
    typeof window !== "undefined" && !!(window as any).webkitSpeechRecognition;

  // --------- MEDIARECORDER (Standard-Weg) ----------
  const startMediaRecorder = async () => {
    try {
      setLastText("");
      setIcsUrl(undefined);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Bewährte Reihenfolge (Safari iOS mag mp4/m4a, Chrome mag webm)
      const mime =
        pickMime(["audio/mp4;codecs=aac", "audio/webm;codecs=opus"]) ||
        pickMime(["audio/webm", "audio/mp4"]) ||
        "";

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        setBusy(true);
        try {
          const mimeType = (mr as any).mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mimeType });

          const fd = new FormData();
          // Dateiendung passend setzen (Server erkennt webm/m4a/mp3)
          const filename = mimeType.includes("mp4") ? "speech.m4a" : "speech.webm";
          fd.append("file", blob, filename);
          fd.append("userId", userId);
          fd.append("includeInputs", String(includeInputs));
          if (typeof startHour === "number") fd.append("startHour", String(startHour));
          if (typeof endHour === "number") fd.append("endHour", String(endHour));

          const res = await fetch("/api/plan/from-speech", { method: "POST", body: fd });

          if (!res.ok) {
            const msg = `from-speech failed ${res.status}`;
            onError?.(new Error(msg));
            alert("Upload/Plan fehlgeschlagen");
            return;
          }

          const data = await res.json();
          setLastText(data?.text || "");
          setIcsUrl(data?.icsUrl);
          onPlan?.(data);
        } catch (e: any) {
          onError?.(e instanceof Error ? e : new Error(String(e)));
          alert("Upload/Plan fehlgeschlagen");
        } finally {
          setBusy(false);
          setRecording(false);
          // Tracks stoppen
          try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        }
      };

      mr.start();
      setRecording(true);
    } catch (e: any) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
      alert("Mikrofon-Zugriff verweigert oder nicht möglich.");
    }
  };

  const stopMediaRecorder = () => {
    try { mediaRecRef.current?.stop(); } catch {}
  };

  // --------- WEB SPEECH (Fallback) ----------
  const startWebSpeech = () => {
    try {
      setLastText("");
      setIcsUrl(undefined);

      const Rec = (window as any).webkitSpeechRecognition;
      const recog = new Rec();
      recognitionRef.current = recog;

      recog.lang = "de-DE";
      recog.continuous = false;
      recog.interimResults = true;

      let finalTranscript = "";

      recog.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript;
        }
      };

      recog.onend = async () => {
        setRecording(false);
        const t = (finalTranscript || "").trim();
        if (!t) return;

        setBusy(true);
        try {
          // Da wir hier nur Text haben, nutzen wir /api/plan/day als Fallback
          const res = await fetch("/api/plan/day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: t }),
          });
          if (!res.ok) throw new Error(`Plan generation failed: ${res.status}`);
          const data = await res.json();
          setLastText(t);
          setIcsUrl(undefined); // /api/plan/day liefert kein ICS; nur /from-speech tut das
          onPlan?.({ text: t, plan: data });
        } catch (e: any) {
          onError?.(e instanceof Error ? e : new Error(String(e)));
          alert("Plan aus Text fehlgeschlagen");
        } finally {
          setBusy(false);
        }
      };

      setRecording(true);
      recog.start();
    } catch (e: any) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
      setRecording(false);
      alert("Konnte Sprachaufnahme (Web Speech) nicht starten.");
    }
  };

  const stopWebSpeech = () => {
    try { recognitionRef.current?.stop?.(); } catch {}
  };

  // --------- Public Button-Handler ----------
  const handlePress = () => {
    if (recording) {
      // Stop
      if (mediaRecRef.current) return stopMediaRecorder();
      if (recognitionRef.current) return stopWebSpeech();
      setRecording(false);
      return;
    }

    // Start
    if (hasMediaRecorder) return startMediaRecorder();
    if (hasWebSpeech) return startWebSpeech();

    alert(
      "Keine unterstützte Audioaufnahme gefunden. Öffne die App über HTTPS (z. B. Chrome/Safari) oder nutze ein Gerät/Bowser mit Mikrofon-Zugriff."
    );
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 text-center">
      <button
        onClick={handlePress}
        disabled={busy}
        className={`w-16 h-16 rounded-full ${
          recording ? "bg-red-600 animate-pulse" : "bg-indigo-600"
        } text-white flex items-center justify-center shadow-lg disabled:opacity-60`}
        aria-label="Tagesplan per Sprache eingeben"
        title={recording ? "Aufnahme stoppen" : "Aufnahme starten"}
      >
        {recording ? "■" : "🎤"}
      </button>

      {busy ? (
        <div className="text-white text-xs mt-2 opacity-80">Erzeuge Plan…</div>
      ) : null}

      {lastText ? (
        <div className="mt-2 max-w-xs text-center text-white/90 text-xs">
          <div className="opacity-80">Transkript:</div>
          <div className="line-clamp-3">{lastText}</div>
          {icsUrl ? (
            <div className="mt-1">
              <a className="text-sky-400 underline" href={icsUrl}>
                ICS herunterladen
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}