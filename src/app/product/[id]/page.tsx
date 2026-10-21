import { ArrowRight, Clock, HelpCircle, Info, MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocateButton } from "@/components/LocateButton";
import { SellerList } from "@/components/SellerList";
import { MapLink } from "@/components/MapLink";
import { daysAgo, distance, place, toman } from "@/lib/format";
import { toFaDigits } from "@/lib/normalize";
import { getProduct, type Center, type MaybeShop } from "@/lib/product";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const center: Center | null =
    sp.lat && sp.lon && Number.isFinite(+sp.lat) && Number.isFinite(+sp.lon)
      ? { lat: +sp.lat, lon: +sp.lon, label: sp.place || "محدوده انتخابی" }
      : null;

  const p = await getProduct(id, center);
  if (!p) notFound();

  const prices = p.sellers.map((s) => s.price).filter((x): x is number => x != null).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  const dates = p.sellers.map((s) => s.priceChangedAt).filter((x): x is string => !!x).sort();
  const openCount = p.sellers.filter((s) => s.hours.state === "open" || s.hours.state === "closing_soon").length;
  const unknownHours = p.sellers.filter((s) => s.hours.state === "unknown").length;
  const specs = p.specs.filter((s) => s.value);

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <BackLink />
        <h1 className="truncate text-sm font-semibold">{p.title}</h1>
      </header>

      <main className="space-y-5 px-4">
        {p.images.length > 0 && (
          <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
            {p.images.slice(0, 6).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-44 shrink-0 snap-center rounded-2xl bg-white object-contain p-2 ring-1 ring-black/5" />
            ))}
          </div>
        )}

        <section>
          <p className="text-xs text-neutral-500">{[p.category, p.brand, p.model].filter(Boolean).join(" · ")}</p>
          <h2 className="mt-1 text-lg font-bold leading-8">{p.title}</h2>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="کمترین" value={prices.length ? toman(prices[0]) : "—"} />
            <Stat label="میانه" value={median != null ? toman(median) : "—"} />
            <Stat label="بیشترین" value={prices.length ? toman(prices.at(-1)) : "—"} />
          </div>
          <p className="mt-2 text-xs leading-6 text-neutral-600">
            {toFaDigits(p.sellers.length)} فروشنده این کالا را ثبت کرده‌اند
            {prices.length < p.sellers.length && ` (${toFaDigits(p.sellers.length - prices.length)} بدون قیمت)`}
            {dates.length > 0 && ` · قیمت‌ها از ${daysAgo(dates.at(-1))} تا ${daysAgo(dates[0])} ثبت شده‌اند`}
            {` · ${toFaDigits(openCount)} فروشنده الان باز`}
            {unknownHours > 0 && `، ساعت ${toFaDigits(unknownHours)} فروشنده نامشخص`}
          </p>
        </section>

        <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs leading-5 text-amber-900">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          قیمت ثبت‌شده، زمان ثبت آن و موجودی سه چیز جدا هستند. هیچ‌کدام از این فروشنده‌ها موجودی را تأیید نکرده‌اند؛ پیش از رفتن تماس بگیرید.
        </p>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">فروشنده‌های این کالا</h2>
            {center ? (
              <span className="flex items-center gap-1 text-xs text-neutral-500"><MapPin className="size-3.5" />فاصله از {center.label}</span>
            ) : (
              <LocateButton />
            )}
          </div>
          <SellerList sellers={p.sellers} hasCenter={!!center} />
        </section>

        {p.category && (
          <MaybeShops shops={p.maybeShops} total={p.maybeShopsTotal} category={p.category} center={center} />
        )}

        {specs.length > 0 && (
          <details className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-semibold">مشخصات فنی ({toFaDigits(specs.length)})</summary>
            <dl className="mt-3 divide-y divide-neutral-100 text-xs">
              {specs.map((s, i) => (
                <div key={i} className="grid grid-cols-[40%_1fr] gap-2 py-1.5">
                  <dt className="text-neutral-500">{s.key}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </main>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="rounded-full p-1.5 hover:bg-neutral-200" aria-label="بازگشت">
      <ArrowRight className="size-5" />
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2 ring-1 ring-black/5">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xs font-bold">{value}</p>
    </div>
  );
}

function MaybeShops({ shops, total, category, center }: { shops: MaybeShop[]; total: number; category: string; center: Center | null }) {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 p-3">
      <h2 className="flex items-center gap-1.5 text-base font-bold">
        <HelpCircle className="size-4 text-neutral-500" />
        ممکن است داشته باشند
      </h2>
      <p className="mt-1 text-xs leading-5 text-neutral-600">
        این فروشگاه‌ها در دسته «{category}» فعالیت می‌کنند اما <strong>این کالا را ثبت نکرده‌اند</strong>. دسته فعالیت نشانه موجود بودن نیست؛ فقط اگر
        فروشنده‌های بالا نداشتند، با تماس بپرسید.
      </p>
      {shops.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">{center ? "در ۳ کیلومتری این محدوده فروشگاه دیگری در این دسته نیست." : "فروشگاه دیگری در این دسته ثبت نشده."}</p>
      ) : (
        <>
          <p className="mt-2 text-[11px] text-neutral-500">
            {center ? `${toFaDigits(total)} فروشگاه در ۳ کیلومتری ${center.label}؛ نزدیک‌ترین‌ها:` : `${toFaDigits(total)} فروشگاه در تهران؛ برای دیدن نزدیک‌ترین‌ها موقعیت را مشخص کنید.`}
          </p>
          <ul className="mt-2 divide-y divide-neutral-100">
            {shops.map((s) => (
              <li key={s.shopId} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 text-xs">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-neutral-500">{s.mall ? place(s.mall, s.floor, s.unit) : s.address}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-neutral-500">
                    <Clock className="size-3" />{s.hours.label}
                    {s.distanceKm != null && ` · ${distance(s.distanceKm)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <MapLink lat={s.lat} lon={s.lon} aria-label="مسیریابی" className="rounded-full p-2 ring-1 ring-black/10"><Navigation className="size-3.5" /></MapLink>
                  {s.phone && <a href={`tel:${s.phone}`} className="rounded-full px-2.5 py-1.5 text-[11px] ring-1 ring-black/10">تماس<span className="block text-[9px] text-neutral-400">نمونه</span></a>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
