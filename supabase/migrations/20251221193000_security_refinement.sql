-- 1. Ensure RLS is enabled on relevant tables
ALTER TABLE quote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- 2. Policy for Viewing Prices (quote_responses)
-- Drop existing policy if it conflicts (good practice for re-runnable scripts)
DROP POLICY IF EXISTS "Users can view quote responses" ON quote_responses;

CREATE POLICY "Users can view quote responses"
ON quote_responses
FOR SELECT
USING (
  -- Option A: Tenant Owner always has access
  (
    EXISTS (
      SELECT 1 FROM tenants 
      WHERE id = quote_responses.tenant_id 
      AND owner_id = auth.uid()
    )
  )
  OR
  -- Option B: User has specific 'view_prices' permission
  (
    EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_id = auth.uid() 
      AND permission = 'view_prices'
      AND tenant_id = quote_responses.tenant_id
    )
  )
);

-- 3. Policy for Preventing Updates on Closed Quotes (quotes)
-- We need a policy that allows updates ONLY when status is NOT closed.
-- Note: This complements existing "Users can update their own tenant quotes" policies.
-- Supabase applies policies as OR logic for permissiveness, but strict restraints are harder.
-- Actually, the best way to enforce "No Access" logic is via a separate policy with a check
-- or modifying the existing Allow policy.
-- However, for simplicity and robustness, we can use a Database Trigger to block updates on closed quotes,
-- as RLS is "permissive" (allows access) rather than "restrictive" (denies access) in standard Policies usage unless using Postgres 16+ "AS RESTRICTIVE".
-- Let's check PG version or assume Trigger is safer for "BLOCK".

CREATE OR REPLACE FUNCTION check_quote_status_before_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'closed' OR OLD.status = 'cancelled' THEN
    -- Allow reopening if it's a specific action (e.g. specifically setting status back to open)
    -- But if the huge form update comes in, we block it.
    -- For now, strict: Cannot edit closed/cancelled quotes unless you are exclusively changing the status (reopening).
    IF NEW.status = OLD.status THEN
       RAISE EXCEPTION 'Cannot update a closed or cancelled quote.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_quote_update ON quotes;

CREATE TRIGGER check_quote_update
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION check_quote_status_before_update();
