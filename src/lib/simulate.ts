// Simulated seller replies. Dataset phone numbers are fake, so the inquiry is answered by a
// deterministic simulation grounded in this offer's data: price age, opening hours, warranty and
// other users' reports. Same offer + same day → same answer, so demos are repeatable.
import { toman } from "./format";
import type { HoursNow } from "./hours";
import type { Status } from "./message";
import { toFaDigits } from "./normalize";

export type Ask = "stock" | "hold" | "warranty";

export type SimInput = {
  offerId: string;
  day: string; // YYYY-MM-DD, part of the seed
  price: number | null;
  priceAgeDays: number | null;
  hours: HoursNow;
  othersUnavailable: number; // real (non-simulated) unavailable reports in the last 30 days
  warranty: { provider: string | null; period_months: number | null } | null;
};

export type SimReply = { text: string; outcome?: Status; reportedPrice?: number; delayMs: number };

// FNV-1a → [0, 1)
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
}

export function outcomeOdds(i: Pick<SimInput, "priceAgeDays" | "othersUnavailable">) {
  const unavailable = Math.min(0.6, 0.12 + 0.15 * Math.min(i.othersUnavailable, 3) + ((i.priceAgeDays ?? 0) > 60 ? 0.1 : 0));
  const age = i.priceAgeDays;
  const priceChanged = age == null ? 0.3 : age <= 7 ? 0.08 : age <= 30 ? 0.25 : 0.45;
  return { unavailable, priceChanged };
}

function visitLine(h: HoursNow): string {
  if (h.state === "open") return `${h.label.replace("باز است", "باز هستیم")}، تشریف بیارید.`;
  if (h.state === "closing_soon") return "ولی نزدیک بستنمونه؛ اگه امروز میاید عجله کنید.";
  if (h.state === "closed") return `${h.label.replace("الان بسته", "الان بسته‌ایم")}.`;
  return "ساعت کاری‌مون توی ترب ثبت نشده؛ قبل از اومدن یه زنگ بزنید.";
}

const delay = (h: HoursNow) => (h.state === "open" || h.state === "closing_soon" ? 1800 : 3200);

export function simulateReply(i: SimInput, ask: Ask, lastOutcome?: Status): SimReply {
  const d = delay(i.hours);
  if (ask === "warranty") {
    const w = i.warranty;
    if (w?.provider && w.provider !== "بدون گارانتی")
      return { delayMs: d, text: `گارانتی ${w.period_months ? `${toFaDigits(w.period_months)} ماهه ` : ""}«${w.provider}» داره؛ کارتش رو موقع خرید تحویل می‌دیم.` };
    if (w?.provider === "بدون گارانتی") return { delayMs: d, text: "این کالا گارانتی نداره؛ فقط موقع تحویل جلوی خودتون تستش می‌کنیم." };
    return { delayMs: d, text: "گارانتی‌اش بستگی به سری کالا داره؛ حضوری که اومدید کارتش رو ببینید. (در ترب گارانتی برای این فروشنده ثبت نشده.)" };
  }
  if (ask === "hold") {
    if (lastOutcome === "unavailable") return { delayMs: d, text: "شرمنده، موجود نداریم که کنار بذاریم." };
    const until = i.hours.state === "closed" || i.hours.state === "unknown" ? "فردا ظهر" : "دو ساعت دیگه";
    return { delayMs: d, text: `باشه، تا ${until} براتون کنار می‌ذارم. موقع اومدن اسم‌تون رو بگید.` };
  }

  const r = rand(`${i.offerId}|${i.day}`);
  const { unavailable, priceChanged } = outcomeOdds(i);
  if (r < unavailable)
    return { delayMs: d, outcome: "unavailable", text: "سلام، متأسفانه فعلاً تموم کردیم. شاید هفته بعد دوباره بیاد." };
  if (i.price != null && r < unavailable + priceChanged) {
    const bump = 0.03 + rand(`${i.offerId}|bump`) * 0.12; // +3…15%
    const newPrice = Math.round((i.price * (1 + bump)) / 10000) * 10000;
    const age = i.priceAgeDays != null ? ` (قیمت ترب مال ${toFaDigits(i.priceAgeDays)} روز پیشه)` : "";
    return {
      delayMs: d,
      outcome: "price_changed",
      reportedPrice: newPrice,
      text: `سلام، موجوده ولی قیمت به‌روز شده: ${toman(newPrice)}${age}. ${visitLine(i.hours)}`,
    };
  }
  const priceLine = i.price != null ? `با همون قیمت ${toman(i.price)}. ` : "";
  return { delayMs: d, outcome: "confirmed", text: `سلام، بله موجوده، ${priceLine}${visitLine(i.hours)}` };
}
