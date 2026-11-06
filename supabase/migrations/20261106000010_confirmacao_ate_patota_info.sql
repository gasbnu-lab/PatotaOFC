-- Data-limite para confirmar presença em cada jogo
ALTER TABLE jogos ADD COLUMN IF NOT EXISTS confirmacao_ate timestamptz;

-- Informações extras da patota (exibidas na página pública)
ALTER TABLE patota ADD COLUMN IF NOT EXISTS local_fixo   text;
ALTER TABLE patota ADD COLUMN IF NOT EXISTS horario_fixo text;
ALTER TABLE patota ADD COLUMN IF NOT EXISTS recado       text;

-- Jogadores isentos de mensalidade (ex: goleiro que não paga)
ALTER TABLE jogadores ADD COLUMN IF NOT EXISTS isento boolean NOT NULL DEFAULT false;
