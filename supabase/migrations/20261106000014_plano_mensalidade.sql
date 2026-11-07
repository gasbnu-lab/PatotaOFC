-- Plano de mensalidade por jogador e valores configuráveis na patota

ALTER TABLE jogadores
  ADD COLUMN IF NOT EXISTS plano_mensalidade text
    CHECK (plano_mensalidade IN ('com_churrasco', 'sem_churrasco'));

ALTER TABLE patota
  ADD COLUMN IF NOT EXISTS valor_mensalidade_com_churrasco numeric DEFAULT 60,
  ADD COLUMN IF NOT EXISTS valor_mensalidade_sem_churrasco numeric DEFAULT 45,
  ADD COLUMN IF NOT EXISTS valor_adicional_churrasco numeric DEFAULT 15;
