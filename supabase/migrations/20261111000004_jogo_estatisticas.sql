-- Tabela de estatísticas por jogo (gols, assistências, gols sofridos)
-- Lançadas pelo admin após o jogo; convidados referenciados via presencas.id
CREATE TABLE IF NOT EXISTS public.jogo_estatisticas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id      uuid NOT NULL REFERENCES public.jogos(id) ON DELETE CASCADE,
  jogador_id   uuid REFERENCES public.jogadores(id) ON DELETE CASCADE,
  presenca_id  uuid REFERENCES public.presencas(id) ON DELETE CASCADE,
  gols         int NOT NULL DEFAULT 0,
  assistencias int NOT NULL DEFAULT 0,
  gols_sofridos int NOT NULL DEFAULT 0,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_jogador_ou_convidado CHECK (
    (jogador_id IS NOT NULL AND presenca_id IS NULL) OR
    (jogador_id IS NULL AND presenca_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS jogo_estat_jogador_idx ON public.jogo_estatisticas (jogo_id, jogador_id) WHERE jogador_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jogo_estat_presenca_idx ON public.jogo_estatisticas (jogo_id, presenca_id) WHERE presenca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jogo_estat_jogo_id_idx ON public.jogo_estatisticas (jogo_id);

ALTER TABLE public.jogo_estatisticas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_estat" ON public.jogo_estatisticas
  FOR SELECT USING (
    public.is_patota_admin((SELECT patota_id FROM public.jogos WHERE id = jogo_id))
  );

CREATE POLICY "admin_insert_estat" ON public.jogo_estatisticas
  FOR INSERT WITH CHECK (
    public.is_patota_admin((SELECT patota_id FROM public.jogos WHERE id = jogo_id))
  );

CREATE POLICY "admin_update_estat" ON public.jogo_estatisticas
  FOR UPDATE USING (
    public.is_patota_admin((SELECT patota_id FROM public.jogos WHERE id = jogo_id))
  );

CREATE POLICY "admin_delete_estat" ON public.jogo_estatisticas
  FOR DELETE USING (
    public.is_patota_admin((SELECT patota_id FROM public.jogos WHERE id = jogo_id))
  );
