import { NextRequest, NextResponse } from "next/server";
import { askLlm, llmEnabled, mergeLlm, shouldAskLlm } from "@/lib/llm";
import { normalizeFa } from "@/lib/normalize";
import { parseQuery, type Sort } from "@/lib/parser";
import { search, type SearchInput } from "@/lib/search";
import { loadVocab } from "@/lib/vocab";

// GET /api/search?q=free text  → parse (rules, then LLM only if they missed), then search.
// Structured params (t, category, brand, min, max, area, lat, lon, r, torobpay, inst, warranty, open, sort)
// override what the parser found, so the filter sheet can edit results without re-asking.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  const flag = (k: string) => (p.has(k) ? p.get(k) === "1" : undefined);
  const str = (k: string) => (p.has(k) ? p.get(k) || undefined : undefined);
  const overrides: Partial<SearchInput> = {
    text: p.has("t") ? normalizeFa(p.get("t")) : undefined,
    category: str("category"),
    brand: str("brand"),
    budgetMin: num("min"),
    budgetMax: num("max"),
    area: str("area"),
    lat: num("lat"),
    lon: num("lon"),
    radiusKm: num("r"),
    torobpay: flag("torobpay"),
    installments: flag("inst"),
    warranty: flag("warranty"),
    openNow: flag("open"),
    sort: (str("sort") as Sort) ?? undefined,
  };
  const withOverrides = (base: SearchInput) => {
    const input = { ...base };
    for (const [k, v] of Object.entries(overrides)) if (p.has(paramName(k))) Object.assign(input, { [k]: v });
    return input;
  };

  try {
    const q = p.get("q");
    const { vocab } = await loadVocab();
    let base: SearchInput = q ? parseQuery(q, vocab) : { text: "", sort: "relevance" };
    let usedLlm = false;

    if (q && llmEnabled() && shouldAskLlm(q, base)) {
      const out = await askLlm(q, vocab);
      if (out) {
        base = mergeLlm(base, out, vocab, false);
        usedLlm = true;
      }
    }
    let result = await search(withOverrides(base));

    // Rules found nothing: let the LLM reinterpret the sentence once.
    if (q && llmEnabled() && !usedLlm && !result.needsQuery && result.results.length === 0) {
      const out = await askLlm(q, vocab);
      if (out) {
        const retry = await search(withOverrides(mergeLlm(base, out, vocab, true)));
        if (retry.results.length) {
          result = retry;
          usedLlm = true;
        }
      }
    }
    // Still nothing (LLM off or unhelpful): retry with the first two words and say so.
    let relaxed: string | undefined;
    const words = result.filters.text.split(" ").filter(Boolean);
    if (q && !result.needsQuery && result.results.length === 0 && words.length >= 3) {
      const text = words.slice(0, 2).join(" ");
      const retry = await search({ ...result.filters, text });
      if (retry.results.length) {
        result = retry;
        relaxed = text;
      }
    }
    return NextResponse.json({ ...result, llm: { used: usedLlm }, relaxed });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}

const PARAM: Record<string, string> = {
  text: "t", budgetMin: "min", budgetMax: "max", radiusKm: "r", installments: "inst", openNow: "open",
};
const paramName = (k: string) => PARAM[k] ?? k;
