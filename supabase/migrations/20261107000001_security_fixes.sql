-- SEC-01+02: Corrigir RLS de presencas (remover políticas abertas)
DROP POLICY IF EXISTS "presencas: public insert" ON presencas;
DROP POLICY IF EXISTS "presencas: public update" ON presencas;

-- INSERT: convidado (jogador_id IS NULL) ou usuário autenticado inserindo o próprio jogador, ou admin
CREATE POLICY "presencas: self insert" ON presencas
  FOR INSERT WITH CHECK (
    jogador_id IS NULL   -- flow de convidado por nome
    OR (
      auth.uid() IS NOT NULL
      AND jogador_id IN (
        SELECT j.id FROM jogadores j
        JOIN usuarios u ON lower(u.email) = lower(j.email)
        WHERE u.id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM jogos jo
      WHERE jo.id = jogo_id
      AND public.is_patota_admin(jo.patota_id)
    )
  );

-- UPDATE: usuário autenticado atualizando a própria presença
-- (admin update já existe em migration 20261106000013)
CREATE POLICY "presencas: self update" ON presencas
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND jogador_id IN (
      SELECT j.id FROM jogadores j
      JOIN usuarios u ON lower(u.email) = lower(j.email)
      WHERE u.id = auth.uid()
    )
  );

-- SEC-05: Adicionar política self insert/delete em churrasco_participantes
-- (admin insert/update/delete já existem em migration 20261106000007)
CREATE POLICY "churrasco_participantes: self insert" ON churrasco_participantes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      jogador_id IS NULL  -- avulso/convidado
      OR jogador_id IN (
        SELECT j.id FROM jogadores j
        JOIN usuarios u ON lower(u.email) = lower(j.email)
        WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY "churrasco_participantes: self delete" ON churrasco_participantes
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND jogador_id IN (
      SELECT j.id FROM jogadores j
      JOIN usuarios u ON lower(u.email) = lower(j.email)
      WHERE u.id = auth.uid()
    )
  );

-- SEC-03+04: Colunas auxiliares em codigos_verificacao
ALTER TABLE codigos_verificacao
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0;
