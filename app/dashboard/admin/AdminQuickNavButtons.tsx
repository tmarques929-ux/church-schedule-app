"use client";

import { useCallback } from "react";

type QuickNavSection = {
  id: string;
  label: string;
};

type AdminQuickNavButtonsProps = {
  sections: QuickNavSection[];
};

export default function AdminQuickNavButtons({ sections }: AdminQuickNavButtonsProps) {
  const handleScroll = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="fixed left-4 top-32 z-30 flex flex-col gap-2 sm:left-6">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => handleScroll(section.id)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-indigo-600/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500 sm:text-xs"
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}
