"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toFaDigits } from "@/lib/normalize";
import type { SpecRow } from "@/lib/specdiff";

// Mobile layout: each spec is a label line over N value cells, so 3 products fit in 375px.
export function CompareTable({ rows, n }: { rows: SpecRow[]; n: number }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [showPartial, setShowPartial] = useState(false);
  const shared = rows.filter((r) => r.shared && (!onlyDiff || r.differs));
  const partial = rows.filter((r) => !r.shared);
  const sharedTotal = rows.filter((r) => r.shared).length;
  const sharedDiff = rows.filter((r) => r.shared && r.differs).length;

  if (!rows.length) return <p className="rounded-2xl bg-white p-4 text-sm text-neutral-600">برای این کالاها مشخصات فنی ثبت نشده است.</p>;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">مشخصات فنی</h2>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="accent-indigo-600" />
          فقط تفاوت‌ها
        </label>
      </div>
      <p className="text-xs leading-5 text-neutral-500">
        {toFaDigits(sharedTotal)} مشخصه برای همه ثبت شده ({toFaDigits(sharedDiff)} مورد متفاوت). مشخصات را فروشنده‌ها و ترب با عبارت‌های
        متفاوت ثبت کرده‌اند؛ «ثبت نشده» یعنی نامعلوم، نه «ندارد».
      </p>

      <Rows rows={shared} n={n} />

      {partial.length > 0 && (
        <div>
          <button onClick={() => setShowPartial((x) => !x)} className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-black/5">
            <span>فقط برای بعضی کالاها ثبت شده ({toFaDigits(partial.length)})</span>
            <ChevronDown className={`size-4 transition ${showPartial ? "rotate-180" : ""}`} />
          </button>
          {showPartial && (
            <div className="mt-2">
              <Rows rows={partial} n={n} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Rows({ rows, n }: { rows: SpecRow[]; n: number }) {
  return (
    <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
      {rows.map((r) => (
        <div key={`${r.section}|${r.key}`} className={`p-2.5 ${r.differs && r.shared ? "border-r-4 border-amber-400" : ""}`}>
          <p className="mb-1 text-[11px] font-semibold text-neutral-500">{r.key}</p>
          <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {r.values.map((v, i) => (
              <p key={i} className={`break-words ${v == null ? "text-neutral-400" : ""}`}>{v ?? "ثبت نشده"}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
