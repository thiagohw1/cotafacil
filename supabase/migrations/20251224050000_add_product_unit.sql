-- Add unit column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit text DEFAULT 'un';

-- Comment on column
COMMENT ON COLUMN products.unit IS 'Unit of measure for the product (e.g. kg, un, l)';
