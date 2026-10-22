import { pool } from "./db";
import { hoursNow, type HoursNow, type Week } from "./hours";

export type Center = { lat: number; lon: number; label: string };

export type Warranty = { provider: string | null; period_months: number | null; description: string | null } | null;

export type Seller = {
  offerId: string;
  shopId: string;
  shopName: string;
  sellerTitle: string | null;
  price: number | null;
  priceChangedAt: string | null;
  warranty: Warranty;
  address: string | null;
  mall: string | null;
  floor: string | null;
  unit: string | null;
  lat: number;
  lon: number;
  distanceKm: number | null;
  hours: HoursNow;
  torobpay: boolean | null;
  installments: string[];
  fastDelivery: boolean | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  report: { status: string; price: number | null; at: string } | null;
};

export type MaybeShop = {
  shopId: string;
  name: string;
  address: string | null;
  mall: string | null;
  floor: string | null;
  unit: string | null;
  lat: number;
  lon: number;
  distanceKm: number | null;
  hours: HoursNow;
  phone: string | null;
};

export type ProductPage = {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  model: string | null;
  images: string[];
  specs: { section: string; key: string; value: string }[];
  sellers: Seller[];
  maybeShops: MaybeShop[];
  maybeShopsTotal: number;
};

export const VALID_PRICE = "o.price_toman BETWEEN 1000 AND 100000000000";
const MAYBE_RADIUS_KM = 3;

export function distSql(lat: string, lon: string) {
  return `6371 * 2 * asin(sqrt(power(sin(radians(s.lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(s.lat)) * power(sin(radians(s.lon - ${lon}) / 2), 2)))`;
}

export const phoneOf = (contacts: { channel: string; display_number?: string }[] | null) =>
  contacts?.find((c) => c.channel === "phone")?.display_number ?? null;

export async function getProduct(id: string, center: Center | null): Promise<ProductPage | null> {
  const p = await pool.query(
    "SELECT product_id, title, brand, category, model, image_urls, specs FROM products WHERE product_id = $1",
    [id],
  );
  if (!p.rows.length) return null;
  const prod = p.rows[0];

  const params: unknown[] = [id];
  const dist = center ? distSql(`$${params.push(center.lat)}`, `$${params.push(center.lon)}`) : "NULL::float";
  const sellers = await pool.query(
    `SELECT o.offer_id, o.seller_title, o.last_price_changed_at, o.warranty,
       CASE WHEN ${VALID_PRICE} THEN o.price_toman END price,
       s.shop_id, s.name, s.address, s.mall, s.floor, s.unit, s.lat, s.lon, s.weekly_hours,
       s.torobpay, s.installment_providers, s.fast_delivery, s.contacts, s.website_url, s.instagram,
       ${dist} distance_km,
       r.status report_status, r.reported_price, r.created_at report_at
     FROM offers o
     JOIN shops s ON s.shop_id = o.shop_id
     LEFT JOIN LATERAL (
       SELECT status, reported_price, created_at FROM user_reports
       WHERE offer_id = o.offer_id AND NOT simulated AND status IN ('confirmed','unavailable','price_changed','bought') -- real outcomes only
       ORDER BY created_at DESC LIMIT 1
     ) r ON true
     WHERE o.product_id = $1`,
    params,
  );

  // Shops that only list this category: they *may* have it, nothing more.
  let maybe = { rows: [] as Record<string, unknown>[] };
  let maybeTotal = 0;
  if (prod.category) {
    const mp: unknown[] = [prod.category, id];
    const near = center
      ? (() => {
          const lat = `$${mp.push(center.lat)}`, lon = `$${mp.push(center.lon)}`, r = `$${mp.push(MAYBE_RADIUS_KM)}`;
          return {
            dist: distSql(lat, lon),
            where: `AND s.lat BETWEEN ${lat} - ${r} / 111.0 AND ${lat} + ${r} / 111.0
                    AND s.lon BETWEEN ${lon} - ${r} / 90.0 AND ${lon} + ${r} / 90.0
                    AND ${distSql(lat, lon)} <= ${r}`,
          };
        })()
      : { dist: "NULL::float", where: "" };
    maybe = await pool.query(
      `SELECT s.shop_id, s.name, s.address, s.mall, s.floor, s.unit, s.lat, s.lon, s.weekly_hours, s.contacts,
         ${near.dist} distance_km, count(*) OVER () total
       FROM shops s
       WHERE s.category_names ? $1
         AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.shop_id = s.shop_id AND o.product_id = $2)
         ${near.where}
       ORDER BY distance_km NULLS LAST, s.has_hours DESC
       LIMIT 8`,
      mp,
    );
    maybeTotal = Number(maybe.rows[0]?.total ?? 0);
  }

  const now = new Date();
  return {
    id: prod.product_id,
    title: prod.title,
    brand: prod.brand,
    category: prod.category,
    model: prod.model,
    images: prod.image_urls ?? [],
    specs: prod.specs ?? [],
    sellers: sellers.rows.map((r) => ({
      offerId: r.offer_id,
      shopId: r.shop_id,
      shopName: r.name,
      sellerTitle: r.seller_title,
      price: r.price == null ? null : +r.price,
      priceChangedAt: r.last_price_changed_at?.toISOString() ?? null,
      warranty: r.warranty,
      address: r.address,
      mall: r.mall,
      floor: r.floor,
      unit: r.unit,
      lat: r.lat,
      lon: r.lon,
      distanceKm: r.distance_km,
      hours: hoursNow(r.weekly_hours as Week, now),
      torobpay: r.torobpay,
      installments: r.installment_providers ?? [],
      fastDelivery: r.fast_delivery,
      phone: phoneOf(r.contacts),
      website: r.website_url,
      instagram: r.instagram,
      report: r.report_status
        ? { status: r.report_status, price: r.reported_price == null ? null : +r.reported_price, at: r.report_at.toISOString() }
        : null,
    })),
    maybeShops: maybe.rows.map((r) => ({
      shopId: r.shop_id as string,
      name: r.name as string,
      address: r.address as string | null,
      mall: r.mall as string | null,
      floor: r.floor as string | null,
      unit: r.unit as string | null,
      lat: r.lat as number,
      lon: r.lon as number,
      distanceKm: r.distance_km as number | null,
      hours: hoursNow(r.weekly_hours as Week, now),
      phone: phoneOf(r.contacts as never),
    })),
    maybeShopsTotal: maybeTotal,
  };
}
