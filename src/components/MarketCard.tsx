"use client";

import { ExternalLink, Landmark, MapPinned, Navigation, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { distance } from "@/lib/format";
import type { Hub, Market } from "@/lib/hubs";
import { toFaDigits } from "@/lib/normalize";
import { MapLink } from "./MapLink";

const HubMap = dynamic(() => import("./HubMap"), { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-neutral-200" /> });

type Props = {
  market: Market;
  center: { lat: number; lon: number; label: string } | null;
  emphasis: boolean; // nothing found → open by default, stronger copy
  onSearchHere: (hub: Hub, byCategory: boolean) => void;
};

// «بورس» widget: where this kind of product is concentrated in Tehran.
export function MarketCard({ market, center, emphasis, onSearchHere }: Props) {
  const [showMap, setShowMap] = useState(emphasis);

  if (market.source === "llm")
    return (
      <section className="rounded-2xl bg-white p-3 ring-1 ring-indigo-200">
        <h3 className="flex items-center gap-1.5 text-sm font-bold"><Landmark className="size-4 text-indigo-600" />جاهایی که «{market.product}» معمولاً فروخته می‌شود</h3>
        <p className="mt-1 text-[11px] leading-5 text-indigo-900">
          در فروشگاه‌های ثبت‌شده در ترب پیدا نشد. این پیشنهادها از دانش عمومی دستیار درباره بازارهای تهران است، نه داده ترب؛ پیش از رفتن مطمئن شوید.
        </p>
        <ul className="mt-2 space-y-2">
          {market.places.map((p) => (
            <li key={p.name} className="flex items-start justify-between gap-2 rounded-xl bg-indigo-50/60 p-2 text-xs">
              <span>
                <span className="block font-semibold">{p.name}</span>
                <span className="text-neutral-600">{p.why}</span>
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} تهران`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 ring-1 ring-indigo-300 text-indigo-800"
              >
                <ExternalLink className="size-3" />نقشه
              </a>
            </li>
          ))}
        </ul>
      </section>
    );

  const total = market.hubs.reduce((a, h) => a + h.shops, 0);
  return (
    <section className={`rounded-2xl bg-white p-3 ring-1 ${emphasis ? "ring-indigo-300" : "ring-black/5"}`}>
      <h3 className="flex items-center gap-1.5 text-sm font-bold">
        <Landmark className="size-4 text-indigo-600" />
        بورس «{market.category}» در تهران
      </h3>
      <p className="mt-1 text-[11px] leading-5 text-neutral-600">
        {emphasis ? "این کالا دقیقاً ثبت نشده، اما " : ""}
        {toFaDigits(total)} فروشگاه ثبت‌شده در ترب در این دسته، بیشتر این‌جاها جمع‌اند. فعالیت در دسته یعنی ممکن است داشته باشند، نه موجودی تأییدشده.
      </p>

      {showMap ? (
        <div className="mt-2">
          <HubMap hubs={market.hubs} center={center} />
        </div>
      ) : (
        <button onClick={() => setShowMap(true)} className="mt-2 flex items-center gap-1 text-xs text-indigo-700">
          <MapPinned className="size-3.5" />نمایش روی نقشه
        </button>
      )}

      <ul className="mt-2 divide-y divide-neutral-100">
        {market.hubs.map((h) => (
          <li key={h.name} className="flex items-center justify-between gap-2 py-2 text-xs">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{h.name}</span>
              <span className="text-neutral-500">
                {h.kind === "mall" ? "پاساژ/مجتمع" : "محدوده"} · {toFaDigits(h.shops)} فروشگاه
                {h.distanceKm != null && ` · ${distance(h.distanceKm)} از ${center?.label ?? "شما"}`}
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button onClick={() => onSearchHere(h, emphasis)} className="flex items-center gap-1 rounded-lg px-2 py-1 ring-1 ring-indigo-300 text-indigo-800">
                <Search className="size-3" />همین‌جا
              </button>
              <MapLink lat={h.lat} lon={h.lon} aria-label="مسیریابی" className="rounded-lg p-1.5 ring-1 ring-black/10">
                <Navigation className="size-3.5" />
              </MapLink>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
