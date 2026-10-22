// In-person buying checklist. Every item says where it came from: this product's Torob data,
// our curated category guide, or the LLM. Not reviews, and never shown as such.
import { toman } from "./format";
import { toFaDigits } from "./normalize";

export type Source = "data" | "guide" | "ai";
export type CheckItem = { text: string; source: Source };

export type ChecklistData = {
  title: string;
  model: string | null;
  priceMin: number | null;
  priceMax: number | null;
  copyListings: number; // sellers whose title says طرح/کپی/استوک/…
  sellers: number;
  warranties: string[]; // distinct recorded warranty providers
};

// Curated, general advice for the dataset's biggest categories.
export const GUIDES: Record<string, string[]> = {
  "دوربین مدار بسته": [
    "نوع خروجی (AHD / CVI / TVI یا IP) باید با دستگاه ضبط شما سازگار باشد.",
    "دید در شب را در گوشه تاریک مغازه تست کنید.",
    "برای فضای باز، درجه حفاظت IP66 یا IP67 را روی جعبه ببینید.",
  ],
  "ضبط کننده ویدیویی دوربین‌های نظارتی و امنیتی": [
    "تعداد کانال و بیشترین رزولوشن پشتیبانی‌شده را با دوربین‌هایتان مقایسه کنید.",
    "بپرسید هارد همراهش هست یا جدا حساب می‌شود.",
    "مشاهده تصویر روی موبایل را همان‌جا امتحان کنید.",
  ],
  "گوشی موبایل": [
    "شناسه IMEI (با شماره‌گیری ‎*#06#‎) را با جعبه تطبیق دهید و رجیستری را در سامانه همتا چک کنید.",
    "پلمپ جعبه و لوازم همراه را جلوی خودتان باز کنید.",
    "پیش از پرداخت، صفحه، دوربین‌ها و شارژ شدن را تست کنید.",
  ],
  "کیف و کاور گوشی": ["مدل دقیق گوشی را بگویید؛ جای دوربین و دکمه‌ها را روی گوشی خودتان امتحان کنید."],
  "محافظ صفحه نمایش گوشی": ["مدل دقیق گوشی و نوع محافظ (فول‌چسب، سرامیکی، حریم شخصی) را مشخص کنید و بپرسید نصبش با خودشان است یا نه."],
  "هدفون، هدست و هندزفری": [
    "نسخه کپی در این دسته رایج است؛ کد اصالت یا برچسب شرکت واردکننده را بخواهید.",
    "اتصال، صدا و میکروفون را با گوشی خودتان تست کنید.",
  ],
  "پاوربانک و شارژر همراه": [
    "ظرفیت (mAh) و توان خروجی (W) را روی بدنه ببینید؛ نمونه‌های تقلبی معمولاً سبک‌ترند.",
    "شارژ سریع را با گوشی و کابل خودتان امتحان کنید.",
  ],
  "تاچ و ال سی دی گوشی و تبلت": [
    "بپرسید اورجینال است، OLED یا طرح (Incell)؛ قیمت‌ها بین این‌ها خیلی فرق دارد.",
    "پیش از چسب‌کاری نهایی، تاچ و رنگ را تست کنید و درباره گارانتی نصب بپرسید.",
  ],
  "سیم و کابل برق ساختمان": [
    "سطح مقطع (مثلاً ۲.۵) و نام تولیدکننده و استاندارد باید روی روکش چاپ شده باشد.",
    "بپرسید مس خالص است یا آلومینیوم با روکش مس (CCA).",
    "متراژ واقعی حلقه را بپرسید؛ قیمت‌ها گاهی متری و گاهی حلقه‌ای ثبت شده‌اند.",
  ],
  "چراغ پنلی و سقفی": ["رنگ نور (آفتابی، مهتابی، یخی) و وات را مشخص کنید.", "درایور و گارانتی‌اش را بپرسید و چراغ را روشن ببینید."],
  "لامپ LED و کم مصرف": ["رنگ نور، وات و نوع سرپیچ را مشخص کنید.", "مدت گارانتی تعویض را بپرسید."],
  "لوستر و چراغ تزئینی": ["ابعاد و ارتفاع لوستر را با سقف خانه بسنجید.", "نوع و تعداد لامپ و سرپیچ را بپرسید و روشنش را ببینید."],
  "ساعت مچی عقربه‌ ای و دیجیتالی": [
    "بپرسید اصل است یا های‌کپی؛ کارت گارانتی و شماره سریال را بخواهید.",
    "درجه ضدآب (مثلاً 5ATM) را روی بدنه یا دفترچه ببینید.",
  ],
  "عطر و ادکلن": ["بچ‌کد روی جعبه و ته شیشه باید یکی باشد.", "بپرسید اصل است، تستر یا اسانس؛ پلمپ را جلوی خودتان باز کنید."],
  "ژنراتور و موتور برق": [
    "توان پیوسته (نه بیشینه) را با نیازتان مقایسه کنید.",
    "دستگاه را جلوی خودتان روشن کنید و درباره سوخت، مصرف و خدمات پس از فروش بپرسید.",
  ],
  "لپ تاپ و نوت بوک": [
    "بپرسید آکبند است، استوک یا ریفربیش.",
    "سلامت باتری، پیکسل سوخته و کیبورد را تست کنید و مشخصات را در تنظیمات سیستم ببینید.",
  ],
  "دریل و پیچ گوشتی برقی و شارژی": ["ولتاژ و تعداد باتری و همراه بودن شارژر را بپرسید.", "اصل یا طرح بودن برند را بپرسید و دستگاه را روشن امتحان کنید."],
  "سشوار و برس حرارتی": ["توان (وات) و دمای قابل تنظیم را بپرسید.", "برندهای معروف نسخه طرح زیادی دارند؛ اصالت را بپرسید و روشنش کنید."],
};

