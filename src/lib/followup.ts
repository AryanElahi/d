// Follow-up: per-device stock-check tracking and alternatives when a shop doesn't have it.
// Reports live in user_reports and never overwrite dataset prices.
import { pool } from "./db";
import { hoursNow, type HoursNow, type Week } from "./hours";
import type { Status } from "./message";
import { distSql, phoneOf, VALID_PRICE } from "./product";

export const STATUSES: Status[] = ["saved", "contacted", "confirmed", "unavailable", "price_changed", "bought", "dismissed"];

export async function addReport(r: { deviceId: string; offerId: string; status: Status; reportedPrice: number | null }) {
  const exists = await pool.query("SELECT 1 FROM offers WHERE offer_id = $1", [r.offerId]);
  if (!exists.rowCount) return false;
  await pool.query("INSERT INTO user_reports (device_id, offer_id, status, reported_price) VALUES ($1, $2, $3, $4)", [
    r.deviceId,
    r.offerId,
    r.status,
    r.reportedPrice,
  ]);
  return true;
}

export type Tracked = {
  offerId: string;
  status: Status;
  reportedPrice: number | null;
  updatedAt: string;
  startedAt: string;
  price: number | null;
  priceChangedAt: string | null;
  productId: string;
  productTitle: string;
  image: string | null;
  shopName: string;
  mall: string | null;
  floor: string | null;
  unit: string | null;
  address: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  hours: HoursNow;
};

export async function trackedFor(deviceId: string): Promise<Tracked[]> {
  const { rows } = await pool.query(
    `WITH latest AS (
       SELECT DISTINCT ON (offer_id) offer_id, status, reported_price, created_at
       FROM user_reports WHERE device_id = $1 ORDER BY offer_id, created_at DESC
     ), first AS (
       SELECT offer_id, min(created_at) started_at FROM user_reports WHERE device_id = $1 GROUP BY 1
     )
     SELECT l.offer_id, l.status, l.reported_price, l.created_at, f.started_at,
       CASE WHEN ${VALID_PRICE} THEN o.price_toman END price, o.last_price_changed_at,
       p.product_id, p.title, p.image_urls->>0 image,
       s.name, s.mall, s.floor, s.unit, s.address, s.lat, s.lon, s.weekly_hours, s.contacts
     FROM latest l
     JOIN first f USING (offer_id)
     JOIN offers o ON o.offer_id = l.offer_id
     JOIN products p ON p.product_id = o.product_id
     JOIN shops s ON s.shop_id = o.shop_id
     WHERE l.status <> 'dismissed'
     ORDER BY l.created_at DESC`,
    [deviceId],
  );
  const now = new Date();
  return rows.map((r) => ({
    offerId: r.offer_id,
    status: r.status,
    reportedPrice: r.reported_price == null ? null : +r.reported_price,
    updatedAt: r.created_at.toISOString(),
    startedAt: r.started_at.toISOString(),
    price: r.price == null ? null : +r.price,
    priceChangedAt: r.last_price_changed_at?.toISOString() ?? null,
    productId: r.product_id,
    productTitle: r.title,
    image: r.image,
    shopName: r.name,
    mall: r.mall,
    floor: r.floor,
    unit: r.unit,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    phone: phoneOf(r.contacts),
    hours: hoursNow(r.weekly_hours as Week, now),
  }));
}

export type AltSeller = {
  kind: "same";
  offerId: string;
  productId: string;
  shopName: string;
  place: string | null;
  price: number | null;
  priceChangedAt: string | null;
  distanceKm: number;
  hours: HoursNow;
  reason: string;
};

export type AltProduct = {
  kind: "similar";
  productId: string;
  title: string;
  image: string | null;
  brand: string | null;
  minPrice: number | null;
  shops: number;
  nearestKm: number;
  sameBrand: boolean;
  reason: string;
};

const SIMILAR_RADIUS_KM = 2;
const SAME_RADIUS_KM = 5;

