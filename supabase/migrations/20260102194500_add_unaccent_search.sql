-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add name_search column if it doesn't exist
-- We use a DO block to check for column existence safely or just use ALTER TABLE IF NOT EXISTS logic where supported, 
-- but consistent idempotent SQL is better.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name_search') THEN
        ALTER TABLE products ADD COLUMN name_search text;
    END IF;
END $$;

-- Create or replace function to update search column
CREATE OR REPLACE FUNCTION update_product_name_search()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize: unaccent and lowercase
  NEW.name_search := unaccent(lower(NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to recreate it cleanly
DROP TRIGGER IF EXISTS tr_product_name_search ON products;

-- Create trigger
CREATE TRIGGER tr_product_name_search
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_product_name_search();

-- Backfill existing data
UPDATE products SET name_search = unaccent(lower(name)) WHERE name_search IS NULL;
