"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useEffect, useRef } from "react";
import { shortToman } from "@/lib/format";
import type { HoursState } from "@/lib/hours";
import { toFaDigits } from "@/lib/normalize";
import type { Center, MaybeShop, Seller } from "@/lib/product";
import { TILE_ATTRIBUTION, TILE_URL } from "@/lib/tiles";

export type MapSelection = { mall: string } | { offerId: string } | null;

type Props = {
  sellers: Seller[];
  maybeShops: MaybeShop[];
  showMaybe: boolean;
  center: Center | null;
  radiusKm: number | null;
  selection: MapSelection;
  onSelect: (s: MapSelection) => void;
};

function tone(states: HoursState[]): string {
  if (states.includes("open")) return "open";
  if (states.includes("closing_soon")) return "closing";
  if (states.every((s) => s === "unknown")) return "unknown";
  return "closed";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function pin(html: string, cls: string, selected: boolean) {
  return L.divIcon({ className: "pin-wrap", html: `<div class="pin ${cls}${selected ? " pin-selected" : ""}">${html}</div>`, iconSize: [0, 0] });
}

type PinInfo = { count: number; minPrice: number | null; states: HoursState[] };
const info = new WeakMap<L.Marker, PinInfo>();

const selKey = (s: MapSelection) => (!s ? "" : "mall" in s ? `m:${s.mall}` : `o:${s.offerId}`);

// Nearby pins (adjacent malls) merge into one: «۱۱ فروشنده · از ۲.۵م». Tap zooms in; max zoom fans out.
function clusterIcon(c: L.MarkerCluster) {
  const items = c.getAllChildMarkers().map((m) => info.get(m)).filter((x): x is PinInfo => !!x);
  const count = items.reduce((a, x) => a + x.count, 0);
  const prices = items.map((x) => x.minPrice).filter((p): p is number => p != null);
  const html = `<b>${toFaDigits(count)}</b> فروشنده${prices.length ? ` · از ${shortToman(Math.min(...prices))}` : ""}`;
  return pin(html, `pin-mall pin-${tone(items.flatMap((x) => x.states))}`, false);
}

type Group = { mall: string; sellers: Seller[]; lat: number; lon: number };

export function groupByMall(sellers: Seller[]): { groups: Group[]; singles: Seller[] } {
  const by = new Map<string, Seller[]>();
  const singles: Seller[] = [];
  for (const s of sellers) {
    if (s.mall) by.set(s.mall, [...(by.get(s.mall) ?? []), s]);
    else singles.push(s);
  }
  const groups: Group[] = [];
  for (const [mall, ss] of by) {
    if (ss.length === 1) singles.push(ss[0]);
    else
      groups.push({
        mall,
        sellers: ss,
        lat: ss.reduce((a, s) => a + s.lat, 0) / ss.length,
        lon: ss.reduce((a, s) => a + s.lon, 0) / ss.length,
      });
  }
  return { groups, singles };
}

export default function SellerMap({ sellers, maybeShops, showMaybe, center, radiusKm, selection, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef<string | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([35.6946, 51.4088], 15);
    L.control.zoom({ position: "bottomleft" }).addTo(m);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      fitted.current = null; // StrictMode remounts: the new map must fit again
    };
  }, []);

  useEffect(() => {
    const m = map.current, lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    let circleBounds: L.LatLngBounds | null = null;
    // Fit to the sellers that matter (inside the radius), not the whole circle: they're often 200 m apart.
    const fitPoint = (lat: number, lon: number, km: number | null) => {
      if (!center || radiusKm == null || (km != null && km <= radiusKm)) bounds.push([lat, lon]);
    };

    if (center) {
      if (radiusKm) {
        const c = L.circle([center.lat, center.lon], {
          radius: radiusKm * 1000, color: "#0d9488", weight: 2, dashArray: "6 6", fillColor: "#14b8a6", fillOpacity: 0.08, interactive: false,
        }).addTo(lg);
        circleBounds = c.getBounds();
      }
      L.marker([center.lat, center.lon], {
        icon: L.divIcon({ className: "pin-wrap", html: `<div class="center-dot" title="${esc(center.label)}"></div>`, iconSize: [0, 0] }),
        interactive: false,
        zIndexOffset: -100,
      }).addTo(lg);
    }

    if (showMaybe)
      for (const s of maybeShops)
        L.marker([s.lat, s.lon], { icon: pin("", "pin-maybe", false), zIndexOffset: -50 })
          .bindTooltip(`${esc(s.name)} · ممکن است داشته باشد`, { direction: "top" })
          .addTo(lg);

    const cg = L.markerClusterGroup({ maxClusterRadius: 80, showCoverageOnHover: false, spiderfyOnMaxZoom: true, iconCreateFunction: clusterIcon });
    cluster.current = cg;
    markers.current.clear();
    const add = (key: string, lat: number, lon: number, html: string, cls: string, pi: PinInfo, sel: MapSelection) => {
      const selected = selKey(selection) === key;
      const mk = L.marker([lat, lon], { icon: pin(html, cls, selected), zIndexOffset: selected ? 1000 : 0 }).on("click", () => onSelect(sel));
      info.set(mk, pi);
      markers.current.set(key, mk);
      cg.addLayer(mk);
    };

    const { groups, singles } = groupByMall(sellers);
    for (const g of groups) {
      const prices = g.sellers.map((s) => s.price).filter((p): p is number => p != null);
      const minPrice = prices.length ? Math.min(...prices) : null;
      const states = g.sellers.map((s) => s.hours.state);
      const label = `<b>${toFaDigits(g.sellers.length)}</b> ${esc(g.mall.replace(/^(پاساژ|مجتمع تجاری|مجتمع)\s+/, ""))}${minPrice != null ? ` · از ${shortToman(minPrice)}` : ""}`;
      add(`m:${g.mall}`, g.lat, g.lon, label, `pin-mall pin-${tone(states)}`, { count: g.sellers.length, minPrice, states }, { mall: g.mall });
      fitPoint(g.lat, g.lon, Math.min(...g.sellers.map((s) => s.distanceKm ?? Infinity)));
    }
    for (const s of singles) {
      add(`o:${s.offerId}`, s.lat, s.lon, shortToman(s.price), `pin-${tone([s.hours.state])}`, { count: 1, minPrice: s.price, states: [s.hours.state] }, { offerId: s.offerId });
      fitPoint(s.lat, s.lon, s.distanceKm);
    }
    cg.addTo(lg);

    // Fit once per center; later selection changes only pan.
    const key = center ? `${center.lat},${center.lon},${radiusKm}` : "all";
    if (fitted.current !== key) {
      if (center) bounds.push([center.lat, center.lon]);
      const b = bounds.length > 1 ? L.latLngBounds(bounds) : circleBounds;
      // The container may only just have its size; measure before fitting.
      if (b)
        requestAnimationFrame(() => {
          if (map.current === m) m.invalidateSize().fitBounds(b, { padding: [40, 40], maxZoom: 18 });
        });
      fitted.current = key;
    }
  }, [sellers, maybeShops, showMaybe, center, radiusKm, selection, onSelect]);

  // Bring the selected pin into view, opening its cluster if needed (e.g. after tapping a mall chip).
  useEffect(() => {
    const mk = markers.current.get(selKey(selection));
    if (mk && cluster.current && map.current) cluster.current.zoomToShowLayer(mk);
  }, [selection]);

  return (
    <div dir="ltr" className="relative">
      <div ref={el} className="h-[55vh] min-h-72 w-full overflow-hidden rounded-2xl ring-1 ring-black/10" />
      <div dir="rtl" className="pointer-events-none absolute right-2 top-2 z-[500] space-y-1 rounded-xl bg-white/90 p-2 text-[10px] shadow">
        <Legend cls="pin-open" label="الان باز" />
        <Legend cls="pin-closing" label="به‌زودی می‌بندد" />
        <Legend cls="pin-closed" label="الان بسته" />
        <Legend cls="pin-unknown" label="ساعت نامشخص" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <p className="flex items-center gap-1.5">
      <span className={`legend-dot ${cls}`} />
      {label}
    </p>
  );
}
