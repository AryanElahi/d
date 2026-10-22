"use client";

import { ArrowRight, Clock, MessageCircleQuestion, Navigation, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FollowUpSheet } from "@/components/FollowUpSheet";
import { MapLink } from "@/components/MapLink";
import { StatusButtons } from "@/components/StatusButtons";
import { useTracked } from "@/components/useTracked";
import { report } from "@/lib/device";
import type { Tracked } from "@/lib/followup";
import { daysAgo, place, toman } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/message";
import { toFaDigits } from "@/lib/normalize";

const STATUS_TONE: Record<string, string> = {
  saved: "bg-neutral-100 text-neutral-700",
  contacted: "bg-sky-100 text-sky-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  unavailable: "bg-rose-100 text-rose-900",
  price_changed: "bg-amber-100 text-amber-900",
  bought: "bg-teal-100 text-teal-900",
};

export default function TrackPage() {
  const { items } = useTracked();
  const active = (items ?? []).filter((t) => t.status !== "bought");
  const done = (items ?? []).filter((t) => t.status === "bought");

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="rounded-full p-1.5 hover:bg-neutral-200" aria-label="بازگشت"><ArrowRight className="size-5" /></Link>
        <h1 className="text-base font-bold">پیگیری‌ها</h1>
      </header>

      <main className="space-y-4 px-4">
        <p className="text-xs leading-6 text-neutral-600">
          فروشنده‌هایی که از آن‌ها استعلام گرفته‌اید. جواب هر فروشنده یا نتیجه مراجعه را ثبت کنید؛ اگر نداشت، جایگزین نزدیک پیشنهاد می‌دهیم.
          این فهرست فقط روی همین مرورگر است.
        </p>

        {items === null && [0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-neutral-200" />)}

        {items && items.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-neutral-600 ring-1 ring-black/5">
            <p>هنوز از فروشنده‌ای استعلام نگرفته‌اید.</p>
            <p className="mt-1 text-xs">در صفحه هر کالا، روی «استعلام» کنار فروشنده بزنید.</p>
            <Link href="/" className="mt-4 inline-block rounded-full bg-teal-600 px-4 py-2 text-white">جست‌وجوی کالا</Link>
          </div>
        )}

        {active.map((t) => <TrackedCard key={t.offerId} t={t} />)}

        {done.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-neutral-600">خریدهای انجام‌شده ({toFaDigits(done.length)})</h2>
            <div className="space-y-3 opacity-80">{done.map((t) => <TrackedCard key={t.offerId} t={t} />)}</div>
          </section>
        )}
      </main>
    </div>
  );
}

function TrackedCard({ t }: { t: Tracked }) {
  const [sheet, setSheet] = useState(false);
  const loc = t.mall ? place(t.mall, t.floor, t.unit) : t.address;
  const productHref = `/product/${t.productId}?lat=${t.lat}&lon=${t.lon}&place=${encodeURIComponent(t.shopName)}`;

  return (
    <article className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <Link href={productHref} className="flex gap-3">
        {t.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-xl object-contain ring-1 ring-black/5" />
        )}
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-sm font-semibold">{t.productTitle}</h2>
          <p className="mt-0.5 text-xs text-neutral-700">{t.shopName}</p>
          {loc && <p className="truncate text-xs text-neutral-500">{loc}</p>}
        </div>
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[t.status] ?? ""}`}>{STATUS_LABEL[t.status]}</span>
        {t.simulated && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-800">پاسخ شبیه‌سازی‌شده</span>}
        <span className="text-neutral-500">{daysAgo(t.updatedAt)}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-neutral-500">قیمت ثبت‌شده در ترب</p>
          <p className="font-bold">{toman(t.price)}</p>
          <p className="text-[10px] text-neutral-400">{daysAgo(t.priceChangedAt)}</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-neutral-500">{t.simulated ? "گفته فروشنده (شبیه‌سازی)" : "گزارش شما"}</p>
          <p className="font-bold">{t.reportedPrice != null ? toman(t.reportedPrice) : "—"}</p>
          <p className="flex items-center gap-1 text-[10px] text-neutral-500"><Clock className="size-3" />{t.hours.label}</p>
        </div>
      </div>

      {t.status !== "bought" && (
        <div className="mt-3">
          <StatusButtons offerId={t.offerId} status={t.status} title={t.status === "contacted" ? "فروشنده چه جوابی داد؟" : "بعد از مراجعه چه شد؟"} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MapLink lat={t.lat} lon={t.lon} className="flex items-center justify-center gap-1 rounded-xl bg-teal-600 py-2 text-white">
          <Navigation className="size-3.5" />مسیریابی
        </MapLink>
        <button onClick={() => setSheet(true)} className="flex items-center justify-center gap-1 rounded-xl py-2 text-teal-700 ring-1 ring-teal-600">
          <MessageCircleQuestion className="size-3.5" />پیام دوباره
        </button>
        <button
          onClick={() => report(t.offerId, "dismissed").catch(() => {})}
          className="flex items-center justify-center gap-1 rounded-xl py-2 text-neutral-500 ring-1 ring-black/10"
        >
          <Trash2 className="size-3.5" />حذف
        </button>
      </div>

      {sheet && (
        <FollowUpSheet
          open
          onClose={() => setSheet(false)}
          offerId={t.offerId}
          shopName={t.shopName}
          phone={t.phone}
          price={t.price}
          productTitle={t.productTitle}
          status={t.status}
        />
      )}
    </article>
  );
}
