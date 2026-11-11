-- EV-01: RLS self-select para mensalidades e jogo_estatisticas
-- Permite que o jogador logado leia seus próprios dados

-- mensalidades: jogador pode ler as próprias linhas (via usuario_id → jogadores.id)
DO $$ BEGIN
  CREATE POLICY "mensalidades: self select"
    ON public.mensalidades FOR SELECT
    USING (
      jogador_id IN (
        SELECT id FROM public.jogadores WHERE usuario_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- jogo_estatisticas: jogador pode ler suas próprias estatísticas
DO $$ BEGIN
  CREATE POLICY "jogo_estat: self select"
    ON public.jogo_estatisticas FOR SELECT
    USING (
      jogador_id IN (
        SELECT id FROM public.jogadores WHERE usuario_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
