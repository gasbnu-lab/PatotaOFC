-- Coluna para URL da logo da patota (armazenada no Supabase Storage)
alter table patota add column if not exists logo_url text;

-- Bucket público para logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Política de leitura pública
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

-- Política de upload/update para admin autenticado
create policy "logos_admin_write" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and auth.role() = 'authenticated'
  );

create policy "logos_admin_update" on storage.objects
  for update using (
    bucket_id = 'logos'
    and auth.role() = 'authenticated'
  );

create policy "logos_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and auth.role() = 'authenticated'
  );
