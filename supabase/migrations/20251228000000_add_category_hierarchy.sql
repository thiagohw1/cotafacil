-- Add parent_id and level to categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES public.categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1 CHECK (level > 0 AND level <= 5);

-- Create index for parent_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Function to calculate level automatically
CREATE OR REPLACE FUNCTION public.calculate_category_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 1;
  ELSE
    -- Calculate level based on parent
    SELECT level + 1 INTO NEW.level FROM public.categories WHERE id = NEW.parent_id;
    
    -- Handle case where parent level is null (shouldn't happen with default 1 but safety first)
    IF NEW.level IS NULL THEN
       NEW.level := 2; -- Fallback if parent exists but level is weird, though FK ensures parent exists
    END IF;
  END IF;
  
  -- Enforce 5 level limit
  IF NEW.level > 5 THEN
    RAISE EXCEPTION 'Maximum category depth of 5 exceeded. Current level calculated: %', NEW.level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain level
DROP TRIGGER IF EXISTS trigger_calculate_category_level ON public.categories;
CREATE TRIGGER trigger_calculate_category_level
BEFORE INSERT OR UPDATE OF parent_id ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.calculate_category_level();

-- Optional: Update existing categories to be level 1 (default handles new ones, but explicit update is good if column was added to existing data without default)
UPDATE public.categories SET level = 1 WHERE level IS NULL;
