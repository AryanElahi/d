import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CompareTable } from "@/components/CompareTable";
import { CompareRemove } from "@/components/CompareRemove";
import { getComparison, MAX_COMPARE, type CompareItem } from "@/lib/compare";
import { daysAgo, distance, toman } from "@/lib/format";
import { toFaDigits } from "@/lib/normalize";
import type { Center } from "@/lib/product";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").filter((x) => /^product_\w+$/.test(x)).slice(0, MAX_COMPARE);
  const center: Center | null =
    sp.lat && sp.lon && Number.isFinite(+sp.lat) && Number.isFinite(+sp.lon) ? { lat: +sp.lat, lon: +sp.lon, label: sp.place || "محدوده انتخابی" } : null;
  const c = ids.length >= 2 ? await getComparison(ids, center) : null;
  const centerQs = center ? `?lat=${center.lat}&lon=${center.lon}&place=${encodeURIComponent(center.label)}` : "";

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="rounded-full p-1.5 hover:bg-neutral-200" aria-label="بازگشت"><ArrowRight className="size-5" /></Link>
        <h1 className="text-base font-bold">مقایسه{c?.ok && c.category ? ` · ${c.category}` : ""}</h1>
      </header>

      <main className="space-y-5 px-4">
        {!c && <Notice text="برای مقایسه دست‌کم دو کالا از یک دسته انتخاب کنید." />}
        {c && !c.ok && c.reason === "not_found" && <Notice text="این کالاها پیدا نشدند." />}
        {c && !c.ok && c.reason === "mixed_categories" && (
          <Notice text={`مقایسه فقط بین کالاهای یک دسته معنا دارد؛ این‌ها از دسته‌های مختلف‌اند: ${c.categories?.join("، ")}`} />
        )}

        {c?.ok && (
          <>
            <Summary items={c.items} center={center} centerQs={centerQs} />
            <CompareTable rows={c.rows} n={c.items.length} />
          </>
        )}
      </main>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center text-sm text-neutral-600 ring-1 ring-black/5">
      <p>{text}</p>
      <Link href="/" className="mt-4 inline-block rounded-full bg-teal-600 px-4 py-2 text-white">جست‌وجوی کالا</Link>
    </div>
  );
}

// Who wins on what, computed only from recorded data.
function badges(items: CompareItem[], hasCenter: boolean): string[][] {
  // Compared at displayed precision; no badge when everyone ties.
  const winners = (f: (i: CompareItem) => number | null, dir: 1 | -1) => {
    const vals = items.map(f);
    const known = vals.filter((v): v is number => v != null);
    if (known.length < 2 || known.every((v) => v === known[0])) return items.map(() => false);
    const top = dir === 1 ? Math.min(...known) : Math.max(...known);
    return vals.map((v) => v === top);
  };
  const cols: [string, boolean[]][] = [
    ["ارزان‌ترین", winners((i) => i.minPrice, 1)],
    ["فروشنده بیشتر", winners((i) => i.shops, -1)],
    ["نزدیک‌تر", hasCenter ? winners((i) => (i.nearestKm == null ? null : Math.round(i.nearestKm * 100)), 1) : items.map(() => false)],
    ["قیمت تازه‌تر", winners((i) => (i.newestChange ? Math.floor(new Date(i.newestChange).getTime() / 864e5) : null), -1)],
  ];
  return items.map((_, k) => cols.filter(([, w]) => w[k]).map(([label]) => label));
}

function Summary({ items, center, centerQs }: { items: CompareItem[]; center: Center | null; centerQs: string }) {
  const b = badges(items, !!center);
  const rows: [string, (i: CompareItem) => string][] = [
    ["کمترین قیمت ثبت‌شده", (i) => toman(i.minPrice)],
    ["میانه قیمت", (i) => toman(i.medianPrice)],
    ["تعداد فروشنده", (i) => `${toFaDigits(i.shops)} فروشنده`],
    ["الان باز", (i) => `${toFaDigits(i.openShops)} فروشنده`],
    ["آخرین ثبت قیمت", (i) => daysAgo(i.newestChange)],
    ...(center ? ([[`نزدیک‌ترین تا ${center.label}`, (i: CompareItem) => distance(i.nearestKm) || "—"]] as [string, (i: CompareItem) => string][]) : []),
  ];
  const cols = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` };

  return (
    <section className="space-y-3">
      <div className="grid gap-2" style={cols}>
        {items.map((i, k) => (
          <div key={i.id} className="flex flex-col rounded-2xl bg-white p-2 ring-1 ring-black/5">
            <Link href={`/product/${i.id}${centerQs}`}>
              <div className="aspect-square overflow-hidden rounded-xl bg-neutral-50">
                {i.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" referrerPolicy="no-referrer" className="size-full object-contain" />
                )}
              </div>
              <h2 className="mt-1.5 line-clamp-3 text-[11px] font-semibold leading-5">{i.title}</h2>
            </Link>
            <div className="mt-1 flex flex-wrap gap-1">
              {b[k].map((x) => <span key={x} className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-800">{x}</span>)}
            </div>
            <div className="mt-auto pt-2">
              <CompareRemove entry={{ id: i.id, title: i.title, category: i.category, image: i.image }} />
            </div>
          </div>
        ))}
      </div>

      <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        {rows.map(([label, f]) => (
          <div key={label} className="p-2.5">
            <p className="mb-1 text-[11px] font-semibold text-neutral-500">{label}</p>
            <div className="grid gap-2 text-xs font-medium" style={cols}>
              {items.map((i) => <p key={i.id}>{f(i)}</p>)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-5 text-neutral-500">قیمت‌ها ثبت‌شده در ترب‌اند و موجودی تأیید نشده؛ برای دیدن فروشنده‌ها روی هر کالا بزنید.</p>
    </section>
  );
}
