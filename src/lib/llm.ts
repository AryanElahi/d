// Optional LLM layer over the rule parser, for vague or need-based queries
// («یه چیزی برای ضبط تصویر مغازه»). Any OpenAI-compatible endpoint; disabled when env is unset.
// The rules stay authoritative: the LLM only fills what they left empty, and every value it
// returns is checked against our own vocabulary. Timeout or bad output → rules only.
import { normalizeFa } from "./normalize";
import type { Filters, Sort, Vocab } from "./parser";

const BASE = process.env.LLM_BASE_URL?.replace(/\/$/, "");
const KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL;
const TIMEOUT_MS = 3000;

export const llmEnabled = () => !!(BASE && KEY && MODEL);

const NEED_WORDS = /(?:^|\s)(برای|که|مناسب|هدیه|بشه|بتونم|میشه|پیشنهاد|چی بخرم|یه چیزی|چیزی)(?=\s|$)/;

// Ask only when the rules clearly missed: no category/brand and a descriptive sentence.
export function shouldAskLlm(q: string, f: Filters): boolean {
  if (f.category || f.brand) return false;
  const words = f.text.split(" ").filter(Boolean).length;
  return words >= 4 || (words >= 1 && NEED_WORDS.test(normalizeFa(q)));
}

export type LlmOut = {
  keywords?: string;
  category?: string | null;
  brand?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  area?: string | null;
  near_me?: boolean;
  open_now?: boolean;
  warranty?: boolean;
  installments?: boolean;
  torobpay?: boolean;
  sort?: string;
};

export function parseLlmJson(text: string): LlmOut | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

// Map a free category hint onto a real dataset category.
export function matchCategory(hint: string | null | undefined, categories: string[]): string | undefined {
  const h = normalizeFa(hint);
  if (h.length < 2) return undefined;
  const norm = categories.map((c) => [c, normalizeFa(c)] as const);
  const exact = norm.find(([, n]) => n === h);
  if (exact) return exact[0];
  const hw = new Set(h.split(" "));
  let best: [string, number] | undefined;
  for (const [c, n] of norm) {
    const cw = n.split(" ");
    const overlap = cw.filter((w) => hw.has(w)).length;
    // Share of the category's words found in the hint, so «دوربین مدار بسته» beats «دوربین».
    const score = overlap / Math.max(cw.length, hw.size);
    if (overlap && (!best || score > best[1])) best = [c, score];
  }
  return best && best[1] > 0.5 ? best[0] : undefined;
}

const SORTS: Sort[] = ["relevance", "price", "distance"];
const money = (v: unknown) => (typeof v === "number" && v >= 1000 && v <= 1e11 ? Math.round(v) : undefined);

// Validated LLM output as filters, only for fields the rule parser left empty.
export function mergeLlm(rule: Filters, out: LlmOut, vocab: Vocab, replaceText: boolean): Filters {
  const f: Filters = { ...rule };
  const inVocab = (v: unknown, list: string[]) =>
    typeof v === "string" ? list.find((x) => normalizeFa(x) === normalizeFa(v)) : undefined;
  const kw = typeof out.keywords === "string" ? normalizeFa(out.keywords) : "";
  if (kw && (replaceText || !f.text)) f.text = kw;
  f.category ??= matchCategory(out.category, vocab.categories);
  f.brand ??= inVocab(out.brand, vocab.brands);
  f.area ??= inVocab(out.area, vocab.areas);
  f.budgetMin ??= money(out.budget_min);
  f.budgetMax ??= money(out.budget_max);
  if (f.budgetMin != null && f.budgetMax != null && f.budgetMin > f.budgetMax) f.budgetMin = undefined;
  for (const [k, o] of [["nearMe", "near_me"], ["openNow", "open_now"], ["warranty", "warranty"], ["installments", "installments"], ["torobpay", "torobpay"]] as const)
    if (!f[k] && out[o] === true) f[k] = true;
  if (f.sort === "relevance" && SORTS.includes(out.sort as Sort)) f.sort = out.sort as Sort;
  // A category match makes generic keywords redundant and over-restrictive.
  if (f.category && normalizeFa(f.category).includes(f.text)) f.text = "";
  return f;
}