const GENERIC = ["کالا را پیش از پرداخت جلوی خودتان روشن یا امتحان کنید.", "درباره شرایط تعویض و مرجوعی بپرسید."];

// A model code worth checking on the box: the dataset field, else the longest Latin token with a digit.
export function modelCode(title: string, model: string | null): string | null {
  if (model?.trim()) return model.trim();
  const codes = title.match(/[A-Za-z0-9][A-Za-z0-9\-/.]{3,}/g)?.filter((c) => /\d/.test(c) && /[A-Za-z]/.test(c)) ?? [];
  return codes.sort((a, b) => b.length - a.length)[0] ?? null;
}

export function dataItems(d: ChecklistData): CheckItem[] {
  const out: CheckItem[] = [];
  const code = modelCode(d.title, d.model);
  if (code) out.push({ source: "data", text: `کد مدل روی جعبه یا بدنه باید «${code}» باشد.` });
  if (d.copyListings > 0 || /(^|\s)(طرح|کپی)(\s|$)/.test(d.title))
    out.push({
      source: "data",
      text:
        d.copyListings > 0
          ? `${toFaDigits(d.copyListings)} فروشنده از ${toFaDigits(d.sellers)} فروشنده این کالا را با عنوان «طرح/کپی/استوک» ثبت کرده‌اند؛ بپرسید اصل است یا نه.`
          : "عنوان این کالا «طرح» است، یعنی نسخه اصلی برند نیست.",
    });
  if (d.warranties.length)
    out.push({ source: "data", text: `گارانتی‌های ثبت‌شده فروشنده‌ها: ${d.warranties.slice(0, 3).join("، ")}. کارت گارانتی را بگیرید و نامش را تطبیق دهید.` });
  else out.push({ source: "data", text: "هیچ فروشنده‌ای برای این کالا گارانتی ثبت نکرده؛ درباره گارانتی یا تست و تحویل بپرسید." });
  if (d.priceMin != null && d.priceMax != null && d.priceMax > d.priceMin)
    out.push({ source: "data", text: `قیمت ثبت‌شده بین ${toman(d.priceMin)} و ${toman(d.priceMax)} است؛ اگر بیشتر شنیدید، دلیلش را بپرسید.` });
  return out;
}

export function buildChecklist(category: string | null, d: ChecklistData, ai: string[] | null): CheckItem[] {
  const guide = category ? GUIDES[category] : undefined;
  const tips: CheckItem[] = guide ? guide.map((text) => ({ text, source: "guide" })) : ai?.length ? ai.map((text) => ({ text, source: "ai" })) : GENERIC.map((text) => ({ text, source: "guide" }));
  return [...dataItems(d), ...tips, { source: "guide", text: "فاکتور با نام فروشگاه و تاریخ بگیرید." }];
}
