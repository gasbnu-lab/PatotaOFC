-- Policy de leitura para mensalidades (estava faltando — sem ela o SELECT retorna vazio)
CREATE POLICY "mensalidades: admin select"
  ON mensalidades FOR SELECT
  USING (public.is_patota_admin(patota_id));
