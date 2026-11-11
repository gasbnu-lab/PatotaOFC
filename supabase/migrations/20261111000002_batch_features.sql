-- Presencas: campos para convidado (posicao + rating 1-5)
ALTER TABLE presencas
  ADD COLUMN IF NOT EXISTS posicao_convidado text CHECK (posicao_convidado IN ('goleiro','linha','qualquer')),
  ADD COLUMN IF NOT EXISTS rating_convidado  int  CHECK (rating_convidado BETWEEN 1 AND 5);

-- Churrascos: controle de encerramento
ALTER TABLE churrascos
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz;
