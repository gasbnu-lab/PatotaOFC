-- Recria sortear_times compatível com o schema real (sem tipo formato_jogo)
CREATE OR REPLACE FUNCTION public.sortear_times(
  p_jogo_id uuid,
  p_num_times integer DEFAULT NULL
)
RETURNS TABLE(
  time_label text,
  jogador_id uuid,
  convidado_id uuid,
  nome text,
  rating integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_patota_id integer;
  v_pessoa    record;
  v_time_atual int := 1;
  v_direcao    int := 1;
  v_labels     text[] := array['A','B','C','D','E','F'];
  v_total      int;
  v_num_times  int;
BEGIN
  -- Busca patota_id do jogo
  SELECT g.patota_id INTO v_patota_id
  FROM public.jogos g WHERE g.id = p_jogo_id;

  IF v_patota_id IS NULL THEN
    RAISE EXCEPTION 'jogo não encontrado';
  END IF;

  -- Verifica se é admin
  IF NOT (SELECT public.is_patota_admin(v_patota_id)) THEN
    RAISE EXCEPTION 'apenas admin pode sortear times';
  END IF;

  -- Conta total de confirmados (jogadores + convidados aprovados)
  SELECT count(*) INTO v_total
  FROM public.presencas p
  WHERE p.jogo_id = p_jogo_id
    AND p.confirmado = true
    AND (p.convidado = false OR p.convidado IS NULL OR p.aprovado = true);

  v_num_times := COALESCE(
    p_num_times,
    GREATEST(2, LEAST(6, ROUND(v_total::numeric / 5)::int))
  );

  -- Remove sorteio anterior
  DELETE FROM public.sorteio_times WHERE sorteio_times.jogo_id = p_jogo_id;

  -- Distribui serpentine por nota (maior primeiro)
  FOR v_pessoa IN
    SELECT * FROM (
      SELECT
        p.jogador_id                                             AS jid,
        NULL::uuid                                               AS cid,
        COALESCE(j.nota, 3)                                      AS rating,
        j.nome                                                   AS nome
      FROM public.presencas p
      JOIN public.jogadores j ON j.id = p.jogador_id
      WHERE p.jogo_id = p_jogo_id
        AND p.confirmado = true
        AND (p.convidado = false OR p.convidado IS NULL)
      UNION ALL
      SELECT
        NULL::uuid,
        p.id,
        COALESCE(p.rating_convidado, p.rating_habilidade, 3),
        COALESCE(p.nome_convidado, 'Convidado')
      FROM public.presencas p
      WHERE p.jogo_id = p_jogo_id
        AND p.confirmado = true
        AND p.convidado = true
        AND p.aprovado = true
    ) sub
    ORDER BY rating DESC, random()
  LOOP
    INSERT INTO public.sorteio_times (jogo_id, patota_id, time_label, jogador_id, convidado_id, nome, rating)
    VALUES (p_jogo_id, v_patota_id, v_labels[v_time_atual], v_pessoa.jid, v_pessoa.cid, v_pessoa.nome, v_pessoa.rating);

    time_label   := v_labels[v_time_atual];
    jogador_id   := v_pessoa.jid;
    convidado_id := v_pessoa.cid;
    nome         := v_pessoa.nome;
    rating       := v_pessoa.rating;
    RETURN NEXT;

    v_time_atual := v_time_atual + v_direcao;
    IF v_time_atual > v_num_times THEN v_time_atual := v_num_times; v_direcao := -1;
    ELSIF v_time_atual < 1 THEN v_time_atual := 1; v_direcao := 1;
    END IF;
  END LOOP;

  RETURN;
END;
$$;
