"use client";

import { AtSign, BadgeCheck, BellRing, Building2, Clock, Globe, List, Map as MapIcon, MapPin, MessageCircleQuestion, Navigation, Phone, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { daysAgo, distance, place, priceTone, toman, type Tone } from "@/lib/format";
import type { HoursState } from "@/lib/hours";
import { toFaDigits } from "@/lib/normalize";
import type { Tracked } from "@/lib/followup";
import { STATUS_LABEL, telHref, type Status } from "@/lib/message";
import type { Center, MaybeShop, Seller, Warranty } from "@/lib/product";
import type { Trust } from "@/lib/trust";
import { FollowUpSheet } from "./FollowUpSheet";
import { useTracked } from "./useTracked";
import { MapLink } from "./MapLink";
import type { MapSelection } from "./SellerMap";

// Leaflet touches window: client-only.
const SellerMap = dynamic(() => import("./SellerMap"), {
  ssr: false,
  loading: () => <div className="h-[55vh] min-h-72 animate-pulse rounded-2xl bg-neutral-200" />,
});

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

// The few shops with a real website/Instagram (dataset keeps their names real for this).
function shopLinks(s: Seller): { href: string; label: string; icon: "web" | "ig" }[] {
  const out: { href: string; label: string; icon: "web" | "ig" }[] = [];
  const safe = (u: unknown): u is string => typeof u === "string" && /^https:\/\/[^\s"<>]+$/.test(u);
  if (safe(s.website)) out.push({ href: s.website, label: new URL(s.website).hostname.replace(/^www\./, ""), icon: "web" });
  try {
    const ig = s.instagram ? JSON.parse(s.instagram) : null;
    if (safe(ig?.profile_url) && new URL(ig.profile_url).hostname.endsWith("instagram.com"))
      out.push({ href: ig.profile_url, label: `@${ig.handle ?? "instagram"}`, icon: "ig" });
  } catch {}
  return out;
}

function warrantyText(w: Warranty): string | null {
  if (!w?.provider) return null;
  if (w.provider === "بدون گارانتی") return "بدون گارانتی";
  return w.period_months ? `گارانتی ${toFaDigits(w.period_months)} ماهه ${w.provider}` : `گارانتی: ${w.provider}`;
}

type Props = { sellers: Seller[]; maybeShops: MaybeShop[]; center: Center | null; radiusKm: number | null; productTitle: string };

export function SellerList({ sellers, maybeShops, center, radiusKm, productTitle }: Props) {
  const { items: tracked } = useTracked();
  const trackedBy = useMemo(() => new Map((tracked ?? []).map((t) => [t.offerId, t])), [tracked]);
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<SortKey>(center ? "distance" : "price");
  const [mall, setMall] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [showMaybe, setShowMaybe] = useState(false);

  const outside = useCallback(
    (s: Seller) => radiusKm != null && s.distanceKm != null && s.distanceKm > radiusKm,
    [radiusKm],
  );
  const inside = radiusKm != null ? sellers.filter((s) => !outside(s)).length : null;

  const malls = useMemo(() => {
    const m = new Map<string, Seller[]>();
    for (const s of sellers) if (s.mall) m.set(s.mall, [...(m.get(s.mall) ?? []), s]);
    return [...m.entries()].filter(([, ss]) => ss.length >= 2).sort((a, b) => b[1].length - a[1].length);
  }, [sellers]);

  const sorted = useMemo(() => {
    const list = [...sellers];
    const byPrice = (a: Seller, b: Seller) => (a.price ?? Infinity) - (b.price ?? Infinity);
    const byDist = (a: Seller, b: Seller) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    if (sort === "price") list.sort((a, b) => +outside(a) - +outside(b) || byPrice(a, b));
    if (sort === "distance") list.sort((a, b) => byDist(a, b) || byPrice(a, b));
    if (sort === "open") list.sort((a, b) => +outside(a) - +outside(b) || OPEN_RANK[a.hours.state] - OPEN_RANK[b.hours.state] || byPrice(a, b));
    return list;
  }, [sellers, sort, outside]);

  const shown = mall ? sorted.filter((s) => s.mall === mall) : offerId && view === "map" ? sorted.filter((s) => s.offerId === offerId) : sorted;

  const selection: MapSelection = mall ? { mall } : offerId ? { offerId } : null;
  const onSelect = useCallback((sel: MapSelection) => {
    if (sel && "mall" in sel) {
      setMall((m) => (m === sel.mall ? null : sel.mall));
      setOfferId(null);
    } else if (sel) {
      setOfferId((o) => (o === sel.offerId ? null : sel.offerId));
      setMall(null);
    }
  }, []);

  const cheapest = Math.min(...sellers.map((s) => s.price ?? Infinity));
  const tabs: [SortKey, string][] = [
    ...(center ? ([["distance", "نزدیک‌ترین"]] as [SortKey, string][]) : []),
    ["price", "ارزان‌ترین"],
    ["open", "اول بازها"],
  ];

  return (
    <section>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-neutral-200/60 p-1 text-sm">
        {([["list", "فهرست", List], ["map", "نقشه", MapIcon]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => {
              setView(k);
              setOfferId(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 ${view === k ? "bg-white font-semibold shadow-sm" : ""}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {inside != null && (
        <p className="mb-3 text-xs text-neutral-600">
          {toFaDigits(inside)} فروشنده در شعاع {distance(radiusKm)} از {center?.label}
          {inside < sellers.length && `؛ ${toFaDigits(sellers.length - inside)} فروشنده دیگر بیرون از این محدوده`}
        </p>
      )}

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
                  onClick={() => onSelect({ mall: name })}
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

      {view === "map" && (
        <div className="mb-3">
          <SellerMap
            sellers={sellers}
            maybeShops={maybeShops}
            showMaybe={showMaybe}
            center={center}
            radiusKm={radiusKm}
            selection={selection}
            onSelect={onSelect}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={showMaybe} onChange={(e) => setShowMaybe(e.target.checked)} className="accent-teal-600" />
            نمایش فروشگاه‌هایی که «ممکن است داشته باشند» (نقطه خاکستری)
          </label>
          {!selection && <p className="mt-2 text-xs text-neutral-500">روی یک پین یا پاساژ بزنید تا فروشنده‌هایش اینجا بیاید.</p>}
        </div>
      )}

      {(view === "list" || selection) && (
        <>
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
              <SellerCard
                key={s.offerId}
                s={s}
                cheapest={s.price != null && s.price === cheapest}
                outside={outside(s)}
                tracked={trackedBy.get(s.offerId)}
                productTitle={productTitle}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type CardProps = { s: Seller; cheapest: boolean; outside: boolean; tracked?: Tracked; productTitle: string };

const TRACK_TONE: Partial<Record<Status, string>> = {
  confirmed: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  unavailable: "bg-rose-50 text-rose-900 ring-rose-200",
  price_changed: "bg-amber-50 text-amber-900 ring-amber-200",
  bought: "bg-teal-50 text-teal-900 ring-teal-200",
};

function SellerCard({ s, cheapest, outside, tracked, productTitle }: CardProps) {
  const [sheet, setSheet] = useState(false);
  const tone = priceTone(s.priceChangedAt);
  const loc = place(s.mall, s.floor, s.unit);
  const w = warrantyText(s.warranty);

  return (
    <li className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 ${outside ? "opacity-75" : ""}`}>
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

      <TrustBlock trust={s.trust} />

      {s.report && (
        <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-900">
          گزارش کاربر · {daysAgo(s.report.at)}: {STATUS_LABEL[s.report.status as Status] ?? s.report.status}
          {s.report.price != null && ` (${toman(s.report.price)})`}
        </p>
      )}

      {tracked && (
        <button
          onClick={() => setSheet(true)}
          className={`mt-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs ring-1 ${TRACK_TONE[tracked.status] ?? "bg-sky-50 text-sky-900 ring-sky-200"}`}
        >
          <span className="flex items-center gap-1.5"><BellRing className="size-3.5" />پیگیری شما: {STATUS_LABEL[tracked.status]}{tracked.reportedPrice != null && ` (${toman(tracked.reportedPrice)})`}
            {tracked.simulated && <span className="rounded bg-white/70 px-1 text-[10px]">شبیه‌سازی</span>}
          </span>
          <span className="font-semibold">{tracked.status === "unavailable" || tracked.status === "price_changed" ? "جایگزین‌ها" : "ثبت نتیجه"}</span>
        </button>
      )}

      <div className="mt-2 space-y-1 text-xs">
        {s.distanceKm != null && (
          <p className="flex items-center gap-1.5 text-neutral-700">
            <MapPin className="size-3.5" />{distance(s.distanceKm)} فاصله
            {outside && <span className="rounded-full bg-neutral-100 px-1.5 text-[10px] text-neutral-500">بیرون از محدوده انتخابی</span>}
          </p>
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

      {shopLinks(s).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {shopLinks(s).map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer nofollow" className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-800 ring-1 ring-indigo-200" dir="ltr">
              {l.icon === "web" ? <Globe className="size-3" /> : <AtSign className="size-3" />}
              {l.label}
            </a>
          ))}
          <span className="self-center text-[10px] text-neutral-400">صفحه رسمی فروشگاه؛ برای دیدن کاتالوگ و نظرات</span>
        </div>
      )}

      {s.sellerTitle && <p className="mt-2 line-clamp-1 text-[11px] text-neutral-400">عنوان فروشنده: {s.sellerTitle}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MapLink lat={s.lat} lon={s.lon} className="flex items-center justify-center gap-1 rounded-xl bg-teal-600 py-2 font-medium text-white">
          <Navigation className="size-3.5" />مسیریابی
        </MapLink>
        <button onClick={() => setSheet(true)} className="flex items-center justify-center gap-1 rounded-xl py-2 font-medium text-teal-700 ring-1 ring-teal-600">
          <MessageCircleQuestion className="size-3.5" />{tracked ? "پیگیری" : "استعلام"}
        </button>
        {s.phone ? (
          <a href={telHref(s.phone)} className="flex flex-col items-center justify-center rounded-xl py-1 ring-1 ring-black/10">
            <span className="flex items-center gap-1 font-medium"><Phone className="size-3.5" />تماس</span>
            <span className="text-[10px] text-neutral-400">شماره نمونه</span>
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl py-2 text-neutral-400 ring-1 ring-black/10">بی‌شماره</span>
        )}
      </div>

      {sheet && (
        <FollowUpSheet
          open
          onClose={() => setSheet(false)}
          offerId={s.offerId}
          shopName={s.shopName}
          phone={s.phone}
          price={s.price}
          productTitle={productTitle}
          status={tracked?.status}
        />
      )}
    </li>
  );
}


const REPORT_TONE = {
  good: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  mixed: "bg-amber-50 text-amber-900 ring-amber-200",
  bad: "bg-rose-50 text-rose-900 ring-rose-200",
};
const SIGNAL_TONE: Record<string, string> = { fresh: "text-emerald-700", aging: "text-amber-700", stale: "text-rose-700" };

// What we know about this shop: real user outcomes (never simulated) and its own Torob data.
function TrustBlock({ trust }: { trust: Trust }) {
  return (
    <div className="mt-2 space-y-1 text-[11px]">
      {trust.reports ? (
        <p className={`flex items-start gap-1.5 rounded-lg px-2 py-1 ring-1 ${REPORT_TONE[trust.reports.tone]}`}>
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0" />
          {trust.reports.text}
        </p>
      ) : (
        <p className="text-neutral-400">هنوز گزارشی از خرید کاربران از این فروشگاه نیست.</p>
      )}
      {trust.signals.length > 0 && (
        <p className="text-neutral-500">
          {trust.signals.map((x, i) => (
            <span key={x.text} className={SIGNAL_TONE[x.tone] ?? ""}>
              {i > 0 && <span className="text-neutral-300"> · </span>}
              {x.text}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
