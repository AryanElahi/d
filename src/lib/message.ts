// Stock-check message drafts and messenger links. Pure: shared by client and tests.
import { toman } from "./format";

export type Status = "saved" | "contacted" | "confirmed" | "unavailable" | "price_changed" | "bought" | "dismissed";

export const STATUS_LABEL: Record<Status, string> = {
  saved: "ذخیره شده",
  contacted: "پیام داده شد، منتظر جواب",
  confirmed: "موجودی تأیید شد",
  unavailable: "ناموجود بود",
  price_changed: "قیمت فرق داشت",
  bought: "خرید انجام شد",
  dismissed: "حذف از پیگیری",
};

const ASCII = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");

// Only Iranian mobiles (09xx) can receive WhatsApp/SMS; landlines get call + copy.
export function mobileIntl(phone: string | null): string | null {
  if (!phone) return null;
  const d = ASCII(phone);
  if (/^09\d{9}$/.test(d)) return `98${d.slice(1)}`;
  if (/^989\d{9}$/.test(d)) return d;
  return null;
}

export function telHref(phone: string): string {
  return `tel:${ASCII(phone)}`;
}

export function draftMessage(p: { productTitle: string; price: number | null; shopName: string }): string {
  const title = p.productTitle.length > 70 ? `${p.productTitle.slice(0, 70)}…` : p.productTitle;
  const price = p.price != null ? ` با قیمت ${toman(p.price)} (قیمت ثبت‌شده در ترب)` : "";
  return `سلام، وقت بخیر.\n«${title}»${price} را الان موجود دارید؟\nاگر بله، امروز تا چه ساعتی باز هستید؟ ممنون.`;
}

export function whatsappHref(intl: string, text: string): string {
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function smsHref(intl: string, text: string): string {
  return `sms:+${intl}?body=${encodeURIComponent(text)}`;
}
