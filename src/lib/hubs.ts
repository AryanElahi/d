// «بورس» guidance: where in Tehran a kind of product is concentrated. Dataset first (shops'
// activity categories → malls/areas); LLM general knowledge only when the dataset has nothing.
import { pool } from "./db";
import { askMarket, llmEnabled, type MarketPlace } from "./llm";
import { normalizeFa } from "./normalize";

export type Hub = { name: string; kind: "mall" | "area"; shops: number; lat: number; lon: number; distanceKm: number | null };

export type Market =
  | { source: "data"; category: string; hubs: Hub[] }
  | { source: "llm"; product: string; places: MarketPlace[] };

// Category of a search: explicit filter, else the most common among top results, else by name.
// Returns { preferred, candidates }: preferred (explicit or from results) is used if it has hubs,
// else the text-matched candidate with the most shops.
export function pickCategory(
  explicit: string | undefined,
  resultCategories: (string | null)[],
  text: string,
  categories: string[],
): { preferred?: string; candidates: string[] } {
  let preferred = explicit;
  const top = resultCategories.slice(0, 10).filter((c): c is string => !!c);
  if (!preferred && top.length) {
    const counts = new Map<string, number>();
    for (const c of top) counts.set(c, (counts.get(c) ?? 0) + 1);
    preferred = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  }
  return { preferred, candidates: textCategories(text, categories) };
}

function textCategories(text: string, categories: string[]): string[] {
  const tokens = text.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return [];
  // Categories naming the product, more matched words first; market() then picks the one with most shops.
  return categories
    .map((c) => {
      const n = normalizeFa(c);
      const words = new Set(n.split(" ")); // whole words: «بای» must not match «موبایل»
      return [c, tokens.filter((t) => words.has(t)).length, n.length] as const;
    })
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .slice(0, 30)
    .map(([c]) => c);
}

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

export async function market(
  pick: { preferred?: string; candidates: string[] },
  text: string,
  center: { lat: number; lon: number } | null,
  allowLlm: boolean,
): Promise<Market | null> {
  const all = [...(pick.preferred ? [pick.preferred] : []), ...pick.candidates];
  if (all.length) {
    const { rows } = await pool.query(
      "SELECT category, name, kind, shops, lat, lon FROM category_hubs WHERE category = ANY($1) ORDER BY rank",
      [all],
    );
    const total = new Map<string, number>();
    for (const r of rows) total.set(r.category, (total.get(r.category) ?? 0) + r.shops);
    const best = pick.preferred && total.has(pick.preferred) ? pick.preferred : [...total].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (best)
      return {
        source: "data",
        category: best,
        hubs: rows
          .filter((r) => r.category === best)
          .slice(0, 4)
          .map((r) => ({
            name: r.name,
            kind: r.kind,
            shops: r.shops,
            lat: r.lat,
            lon: r.lon,
            distanceKm: center ? km(center.lat, center.lon, r.lat, r.lon) : null,
          })),
      };
  }
  if (allowLlm && llmEnabled() && text) {
    const places = await askMarket(text);
    if (places.length) return { source: "llm", product: text, places };
  }
  return null;
}
