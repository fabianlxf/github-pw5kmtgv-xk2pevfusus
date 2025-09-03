import { useEffect, useRef, useState } from "react";

export default function PosterGate({
  src, quote, show, onDismiss, masterPercent = 60
}: {
  src: string; quote?: string; show: boolean; onDismiss: ()=>void; masterPercent?: number;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!show) return;
    const onTouchStart = (e: TouchEvent) => { startY.current = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      setDragY(dy);
    };
    const onTouchEnd = () => {
      if (Math.abs(dragY) > 120) onDismiss();
      setDragY(0); startY.current = null;
    };
    window.addEventListener('touchstart', onTouchStart,{passive:true});
    window.addEventListener('touchmove', onTouchMove,{passive:true});
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [show, dragY, onDismiss]);

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        transform: `translateY(${dragY}px)`,
        transition: dragY === 0 ? 'transform 300ms ease' : 'none'
      }}
    >
      <div className="absolute inset-0">
        <img src={src} alt="Poster"
             className="w-full h-full object-cover"
             style={{ animation: 'posterBreath 12s ease-in-out infinite' }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.7)_100%)]" />
        {/* Swipe hint */}
        <div className="absolute bottom-20 w-full text-center text-white/80 text-sm">Nach oben/unten wischen</div>

        {/* Quote */}
        {quote ? (
          <div className="absolute left-0 right-0 bottom-28 text-center px-6 text-white drop-shadow">
            <div className="text-xl font-semibold">{quote}</div>
          </div>
        ) : null}

        {/* Master Flame */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur border border-white/20 flex items-center justify-center">
              <span className="text-white text-lg animate-pulse">🔥</span>
            </div>
            <div className="absolute -bottom-2 w-full text-center text-white/90 text-xs">{masterPercent}%</div>
          </div>
        </div>
      </div>

      <style>
        {`@keyframes posterBreath {
            0% { transform: scale(1.02) translate3d(0,0,0); }
            50% { transform: scale(1.06) translate3d(0,0,0); }
            100% { transform: scale(1.02) translate3d(0,0,0); }
          }`}
      </style>
    </div>
  );
}