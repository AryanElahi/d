"use client";

import { GitCompareArrows } from "lucide-react";
import { useState } from "react";
import { toFaDigits } from "@/lib/normalize";
import { MAX, useCompare, type CompareEntry } from "./useCompare";

// Lives inside result cards (which are links), so it must not trigger navigation.
export function CompareToggle({ entry, className = "" }: { entry: CompareEntry; className?: string }) {
  const { list, toggle, has } = useCompare();
  const [msg, setMsg] = useState<string | null>(null);
  const active = has(entry.id);

  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = toggle(entry);
    if (r === "full") setMsg(`حداکثر ${toFaDigits(MAX)} کالا`);
    else if (r === "other_category") {
      if (confirm(`مقایسه فقط بین کالاهای یک دسته ممکن است. فهرست فعلی («${list[0]?.category}») پاک شود و این کالا جایگزین شود؟`)) toggle(entry, true);
    } else setMsg(null);
  };

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <button
        onClick={click}
        aria-pressed={active}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ring-1 ${active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-neutral-700 ring-black/10"}`}
      >
        <GitCompareArrows className="size-3.5" />
        {active ? "در مقایسه" : "مقایسه"}
      </button>
      {msg && <span className="mt-0.5 text-[10px] text-rose-700">{msg}</span>}
    </span>
  );
}
