import { CheckCircle2, Clock, MapPin, Store } from "lucide-react";
import Link from "next/link";
import { daysAgo, distance, toman } from "@/lib/format";
import { toFaDigits } from "@/lib/normalize";
import type { ProductHit } from "@/lib/search";
import { CompareToggle } from "./CompareToggle";

function priceRange(h: ProductHit) {
  if (h.minPrice == null) return "قیمت ثبت نشده";
  if (h.minPrice === h.maxPrice) return toman(h.minPrice);
  return `از ${toman(h.minPrice)}`;
}

function priceAge(h: ProductHit) {
  if (!h.newestChange) return "زمان ثبت قیمت نامشخص";
  const newest = daysAgo(h.newestChange);
  const oldest = daysAgo(h.oldestChange);
  return newest === oldest ? `قیمت ثبت‌شده ${newest}` : `قیمت‌ها ثبت‌شده ${newest} تا ${oldest}`;
}

function openText(h: ProductHit) {
  if (h.openShops > 0) return `${toFaDigits(h.openShops)} فروشنده الان باز`;
  if (h.unknownHoursShops === h.shops) return "ساعت کاری ثبت نشده";
  if (h.unknownHoursShops > 0) return `الان بسته · ساعت ${toFaDigits(h.unknownHoursShops)} فروشنده نامشخص`;
  return "الان همه بسته‌اند";
}

export function ResultCard({ hit, href }: { hit: ProductHit; href: string }) {
  return (
    <Link href={href} className="block rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 active:scale-[0.99] transition">
      <div className="flex gap-3">
        <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          {hit.image && (
            // Plain <img>: next/image would proxy Torob's CDN through our server.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hit.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-6">{hit.title}</h3>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {[hit.category, hit.brand].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1.5 text-base font-bold text-teal-700">{priceRange(hit)}</p>
          {hit.minPrice != null && hit.maxPrice !== hit.minPrice && (
            <p className="text-xs text-neutral-500">تا {toman(hit.maxPrice)}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
        <span className="flex items-center gap-1"><Store className="size-3.5" />{toFaDigits(hit.shops)} فروشنده</span>
        {hit.nearestKm != null && (
          <span className="flex items-center gap-1"><MapPin className="size-3.5" />نزدیک‌ترین {distance(hit.nearestKm)}</span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" />
          {openText(hit)}
        </span>
      </div>

      {hit.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-xl bg-teal-50 p-2 text-xs text-teal-900">
          {hit.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />{r}</li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <CompareToggle entry={{ id: hit.id, title: hit.title, category: hit.category, image: hit.image }} className="ml-auto order-last" />
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">موجودی تأیید نشده</span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">{priceAge(hit)}</span>
        {hit.warrantyShops > 0 && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">گارانتی در {toFaDigits(hit.warrantyShops)} فروشنده</span>
        )}
        {hit.torobpayShops > 0 && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">ترب‌پی در {toFaDigits(hit.torobpayShops)} فروشنده</span>
        )}
      </div>
    </Link>
  );
}

export function ResultCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-3 ring-1 ring-black/5">
      <div className="flex gap-3">
        <div className="size-24 rounded-xl bg-neutral-200" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-5/6 rounded bg-neutral-200" />
          <div className="h-3 w-1/2 rounded bg-neutral-200" />
          <div className="h-4 w-1/3 rounded bg-neutral-200" />
        </div>
      </div>
      <div className="mt-3 h-8 rounded-xl bg-neutral-100" />
    </div>
  );
}
