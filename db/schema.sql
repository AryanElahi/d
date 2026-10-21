CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS offers, products, shops, areas CASCADE;

CREATE TABLE shops (
  shop_id text PRIMARY KEY,
  name text NOT NULL,
  address text,
  location_label text,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  category_names jsonb,
  contacts jsonb,
  payment_options jsonb,
  weekly_hours jsonb,
  website_url text,
  instagram text,
  fast_delivery boolean,
  mall text,
  floor text,
  unit text,
  torobpay boolean,
  installment_providers text[],
  has_hours boolean NOT NULL,
  is_real_name boolean NOT NULL,
  categories_norm text
);

CREATE TABLE products (
  product_id text PRIMARY KEY,
  title text NOT NULL,
  title_norm text NOT NULL,
  brand text,
  category text,
  model text,
  image_urls jsonb,
  specs jsonb
);

CREATE TABLE offers (
  offer_id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops,
  product_id text NOT NULL REFERENCES products,
  seller_title text,
  seller_norm text,
  description text,
  price_toman bigint,
  last_price_changed_at timestamptz,
  warranty jsonb
);

CREATE TABLE areas (
  name text PRIMARY KEY,
  name_norm text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  shop_count int NOT NULL
);

-- User reports never overwrite dataset prices.
CREATE TABLE IF NOT EXISTS user_reports (
  id bigserial PRIMARY KEY,
  device_id text NOT NULL,
  offer_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('contacted','confirmed','unavailable','price_changed','bought')),
  reported_price bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
