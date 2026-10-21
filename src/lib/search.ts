import { pool } from "./db";
import { ageDays, toman } from "./format";
import { normalizeFa, toFaDigits } from "./normalize";
import type { Filters } from "./parser";
import { loadVocab } from "./vocab";

export type SearchInput = Filters & { lat?: number; lon?: number; radiusKm?: number };

export type ProductHit = {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  shops: number;
  pricedShops: number;
  nearestKm: number | null;
  newestChange: string | null;
  oldestChange: string | null;
  openShops: number;
  unknownHoursShops: number;
  torobpayShops: number;
  warrantyShops: number;
  topMall: { name: string; shops: number } | null;
  reasons: string[];
};

export type SearchResult = {
  filters: SearchInput;
  center: { lat: number; lon: number; label: string } | null;
  results: ProductHit[];
  needsQuery?: boolean;
};

// Dataset has junk prices (1 toman, 10^17); only these count as a real recorded price.
const VALID_PRICE = "o.price_toman BETWEEN 1000 AND 100000000000";
const DEFAULT_RADIUS = { area: 1.5, nearMe: 3 };

export async function search(input: SearchInput): Promise<SearchResult> {
  const f = { ...input };
  const { areas } = await loadVocab();
  const tokens = f.text.split(" ").filter((t) => t.length > 1);
  if (!tokens.length && !f.category && !f.brand) return { filters: f, center: null, results: [], needsQuery: true };

  let center: SearchResult["center"] = null;
  const area = f.area ? areas.get(f.area) : undefined;
  if (f.lat != null && f.lon != null) {
    center = { lat: f.lat, lon: f.lon, label: "موقعیت شما" };
    f.radiusKm ??= DEFAULT_RADIUS.nearMe;
  } else if (area) {
    center = { lat: area.lat, lon: area.lon, label: area.name };
    f.radiusKm ??= DEFAULT_RADIUS.area;
  }

  const params: unknown[] = [];
  const $ = (v: unknown) => `$${params.push(v)}`;
  const where: string[] = [];

  for (const t of tokens) where.push(`p.title_norm LIKE ${$(`%${t}%`)}`);
  if (f.category) where.push(`p.category = ${$(f.category)}`);
  if (f.brand) where.push(`(p.brand = ${$(f.brand)} OR p.title_norm LIKE ${$(`%${normalizeFa(f.brand)}%`)})`);
  if (f.budgetMin != null) where.push(`${VALID_PRICE} AND o.price_toman >= ${$(f.budgetMin)}`);
  if (f.budgetMax != null) where.push(`${VALID_PRICE} AND o.price_toman <= ${$(f.budgetMax)}`);
  if (f.warranty) where.push(`o.warranty IS NOT NULL AND o.warranty->>'provider' <> 'بدون گارانتی'`);
  if (f.torobpay) where.push(`s.torobpay`);
  if (f.installments) where.push(`cardinality(s.installment_providers) > 0`);
  if (f.openNow) where.push(`shop_open_at(s.weekly_hours, now()) IS TRUE`);

  let dist = "NULL::float";
  if (center) {
    const lat = $(center.lat), lon = $(center.lon), r = $(f.radiusKm);
    dist = `6371 * 2 * asin(sqrt(power(sin(radians(s.lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(s.lat)) * power(sin(radians(s.lon - ${lon}) / 2), 2)))`;
    // Bounding box first so the (lat, lon) index is used, then exact distance.
    where.push(`s.lat BETWEEN ${lat} - ${r} / 111.0 AND ${lat} + ${r} / 111.0`);
    where.push(`s.lon BETWEEN ${lon} - ${r} / 90.0 AND ${lon} + ${r} / 90.0`);
    where.push(`${dist} <= ${r}`);
  }

  const head = $(tokens[0] ?? "");
  const q = $(tokens.join(" "));
  // "Relevant" = the query names this kind of product, not an accessory that mentions it.
  const relevant = `(p.category_norm LIKE '%' || ${q} || '%' OR p.category_norm LIKE ${head} || '%' OR p.title_norm LIKE ${head} || '%')`;
  const order = {
    relevance: "score DESC, shops DESC",
    price: `${relevant} DESC, min_price ASC NULLS LAST, score DESC`,
    distance: `${relevant} DESC, nearest_km ASC NULLS LAST, score DESC`,
  }[f.sort];

  const sql = `
    SELECT p.product_id id, p.title, p.brand, p.category, p.image_urls->>0 image,
      min(o.price_toman) FILTER (WHERE ${VALID_PRICE}) min_price,
      max(o.price_toman) FILTER (WHERE ${VALID_PRICE}) max_price,
      count(DISTINCT o.shop_id)::int shops,
      count(DISTINCT o.shop_id) FILTER (WHERE ${VALID_PRICE})::int priced_shops,
      min(${dist}) nearest_km,
      max(o.last_price_changed_at) newest_change,
      min(o.last_price_changed_at) oldest_change,
      count(DISTINCT o.shop_id) FILTER (WHERE shop_open_at(s.weekly_hours, now()))::int open_shops,
      count(DISTINCT o.shop_id) FILTER (WHERE shop_open_at(s.weekly_hours, now()) IS NULL)::int unknown_hours_shops,
      count(DISTINCT o.shop_id) FILTER (WHERE s.torobpay)::int torobpay_shops,
      count(DISTINCT o.shop_id) FILTER (WHERE o.warranty IS NOT NULL AND o.warranty->>'provider' <> 'بدون گارانتی')::int warranty_shops,
      array_remove(array_agg(s.mall), NULL) malls,
      (CASE WHEN p.category_norm LIKE '%' || ${q} || '%' THEN 1 ELSE 0 END
        + CASE WHEN p.category_norm LIKE ${head} || '%' THEN 1 ELSE 0 END
        + CASE WHEN p.title_norm LIKE ${head} || '%' THEN 0.5 ELSE 0 END
        + similarity(p.title_norm, ${q})
        + 0.1 * ln(count(DISTINCT o.shop_id))) score
    FROM products p
    JOIN offers o ON o.product_id = p.product_id
    JOIN shops s ON s.shop_id = o.shop_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY p.product_id
    ORDER BY ${order}
    LIMIT 30`;

  const { rows } = await pool.query(sql, params);
  const cheapest = Math.min(...rows.map((r) => (r.min_price == null ? Infinity : +r.min_price)));

  const results: ProductHit[] = rows.map((r) => {
    const topMall = mostCommon(r.malls as string[]);
    const hit: ProductHit = {
      id: r.id,
      title: r.title,
      brand: r.brand,
      category: r.category,
      image: r.image,
      minPrice: r.min_price == null ? null : +r.min_price,
      maxPrice: r.max_price == null ? null : +r.max_price,
      shops: r.shops,
      pricedShops: r.priced_shops,
      nearestKm: r.nearest_km,
      newestChange: r.newest_change?.toISOString() ?? null,
      oldestChange: r.oldest_change?.toISOString() ?? null,
      openShops: r.open_shops,
      unknownHoursShops: r.unknown_hours_shops,
      torobpayShops: r.torobpay_shops,
      warrantyShops: r.warranty_shops,
      topMall,
      reasons: [],
    };
    hit.reasons = reasons(hit, cheapest);
    return hit;
  });

  return { filters: f, center, results };
}

function mostCommon(xs: string[]): ProductHit["topMall"] {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: ProductHit["topMall"] = null;
  for (const [name, shops] of counts) if (!best || shops > best.shops) best = { name, shops };
  return best;
}

// Short, honest "why this result" lines built only from recorded data.
function reasons(h: ProductHit, cheapest: number): string[] {
  const out: string[] = [];
  if (h.minPrice != null && h.minPrice === cheapest) out.push(`ارزان‌ترین قیمت ثبت‌شده در این نتایج (${toman(h.minPrice)})`);
  if (h.topMall && h.topMall.shops >= 2) out.push(`${toFaDigits(h.topMall.shops)} فروشنده در ${h.topMall.name}؛ یک مراجعه، چند گزینه`);
  const age = ageDays(h.newestChange);
  if (age != null && age <= 7) out.push("قیمت در هفته اخیر به‌روز شده");
  if (h.shops >= 5) out.push(`${toFaDigits(h.shops)} فروشنده برای مقایسه`);
  return out.slice(0, 2);
}
