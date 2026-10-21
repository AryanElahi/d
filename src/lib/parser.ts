// Rule-based query parser: turns «دوربین داهوا زیر ۵ میلیون نزدیک جمهوری» into filters.
// Works offline; the LLM layer only refines what this leaves ambiguous.
import { normalizeFa } from "./normalize";

export type Sort = "relevance" | "price" | "distance";

export type Filters = {
  text: string;
  category?: string;
  brand?: string;
  budgetMin?: number;
  budgetMax?: number;
  area?: string;
  nearMe?: boolean;
  torobpay?: boolean;
  installments?: boolean;
  warranty?: boolean;
  openNow?: boolean;
  sort: Sort;
};

export type Vocab = {
  areas: string[]; // display names incl. aliases
  brands: string[];
  categories: string[];
};

const UNITS: Record<string, number> = {
  "میلیارد": 1e9,
  "میلیون": 1e6,
  "م": 1e6,
  "هزار": 1e3,
  "تومان": 1,
  "تومن": 1,
};
const UNIT = "(میلیارد|میلیون|هزار|تومان|تومن|م)?";
const NUM = "(\\d+(?:[.,/]\\d+)?)";

function amount(n: string, unit: string | undefined): number {
  const v = parseFloat(n.replace(/[,/]/g, "."));
  if (unit) return Math.round(v * UNITS[unit]);
  return Math.round(v < 1000 ? v * 1e6 : v); // «زیر ۲۰» means 20 million
}

// Digits + letters only; keeps punctuation so «1.5 میلیون» survives.
function prep(q: string) {
  return q
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ");
}

type Rule = [RegExp, (m: RegExpMatchArray, f: Filters) => void];

const b = (s: string) => new RegExp(`(?:^|\\s)(?:${s})(?=\\s|$)`, "g");

const RULES: Rule[] = [
  [new RegExp(`بین\\s+${NUM}\\s*${UNIT}\\s*(?:تا|و)\\s*${NUM}\\s*${UNIT}`), (m, f) => {
    f.budgetMin = amount(m[1], m[2] ?? m[4]);
    f.budgetMax = amount(m[3], m[4]);
  }],
  [new RegExp(`${NUM}\\s*${UNIT}\\s*تا\\s*${NUM}\\s*${UNIT}`), (m, f) => {
    f.budgetMin = amount(m[1], m[2] ?? m[4]);
    f.budgetMax = amount(m[3], m[4]);
  }],
  [new RegExp(`(?:زیر|کمتر\\s*از|تا|حداکثر|نهایتا|ماکزیمم|ارزانتر\\s*از)\\s*${NUM}\\s*${UNIT}`), (m, f) => {
    f.budgetMax = amount(m[1], m[2]);
  }],
  [new RegExp(`(?:بالای|بیشتر\\s*از|حداقل|گرانتر\\s*از)\\s*${NUM}\\s*${UNIT}`), (m, f) => {
    f.budgetMin = amount(m[1], m[2]);
  }],
  [new RegExp(`${NUM}\\s*(میلیارد|میلیون|هزار)\\s*(?:تومان|تومن)?`), (m, f) => {
    f.budgetMax = amount(m[1], m[2]);
  }],
  [b("نزدیک\\s*من|نزدیکم|اطراف\\s*من|دور\\s*و\\s*برم|همین\\s*اطراف"), (_, f) => { f.nearMe = true; }],
  [b("ترب\\s*پی|ترب\\s*پی\\s*دار"), (_, f) => { f.torobpay = true; }],
  [b("قسطی|اقساطی|قسط|اقساط|قسط\\s*بندی"), (_, f) => { f.installments = true; }],
  [b("با\\s*گارانتی|گارانتی\\s*دار|گارانتی|ضمانت"), (_, f) => { f.warranty = true; }],
  [b("الان\\s*باز|باز\\s*باشه|باز\\s*باشد|باز\\s*است|بازه"), (_, f) => { f.openNow = true; }],
  [b("ارزان\\s*ترین|ارزونترین|ارزانترین|ارزون\\s*ترین|ارزان|ارزون|اقتصادی"), (_, f) => { f.sort = "price"; }],
  [b("نزدیک\\s*ترین|نزدیکترین"), (_, f) => { f.sort = "distance"; }],
];

const FILLER = b(
  [
    "می\\s*خوام", "میخوام", "می\\s*خواهم", "میخواهم", "لازم\\s*دارم", "دنبال", "هستم", "یه", "یک", "برای", "خرید",
    "بخرم", "کجا", "پیدا\\s*کنم", "قیمت", "تومان", "تومن", "نزدیک", "حوالی", "اطراف", "در", "توی", "تو", "سمت",
    "خیابان", "خ", "محدوده", "منطقه", "که", "باشه", "باشد", "با", "و", "رو", "را", "از", "مدل", "جنس",
  ].join("|"),
);

function takeLongest(text: string, names: string[]): [string | undefined, string] {
  const padded = ` ${text} `;
  let best: string | undefined;
  for (const n of names) {
    const nn = normalizeFa(n);
    if (nn.length >= 2 && padded.includes(` ${nn} `) && (!best || nn.length > normalizeFa(best).length)) best = n;
  }
  if (!best) return [undefined, text];
  return [best, padded.replace(` ${normalizeFa(best)} `, " ").trim()];
}

export function parseQuery(q: string, vocab: Vocab): Filters {
  const f: Filters = { text: "", sort: "relevance" };
  let s = ` ${prep(q)} `;
  for (const [re, apply] of RULES) {
    const m = s.match(new RegExp(re.source));
    if (m) {
      apply(m, f);
      s = s.replace(new RegExp(re.source, re.flags), " ");
    }
  }
  let text = normalizeFa(s);
  [f.area, text] = takeLongest(text, vocab.areas);
  [f.category, text] = takeLongest(text, vocab.categories);
  [f.brand, text] = takeLongest(text, vocab.brands);
  f.text = normalizeFa(` ${text} `.replace(FILLER, " ").replace(FILLER, " "));
  return f;
}
