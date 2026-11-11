-- Adiciona usuario_id a jogadores para vínculo explícito com auth
ALTER TABLE jogadores
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para lookups rápidos
CREATE INDEX IF NOT EXISTS jogadores_usuario_id_idx ON jogadores (usuario_id);

-- Retroativamente vincular jogadores que já têm email matching a um usuário aprovado
UPDATE jogadores j
SET usuario_id = u.id
FROM usuarios u
WHERE lower(j.email) = lower(u.email)
  AND u.status = 'aprovado'
  AND j.usuario_id IS NULL
  AND j.patota_id = u.patota_id;
