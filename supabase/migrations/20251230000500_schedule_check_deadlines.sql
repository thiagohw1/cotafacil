-- Enable the pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the check-deadlines function to run every hour
-- NOTE: You need to replace PROJECT_REF and ANON_KEY with actual values if running manually, 
-- but ideally this is handled by Supabase Dashboard "Database Webhooks" or "Cron" UI.
-- However, for a pure SQL approach using pg_net to call the function:

SELECT cron.schedule(
  'check-deadlines-hourly', -- name of the cron job
  '0 * * * *',              -- every hour
  $$
  select
      net.http_post(
          url:='https://PLACEHOLDER_PROJECT_REF.supabase.co/functions/v1/check-deadlines',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer PLACEHOLDER_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
  $$
);

-- IMPORTANT: The user must replace PLACEHOLDER_PROJECT_REF and PLACEHOLDER_SERVICE_ROLE_KEY 
-- manually in the Supabase Dashboard SQL Editor, as we don't want to commit secrets or assume IDs here.
