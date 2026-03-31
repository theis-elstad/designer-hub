-- Migration: Creative Strategist tables
-- Builds on existing adgen_brand_research and adgen_product_research

-- ─────────────────────────────────────────
-- Saved Brands
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_brands (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  brand_name  TEXT NOT NULL,
  domain      TEXT NOT NULL,
  guidelines  JSONB NOT NULL DEFAULT '[]',  -- array of rule strings
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cs_brands_user_id_idx ON cs_brands(user_id);
CREATE INDEX IF NOT EXISTS cs_brands_domain_idx ON cs_brands(domain);

ALTER TABLE cs_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own brands" ON cs_brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brands" ON cs_brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brands" ON cs_brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brands" ON cs_brands FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cs_brands_updated_at
  BEFORE UPDATE ON cs_brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────
-- Saved Products / Collections per Brand
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_products (
  id          TEXT PRIMARY KEY,
  brand_id    TEXT NOT NULL REFERENCES cs_brands(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'product',  -- 'product' | 'collection'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cs_products_brand_id_idx ON cs_products(brand_id);
CREATE INDEX IF NOT EXISTS cs_products_user_id_idx ON cs_products(user_id);

ALTER TABLE cs_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own products" ON cs_products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON cs_products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON cs_products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON cs_products FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cs_products_updated_at
  BEFORE UPDATE ON cs_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────
-- Customer Avatars per Brand
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cs_avatars (
  id              TEXT PRIMARY KEY,
  brand_id        TEXT NOT NULL REFERENCES cs_brands(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  research        JSONB NOT NULL DEFAULT '{}',
  products_used   TEXT[] NOT NULL DEFAULT '{}',  -- array of cs_products IDs
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cs_avatars_brand_id_idx ON cs_avatars(brand_id);
CREATE INDEX IF NOT EXISTS cs_avatars_user_id_idx ON cs_avatars(user_id);

ALTER TABLE cs_avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own avatars" ON cs_avatars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own avatars" ON cs_avatars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own avatars" ON cs_avatars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own avatars" ON cs_avatars FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cs_avatars_updated_at
  BEFORE UPDATE ON cs_avatars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
