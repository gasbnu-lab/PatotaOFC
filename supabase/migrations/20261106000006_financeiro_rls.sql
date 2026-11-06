-- RLS para lancamentos: somente admin da patota
CREATE POLICY "lancamentos: admin select"
  ON lancamentos FOR SELECT
  USING (public.is_patota_admin(patota_id));

CREATE POLICY "lancamentos: admin insert"
  ON lancamentos FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "lancamentos: admin delete"
  ON lancamentos FOR DELETE
  USING (public.is_patota_admin(patota_id));

-- View de saldo por patota (leitura via RLS de lancamentos)
CREATE OR REPLACE VIEW v_saldo_patota AS
SELECT
  patota_id,
  COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS total_entradas,
  COALESCE(SUM(CASE WHEN tipo = 'saida'   THEN valor ELSE 0 END), 0) AS total_saidas,
  COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0) AS saldo
FROM lancamentos
GROUP BY patota_id;
