-- EV-06: Disparo automático do relatório mensal via pg_cron + pg_net
--
-- ⚠️  APLICAR MANUALMENTE no Supabase SQL Editor:
--     Dashboard → SQL Editor → cole este arquivo inteiro → Run
--
-- Pré-requisitos:
--   1. Edge Function `relatorio-mensal` já deployada (Supabase Dashboard → Edge Functions)
--   2. Secret CRON_SECRET definido via Supabase CLI:
--        supabase secrets set CRON_SECRET=<gere uma string aleatória longa>
--   3. Extensões pg_cron e pg_net habilitadas no projeto.
--
-- Preencha os dois valores abaixo antes de rodar:
--   PROJECT_REF  → disponível na URL do dashboard: app.supabase.com/project/<PROJECT_REF>
--   CRON_SECRET  → o mesmo valor que você usou no `supabase secrets set` acima

-- ── Configuração — edite aqui ──────────────────────────────────────────────
DO $$
DECLARE
  v_project_ref  text := 'ptlgcyqmzwhwrooaxcjk';  -- ← seu project ref
  v_cron_secret  text := 'SUBSTITUA_PELO_CRON_SECRET'; -- ← mesmo valor do secret
  v_base_url     text;
BEGIN
  v_base_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/relatorio-mensal';

  -- Agenda: todo dia 1 às 06:30 UTC (03:30 BRT) — 30 min após a geração de mensalidades
  PERFORM cron.schedule(
    'relatorio-mensal-dia-1',
    '30 6 1 * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',    'application/json',
          'x-cron-secret',   %L
        ),
        body    := jsonb_build_object('patota_id', id)
      )
      FROM public.patota;
      $cmd$,
      v_base_url,
      v_cron_secret
    )
  );
END $$;
