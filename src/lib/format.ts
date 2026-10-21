import { toFaDigits } from "./normalize";

export function toman(n: number | null | undefined): string {
  if (n == null) return "قیمت ثبت نشده";
  if (n >= 1e9) return `${toFaDigits(+(n / 1e9).toFixed(1))} میلیارد تومان`;
  if (n >= 1e6) return `${toFaDigits(+(n / 1e6).toFixed(n >= 1e8 ? 0 : 1))} میلیون تومان`;
  return `${new Intl.NumberFormat("fa-IR").format(n)} تومان`;
}

export function daysAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "زمان نامشخص";
  const d = Math.floor((now - new Date(iso).getTime()) / 864e5);
  if (d <= 0) return "امروز";
  if (d === 1) return "دیروز";
  if (d < 30) return `${toFaDigits(d)} روز پیش`;
  return `${toFaDigits(Math.floor(d / 30))} ماه پیش`;
}

export function ageDays(iso: string | null | undefined, now = Date.now()): number | null {
  return iso ? Math.floor((now - new Date(iso).getTime()) / 864e5) : null;
}

export function distance(km: number | null | undefined): string {
  if (km == null) return "";
  if (km < 1) return `${toFaDigits(Math.round(km * 1000 / 10) * 10)} متر`;
  return `${toFaDigits(+km.toFixed(1))} کیلومتر`;
}

export type Tone = "fresh" | "aging" | "stale" | "unknown";

// Price freshness: a recorded price is a hint, and older hints deserve louder warnings.
export function priceTone(iso: string | null | undefined, now = Date.now()): Tone {
  const d = ageDays(iso, now);
  if (d == null) return "unknown";
  if (d <= 7) return "fresh";
  if (d <= 30) return "aging";
  return "stale";
}

export function place(mall: string | null, floor: string | null, unit: string | null): string {
  return [mall, floor && `طبقه ${toFaDigits(floor)}`, unit && `واحد ${toFaDigits(unit)}`].filter(Boolean).join("، ");
}

// Android: geo: lets the user pick Neshan/Balad and drops a pin. Elsewhere: a Google Maps pin.
// (Neshan's web URLs can't drop a pin and clamp zoom; checked 2026-10-22.)
export function mapsUrl(lat: number, lon: number, android: boolean): string {
  return android ? `geo:${lat},${lon}?q=${lat},${lon}` : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

// Compact price for map pins: «۲.۵م», «۸۵۰ه».
export function shortToman(n: number | null | undefined): string {
  if (n == null) return "؟";
  if (n >= 1e9) return `${toFaDigits(+(n / 1e9).toFixed(1))}میلیارد`;
  if (n >= 1e6) return `${toFaDigits(+(n / 1e6).toFixed(n >= 1e8 ? 0 : 1))}م`;
  return `${toFaDigits(Math.round(n / 1e3))}ه`;
}
