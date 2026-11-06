-- Corrige RLS de presencas: a coluna patota_id não existe em presencas,
-- o acesso à patota se dá via jogo_id → jogos.patota_id

-- Remove policies com referência inválida a patota_id
DROP POLICY IF EXISTS "presencas: admin delete" ON presencas;

-- Recria corretamente via join em jogos
CREATE POLICY "presencas: admin delete"
  ON presencas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jogos j
      WHERE j.id = presencas.jogo_id
        AND public.is_patota_admin(j.patota_id)
    )
  );

-- Também adiciona policy de UPDATE para admin poder aprovar convidados
DROP POLICY IF EXISTS "presencas: admin update" ON presencas;

CREATE POLICY "presencas: admin update"
  ON presencas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jogos j
      WHERE j.id = presencas.jogo_id
        AND public.is_patota_admin(j.patota_id)
    )
  );
