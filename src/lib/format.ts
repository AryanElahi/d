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
