// Load the Torob CSVs into Postgres. Usage: DATABASE_URL=... npm run import [dataDir]
import { createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse";
import { Client } from "pg";
import { normalizeFa } from "../src/lib/normalize";
import { mallKey, parseAddress } from "../src/lib/address";

const dir = process.argv[2] ?? "data";
const BATCH = 2000;
const db = new Client({ connectionString: process.env.DATABASE_URL });

const nil = (v: string) => (v === "null" || v === "" ? null : v);
const json = (v: string) => (nil(v) === null ? null : JSON.parse(v));

async function load(file: string, table: string, map: (r: Record<string, string>) => object) {
  const rows = createReadStream(join(dir, file)).pipe(parse({ columns: true, relax_quotes: true }));
  let batch: object[] = [];
  let n = 0;
  const flush = async () => {
    if (!batch.length) return;
    await db.query(`INSERT INTO ${table} SELECT * FROM json_populate_recordset(null::${table}, $1)`, [JSON.stringify(batch)]);
    n += batch.length;
    batch = [];
    process.stdout.write(`\r${table}: ${n}`);
  };
  for await (const r of rows) {
    batch.push(map(r));
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.log();
}

function addr(a: string) {
  const parts = parseAddress(a);
  return { ...parts, mall_key: mallKey(parts.mall) };
}

type Day = { status: string; shifts: { start_time: string; end_time: string }[] };

// 00:00-00:00 "declared" shifts are placeholders, not real hours.
function hasRealHours(h: Record<string, Day> | null) {
  return !!h && Object.values(h).some((d) => d?.status === "declared" && d.shifts.some((s) => s.start_time !== s.end_time));
}

// Street/bazaar names people say, mapped to the dataset's location_label.
const AREA_ALIASES: Record<string, string> = {
  "جمهوری": "شیخ هادی",
  "لاله زار": "فردوسی",
  "منوچهری": "فردوسی",
  "استانبول": "فردوسی",
  "توپخانه": "فردوسی",
  "مجلس": "بهارستان",
};

async function main() {
  await db.connect();
  await db.query(readFileSync("db/schema.sql", "utf8"));

  await load("shops.csv", "shops", (r) => {
    const hours = json(r.weekly_hours);
    const pay: { provider_name?: string }[] = json(r.payment_options) ?? [];
    const providers = pay.map((p) => p.provider_name).filter((p): p is string => !!p);
    const cats: string[] = json(r.category_names) ?? [];
    return {
      shop_id: r.shop_id,
      name: r.name,
      address: nil(r.address),
      location_label: nil(r.location_label),
      lat: +r.lat,
      lon: +r.lon,
      category_names: json(r.category_names),
      contacts: json(r.contacts),
      payment_options: json(r.payment_options),
      weekly_hours: hours,
      website_url: nil(r.website_url),
      instagram: nil(r.instagram),
      fast_delivery: nil(r.supports_fast_delivery) === null ? null : r.supports_fast_delivery === "true",
      ...addr(r.address),
      torobpay: pay.length ? providers.includes("ترب‌پی") : null,
      installment_providers: providers.filter((p) => p !== "ترب‌پی"),
      has_hours: hasRealHours(hours),
      is_real_name: !!(nil(r.instagram) || nil(r.website_url)),
      categories_norm: normalizeFa(cats.join(" | ")),
    };
  });

  await load("products.csv", "products", (r) => ({
    product_id: r.product_id,
    title: r.persian_title,
    title_norm: normalizeFa(`${r.persian_title} ${nil(r.model) ?? ""} ${nil(r.brand_name) ?? ""}`),
    brand: nil(r.brand_name),
    category: nil(r.category_name),
    category_norm: normalizeFa(r.category_name),
    model: nil(r.model),
    image_urls: json(r.image_urls),
    specs: json(r.specs),
  }));

  await load("offers.csv", "offers", (r) => ({
    offer_id: r.offer_id,
    shop_id: r.shop_id,
    product_id: r.product_id,
    seller_title: nil(r.seller_title),
    seller_norm: normalizeFa(r.seller_title),
    description: nil(r.description),
    price_toman: nil(r.price_toman) === null ? null : Math.round(+r.price_toman),
    last_price_changed_at: nil(r.last_price_changed_at),
    warranty: json(r.warranty),
  }));

  // Per-shop signals from its offers: catalogue size, warranty coverage, how fresh its prices usually are.
  await db.query(`
    UPDATE shops s SET offers_count = x.n, warranty_share = x.w, price_median_at = x.m
    FROM (
      SELECT shop_id, count(*)::int n,
        avg((warranty IS NOT NULL AND warranty->>'provider' <> 'بدون گارانتی')::int)::real w,
        percentile_disc(0.5) WITHIN GROUP (ORDER BY last_price_changed_at) m
      FROM offers GROUP BY shop_id
    ) x WHERE x.shop_id = s.shop_id`);

  // One display name per building: the most common spelling of its key.
  await db.query(`
    UPDATE shops s SET mall = c.name
    FROM (SELECT mall_key, mode() WITHIN GROUP (ORDER BY mall) name FROM shops WHERE mall_key IS NOT NULL GROUP BY 1) c
    WHERE s.mall_key = c.mall_key`);

  // Area centroids from the shops' own labels: no external geocoder.
  const { rows } = await db.query(
    `SELECT location_label AS name, avg(lat) lat, avg(lon) lon, count(*)::int shop_count
     FROM shops WHERE location_label IS NOT NULL GROUP BY 1`,
  );
  for (const a of rows)
    await db.query(`INSERT INTO areas VALUES ($1,$2,$3,$4,$5)`, [a.name, normalizeFa(a.name), a.lat, a.lon, a.shop_count]);
  for (const [alias, label] of Object.entries(AREA_ALIASES))
    await db.query(`INSERT INTO areas SELECT $1, $2, lat, lon, shop_count FROM areas WHERE name = $3`, [alias, normalizeFa(alias), label]);
  console.log(`areas: ${rows.length} + ${Object.keys(AREA_ALIASES).length} aliases`);

  // Where each category is concentrated («بورس»): malls first, else the area label. Top 5, ≥3 shops.
  await db.query(`
    CREATE TABLE category_hubs AS
    SELECT category, name, kind, shops, lat, lon, rank FROM (
      SELECT c.category, coalesce(s.mall, s.location_label) name,
        CASE WHEN s.mall IS NOT NULL THEN 'mall' ELSE 'area' END kind,
        count(*)::int shops, avg(s.lat) lat, avg(s.lon) lon,
        row_number() OVER (PARTITION BY c.category ORDER BY count(*) DESC)::int rank
      FROM shops s, jsonb_array_elements_text(s.category_names) c(category)
      WHERE coalesce(s.mall, s.location_label) IS NOT NULL
      GROUP BY 1, 2, 3
    ) h WHERE rank <= 5 AND shops >= 3`);
  const hubs = await db.query("SELECT count(*)::int n, count(DISTINCT category)::int c FROM category_hubs");
  console.log(`category_hubs: ${hubs.rows[0].n} hubs for ${hubs.rows[0].c} categories`);

  await db.query(readFileSync("db/indexes.sql", "utf8"));
  console.log("indexes done");
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
