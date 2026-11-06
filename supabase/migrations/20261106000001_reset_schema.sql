-- Drop schema antigo e recriar limpo
-- Ordem: primeiro tabelas dependentes, depois as principais

drop table if exists churrasco_despesas       cascade;
drop table if exists churrasco_participantes  cascade;
drop table if exists churrascos               cascade;
drop table if exists lancamentos              cascade;
drop table if exists mensalidades             cascade;
drop table if exists sorteios                 cascade;
drop table if exists sorteio_times            cascade;
drop table if exists presencas                cascade;
drop table if exists convidados               cascade;
drop table if exists jogos                    cascade;
drop table if exists jogadores                cascade;
drop table if exists patota_fotos             cascade;
drop table if exists patotas                  cascade;
drop table if exists patota                   cascade;
drop table if exists auth_tokens              cascade;
drop table if exists usuarios                 cascade;

-- Drop types antigos se existirem
drop type if exists posicao_jogador cascade;
drop type if exists tipo_jogador    cascade;
drop type if exists status_jogador  cascade;
drop type if exists role_jogador    cascade;
drop type if exists status_jogo     cascade;
drop type if exists formato_jogo    cascade;
drop type if exists status_presenca cascade;
drop type if exists status_mensalidade cascade;

-- ============================================================
-- PatotaOFC — Schema limpo
-- ============================================================

create table patota (
  id                serial primary key,
  nome              text           not null default 'PatotaOFC',
  dia_vencimento    int            not null default 9,
  valor_mensalidade numeric(10,2)  not null default 0,
  criada_em         timestamptz    not null default now()
);

insert into patota (nome) values ('PatotaOFC');

create table jogadores (
  id          uuid primary key default gen_random_uuid(),
  nome        text    not null,
  email       text    unique,
  posicao     text    check (posicao in ('goleiro','linha','qualquer')) not null default 'qualquer',
  nota        int     check (nota between 1 and 10) not null default 5,
  is_admin    boolean not null default false,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table jogos (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  horario       time not null,
  local         text not null,
  status        text check (status in ('agendado','confirmado','cancelado','realizado')) not null default 'agendado',
  max_jogadores int,
  criado_em     timestamptz not null default now()
);

create table presencas (
  id              uuid primary key default gen_random_uuid(),
  jogo_id         uuid    not null references jogos(id) on delete cascade,
  jogador_id      uuid    references jogadores(id) on delete set null,
  nome_convidado  text,
  confirmado      boolean not null default true,
  convidado       boolean not null default false,
  aprovado        boolean not null default false,
  criado_em       timestamptz not null default now(),
  constraint presenca_tem_jogador check (jogador_id is not null or nome_convidado is not null)
);

create unique index presencas_jogo_jogador on presencas(jogo_id, jogador_id) where jogador_id is not null;

create table sorteios (
  id        uuid primary key default gen_random_uuid(),
  jogo_id   uuid  not null references jogos(id) on delete cascade,
  time_a    jsonb not null default '[]',
  time_b    jsonb not null default '[]',
  criado_em timestamptz not null default now()
);

create table mensalidades (
  id              uuid primary key default gen_random_uuid(),
  jogador_id      uuid          not null references jogadores(id) on delete cascade,
  mes_ref         date          not null,
  valor           numeric(10,2) not null,
  pago            boolean       not null default false,
  data_pagamento  date,
  criado_em       timestamptz   not null default now(),
  unique(jogador_id, mes_ref)
);

create table churrascos (
  id        uuid primary key default gen_random_uuid(),
  data      date not null,
  descricao text,
  criado_em timestamptz not null default now()
);

create table churrasco_participantes (
  id              uuid primary key default gen_random_uuid(),
  churrasco_id    uuid not null references churrascos(id) on delete cascade,
  jogador_id      uuid references jogadores(id) on delete set null,
  nome_avulso     text,
  constraint participante_tem_nome check (jogador_id is not null or nome_avulso is not null)
);

create table churrasco_despesas (
  id           uuid primary key default gen_random_uuid(),
  churrasco_id uuid          not null references churrascos(id) on delete cascade,
  descricao    text          not null,
  valor        numeric(10,2) not null,
  pago_por_id  uuid          references jogadores(id) on delete set null,
  criado_em    timestamptz   not null default now()
);

create table lancamentos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text check (tipo in ('entrada','saida')) not null,
  valor           numeric(10,2) not null,
  descricao       text          not null,
  data            date          not null default current_date,
  referencia_tipo text,
  referencia_id   uuid,
  criado_em       timestamptz   not null default now()
);

-- ============================================================
-- RLS + políticas de leitura pública
-- ============================================================
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

create policy "leitura_publica" on patota                  for select using (true);
create policy "leitura_publica" on jogadores               for select using (true);
create policy "leitura_publica" on jogos                   for select using (true);
create policy "leitura_publica" on presencas               for select using (true);
create policy "leitura_publica" on sorteios                for select using (true);
create policy "leitura_publica" on churrascos              for select using (true);
create policy "leitura_publica" on churrasco_participantes for select using (true);
create policy "leitura_publica" on churrasco_despesas      for select using (true);
