"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompare, type CompareEntry } from "./useCompare";

// On /compare, removing a product also drops it from the URL so the table updates.
export function CompareRemove({ entry }: { entry: CompareEntry }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { has, toggle } = useCompare();
  return (
    <button
      onClick={() => {
        if (has(entry.id)) toggle(entry);
        const p = new URLSearchParams(sp);
        p.set("ids", (p.get("ids") ?? "").split(",").filter((x) => x !== entry.id).join(","));
        router.replace(`/compare?${p}`);
      }}
      className="flex w-full items-center justify-center gap-1 rounded-full py-1 text-[11px] text-neutral-500 ring-1 ring-black/10"
    >
      <X className="size-3" />
      حذف
    </button>
  );
}
