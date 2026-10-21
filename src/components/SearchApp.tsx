"use client";

import { Info, LocateFixed, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { distance, toman } from "@/lib/format";
import { toFaDigits } from "@/lib/normalize";
import { toParams } from "@/lib/query";
import type { SearchInput, SearchResult } from "@/lib/search";
import { FilterSheet } from "./FilterSheet";
import { ResultCard, ResultCardSkeleton } from "./ResultCard";
import { TrackLink } from "./TrackLink";
import { CompareBar } from "./CompareBar";

const EXAMPLES = [
  "دوربین مدار بسته داهوا نزدیک جمهوری",
  "گوشی سامسونگ زیر ۲۰ میلیون",
  "سیم برق ارزان در لاله زار",
  "هندزفری با گارانتی الان باز",
];

type Status = "idle" | "loading" | "done" | "error";

export function SearchApp({ areas }: { areas: string[] }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<SearchInput | null>(null);
  const [data, setData] = useState<SearchResult | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const reqId = useRef(0);

  const run = useCallback(async (params: URLSearchParams) => {
    const id = ++reqId.current;
    setStatus("loading");
    try {
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const json: SearchResult = await res.json();
      if (id !== reqId.current) return; // a newer filter change won
      setData(json);
      setFilters(json.filters);
      setStatus("done");
      window.history.replaceState(null, "", `?${toParams(json.filters)}`);
    } catch {
      if (id === reqId.current) setStatus("error");
    }
  }, []);

  const locate = useCallback(
    (base: SearchInput) => {
      if (!navigator.geolocation) return setToast("مرورگر شما موقعیت‌یابی ندارد؛ محدوده را از فیلترها انتخاب کنید.");
      navigator.geolocation.getCurrentPosition(
        (pos) => run(toParams({ ...base, area: undefined, lat: pos.coords.latitude, lon: pos.coords.longitude, radiusKm: base.radiusKm ?? 3 })),
        () => setToast("به موقعیت شما دسترسی نداریم؛ محدوده را از فیلترها انتخاب کنید."),
        { timeout: 8000 },
      );
    },
    [run],
  );

  // Restore a shared/refreshed URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("t") || p.has("q")) {
      setQ(p.get("q") ?? p.get("t") ?? "");
      run(p);
    }
  }, [run]);

  // "نزدیک من" in the query: ask for location once results for the rest are in.
  useEffect(() => {
    if (filters?.nearMe && filters.lat == null) locate({ ...filters, nearMe: false });
  }, [filters, locate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    setQ(text);
    run(new URLSearchParams({ q: text }));
  };
  const update = (f: SearchInput) => {
    setFilters(f);
    run(toParams(f));
  };

  const chips = filters ? activeChips(filters) : [];

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <header className="sticky top-0 z-20 bg-[var(--background)]/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-teal-700">خریدیار</h1>
            <span className="text-xs text-neutral-500">دستیار خرید حضوری تهران</span>
          </div>
          <TrackLink />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5 focus-within:ring-teal-500"
        >
          <Search className="size-5 shrink-0 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="چی لازم داری؟ کجا و با چه بودجه‌ای؟"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="پاک کردن" className="text-neutral-400"><X className="size-4" /></button>
          )}
        </form>

        {filters && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <button
              onClick={() => setSheet(true)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              <SlidersHorizontal className="size-3.5" />
              فیلترها
            </button>
            {filters.lat == null && (
              <button
                onClick={() => locate(filters)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-black/10"
              >
                <LocateFixed className="size-3.5" />
                نزدیک من
              </button>
            )}
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={() => update({ ...filters, ...c.clear })}
                className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs ring-1 ring-black/10"
              >
                {c.label}
                <X className="size-3 text-neutral-400" />
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="space-y-3 px-4">
        {status === "idle" && <Welcome onPick={submit} />}

        {status !== "idle" && (
          <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs leading-5 text-amber-900">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            قیمت‌ها همان قیمتی است که فروشنده در ترب ثبت کرده و موجودی تأیید نشده است. پیش از رفتن، از صفحه هر فروشنده استعلام بگیرید.
          </p>
        )}

        {status === "loading" && [0, 1, 2].map((i) => <ResultCardSkeleton key={i} />)}

        {status === "error" && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm">
            <p>جست‌وجو انجام نشد.</p>
            <button onClick={() => filters && update(filters)} className="mt-3 rounded-full bg-teal-600 px-4 py-2 text-white">دوباره تلاش کن</button>
          </div>
        )}

        {status === "done" && data && (
          <>
            {data.needsQuery ? (
              <p className="rounded-2xl bg-white p-6 text-center text-sm text-neutral-600">بگو دنبال چه کالایی هستی؛ مثلاً «دوربین مدار بسته» یا «هندزفری».</p>
            ) : data.results.length === 0 ? (
              <EmptyState filters={data.filters} onChange={update} />
            ) : (
              <>
                {data.relaxed && (
                  <p className="rounded-xl bg-neutral-100 p-2.5 text-xs leading-5 text-neutral-700">
                    برای کل جمله نتیجه‌ای نبود؛ نتایج «{data.relaxed}» را نشان می‌دهیم.
                  </p>
                )}
                {data.llm?.used && (
                  <p className="flex items-start gap-1.5 rounded-xl bg-indigo-50 p-2.5 text-xs leading-5 text-indigo-900">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                    جمله شما با کمک هوش مصنوعی به فیلترهای بالا تبدیل شد. اگر درست نیست، هر فیلتر را بردارید یا تغییر دهید.
                  </p>
                )}
                <p className="text-xs text-neutral-500">
                  {toFaDigits(data.results.length)} کالا
                  {data.center && ` · تا ${distance(data.filters.radiusKm)} از ${data.center.label}`}
                </p>
                {data.results.map((h) => {
                  const p = new URLSearchParams();
                  if (data.center) {
                    p.set("lat", String(data.center.lat));
                    p.set("lon", String(data.center.lon));
                    p.set("place", data.center.label);
                    if (data.filters.radiusKm) p.set("r", String(data.filters.radiusKm));
                  }
                  return <ResultCard key={h.id} hit={h} href={`/product/${h.id}?${p}`} />;
                })}
              </>
            )}
          </>
        )}
      </main>

      <CompareBar query={data?.center ? `&lat=${data.center.lat}&lon=${data.center.lon}&place=${encodeURIComponent(data.center.label)}` : ""} />

      {filters && (
        <FilterSheet open={sheet} filters={filters} areas={areas} onChange={update} onClose={() => setSheet(false)} />
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-sm rounded-xl bg-neutral-900 p-3 text-center text-xs text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function activeChips(f: SearchInput): { label: string; clear: Partial<SearchInput> }[] {
  const out: { label: string; clear: Partial<SearchInput> }[] = [];
  if (f.category) out.push({ label: f.category, clear: { category: undefined } });
  if (f.brand) out.push({ label: `برند ${f.brand}`, clear: { brand: undefined } });
  if (f.budgetMin != null && f.budgetMax != null)
    out.push({ label: `${toman(f.budgetMin)} تا ${toman(f.budgetMax)}`, clear: { budgetMin: undefined, budgetMax: undefined } });
  else if (f.budgetMax != null) out.push({ label: `تا ${toman(f.budgetMax)}`, clear: { budgetMax: undefined } });
  else if (f.budgetMin != null) out.push({ label: `از ${toman(f.budgetMin)}`, clear: { budgetMin: undefined } });
  const noPlaceSort = f.sort === "distance" ? { sort: "relevance" as const } : {};
  if (f.lat != null)
    out.push({ label: `اطراف من · ${distance(f.radiusKm)}`, clear: { lat: undefined, lon: undefined, radiusKm: undefined, ...noPlaceSort } });
  else if (f.area) out.push({ label: `${f.area} · ${distance(f.radiusKm)}`, clear: { area: undefined, radiusKm: undefined, ...noPlaceSort } });
  if (f.openNow) out.push({ label: "الان باز", clear: { openNow: false } });
  if (f.warranty) out.push({ label: "گارانتی‌دار", clear: { warranty: false } });
  if (f.torobpay) out.push({ label: "ترب‌پی", clear: { torobpay: false } });
  if (f.installments) out.push({ label: "قسطی", clear: { installments: false } });
  if (f.sort === "price") out.push({ label: "ارزان‌ترین", clear: { sort: "relevance" } });
  if (f.sort === "distance") out.push({ label: "نزدیک‌ترین", clear: { sort: "relevance" } });
  return out;
}

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <section className="pt-4">
      <h2 className="text-xl font-bold leading-9">پیش از رفتن به بازار،<br />بدان کجا برو.</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        کالا، بودجه و محله را بنویس. فروشنده‌های نزدیک، قیمت ثبت‌شده و پاساژهایی که چند گزینه دارند را نشانت می‌دهیم.
      </p>
      <h3 className="mb-2 mt-6 text-xs font-semibold text-neutral-500">امتحان کن</h3>
      <div className="space-y-2">
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => onPick(e)} className="block w-full rounded-xl bg-white px-3 py-2.5 text-right text-sm ring-1 ring-black/5 hover:ring-teal-400">
            {e}
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ filters: f, onChange }: { filters: SearchInput; onChange: (f: SearchInput) => void }) {
  const hasPlace = f.area || f.lat != null;
  const strict = f.openNow || f.warranty || f.torobpay || f.installments;
  return (
    <div className="rounded-2xl bg-white p-6 text-center text-sm">
      <p className="font-semibold">با این شرایط چیزی پیدا نشد.</p>
      <div className="mt-4 flex flex-col gap-2">
        {hasPlace && (f.radiusKm ?? 0) < 10 && (
          <button onClick={() => onChange({ ...f, radiusKm: Math.min(10, (f.radiusKm ?? 1.5) * 2) })} className="rounded-full bg-teal-600 px-4 py-2 text-white">
            شعاع را به {toFaDigits(Math.min(10, (f.radiusKm ?? 1.5) * 2))} کیلومتر برسان
          </button>
        )}
        {f.budgetMax != null && (
          <button onClick={() => onChange({ ...f, budgetMax: Math.round(f.budgetMax! * 1.3) })} className="rounded-full bg-white px-4 py-2 ring-1 ring-teal-600 text-teal-700">
            بودجه را ۳۰٪ بیشتر کن
          </button>
        )}
        {strict && (
          <button onClick={() => onChange({ ...f, openNow: false, warranty: false, torobpay: false, installments: false })} className="rounded-full bg-white px-4 py-2 ring-1 ring-black/10">
            شرایط خرید را بردار
          </button>
        )}
        {hasPlace && (
          <button onClick={() => onChange({ ...f, area: undefined, lat: undefined, lon: undefined, radiusKm: undefined, sort: "relevance" })} className="rounded-full bg-white px-4 py-2 ring-1 ring-black/10">
            در همه تهران بگرد
          </button>
        )}
      </div>
    </div>
  );
}
