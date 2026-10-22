"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Hub } from "@/lib/hubs";
import { toFaDigits } from "@/lib/normalize";
import { TILE_ATTRIBUTION, TILE_URL } from "@/lib/tiles";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

// Small static map of «بورس» hubs: one labelled pin per mall/area, plus the user's center.
export default function HubMap({ hubs, center }: { hubs: Hub[]; center: { lat: number; lon: number } | null }) {
  const el = useRef<HTMLDivElement>(null);

  const lat = center?.lat, lon = center?.lon;
  useEffect(() => {
    if (!el.current) return;
    let live = true; // StrictMode removes the first map before its queued fit runs
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
    const pts: L.LatLngExpression[] = [];
    for (const h of hubs) {
      const name = h.name.replace(/^(پاساژ|مجتمع تجاری|مجتمع)\s+/, "");
      L.marker([h.lat, h.lon], {
        icon: L.divIcon({ className: "pin-wrap", html: `<div class="pin pin-hub"><b>${toFaDigits(h.shops)}</b> ${esc(name)}</div>`, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(m);
      pts.push([h.lat, h.lon]);
    }
    if (lat != null && lon != null) {
      L.marker([lat, lon], {
        icon: L.divIcon({ className: "pin-wrap", html: `<div class="center-dot"></div>`, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(m);
      pts.push([lat, lon]);
    }
    requestAnimationFrame(() => {
      if (!live) return;
      m.invalidateSize();
      if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 });
    });
    return () => {
      live = false;
      m.remove();
    };
  }, [hubs, lat, lon]);

  return <div dir="ltr" ref={el} className="h-48 w-full overflow-hidden rounded-xl ring-1 ring-black/10" />;
}
