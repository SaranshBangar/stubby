"use client";
import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

// Minimal accordion: one open at a time, orange +/− affordance. Matches the
// design's FAQ section. Kept client-side just for the open/close state.
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col">
      {items.map((item, i) => (
        <div key={i} className="border-t border-b1">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 py-[18px] text-left"
            aria-expanded={open === i}
          >
            <span className="text-[14.5px] font-medium leading-snug text-t1">
              {item.q}
            </span>
            <span className="shrink-0 font-mono text-base text-brand">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <div className="pb-[18px] pr-8 text-sm leading-relaxed text-t2">
              {item.a}
            </div>
          )}
        </div>
      ))}
      <div className="border-t border-b1" />
    </div>
  );
}
