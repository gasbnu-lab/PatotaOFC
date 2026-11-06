-- Permite admin atualizar configurações da sua própria patota
CREATE POLICY "patota: admin update"
  ON patota FOR UPDATE
  USING (public.is_patota_admin(id));
