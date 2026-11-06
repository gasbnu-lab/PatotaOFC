-- Tabela para persistir resultado do sorteio por jogo
CREATE TABLE IF NOT EXISTS sorteio_times (
  id           uuid primary key default gen_random_uuid(),
  jogo_id      uuid    not null references jogos(id) on delete cascade,
  patota_id    integer references patota(id) on delete cascade,
  time_label   text    not null,
  jogador_id   uuid    references jogadores(id) on delete set null,
  convidado_id uuid,
  nome         text    not null,
  rating       int     not null default 5,
  criado_em    timestamptz not null default now()
);

ALTER TABLE sorteio_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sorteio_times: leitura_publica"
  ON sorteio_times FOR SELECT USING (true);

CREATE POLICY "sorteio_times: admin_insert"
  ON sorteio_times FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "sorteio_times: admin_delete"
  ON sorteio_times FOR DELETE
  USING (public.is_patota_admin(patota_id));
