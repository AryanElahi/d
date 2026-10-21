"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { toFaDigits } from "@/lib/normalize";
import { useTracked } from "./useTracked";

export function TrackLink() {
  const { items } = useTracked();
  const open = (items ?? []).filter((t) => t.status !== "bought").length;
  return (
    <Link href="/track" className="relative flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-black/10">
      <BellRing className="size-3.5" />
      پیگیری‌ها
      {open > 0 && (
        <span className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
          {toFaDigits(open)}
        </span>
      )}
    </Link>
  );
}
