-- Unique constraint em lancamentos para evitar duplicação por referência
ALTER TABLE public.lancamentos
  ADD CONSTRAINT lancamentos_referencia_unique
  UNIQUE (referencia_tipo, referencia_id);

-- RPC encerrar_churrasco: lógica atômica no banco, impossível duplicar
CREATE OR REPLACE FUNCTION public.encerrar_churrasco(p_churrasco_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_patota_id   integer;
  v_data        date;
  v_desc        text;
  v_encerrado   timestamptz;
  v_despesa     record;
  v_partic      record;
  v_inseridos   int := 0;
BEGIN
  -- Busca churrasco e verifica existência
  SELECT c.patota_id, c.data, c.descricao, c.encerrado_em
    INTO v_patota_id, v_data, v_desc, v_encerrado
  FROM public.churrascos c
  WHERE c.id = p_churrasco_id;

  IF v_patota_id IS NULL THEN
    RAISE EXCEPTION 'churrasco não encontrado';
  END IF;

  -- Verifica admin
  IF NOT (SELECT public.is_patota_admin(v_patota_id)) THEN
    RAISE EXCEPTION 'apenas admin pode encerrar churrasco';
  END IF;

  -- Idempotência real: já encerrado → retorna sem erro
  IF v_encerrado IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_closed', 'encerrado_em', v_encerrado);
  END IF;

  -- Label do churrasco para descrições
  v_desc := COALESCE(v_desc, 'Churrasco ' || TO_CHAR(v_data, 'DD/MM/YYYY'));

  -- Lançar saídas para despesas (ON CONFLICT DO NOTHING: idempotente se chamado 2x)
  FOR v_despesa IN
    SELECT d.id, d.descricao, d.valor
    FROM public.churrasco_despesas d
    WHERE d.churrasco_id = p_churrasco_id
  LOOP
    INSERT INTO public.lancamentos
      (tipo, valor, descricao, data, patota_id, referencia_tipo, referencia_id)
    VALUES
      ('saida', v_despesa.valor,
       v_desc || ' — ' || v_despesa.descricao,
       v_data, v_patota_id,
       'churrasco_despesa', v_despesa.id)
    ON CONFLICT (referencia_tipo, referencia_id) DO NOTHING;
    v_inseridos := v_inseridos + 1;
  END LOOP;

  -- Lançar entradas para participantes pagos com valor > 0
  FOR v_partic IN
    SELECT p.id, p.valor_devido,
           COALESCE(j.nome, p.nome_avulso, 'Participante') AS nome
    FROM public.churrasco_participantes p
    LEFT JOIN public.jogadores j ON j.id = p.jogador_id
    WHERE p.churrasco_id = p_churrasco_id
      AND p.status = 'pago'
      AND p.valor_devido > 0
  LOOP
    INSERT INTO public.lancamentos
      (tipo, valor, descricao, data, patota_id, referencia_tipo, referencia_id)
    VALUES
      ('entrada', v_partic.valor_devido,
       v_desc || ' — ' || v_partic.nome,
       v_data, v_patota_id,
       'churrasco_participante', v_partic.id)
    ON CONFLICT (referencia_tipo, referencia_id) DO NOTHING;
    v_inseridos := v_inseridos + 1;
  END LOOP;

  -- Marcar encerrado
  UPDATE public.churrascos SET encerrado_em = now() WHERE id = p_churrasco_id;

  RETURN jsonb_build_object('status', 'ok', 'lancamentos', v_inseridos);
END;
$$;
