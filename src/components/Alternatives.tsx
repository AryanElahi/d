"use client";

import { ArrowLeftRight, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { deviceId } from "@/lib/device";
import type { alternatives } from "@/lib/followup";
import { daysAgo, toman } from "@/lib/format";

type Alts = NonNullable<Awaited<ReturnType<typeof alternatives>>>;

export function Alternatives({ offerId }: { offerId: string }) {
  const [data, setData] = useState<Alts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/alternatives?offer=${offerId}&device=${encodeURIComponent(deviceId())}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [offerId]);

  if (failed) return <p className="text-xs text-rose-700">پیدا کردن جایگزین انجام نشد.</p>;
  if (!data) return <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />;

  const near = (productId: string) =>
    `/product/${productId}?lat=${data.origin.lat}&lon=${data.origin.lon}&place=${encodeURIComponent(data.origin.shopName)}`;

  return (
    <div className="space-y-3 rounded-xl bg-sky-50/60 p-3 ring-1 ring-sky-100">
      <h4 className="flex items-center gap-1.5 text-sm font-bold text-sky-950">
        <ArrowLeftRight className="size-4" />
        جایگزین‌ها
      </h4>

      <section>
        <h5 className="mb-1.5 text-xs font-semibold text-neutral-600">همین کالا، فروشنده دیگر</h5>
        {data.same.length === 0 ? (
          <p className="text-xs text-neutral-500">فروشنده دیگری در ۵ کیلومتری این کالا را ثبت نکرده.</p>
        ) : (
          <ul className="divide-y divide-sky-100">
            {data.same.map((a) => (
              <li key={a.offerId}>
                <Link href={near(a.productId)} className="flex items-start justify-between gap-2 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-semibold"><Store className="size-3.5" />{a.shopName}</span>
                    {a.place && <span className="block truncate text-neutral-500">{a.place}</span>}
                    <span className="block text-sky-900">{a.reason}</span>
                    <span className="block text-neutral-500">{a.hours.label}</span>
                  </span>
                  <span className="shrink-0 text-left">
                    <span className="block font-bold text-teal-700">{toman(a.price)}</span>
                    <span className="block text-[10px] text-neutral-400">ثبت‌شده {daysAgo(a.priceChangedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.similar.length > 0 && (
        <section>
          <h5 className="mb-1.5 text-xs font-semibold text-neutral-600">کالای مشابه نزدیک همین فروشگاه</h5>
          <ul className="space-y-2">
            {data.similar.map((a) => (
              <li key={a.productId}>
                <Link href={near(a.productId)} className="flex gap-2 rounded-lg bg-white p-2 text-xs ring-1 ring-sky-100">
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-md object-contain" />
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-semibold">{a.title}</span>
                    <span className="block text-sky-900">{a.reason}</span>
                    <span className="block font-bold text-teal-700">از {toman(a.minPrice)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[10px] text-neutral-500">موجودی جایگزین‌ها هم تأیید نشده؛ پیش از رفتن استعلام بگیرید.</p>
    </div>
  );
}
