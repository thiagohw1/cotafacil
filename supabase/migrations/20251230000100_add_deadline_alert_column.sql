-- Add column to track if deadline alert has been sent
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS deadline_alert_sent BOOLEAN DEFAULT FALSE;

-- Index for performance when querying pending alerts
CREATE INDEX IF NOT EXISTS idx_quotes_deadline_alert 
ON public.quotes(deadline_at, status, deadline_alert_sent);
