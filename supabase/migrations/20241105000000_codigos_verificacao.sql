create table if not exists public.codigos_verificacao (
  id uuid default gen_random_uuid() primary key,
  telefone text not null,
  codigo text not null,
  expira_em timestamptz not null,
  usado boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists idx_codigos_telefone_usado
  on public.codigos_verificacao (telefone, usado);

-- RLS: somente service_role acessa
alter table public.codigos_verificacao enable row level security;
