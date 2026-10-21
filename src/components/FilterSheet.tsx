"use client";

import { X } from "lucide-react";
import { toFaDigits } from "@/lib/normalize";
import type { Sort } from "@/lib/parser";
import type { SearchInput } from "@/lib/search";

type Props = {
  open: boolean;
  filters: SearchInput;
  areas: string[];
  onChange: (f: SearchInput) => void;
  onClose: () => void;
};

const SORTS: [Sort, string][] = [
  ["relevance", "مرتبط‌ترین"],
  ["price", "ارزان‌ترین"],
  ["distance", "نزدیک‌ترین"],
];

const TOGGLES: [keyof SearchInput, string, string][] = [
  ["openNow", "الان باز باشد", "فقط فروشگاه‌هایی که ساعت کاری‌شان ثبت شده و الان باز هستند"],
  ["warranty", "گارانتی‌دار", "فروشنده برای این کالا گارانتی ثبت کرده"],
  ["torobpay", "ترب‌پی", "فقط برای بخش کمی از فروشگاه‌ها ثبت شده"],
  ["installments", "خرید قسطی", "سرویس قسطی اعلام‌شده توسط فروشنده"],
];

const million = (n?: number) => (n == null ? "" : String(n / 1e6));
const toToman = (v: string) => (v.trim() === "" ? undefined : Math.round(Number(v) * 1e6));

export function FilterSheet({ open, filters: f, areas, onChange, onClose }: Props) {
  const set = (patch: Partial<SearchInput>) => onChange({ ...f, ...patch });
  const hasPlace = f.area || f.lat != null;

  return (
    <div className={`fixed inset-0 z-30 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-xl transition-transform ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">فیلترها</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-neutral-100" aria-label="بستن"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-xs text-neutral-500">هر تغییر همان لحظه روی نتایج اعمال می‌شود.</p>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">مرتب‌سازی</h3>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 text-sm">
            {SORTS.map(([k, label]) => (
              <button
                key={k}
                disabled={k === "distance" && !hasPlace}
                onClick={() => set({ sort: k })}
                className={`rounded-lg py-1.5 disabled:opacity-40 ${f.sort === k ? "bg-white font-semibold shadow-sm" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">بودجه (میلیون تومان)</h3>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              placeholder="از"
              defaultValue={million(f.budgetMin)}
              key={`min-${f.budgetMin}`}
              onBlur={(e) => set({ budgetMin: toToman(e.target.value) })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <span className="text-neutral-400">تا</span>
            <input
              inputMode="decimal"
              placeholder="تا"
              defaultValue={million(f.budgetMax)}
              key={`max-${f.budgetMax}`}
              onBlur={(e) => set({ budgetMax: toToman(e.target.value) })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold">محدوده</h3>
          <select
            value={f.lat != null ? "__me" : f.area ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__me") return;
              set({ area: v || undefined, lat: undefined, lon: undefined, radiusKm: undefined, sort: v ? f.sort : f.sort === "distance" ? "relevance" : f.sort });
            }}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">همه تهران</option>
            {f.lat != null && <option value="__me">موقعیت فعلی من</option>}
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {hasPlace && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-neutral-600">
                <span>شعاع جست‌وجو</span>
                <span>{toFaDigits(f.radiusKm ?? 1.5)} کیلومتر</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                defaultValue={f.radiusKm ?? 1.5}
                key={`r-${f.radiusKm}`}
                onPointerUp={(e) => set({ radiusKm: Number(e.currentTarget.value) })}
                onKeyUp={(e) => set({ radiusKm: Number(e.currentTarget.value) })}
                className="w-full accent-teal-600"
              />
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">شرایط خرید</h3>
          <div className="space-y-2">
            {TOGGLES.map(([k, label, hint]) => (
              <label key={k} className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3">
                <input
                  type="checkbox"
                  checked={!!f[k]}
                  onChange={(e) => set({ [k]: e.target.checked })}
                  className="mt-1 size-4 accent-teal-600"
                />
                <span>
                  <span className="block text-sm">{label}</span>
                  <span className="block text-xs text-neutral-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
