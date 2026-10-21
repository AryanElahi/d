import { pool } from "./db";
import { distSql, VALID_PRICE, type Center } from "./product";
import { diffSpecs, type Spec, type SpecRow } from "./specdiff";

export const MAX_COMPARE = 3;

export type CompareItem = {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  minPrice: number | null;
  medianPrice: number | null;
  maxPrice: number | null;
  shops: number;
  openShops: number;
  newestChange: string | null;
  nearestKm: number | null;
};

export type Comparison =
  | { ok: true; category: string | null; items: CompareItem[]; rows: SpecRow[] }
  | { ok: false; reason: "mixed_categories" | "not_found"; categories?: string[] };

export async function getComparison(ids: string[], center: Center | null): Promise<Comparison> {
  const uniq = [...new Set(ids)].slice(0, MAX_COMPARE);
  const params: unknown[] = [uniq];
  const dist = center ? distSql(`$${params.push(center.lat)}`, `$${params.push(center.lon)}`) : "NULL::float";
  const { rows } = await pool.query(
    `SELECT p.product_id id, p.title, p.brand, p.category, p.image_urls->>0 image, p.specs,
       min(o.price_toman) FILTER (WHERE ${VALID_PRICE}) min_price,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY o.price_toman) FILTER (WHERE ${VALID_PRICE}) median_price,
       max(o.price_toman) FILTER (WHERE ${VALID_PRICE}) max_price,
       count(DISTINCT o.shop_id)::int shops,
       count(DISTINCT o.shop_id) FILTER (WHERE shop_open_at(s.weekly_hours, now()))::int open_shops,
       max(o.last_price_changed_at) newest_change,
       min(${dist}) nearest_km
     FROM products p
     LEFT JOIN offers o ON o.product_id = p.product_id
     LEFT JOIN shops s ON s.shop_id = o.shop_id
     WHERE p.product_id = ANY($1)
     GROUP BY p.product_id`,
    params,
  );
  if (!rows.length) return { ok: false, reason: "not_found" };
  // Spec keys only line up within one category, so mixing is refused rather than shown half-empty.
  const cats = [...new Set(rows.map((r) => r.category))];
  if (cats.length > 1) return { ok: false, reason: "mixed_categories", categories: cats };

  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = uniq.map((id) => byId.get(id)).filter(Boolean);
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    ok: true,
    category: cats[0],
    items: ordered.map((r) => ({
      id: r.id,
      title: r.title,
      brand: r.brand,
      category: r.category,
      image: r.image,
      minPrice: num(r.min_price),
      medianPrice: num(r.median_price),
      maxPrice: num(r.max_price),
      shops: r.shops,
      openShops: r.open_shops,
      newestChange: r.newest_change?.toISOString() ?? null,
      nearestKm: r.nearest_km,
    })),
    rows: diffSpecs(ordered.map((r) => ({ specs: (r.specs ?? []) as Spec[] }))),
  };
}
