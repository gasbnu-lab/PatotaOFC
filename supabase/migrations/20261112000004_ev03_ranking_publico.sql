-- EV-03: ranking_publico opt-in na patota + RPC lideranca_publica

-- Coluna opt-in de ranking público
ALTER TABLE public.patota
  ADD COLUMN IF NOT EXISTS ranking_publico boolean NOT NULL DEFAULT false;

-- RPC SECURITY DEFINER: retorna 3 líderes sem expor tabela raw
-- Chamada pela página pública quando ranking_publico = true
CREATE OR REPLACE FUNCTION public.lideranca_publica(p_patota_id integer)
RETURNS TABLE (
  categoria  text,
  nome       text,
  total      integer,
  jogos      integer,
  media      numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      je.jogador_id,
      jg.nome,
      COUNT(*)::int                   AS n_jogos,
      SUM(je.gols)::int               AS gols,
      SUM(je.gols_sofridos)::int      AS gols_sofridos,
      SUM(je.canetas)::int            AS canetas
    FROM public.jogo_estatisticas je
    JOIN public.jogos jj ON jj.id = je.jogo_id
    JOIN public.jogadores jg ON jg.id = je.jogador_id
    WHERE jj.patota_id = p_patota_id
      AND je.jogador_id IS NOT NULL
    GROUP BY je.jogador_id, jg.nome
  ),
  artilheiro AS (
    SELECT nome, gols AS total, n_jogos,
           ROUND(gols::numeric / NULLIF(n_jogos, 0), 2) AS media
    FROM stats ORDER BY media DESC NULLS LAST, nome LIMIT 1
  ),
  menos_vazado AS (
    SELECT nome, gols_sofridos AS total, n_jogos,
           ROUND(gols_sofridos::numeric / NULLIF(n_jogos, 0), 2) AS media
    FROM stats ORDER BY media ASC NULLS LAST, nome LIMIT 1
  ),
  mais_coca AS (
    SELECT nome, canetas AS total, n_jogos,
           ROUND(canetas::numeric / NULLIF(n_jogos, 0), 2) AS media
    FROM stats ORDER BY media DESC NULLS LAST, nome LIMIT 1
  )
  SELECT 'artilheiro'::text,   a.nome, a.total, a.n_jogos, a.media FROM artilheiro a
  UNION ALL
  SELECT 'menos_vazado'::text, v.nome, v.total, v.n_jogos, v.media FROM menos_vazado v
  UNION ALL
  SELECT 'mais_coca'::text,    c.nome, c.total, c.n_jogos, c.media FROM mais_coca c;
END;
$$;

-- Permite chamada anônima (página pública usa anon key)
GRANT EXECUTE ON FUNCTION public.lideranca_publica(integer) TO anon, authenticated;
