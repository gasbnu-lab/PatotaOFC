-- EV-05: Geração automática de mensalidades via pg_cron
--
-- ⚠️  APLICAR MANUALMENTE no Supabase SQL Editor:
--     Dashboard → SQL Editor → cole este arquivo inteiro → Run
--
-- Este arquivo usa pg_cron, que não pode ser executado via CLI de migrations.
-- As migrations normais (via Supabase CLI) NÃO suportam cron.schedule().

-- ── 1. Constraint única para suportar ON CONFLICT na geração ──────────────
ALTER TABLE public.mensalidades
  ADD CONSTRAINT IF NOT EXISTS mensalidades_jogador_mes_uniq
    UNIQUE (jogador_id, mes_ref);

-- ── 2. Função de geração de mensalidades do mês atual ────────────────────
CREATE OR REPLACE FUNCTION public.gerar_mensalidades_mes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  mes_atual text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-01');
BEGIN
  INSERT INTO public.mensalidades (jogador_id, patota_id, mes_ref, pago, valor)
  SELECT
    j.id,
    j.patota_id,
    mes_atual,
    false,
    CASE j.plano_mensalidade
      WHEN 'com_churrasco' THEN COALESCE(p.valor_mensalidade_com_churrasco, p.valor_mensalidade, 0)
      WHEN 'sem_churrasco' THEN COALESCE(p.valor_mensalidade_sem_churrasco, p.valor_mensalidade, 0)
      ELSE COALESCE(p.valor_mensalidade, 0)
    END
  FROM public.jogadores j
  JOIN public.patota p ON p.id = j.patota_id
  WHERE j.ativo = true
    AND j.isento = false
  ON CONFLICT (jogador_id, mes_ref) DO NOTHING;
END;
$$;

-- ── 3. Agendar no pg_cron: todo dia 1 às 03:00 (Supabase usa UTC) ────────
-- São Paulo é UTC-3, então 03:00 BRT = 06:00 UTC
SELECT cron.schedule(
  'gerar-mensalidades-dia-1',
  '0 6 1 * *',
  $$ SELECT public.gerar_mensalidades_mes(); $$
);

-- ── Nota sobre cron de "atrasado" ────────────────────────────────────────
-- O status "atrasado" é calculado dinamicamente no frontend via statusMens().
-- Não há coluna de status no banco; nenhum cron adicional é necessário.
-- Se futuramente o status for persistido no banco, adicionar cron aqui.