function prompt(areas: string[]) {
  return `You turn a Persian shopping request (in-person shops in Tehran) into search filters.
Reply with ONLY a JSON object with these keys:
- keywords: 1-4 Persian words naming the product as it would appear in a product title (no brand, place or price)
- category: short Persian product category name, or null
- brand: brand name in Persian if the user named one, else null (never invent)
- budget_min, budget_max: integers in toman or null («میلیون» = 1000000, «هزار» = 1000)
- area: one of [${areas.join("، ")}] or null
- near_me, open_now, warranty, installments, torobpay: true only if asked for
- sort: "price" if they want the cheapest, "distance" if the nearest, else "relevance"
Infer the product from the need, e.g. «یه چیزی که بشه باهاش جلوی مغازه رو دید» → keywords «دوربین مدار بسته».`;
}

const cache = new Map<string, unknown>();

// One JSON-returning chat call with timeout and cache; null on any failure.
async function chatJson<T>(kind: string, system: string, user: string, fetchImpl: typeof fetch): Promise<T | null> {
  if (!llmEnabled()) return null;
  const key = `${kind}:${normalizeFa(user)}`;
  if (cache.has(key)) return cache.get(key) as T | null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let out: T | null = null;
  try {
    const res = await fetchImpl(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 300,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.ok) out = parseLlmJson((await res.json())?.choices?.[0]?.message?.content ?? "") as T | null;
  } catch {
    out = null; // timeout / network: rules only
  } finally {
    clearTimeout(timer);
  }
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

export function askLlm(q: string, vocab: Vocab, fetchImpl: typeof fetch = fetch): Promise<LlmOut | null> {
  return chatJson<LlmOut>("query", prompt(vocab.areas), q, fetchImpl);
}

export type MarketPlace = { name: string; why: string };

const MARKET_PROMPT = `You know Tehran's traditional trade districts («بورس»): which streets, bazaars and malls specialise in which goods.
Given a product a shopper could not find in our shop list, reply with ONLY JSON: {"places":[{"name":"...","why":"..."}]}
- name: a well-known Tehran street, bazaar or mall in Persian (e.g. «بازار امین‌السلطان», «خیابان لاله‌زار»)
- why: one short Persian sentence on what is sold there
- at most 3 places, only ones you are confident about; {"places":[]} if unsure.`;

// General knowledge, not dataset data: names only, the UI links them to a map search.
export async function askMarket(product: string, fetchImpl: typeof fetch = fetch): Promise<MarketPlace[]> {
  const out = await chatJson<{ places?: unknown }>("market", MARKET_PROMPT, product, fetchImpl);
  const places = Array.isArray(out?.places) ? out.places : [];
  return places
    .filter((p): p is MarketPlace => typeof p?.name === "string" && typeof p?.why === "string" && p.name.length <= 60 && p.why.length <= 160)
    .slice(0, 3);
}

const CHECKLIST_PROMPT = `You help shoppers buying in person in Iranian shops. Given a product category, reply with ONLY JSON:
{"tips":["...","..."]} with 2-4 short, practical Persian checks to do in the shop before paying (what to test, ask or verify).
No brand recommendations, no prices, nothing you are unsure of.`;

// Category tips for categories without a curated guide; shown labelled as AI-generated.
export async function askChecklist(category: string, fetchImpl: typeof fetch = fetch): Promise<string[] | null> {
  const out = await chatJson<{ tips?: unknown }>("checklist", CHECKLIST_PROMPT, category, fetchImpl);
  const tips = Array.isArray(out?.tips) ? out.tips.filter((t): t is string => typeof t === "string" && t.length > 3 && t.length <= 160) : [];
  return tips.length ? tips.slice(0, 4) : null;
}
