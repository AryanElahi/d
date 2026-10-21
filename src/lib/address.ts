// Pull mall / floor / unit out of a free-text Tehran address.
export type AddressParts = { mall: string | null; floor: string | null; unit: string | null };

const MALL = /((?:پاساژ|مجتمع(?: تجاری)?|مرکز خرید|بازار(?:چه)?|سرای|تیمچه)\s+[^،,\-]+?)(?=\s*(?:[،,\-]|طبقه|واحد|پلاک|$))/;
const FLOOR = /طبقه\s*(زیر\s*همکف|همکف|زیرزمین|منفی\s*(?:\d+|یک|دو|سه)|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|\d+)/;
const UNIT = /(?:واحد|پلاک)\s*([\d۰-۹]+(?:\s*[a-zA-Z؀-ۿ]?)?)/;

export function parseAddress(addr: string | null | undefined): AddressParts {
  const a = (addr ?? "").replace(/\u200c/g, " ").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const mall = a.match(MALL)?.[1].trim().replace(/\s+/g, " ") ?? null;
  const floor = a.match(FLOOR)?.[1].trim() ?? null;
  const unit = a.match(UNIT)?.[1].trim() ?? null;
  return { mall, floor, unit };
}
