-- Enable the unaccent extension
create extension if not exists unaccent;

-- Add name_clean column to suppliers
alter table suppliers add column if not exists name_clean text;

-- Add name_clean column to products
alter table products add column if not exists name_clean text;

-- Create function to update name_clean
create or replace function update_name_clean()
returns trigger as $$
begin
  -- Update name_clean with unaccented lowercase name
  new.name_clean := unaccent(lower(new.name));
  return new;
end;
$$ language plpgsql;

-- Create trigger for suppliers
drop trigger if exists update_suppliers_name_clean on suppliers;
create trigger update_suppliers_name_clean
before insert or update on suppliers
for each row execute function update_name_clean();

-- Create trigger for products
drop trigger if exists update_products_name_clean on products;
create trigger update_products_name_clean
before insert or update on products
for each row execute function update_name_clean();

-- Backfill existing data
update suppliers set name_clean = unaccent(lower(name)) where name_clean is null;
update products set name_clean = unaccent(lower(name)) where name_clean is null;

-- Create indexes for faster searching
create index if not exists suppliers_name_clean_idx on suppliers(name_clean);
create index if not exists products_name_clean_idx on products(name_clean);
