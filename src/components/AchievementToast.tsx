"use client";

export function AchievementToast({
  items,
  onClose,
}: {
  items: { title: string; description: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6" onClick={onClose}>
      <div
        className="bg-jcf-panel border border-jcf-gold/50 rounded-sm p-6 max-w-sm w-full text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-diagonal-fade pointer-events-none" />
        <div className="relative">
          <div className="text-jcf-gold text-[11px] uppercase tracking-widest mb-3">
            {items.length > 1 ? "New Achievements" : "Achievement Unlocked"}
          </div>
          {items.map((item, i) => (
            <div key={i} className={i > 0 ? "mt-4 pt-4 border-t border-white/10" : ""}>
              <div className="font-display text-xl uppercase text-white mb-1">{item.title}</div>
              <div className="text-jcf-gray text-sm">{item.description}</div>
            </div>
          ))}
          <button
            onClick={onClose}
            className="mt-6 bg-jcf-gold text-jcf-black uppercase text-sm font-semibold px-5 py-2 rounded-sm"
          >
            Nice
          </button>
        </div>
      </div>
    </div>
  );
}
