import type { SearchInput } from "./search";

// Structured filters → /api/search params. Every key is sent, so a cleared filter stays cleared.
export function toParams(f: SearchInput): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: unknown) => p.set(k, v == null || v === false ? "" : v === true ? "1" : String(v));
  set("t", f.text);
  set("category", f.category);
  set("brand", f.brand);
  set("min", f.budgetMin);
  set("max", f.budgetMax);
  set("area", f.area);
  set("lat", f.lat);
  set("lon", f.lon);
  set("r", f.radiusKm);
  set("place", f.lat != null ? f.place : undefined);
  set("torobpay", f.torobpay ? "1" : "0");
  set("inst", f.installments ? "1" : "0");
  set("warranty", f.warranty ? "1" : "0");
  set("open", f.openNow ? "1" : "0");
  set("sort", f.sort);
  return p;
}
