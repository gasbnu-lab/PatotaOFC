alter table public.codigos_verificacao
  rename column telefone to email;

drop index if exists idx_codigos_telefone_usado;

create index if not exists idx_codigos_email_usado
  on public.codigos_verificacao (email, usado);
