-- Adiciona colunas faltantes em presencas para suporte a convidados
ALTER TABLE presencas
  ADD COLUMN IF NOT EXISTS convidado_por_id  uuid REFERENCES jogadores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS posicao           text CHECK (posicao IN ('goleiro','linha','qualquer')),
  ADD COLUMN IF NOT EXISTS rating_habilidade int  CHECK (rating_habilidade BETWEEN 1 AND 10) DEFAULT 5;

-- RLS: leitura pública para SELECT (já existe, não duplicar)
-- INSERT: qualquer pessoa pode confirmar presença (fluxo público)
DO $$ BEGIN
  CREATE POLICY "presencas: public insert"
    ON presencas FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATE: público (confirmação de presença na tela pública)
DO $$ BEGIN
  CREATE POLICY "presencas: public update"
    ON presencas FOR UPDATE
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DELETE: somente admin da patota
DO $$ BEGIN
  CREATE POLICY "presencas: admin delete"
    ON presencas FOR DELETE
    USING (public.is_patota_admin(patota_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
