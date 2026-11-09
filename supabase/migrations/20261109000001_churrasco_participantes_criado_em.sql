-- Adiciona criado_em a churrasco_participantes
-- Causa: tabela foi criada sem essa coluna, mas admin/ChurrascoPublico
-- ordenam por criado_em → PostgREST retornava erro silencioso → 0 participantes.
ALTER TABLE churrasco_participantes
  ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();
