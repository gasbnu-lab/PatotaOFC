-- Adiciona campo canetas levadas em jogo_estatisticas
ALTER TABLE public.jogo_estatisticas
  ADD COLUMN IF NOT EXISTS canetas int NOT NULL DEFAULT 0;
