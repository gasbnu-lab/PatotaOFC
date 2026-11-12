-- Garante que admin pode ler presencas do seu jogo no modal de estatísticas
-- A política leitura_publica pode ter sido removida durante hardening de segurança

DO $$ BEGIN
  CREATE POLICY "presencas: admin select"
    ON public.presencas FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.jogos j
        WHERE j.id = presencas.jogo_id
          AND public.is_patota_admin(j.patota_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Garante que jogador autenticado pode ler próprias presenças (já existe via leitura_publica mas reforça)
DO $$ BEGIN
  CREATE POLICY "presencas: self select"
    ON public.presencas FOR SELECT
    USING (
      jogador_id IN (
        SELECT j.id FROM public.jogadores j
        JOIN public.usuarios u ON lower(u.email) = lower(j.email)
        WHERE u.id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
