// Shop trust: real user outcome reports plus signals from the shop's own Torob data.
// No reviews exist in the dataset, so nothing here is presented as one.
import { daysAgo, priceTone, type Tone } from "./format";
import { toFaDigits } from "./normalize";

export type ReportStats = { confirmed: number; unavailable: number; priceChanged: number; bought: number };
export type ShopSignals = { offersCount: number | null; warrantyShare: number | null; priceMedianAt: string | null };

export type Trust = {
  reports: { text: string; tone: "good" | "mixed" | "bad"; n: number } | null;
  signals: { text: string; tone: Tone | "neutral" }[];
};

export function trustOf(r: ReportStats, s: ShopSignals, now = Date.now()): Trust {
  const there = r.confirmed + r.priceChanged + r.bought; // it was in stock
  const n = there + r.unavailable;
  let reports: Trust["reports"] = null;
  if (n > 0) {
    const priceOk = r.confirmed + r.bought;
    const parts = [`${toFaDigits(there)} از ${toFaDigits(n)} بار موجود بود`];
    if (there > 0) parts.push(`قیمت ${toFaDigits(priceOk)} از ${toFaDigits(there)} بار همان قیمت ترب بود`);
    const rate = there / n;
    reports = {
      n,
      tone: rate >= 0.75 && priceOk >= there / 2 ? "good" : rate < 0.5 ? "bad" : "mixed",
      text: `گزارش کاربران: ${parts.join("؛ ")}${n < 3 ? " (نمونه کم)" : ""}`,
    };
  }

  const signals: Trust["signals"] = [];
  if (s.priceMedianAt) signals.push({ text: `قیمت‌هایش معمولاً ${daysAgo(s.priceMedianAt, now)} ثبت شده`, tone: priceTone(s.priceMedianAt, now) });
  if (s.offersCount != null && s.offersCount >= 5 && s.warrantyShare != null)
    signals.push({
      text: s.warrantyShare === 0 ? "برای هیچ‌کدام از کالاهایش گارانتی ثبت نکرده" : `گارانتی برای ${toFaDigits(Math.round(s.warrantyShare * 100))}٪ کالاهایش ثبت شده`,
      tone: "neutral",
    });
  if (s.offersCount != null) signals.push({ text: `${toFaDigits(s.offersCount)} کالا در ترب`, tone: "neutral" });
  return { reports, signals };
}
