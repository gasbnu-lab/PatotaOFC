-- PERF-01: índice para o join do Ranking (jogo_estatisticas → jogos.patota_id)
CREATE INDEX IF NOT EXISTS idx_jogos_patota_id ON public.jogos (patota_id);
