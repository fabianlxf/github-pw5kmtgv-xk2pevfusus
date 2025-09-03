import { useEffect, useMemo, useState } from "react";

type Props = {
  masterPercent: number;         // z.B. 60
  onDismiss: () => void;         // wird beim Tap/Swipe aufgerufen
};

function chooseTodayPoster(candidates: string[]): string | null {
  if (!candidates.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem("poster.date");
  let url = localStorage.getItem("poster.url");

  if (lastDate !== today) {
    url = candidates[Math.floor(Math.random() * candidates.length)];
    localStorage.setItem("poster.date", today);
    localStorage.setItem("poster.url", url);
  }
  return url;
}

export default function PosterSplash({ masterPercent, onDismiss }: Props) {
  const [loading, setLoading] = useState(true);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [show, setShow] = useState(true);

  // Beim ersten Laden: Liste holen & Tagesposter bestimmen
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/posters");
        const data = await r.json();
        const files: string[] = Array.isArray(data?.files) ? data.files : [];
        const chosen = chooseTodayPoster(files);
        if (!cancelled) {
          setPosterUrl(chosen ?? "/posters/today.jpg"); // Fallback falls leer
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPosterUrl("/posters/today.jpg");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Swipe up/down
  useEffect(() => {
    if (!show) return;
    let startY: number | null = null;

    const onStart = (y: number) => (startY = y);
    const onMove = (y: number) => {
      if (startY == null) return;
      const dy = y - startY;
      setDragY(dy);
    };
    const onEnd = () => {
      if (Math.abs(dragY) > 120) {
        setShow(false);
        onDismiss();
      }
      setDragY(0);
      startY = null;
    };

    const ts = (e: TouchEvent) => onStart(e.touches[0].clientY);
    const tm = (e: TouchEvent) => onMove(e.touches[0].clientY);
    const te = () => onEnd();

    const ms = (e: MouseEvent) => onStart(e.clientY);
    const mm = (e: MouseEvent) => onMove(e.clientY);
    const me = () => onEnd();

    window.addEventListener('touchstart', ts, { passive: true });
    window.addEventListener('touchmove', tm, { passive: true });
    window.addEventListener('touchend', te);
    window.addEventListener('mousedown', ms);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', me);
    return () => {
      window.removeEventListener('touchstart', ts);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', te);
      window.removeEventListener('mousedown', ms);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', me);
    };
  }, [show, dragY, onDismiss]);

  if (!show) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex items-center justify-center">
        Lade Poster…
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        transform: `translateY(${dragY}px)`,
        transition: dragY === 0 ? 'transform 300ms ease' : 'none'
      }}
      onClick={() => { setShow(false); onDismiss(); }}
    >
      <div className="absolute inset-0">
        <img
          src={posterUrl ?? "/posters/today.jpg"}
          alt="Poster"
          className="w-full h-full object-cover"
          style={{ animation: 'posterBreath 12s ease-in-out infinite' }}
        />
        {/* Vignette / Hinweis */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.7)_100%)]" />
        <div className="absolute bottom-24 w-full text-center text-white/80 text-sm">Wischen zum Start</div>

        {/* Master Flame */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur border border-white/20 flex items-center justify-center">
              <span className={masterPercent >= 80 ? "animate-pulse" : ""}>🔥</span>
            </div>
            <div className="absolute -bottom-2 w-full text-center text-white/90 text-xs">
              {masterPercent}%
            </div>
          </div>
        </div>
      </div>

      <style>
        {`@keyframes posterBreath {
            0% { transform: scale(1.02) }
            50% { transform: scale(1.06) }
            100% { transform: scale(1.02) }
          }`}
      </style>
    </div>
  );
}