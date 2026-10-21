"use client";

import { GitCompareArrows, X } from "lucide-react";
import Link from "next/link";
import { toFaDigits } from "@/lib/normalize";
import { useCompare } from "./useCompare";

// Floating tray shown once something is picked for comparison.
export function CompareBar({ query = "" }: { query?: string }) {
  const { list, toggle, clear } = useCompare();
  if (!list.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-md px-3">
      <div className="flex items-center gap-2 rounded-2xl bg-indigo-950 p-2 text-white shadow-xl">
        <div className="flex min-w-0 flex-1 gap-1.5">
          {list.map((e) => (
            <button key={e.id} onClick={() => toggle(e)} className="relative size-10 shrink-0 rounded-lg bg-white" aria-label={`حذف ${e.title}`}>
              {e.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image} alt="" referrerPolicy="no-referrer" className="size-full rounded-lg object-contain" />
              )}
              <X className="absolute -left-1 -top-1 size-4 rounded-full bg-neutral-700 p-0.5" />
            </button>
          ))}
        </div>
        <button onClick={clear} className="px-1 text-[11px] text-indigo-200">پاک کردن</button>
        {list.length >= 2 ? (
          <Link href={`/compare?ids=${list.map((e) => e.id).join(",")}${query}`} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-indigo-950">
            <GitCompareArrows className="size-4" />
            مقایسه {toFaDigits(list.length)} کالا
          </Link>
        ) : (
          <span className="px-2 text-[11px] text-indigo-200">یک کالای دیگر از همین دسته انتخاب کنید</span>
        )}
      </div>
    </div>
  );
}
