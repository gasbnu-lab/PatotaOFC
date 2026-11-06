-- Policy de leitura para mensalidades
DO $$ BEGIN
  CREATE POLICY "mensalidades: admin select"
    ON mensalidades FOR SELECT
    USING (public.is_patota_admin(patota_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
