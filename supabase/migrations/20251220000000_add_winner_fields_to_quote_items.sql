-- ============================================================================
-- Migration: Adicionar campos de vencedor em quote_items
-- Data: 2025-12-20
-- Descrição: Adiciona os campos necessários para armazenar o fornecedor
--            vencedor de cada item da cotação
-- ============================================================================

-- Adicionar campos de vencedor
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS winner_supplier_id BIGINT REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS winner_response_id BIGINT REFERENCES public.quote_responses(id),
ADD COLUMN IF NOT EXISTS winner_reason TEXT,
ADD COLUMN IF NOT EXISTS winner_set_at TIMESTAMPTZ;

-- Criar índice para melhorar performance em queries de vencedores
CREATE INDEX IF NOT EXISTS idx_quote_items_winner 
ON public.quote_items(winner_supplier_id) 
WHERE winner_supplier_id IS NOT NULL;

-- Criar índice para quote_id (usado frequentemente em joins)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id 
ON public.quote_items(quote_id);

-- Comentários para documentação
COMMENT ON COLUMN public.quote_items.winner_supplier_id IS 'ID do fornecedor vencedor para este item';
COMMENT ON COLUMN public.quote_items.winner_response_id IS 'ID da resposta vencedora (referência à quote_responses)';
COMMENT ON COLUMN public.quote_items.winner_reason IS 'Motivo da escolha do vencedor (ex: Menor Preço, Melhor Prazo, etc.)';
COMMENT ON COLUMN public.quote_items.winner_set_at IS 'Data/hora em que o vencedor foi definido';
