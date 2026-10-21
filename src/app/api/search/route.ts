import { NextRequest, NextResponse } from "next/server";
import { normalizeFa } from "@/lib/normalize";
import { parseQuery, type Sort } from "@/lib/parser";
import { search, type SearchInput } from "@/lib/search";
import { loadVocab } from "@/lib/vocab";

// GET /api/search?q=free text  → parse, then search.
// Structured params (t, category, brand, min, max, area, lat, lon, r, torobpay, inst, warranty, open, sort)
// override what the parser found, so the filter sheet can edit results without re-asking.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  const flag = (k: string) => (p.has(k) ? p.get(k) === "1" : undefined);
  const str = (k: string) => (p.has(k) ? p.get(k) || undefined : undefined);

  try {
    const base: SearchInput = p.get("q") ? parseQuery(p.get("q")!, (await loadVocab()).vocab) : { text: "", sort: "relevance" };
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
    const input = { ...base };
    for (const [k, v] of Object.entries(overrides)) if (p.has(paramName(k))) Object.assign(input, { [k]: v });
    return NextResponse.json(await search(input));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}

const PARAM: Record<string, string> = {
  text: "t", budgetMin: "min", budgetMax: "max", radiusKm: "r", installments: "inst", openNow: "open",
};
const paramName = (k: string) => PARAM[k] ?? k;
