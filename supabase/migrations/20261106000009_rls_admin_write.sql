-- RLS de escrita admin para tabelas principais
-- jogadores
CREATE POLICY "jogadores: admin insert"
  ON jogadores FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "jogadores: admin update"
  ON jogadores FOR UPDATE
  USING (public.is_patota_admin(patota_id));

CREATE POLICY "jogadores: admin delete"
  ON jogadores FOR DELETE
  USING (public.is_patota_admin(patota_id));

-- jogos
CREATE POLICY "jogos: admin insert"
  ON jogos FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "jogos: admin update"
  ON jogos FOR UPDATE
  USING (public.is_patota_admin(patota_id));

CREATE POLICY "jogos: admin delete"
  ON jogos FOR DELETE
  USING (public.is_patota_admin(patota_id));

-- mensalidades
CREATE POLICY "mensalidades: admin insert"
  ON mensalidades FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "mensalidades: admin update"
  ON mensalidades FOR UPDATE
  USING (public.is_patota_admin(patota_id));

CREATE POLICY "mensalidades: admin delete"
  ON mensalidades FOR DELETE
  USING (public.is_patota_admin(patota_id));

-- sorteios
CREATE POLICY "sorteios: admin insert"
  ON sorteios FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "sorteios: admin update"
  ON sorteios FOR UPDATE
  USING (public.is_patota_admin(patota_id));

CREATE POLICY "sorteios: admin delete"
  ON sorteios FOR DELETE
  USING (public.is_patota_admin(patota_id));
