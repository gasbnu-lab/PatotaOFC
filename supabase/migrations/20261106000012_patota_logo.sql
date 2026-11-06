-- Coluna para URL da logo da patota (armazenada no Supabase Storage)
ALTER TABLE patota ADD COLUMN IF NOT EXISTS logo_url text;

-- Bucket público para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

-- Escrita restrita ao admin da patota dona do arquivo
-- O path segue o padrão "patota-{id}.{ext}", ex: patota-42.png
DROP POLICY IF EXISTS "logos_admin_write" ON storage.objects;
CREATE POLICY "logos_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM patota p
      JOIN usuarios u ON u.patota_id = p.id
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND ('patota-' || p.id::text) = split_part(name, '.', 1)
    )
  );

DROP POLICY IF EXISTS "logos_admin_update" ON storage.objects;
CREATE POLICY "logos_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM patota p
      JOIN usuarios u ON u.patota_id = p.id
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND ('patota-' || p.id::text) = split_part(name, '.', 1)
    )
  );

DROP POLICY IF EXISTS "logos_admin_delete" ON storage.objects;
CREATE POLICY "logos_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM patota p
      JOIN usuarios u ON u.patota_id = p.id
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND ('patota-' || p.id::text) = split_part(name, '.', 1)
    )
  );
