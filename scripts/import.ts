// Load the Torob CSVs into Postgres. Usage: DATABASE_URL=... npm run import [dataDir]
import { createReadStream, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse";
import { Client } from "pg";
import { normalizeFa } from "../src/lib/normalize";
import { parseAddress } from "../src/lib/address";

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

function hasDeclaredHours(h: Record<string, { status: string }> | null) {
  return !!h && Object.values(h).some((d) => d?.status === "declared");
}

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
      ...parseAddress(r.address),
      torobpay: pay.length ? providers.includes("ترب‌پی") : null,
      installment_providers: providers.filter((p) => p !== "ترب‌پی"),
      has_hours: hasDeclaredHours(hours),
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

  // Area centroids from the shops' own labels: no external geocoder.
  const { rows } = await db.query(
    `SELECT location_label AS name, avg(lat) lat, avg(lon) lon, count(*)::int shop_count
     FROM shops WHERE location_label IS NOT NULL GROUP BY 1`,
  );
  for (const a of rows)
    await db.query(`INSERT INTO areas VALUES ($1,$2,$3,$4,$5)`, [a.name, normalizeFa(a.name), a.lat, a.lon, a.shop_count]);
  console.log(`areas: ${rows.length}`);

  await db.query(readFileSync("db/indexes.sql", "utf8"));
  console.log("indexes done");
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
