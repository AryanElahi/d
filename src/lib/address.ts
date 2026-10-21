// Pull mall / floor / unit out of a free-text Tehran address.
import { normalizeFa } from "./normalize";

export type AddressParts = { mall: string | null; floor: string | null; unit: string | null };

const MALL = /((?:پاساژ|مجتمع(?: تجاری)?|مرکز خرید|بازار(?:چه)?|سرای|تیمچه)\s+[^،,\-]+?)(?=\s*(?:[،,\-]|طبقه|واحد|پلاک|$))/;
const FLOOR = /طبقه\s*(زیر\s*همکف|همکف|زیرزمین|منفی\s*(?:\d+|یک|دو|سه)|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|\d+)/;
const UNIT = /واحد\s*(\d+[a-zA-Z]?)/;
const PLATE = /پلاک\s*(\d+[a-zA-Z]?)/;

export function parseAddress(addr: string | null | undefined): AddressParts {
  const a = (addr ?? "").replace(/\u200c/g, " ").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const mall = a.match(MALL)?.[1].trim().replace(/\s+/g, " ") ?? null;
  const floor = a.match(FLOOR)?.[1].trim() ?? null;
  const unit = (a.match(UNIT) ?? a.match(PLATE))?.[1] ?? null; // واحد beats پلاک (building number)
  return { mall, floor, unit };
}

// «پاساژ علاالدین 2», «مجتمع علاءالدین2» → one key, so the same building groups together.
export function mallKey(mall: string | null): string | null {
  if (!mall) return null;
  return normalizeFa(mall)
    .replace(/^(پاساژ|مجتمع تجاری|مجتمع|مرکز خرید|بازارچه|بازار|سرای|تیمچه)\s+/, "")
    .replace(/ء/g, "")
    .replace(/\s+/g, "");
}
