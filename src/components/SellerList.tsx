"use client";

import { Building2, Clock, MapPin, Navigation, Phone, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { daysAgo, distance, place, priceTone, toman, type Tone } from "@/lib/format";
import type { HoursState } from "@/lib/hours";
import { toFaDigits } from "@/lib/normalize";
import type { Seller, Warranty } from "@/lib/product";
import { MapLink } from "./MapLink";

type SortKey = "price" | "distance" | "open";

const TONE: Record<Tone, string> = {
  fresh: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  aging: "bg-amber-50 text-amber-800 ring-amber-200",
  stale: "bg-rose-50 text-rose-800 ring-rose-200",
  unknown: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

const HOURS_TONE: Record<HoursState, string> = {
  open: "text-emerald-700",
  closing_soon: "text-amber-700",
  closed: "text-rose-700",
  unknown: "text-neutral-500",
};

const OPEN_RANK: Record<HoursState, number> = { open: 0, closing_soon: 1, unknown: 2, closed: 3 };

function warrantyText(w: Warranty): string | null {
  if (!w?.provider) return null;
  if (w.provider === "بدون گارانتی") return "بدون گارانتی";
  return w.period_months ? `گارانتی ${toFaDigits(w.period_months)} ماهه ${w.provider}` : `گارانتی: ${w.provider}`;
}

export function SellerList({ sellers, hasCenter }: { sellers: Seller[]; hasCenter: boolean }) {
  const [sort, setSort] = useState<SortKey>(hasCenter ? "distance" : "price");
  const [mall, setMall] = useState<string | null>(null);

  const malls = useMemo(() => {
    const m = new Map<string, Seller[]>();
    for (const s of sellers) if (s.mall) m.set(s.mall, [...(m.get(s.mall) ?? []), s]);
    return [...m.entries()].filter(([, ss]) => ss.length >= 2).sort((a, b) => b[1].length - a[1].length);
  }, [sellers]);

  const shown = useMemo(() => {
    const list = mall ? sellers.filter((s) => s.mall === mall) : [...sellers];
    const byPrice = (a: Seller, b: Seller) => (a.price ?? Infinity) - (b.price ?? Infinity);
    const byDist = (a: Seller, b: Seller) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (sort === "price") list.sort(byPrice);
    if (sort === "distance") list.sort((a, b) => byDist(a, b) || byPrice(a, b));
    if (sort === "open") list.sort((a, b) => OPEN_RANK[a.hours.state] - OPEN_RANK[b.hours.state] || byPrice(a, b));
    return list;
  }, [sellers, sort, mall]);

  const cheapest = Math.min(...sellers.map((s) => s.price ?? Infinity));
  const tabs: [SortKey, string][] = [
    ...(hasCenter ? ([["distance", "نزدیک‌ترین"]] as [SortKey, string][]) : []),
    ["price", "ارزان‌ترین"],
    ["open", "اول بازها"],
  ];

  return (
    <section>
      {malls.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-2 text-xs font-semibold text-neutral-500">یک مراجعه، چند گزینه</h3>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {malls.map(([name, ss]) => {
              const active = mall === name;
              const min = Math.min(...ss.map((s) => s.price ?? Infinity));
              return (
                <button
                  key={name}
                  onClick={() => setMall(active ? null : name)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-right text-xs ring-1 ${active ? "bg-teal-600 text-white ring-teal-600" : "bg-white ring-black/10"}`}
                >
                  <span className="flex items-center gap-1 font-semibold"><Building2 className="size-3.5" />{name}</span>
                  <span className={active ? "text-teal-50" : "text-neutral-500"}>
                    {toFaDigits(ss.length)} فروشنده{Number.isFinite(min) && ` · از ${toman(min)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-neutral-200/60 p-1 text-xs">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)} className={`rounded-lg px-3 py-1.5 ${sort === k ? "bg-white font-semibold shadow-sm" : ""}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-500">{toFaDigits(shown.length)} فروشنده</span>
      </div>

      <ul className="space-y-3">
        {shown.map((s) => (
          <SellerCard key={s.offerId} s={s} cheapest={s.price != null && s.price === cheapest} />
        ))}
      </ul>
    </section>
  );
}

function SellerCard({ s, cheapest }: { s: Seller; cheapest: boolean }) {
  const tone = priceTone(s.priceChangedAt);
  const loc = place(s.mall, s.floor, s.unit);
  const w = warrantyText(s.warranty);

  return (
    <li className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold">{s.shopName}</h4>
          {s.mall ? (
            <p className="mt-0.5 text-xs text-neutral-700">{loc}</p>
          ) : (
            s.address && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-700">{s.address}</p>
          )}
        </div>
        <div className="shrink-0 text-left">
          <p className={`text-base font-bold ${s.price == null ? "text-neutral-400" : "text-teal-700"}`}>{toman(s.price)}</p>
          {cheapest && <p className="text-[11px] font-medium text-emerald-700">ارزان‌ترین ثبت‌شده</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 ring-1 ${TONE[tone]}`}>
          {tone === "unknown" ? "زمان ثبت قیمت نامشخص" : `قیمت ثبت‌شده ${daysAgo(s.priceChangedAt)}`}
          {tone === "stale" && " · احتمال تغییر"}
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">موجودی تأیید نشده</span>
      </div>

      {s.report && (
        <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-900">
          گزارش کاربر · {daysAgo(s.report.at)}: {REPORT[s.report.status] ?? s.report.status}
          {s.report.price != null && ` (${toman(s.report.price)})`}
        </p>
      )}

      <div className="mt-2 space-y-1 text-xs">
        {s.distanceKm != null && (
          <p className="flex items-center gap-1.5 text-neutral-700"><MapPin className="size-3.5" />{distance(s.distanceKm)} فاصله</p>
        )}
        <p className={`flex items-center gap-1.5 ${HOURS_TONE[s.hours.state]}`}>
          <Clock className="size-3.5" />
          {s.hours.label}
          {s.hours.today && s.hours.state !== "unknown" && <span className="text-neutral-400">· امروز {s.hours.today}</span>}
        </p>
        <p className="flex items-center gap-1.5 text-neutral-700">
          <ShieldCheck className="size-3.5" />
          {w ?? <span className="text-neutral-400">گارانتی ثبت نشده</span>}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-600">
        {s.torobpay === true && <span className="rounded-full bg-neutral-100 px-2 py-0.5">ترب‌پی</span>}
        {s.installments.map((p) => <span key={p} className="rounded-full bg-neutral-100 px-2 py-0.5">قسطی: {p}</span>)}
        {s.torobpay == null && <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-neutral-400">شرایط پرداخت نامشخص</span>}
        {s.fastDelivery && <span className="rounded-full bg-neutral-100 px-2 py-0.5">ارسال فوری</span>}
      </div>

      {s.sellerTitle && <p className="mt-2 line-clamp-1 text-[11px] text-neutral-400">عنوان فروشنده: {s.sellerTitle}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MapLink lat={s.lat} lon={s.lon} className="flex items-center justify-center gap-1 rounded-xl bg-teal-600 py-2 font-medium text-white">
          <Navigation className="size-3.5" />مسیریابی
        </MapLink>
        {s.phone ? (
          <a href={`tel:${s.phone}`} className="flex flex-col items-center justify-center rounded-xl py-1 ring-1 ring-teal-600 text-teal-700">
            <span className="flex items-center gap-1 font-medium"><Phone className="size-3.5" />تماس</span>
            <span className="text-[10px] text-neutral-400">شماره نمونه</span>
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl py-2 text-neutral-400 ring-1 ring-black/10">تماس ثبت نشده</span>
        )}
      </div>
    </li>
  );
}

const REPORT: Record<string, string> = {
  contacted: "پیام داده شد",
  confirmed: "موجودی تأیید شد",
  unavailable: "ناموجود بود",
  price_changed: "قیمت فرق داشت",
  bought: "خرید انجام شد",
};
