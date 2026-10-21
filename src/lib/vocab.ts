import { pool } from "./db";
import type { Vocab } from "./parser";

export type Area = { name: string; lat: number; lon: number };

let cache: Promise<{ vocab: Vocab; areas: Map<string, Area> }> | undefined;

// Area names, brands and categories the parser can recognize, loaded once per process.
export function loadVocab() {
  return (cache ??= (async () => {
    const [areas, brands, cats] = await Promise.all([
      pool.query<Area>("SELECT name, lat, lon FROM areas"),
      pool.query("SELECT brand FROM products WHERE brand IS NOT NULL GROUP BY brand HAVING count(*) >= 3"),
      pool.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL"),
    ]);
    return {
      vocab: {
        areas: areas.rows.map((a) => a.name),
        brands: brands.rows.map((r) => r.brand),
        categories: cats.rows.map((r) => r.category),
      },
      areas: new Map(areas.rows.map((a) => [a.name, a])),
    };
  })());
}
