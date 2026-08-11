-- Supabase Migration - 202607150001_voto_reestruturacao.sql
begin;

-- 1. Tornar whatsapp e email opcionais (DROP NOT NULL) para permitir cadastros/indicações apenas com nome e Instagram
alter table public.candidates alter column whatsapp drop not null;
alter table public.candidates alter column email drop not null;

-- 2. Adicionar índice de unicidade case-insensitive para a coluna instagram por eleição
-- Isso impede cadastros duplicados do mesmo arroba (ex: @padaria e @Padaria) na mesma edição do prêmio
drop index if exists public.candidates_election_instagram_idx;
create unique index candidates_election_instagram_idx 
  on public.candidates (election_id, lower(trim(instagram)));

-- 3. Criar tabela de configuração de fases do evento
create table if not exists public.event_config (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default now()
);

-- Habilitar RLS na tabela de configuração
alter table public.event_config enable row level security;

-- Permitir que qualquer pessoa leia a configuração das fases
drop policy if exists select_event_config_public on public.event_config;
create policy select_event_config_public on public.event_config
  for select to anon, authenticated using (true);

-- Apenas administradores podem modificar a configuração
drop policy if exists admin_event_config_all on public.event_config;
create policy admin_event_config_all on public.event_config
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin']))
  with check (public.has_role(array['admin', 'super_admin']));

-- Inserir fase padrão inicial
insert into public.event_config (key, value)
values ('current_phase', 'registration')
on conflict (key) do nothing;

-- 4. Criar View Agregada Pública para os Resultados em Tempo Real
-- Essa view calcula os votos em tempo real de forma totalmente segura (sem vazar dados de eleitores)
create or replace view public.candidate_votes_summary
with (security_barrier = true) as
select
  v.election_id,
  v.category_id,
  v.candidate_id,
  count(*)::integer as vote_count
from public.votes v
where v.status = 'valido'
group by v.election_id, v.category_id, v.candidate_id;

-- Conceder acesso de leitura pública à view de apuração
grant select on public.candidate_votes_summary to anon, authenticated;

commit;
