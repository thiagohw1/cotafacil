-- Make email optional in suppliers table
ALTER TABLE public.suppliers ALTER COLUMN email DROP NOT NULL;
