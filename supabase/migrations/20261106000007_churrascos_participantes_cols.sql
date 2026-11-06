-- Adiciona colunas de pagamento em churrasco_participantes
ALTER TABLE churrasco_participantes
  ADD COLUMN IF NOT EXISTS valor_devido numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'atrasado'));

-- RLS admin para churrascos
CREATE POLICY "churrascos: admin insert"
  ON churrascos FOR INSERT
  WITH CHECK (public.is_patota_admin(patota_id));

CREATE POLICY "churrascos: admin update"
  ON churrascos FOR UPDATE
  USING (public.is_patota_admin(patota_id));

CREATE POLICY "churrascos: admin delete"
  ON churrascos FOR DELETE
  USING (public.is_patota_admin(patota_id));

-- RLS admin para churrasco_despesas
CREATE POLICY "churrasco_despesas: admin insert"
  ON churrasco_despesas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM churrascos c
      WHERE c.id = churrasco_id AND public.is_patota_admin(c.patota_id)
    )
  );

CREATE POLICY "churrasco_despesas: admin delete"
  ON churrasco_despesas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM churrascos c
      WHERE c.id = churrasco_id AND public.is_patota_admin(c.patota_id)
    )
  );

-- RLS admin para churrasco_participantes
CREATE POLICY "churrasco_participantes: admin insert"
  ON churrasco_participantes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM churrascos c
      WHERE c.id = churrasco_id AND public.is_patota_admin(c.patota_id)
    )
  );

CREATE POLICY "churrasco_participantes: admin update"
  ON churrasco_participantes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM churrascos c
      WHERE c.id = churrasco_id AND public.is_patota_admin(c.patota_id)
    )
  );

CREATE POLICY "churrasco_participantes: admin delete"
  ON churrasco_participantes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM churrascos c
      WHERE c.id = churrasco_id AND public.is_patota_admin(c.patota_id)
    )
  );
