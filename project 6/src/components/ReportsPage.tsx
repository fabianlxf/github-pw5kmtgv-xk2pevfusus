export default function ReportsPage({
  posters
}: { posters: { date: string; src: string; quote?: string }[] }) {
  return (
    <div className="text-white px-4 py-3">
      <h2 className="text-lg font-semibold mb-3">Wochenreport</h2>
      <div className="text-sm opacity-80 mb-4">
        Tipp: Morgens 1 Hauptblock Deep Work, abends kurze Reflexion.
      </div>

      <h3 className="font-medium mb-2">Poster-History</h3>
      <div className="space-y-3">
        {posters.map((p, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="text-xs opacity-70 px-3 py-2">{p.date}</div>
            <div className="w-full aspect-[16/9] overflow-hidden">
              <img src={p.src} className="w-full h-full object-cover" />
            </div>
            {p.quote ? <div className="px-3 py-2 text-sm">{p.quote}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}