// When a shop doesn't have it: first the same product at other nearby shops, then similar products
// (same category, ±20% price, same brand first) near that shop. Shops this device already
// reported as unavailable are skipped.
export async function alternatives(offerId: string, deviceId: string | null): Promise<{ origin: { lat: number; lon: number; shopName: string }; same: AltSeller[]; similar: AltProduct[] } | null> {
  const base = await pool.query(
    `SELECT o.product_id, CASE WHEN ${VALID_PRICE} THEN o.price_toman END price,
       p.category, p.brand, s.lat, s.lon, s.name shop_name
     FROM offers o JOIN products p USING (product_id) JOIN shops s ON s.shop_id = o.shop_id
     WHERE o.offer_id = $1`,
    [offerId],
  );
  if (!base.rowCount) return null;
  const b = base.rows[0];
  const now = new Date();

  const sp: unknown[] = [b.product_id, offerId, deviceId ?? "", b.lat, b.lon, SAME_RADIUS_KM];
  const dist = distSql("$4", "$5");
  const same = await pool.query(
    `SELECT o.offer_id, CASE WHEN ${VALID_PRICE} THEN o.price_toman END price, o.last_price_changed_at,
       s.name, s.mall, s.floor, s.unit, s.weekly_hours, ${dist} distance_km
     FROM offers o JOIN shops s ON s.shop_id = o.shop_id
     WHERE o.product_id = $1 AND o.offer_id <> $2
       AND NOT EXISTS (SELECT 1 FROM user_reports r WHERE r.device_id = $3 AND r.offer_id = o.offer_id AND r.status = 'unavailable')
       AND ${dist} <= $6
     ORDER BY distance_km
     LIMIT 12`,
    sp,
  );

  const sameOut: AltSeller[] = same.rows
    .map((r) => {
      const hours = hoursNow(r.weekly_hours as Week, now);
      return {
        kind: "same" as const,
        offerId: r.offer_id,
        productId: b.product_id,
        shopName: r.name,
        place: [r.mall, r.floor && `طبقه ${r.floor}`, r.unit && `واحد ${r.unit}`].filter(Boolean).join("، ") || null,
        price: r.price == null ? null : +r.price,
        priceChangedAt: r.last_price_changed_at?.toISOString() ?? null,
        distanceKm: r.distance_km,
        hours,
        reason: "",
      };
    })
    // Open shops first, then distance: the point is a shop you can walk to now.
    .sort((x, y) => openRank(x.hours) - openRank(y.hours) || x.distanceKm - y.distanceKm)
    .slice(0, 5);

  let similar: AltProduct[] = [];
  if (b.category) {
    const qp: unknown[] = [b.category, b.product_id, b.lat, b.lon, SIMILAR_RADIUS_KM, b.brand];
    let priceCond = "";
    if (b.price != null) {
      qp.push(Math.round(+b.price * 0.8), Math.round(+b.price * 1.2));
      priceCond = `AND o.price_toman BETWEEN $7 AND $8`;
    }
    const d = distSql("$3", "$4");
    const sim = await pool.query(
      `SELECT p.product_id, p.title, p.image_urls->>0 image, p.brand,
         min(o.price_toman) FILTER (WHERE ${VALID_PRICE}) min_price,
         count(DISTINCT o.shop_id)::int shops, min(${d}) nearest_km,
         (p.brand IS NOT NULL AND p.brand = $6) same_brand
       FROM products p JOIN offers o USING (product_id) JOIN shops s ON s.shop_id = o.shop_id
       WHERE p.category = $1 AND p.product_id <> $2 ${priceCond}
         AND s.lat BETWEEN $3 - $5 / 111.0 AND $3 + $5 / 111.0
         AND s.lon BETWEEN $4 - $5 / 90.0 AND $4 + $5 / 90.0
         AND ${d} <= $5
       GROUP BY p.product_id
       ORDER BY same_brand DESC, shops DESC, nearest_km
       LIMIT 5`,
      qp,
    );
    similar = sim.rows.map((r) => ({
      kind: "similar" as const,
      productId: r.product_id,
      title: r.title,
      image: r.image,
      brand: r.brand,
      minPrice: r.min_price == null ? null : +r.min_price,
      shops: r.shops,
      nearestKm: r.nearest_km,
      sameBrand: r.same_brand,
      reason: "",
    }));
  }

  const basePrice = b.price == null ? null : +b.price;
  for (const a of sameOut) a.reason = sameReason(a);
  for (const a of similar) a.reason = similarReason(a, basePrice, b.category);
  return { origin: { lat: b.lat, lon: b.lon, shopName: b.shop_name }, same: sameOut, similar };
}

const openRank = (h: HoursNow) => ({ open: 0, closing_soon: 1, unknown: 2, closed: 3 })[h.state];

function sameReason(a: AltSeller): string {
  const parts = ["همین کالا"];
  if (a.distanceKm < 0.03) parts.push("در همین ساختمان");
  else parts.push(a.distanceKm < 1 ? `${Math.round(a.distanceKm * 1000 / 10) * 10} متر آن‌طرف‌تر` : `${a.distanceKm.toFixed(1)} کیلومتر آن‌طرف‌تر`);
  if (a.hours.state === "open") parts.push("الان باز");
  return toFa(parts.join("، "));
}

function similarReason(a: AltProduct, basePrice: number | null, category: string): string {
  const parts = [a.sameBrand ? `همان برند و دسته «${category}»` : `همان دسته «${category}»`];
  if (basePrice != null && a.minPrice != null) {
    const pct = Math.round(((a.minPrice - basePrice) / basePrice) * 100);
    parts.push(pct === 0 ? "هم‌قیمت" : pct < 0 ? `${-pct}٪ ارزان‌تر` : `${pct}٪ گران‌تر`);
  }
  parts.push(`${a.shops} فروشنده نزدیک`);
  return toFa(parts.join("، "));
}

const toFa = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
