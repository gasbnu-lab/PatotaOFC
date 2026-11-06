-- ============================================================
-- PatotaOFC — Schema principal (idempotente)
-- ============================================================

create table if not exists patota (
  id              serial primary key,
  nome            text not null default 'PatotaOFC',
  dia_vencimento  int  not null default 9,
  valor_mensalidade numeric(10,2) not null default 0,
  criada_em       timestamptz not null default now()
);

insert into patota (nome) select 'PatotaOFC' where not exists (select 1 from patota);

-- ============================================================
-- Jogadores
-- ============================================================
create table if not exists jogadores (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text unique,
  posicao     text check (posicao in ('goleiro','linha','qualquer')) not null default 'qualquer',
  nota        int  check (nota between 1 and 10) not null default 5,
  is_admin    boolean not null default false,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ============================================================
-- Jogos
-- ============================================================
create table if not exists jogos (
  id          uuid primary key default gen_random_uuid(),
  data        date not null,
  horario     time not null,
  local       text not null,
  status      text check (status in ('agendado','confirmado','cancelado','realizado')) not null default 'agendado',
  max_jogadores int,
  criado_em   timestamptz not null default now()
);

-- ============================================================
-- Presenças
-- ============================================================
create table if not exists presencas (
  id              uuid primary key default gen_random_uuid(),
  jogo_id         uuid not null references jogos(id) on delete cascade,
  jogador_id      uuid references jogadores(id) on delete set null,
  nome_convidado  text,
  confirmado      boolean not null default true,
  convidado       boolean not null default false,
  aprovado        boolean not null default false,
  criado_em       timestamptz not null default now(),
  constraint presenca_tem_jogador check (jogador_id is not null or nome_convidado is not null)
);

create unique index if not exists presencas_jogo_jogador on presencas(jogo_id, jogador_id) where jogador_id is not null;

-- ============================================================
-- Sorteio de times
-- ============================================================
create table if not exists sorteios (
  id          uuid primary key default gen_random_uuid(),
  jogo_id     uuid not null references jogos(id) on delete cascade,
  time_a      jsonb not null default '[]',
  time_b      jsonb not null default '[]',
  criado_em   timestamptz not null default now()
);

-- ============================================================
-- Mensalidades
-- ============================================================
create table if not exists mensalidades (
  id              uuid primary key default gen_random_uuid(),
  jogador_id      uuid not null references jogadores(id) on delete cascade,
  mes_ref         date not null,
  valor           numeric(10,2) not null,
  pago            boolean not null default false,
  data_pagamento  date,
  criado_em       timestamptz not null default now(),
  unique(jogador_id, mes_ref)
);

-- ============================================================
-- Churrascos
-- ============================================================
create table if not exists churrascos (
  id          uuid primary key default gen_random_uuid(),
  data        date not null,
  descricao   text,
  criado_em   timestamptz not null default now()
);

create table if not exists churrasco_participantes (
  id              uuid primary key default gen_random_uuid(),
  churrasco_id    uuid not null references churrascos(id) on delete cascade,
  jogador_id      uuid references jogadores(id) on delete set null,
  nome_avulso     text,
  constraint participante_tem_nome check (jogador_id is not null or nome_avulso is not null)
);

create table if not exists churrasco_despesas (
  id              uuid primary key default gen_random_uuid(),
  churrasco_id    uuid not null references churrascos(id) on delete cascade,
  descricao       text not null,
  valor           numeric(10,2) not null,
  pago_por_id     uuid references jogadores(id) on delete set null,
  criado_em       timestamptz not null default now()
);

-- ============================================================
-- Extrato financeiro
-- ============================================================
create table if not exists lancamentos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text check (tipo in ('entrada','saida')) not null,
  valor           numeric(10,2) not null,
  descricao       text not null,
  data            date not null default current_date,
  referencia_tipo text,
  referencia_id   uuid,
  criado_em       timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
do $$ begin
  alter table patota                  enable row level security;
  alter table jogadores               enable row level security;
  alter table jogos                   enable row level security;
  alter table presencas               enable row level security;
  alter table sorteios                enable row level security;
  alter table mensalidades            enable row level security;
  alter table churrascos              enable row level security;
  alter table churrasco_participantes enable row level security;
  alter table churrasco_despesas      enable row level security;
  alter table lancamentos             enable row level security;
exception when others then null;
end $$;

-- Políticas de leitura pública (cria só se não existir)
do $$ begin
  create policy "leitura_publica" on patota                  for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on jogadores               for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on jogos                   for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on presencas               for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on sorteios                for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on churrascos              for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on churrasco_participantes for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "leitura_publica" on churrasco_despesas      for select using (true);
exception when duplicate_object then null; end $$;
