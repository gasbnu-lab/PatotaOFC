-- Multi-tenant auth: usuarios table + patota_id on main tables

-- Helper function to check admin role (security definer avoids RLS recursion)
create or replace function public.is_patota_admin(p_patota_id integer)
returns boolean
language plpgsql security definer
as $$
begin
  return exists (
    select 1 from public.usuarios
    where id = auth.uid()
      and patota_id = p_patota_id
      and role = 'admin'
      and status = 'aprovado'
  );
end;
$$;

-- usuarios: links Supabase Auth users to a patota
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  patota_id integer references public.patota(id) on delete cascade,
  nome text not null default '',
  email text,
  role text not null default 'membro' check (role in ('admin', 'membro')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  created_at timestamptz default now()
);

alter table public.usuarios enable row level security;

create policy "usuarios: own read" on public.usuarios
  for select using (auth.uid() = id);

create policy "usuarios: own insert" on public.usuarios
  for insert with check (auth.uid() = id);

create policy "usuarios: admin read" on public.usuarios
  for select using (public.is_patota_admin(patota_id));

create policy "usuarios: admin update" on public.usuarios
  for update using (public.is_patota_admin(patota_id));

-- Ensure patota table has a public read policy
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'patota' and policyname = 'patota: public read'
  ) then
    execute 'create policy "patota: public read" on public.patota for select using (true)';
  end if;
end $$;

-- Add patota_id to main tables (nullable — existing rows keep working)
alter table public.jogadores    add column if not exists patota_id integer references public.patota(id);
alter table public.jogos        add column if not exists patota_id integer references public.patota(id);
alter table public.mensalidades add column if not exists patota_id integer references public.patota(id);
alter table public.lancamentos  add column if not exists patota_id integer references public.patota(id);
alter table public.churrascos   add column if not exists patota_id integer references public.patota(id);
alter table public.sorteios     add column if not exists patota_id integer references public.patota(id);
alter table public.presencas    add column if not exists patota_id integer references public.patota(id);
