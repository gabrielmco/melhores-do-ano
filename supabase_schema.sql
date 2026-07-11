-- ============================================================================
-- EMPÓRIO EXCELÊNCIA - SCHEMA DE BANCO DE DADOS E POLÍTICAS DE SEGURANÇA
-- ============================================================================

-- Habilitar extensões necessárias para busca fuzzy e normalização
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ============================================================================
-- 1. CRIAÇÃO DE TABELAS
-- ============================================================================

-- Tabela de Perfis de Usuários (Estende auth.users do Supabase)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'candidato' check (role in ('super_admin', 'admin', 'moderador', 'comercial', 'candidato')),
  created_at timestamp with time zone default now()
);

-- Tabela de Cidades
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamp with time zone default now()
);

-- Tabela de Edições (Elections)
create table public.elections (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities on delete cascade,
  year integer not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'aberta', 'encerrada', 'apuracao', 'publicada')),
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  unique(city_id, year)
);

-- Tabela de Categorias
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamp with time zone default now()
);

-- Categorias Ativas por Eleição
create table public.city_categories (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  unique(election_id, category_id)
);

-- Tabela de Candidatos (Dados Privados + Internos)
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections on delete restrict,
  category_id uuid not null references public.categories on delete restrict,
  name text not null,
  normalized_name text not null,
  type text not null check (type in ('profissional', 'empresa')),
  instagram text,
  whatsapp text not null, -- Privado
  email text not null, -- Privado
  logo_url text,
  description text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado', 'mesclado')),
  merged_into_candidate_id uuid references public.candidates on delete restrict,
  commercial_status text not null default 'não contatado' check (commercial_status in ('não contatado', 'chamou no WhatsApp', 'interessado', 'comprou', 'recusou')),
  commercial_notes text,
  last_contact_date timestamp with time zone,
  commercial_package text not null default 'nao_definido' check (commercial_package in ('nao_definido', 'selo_digital', 'placa_classica', 'kit_premium')),
  commercial_owner_id uuid references public.profiles on delete set null,
  commercial_next_action text,
  commercial_follow_up_date date,
  commercial_value_estimate numeric(12,2),
  profile_id uuid unique references public.profiles on delete set null,
  created_at timestamp with time zone default now()
);

-- Aliases / Variações de Nome para Candidatos (para mesclagem e busca)
create table public.candidate_aliases (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates on delete cascade,
  election_id uuid not null references public.elections on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  alias text not null,
  normalized_alias text not null,
  unique(election_id, category_id, normalized_alias)
);

-- Tabela de Indicações de Candidatos pelo Público (Fila de Moderação)
create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  name text not null,
  normalized_name text not null, -- Para detecção prévia de duplicados
  type text not null check (type in ('profissional', 'empresa')),
  instagram text,
  whatsapp text,
  email text,
  voter_name text,
  voter_identifier_hash text,
  voter_type text check (voter_type in ('email', 'whatsapp')),
  ip_address inet,
  user_agent text,
  cookie_id uuid,
  privacy_consent boolean not null default false,
  validation_consent boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado', 'mesclado')),
  candidate_id uuid references public.candidates on delete set null,
  created_at timestamp with time zone default now()
);

-- Tabela de Votos
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections on delete restrict,
  category_id uuid not null references public.categories on delete restrict,
  candidate_id uuid not null references public.candidates on delete restrict,
  voter_name text not null,
  voter_identifier text not null, -- Hash HMAC seguro gerado no servidor
  voter_type text not null check (voter_type in ('email', 'whatsapp')),
  ip_address inet not null,
  user_agent text,
  cookie_id uuid not null,
  status text not null default 'valido' check (status in ('valido', 'suspeito', 'anulado')),
  privacy_consent boolean not null check (privacy_consent = true),
  validation_consent boolean not null check (validation_consent = true),
  created_at timestamp with time zone default now(),
  unique(election_id, category_id, voter_identifier)
);

-- Tabela de Tentativas de Voto (Auditoria abrangente contra spambots)
create table public.vote_attempts (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references public.elections on delete set null,
  category_id uuid references public.categories on delete set null,
  candidate_id uuid references public.candidates on delete set null,
  ip_address inet not null,
  cookie_id uuid,
  voter_identifier_hash text,
  success boolean not null,
  reason text,
  created_at timestamp with time zone default now()
);

-- Flags de Auditoria de Voto Suspeito
create table public.suspicious_vote_flags (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes on delete cascade,
  reason text not null,
  created_at timestamp with time zone default now()
);

-- Logs de Auditoria das Ações Administrativas
create table public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles on delete set null,
  action text not null,
  details jsonb not null,
  created_at timestamp with time zone default now()
);

-- Tabela de Vencedores e Finalistas (Snapshot oficial pós-votação)
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections on delete restrict,
  category_id uuid not null references public.categories on delete restrict,
  candidate_id uuid not null references public.candidates on delete restrict,
  vote_count_snapshot integer not null,
  position integer not null default 1, -- 1 = Vencedor, 2 = 2º Lugar (Finalista)
  published_by uuid references public.profiles on delete set null,
  is_public boolean not null default true,
  published_at timestamp with time zone default now(),
  unique(election_id, category_id, position)
);

-- ============================================================================
-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.elections enable row level security;
alter table public.categories enable row level security;
alter table public.city_categories enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_aliases enable row level security;
alter table public.nominations enable row level security;
alter table public.votes enable row level security;
alter table public.vote_attempts enable row level security;
alter table public.suspicious_vote_flags enable row level security;
alter table public.admin_action_logs enable row level security;
alter table public.winners enable row level security;

-- ============================================================================
-- 3. FUNÇÕES HELPER DE CONTROLE DE ACESSO (Evitam recursão de RLS)
-- ============================================================================

-- Retorna a role do usuário autenticado atual consultando perfis como Security Definer
create or replace function public.current_user_role()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = auth.uid();
  return v_role;
end;
$$;

revoke execute on function public.current_user_role() from public, anon, authenticated;
grant execute on function public.current_user_role() to authenticated;

-- Verifica se o usuário autenticado atual possui uma das roles fornecidas
create or replace function public.has_role(p_roles text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.current_user_role() = any(p_roles);
end;
$$;

revoke execute on function public.has_role(text[]) from public, anon, authenticated;
grant execute on function public.has_role(text[]) to authenticated;

-- ============================================================================
-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- perfis
create policy select_own_profile on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy select_admin_profiles on public.profiles
  for select to authenticated
  using (public.has_role(array['admin', 'super_admin', 'moderador']));

create policy update_admin_profiles on public.profiles
  for update to authenticated
  using (public.has_role(array['admin', 'super_admin']));

-- cidades
create policy select_cities_public on public.cities for select to anon, authenticated using (true);
create policy admin_cities_all on public.cities for all to authenticated 
  using (public.has_role(array['admin', 'super_admin']));

-- categorias
create policy select_categories_public on public.categories for select to anon, authenticated using (true);
create policy admin_categories_all on public.categories for all to authenticated 
  using (public.has_role(array['admin', 'super_admin']));

-- categorias por eleição
create policy select_city_categories_public on public.city_categories for select to anon, authenticated using (true);
create policy admin_city_categories_all on public.city_categories for all to authenticated 
  using (public.has_role(array['admin', 'super_admin']));

-- edições (elections)
create policy select_elections_public on public.elections for select to anon, authenticated using (status in ('aberta', 'publicada'));
create policy admin_elections_all on public.elections for all to authenticated 
  using (public.has_role(array['admin', 'super_admin']));

-- candidatos (candidates)
-- Nota: Para máxima segurança contra vazamento de dados, usuários finais (candidatos e comercial) não possuem políticas de SELECT direto na tabela.
-- Eles acessam dados através das RPCs get_my_candidate_profile() e get_crm_candidates_v2().
create policy admin_candidates_all on public.candidates for all to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador']));

-- aliases
create policy select_aliases_public on public.candidate_aliases for select to anon, authenticated using (true);
create policy admin_aliases_all on public.candidate_aliases for all to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador']));

-- indicações (nominations)
-- Inserções públicas diretas foram removidas. Indicações devem entrar via Edge Function
-- com Service Role para validar Turnstile, consentimentos, rate limit e auditoria.
drop policy if exists insert_nominations_public on public.nominations;
create policy staff_nominations_select on public.nominations for select to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador', 'comercial']));
create policy staff_nominations_mod on public.nominations for all to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador']));

-- votos e tentativas
create policy staff_votes_select on public.votes for select to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador']));
create policy staff_attempts_select on public.vote_attempts for select to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador']));

-- flags e logs
create policy staff_flags_all on public.suspicious_vote_flags for all to authenticated 
  using (public.has_role(array['admin', 'super_admin', 'moderador']));
create policy admin_logs_all on public.admin_action_logs for all to authenticated 
  using (public.has_role(array['admin', 'super_admin']));

-- vencedores (winners)
create policy select_winners_public on public.winners for select to anon, authenticated using (is_public = true);
create policy admin_winners_all on public.winners for all to authenticated 
  using (public.has_role(array['admin', 'super_admin']));

-- ============================================================================
-- 5. CRIAÇÃO DE VIEWS PÚBLICAS (Executam como Security Definer)
-- ============================================================================

-- View Pública de Candidatos (Sem security_invoker para que execute com privilégios do criador)
create or replace view public.public_candidates
with (security_barrier = true) as
select 
  c.id,
  c.election_id,
  c.category_id,
  c.name,
  c.type,
  c.instagram,
  c.logo_url,
  c.description,
  c.status
from public.candidates c
join public.elections e on e.id = c.election_id
where c.status = 'aprovado'
  and e.status = 'aberta'
  and now() between e.start_date and e.end_date;

-- View Pública de Vencedores/Finalistas
create or replace view public.public_winners
with (security_barrier = true) as
select 
  w.id,
  w.election_id,
  w.category_id,
  w.candidate_id,
  w.vote_count_snapshot,
  w.position,
  w.published_at,
  c.name as candidate_name,
  c.logo_url as candidate_logo,
  c.instagram as candidate_instagram
from public.winners w
join public.candidates c on w.candidate_id = c.id
join public.elections e on e.id = w.election_id
where w.is_public = true
  and e.status = 'publicada';

-- Conceder permissão de select nas views para anon e authenticated
grant select on public.public_candidates to anon, authenticated;
grant select on public.public_winners to anon, authenticated;

-- ============================================================================
-- 6. ÍNDICES DE DESEMPENHO E AUDITORIA
-- ============================================================================

-- Índice Parcial para contagens e rankings rápidos de votos válidos
create index idx_votes_valid_lookup 
on public.votes (election_id, category_id, candidate_id) 
where status = 'valido';

-- Índice para a Constraint de voto único
create index idx_votes_unique_check
on public.votes (election_id, category_id, voter_identifier);

-- Índice composto para acelerar consulta de candidatos ativos
create index idx_candidates_active 
on public.candidates (election_id, category_id, status);

-- Índices GIN trigram para busca rápida de nomes e apelidos normalizados
create index idx_candidates_trgm_name 
on public.candidates using gin (normalized_name gin_trgm_ops);

create index idx_aliases_trgm_alias 
on public.candidate_aliases using gin (normalized_alias gin_trgm_ops);

-- Índice composto de tentativas para rate limits rápidos
create index idx_vote_attempts_ip_created
on public.vote_attempts (ip_address, created_at);

-- Outros índices de suporte
create index idx_votes_created_at on public.votes (created_at);
create index idx_logs_profile_created on public.admin_action_logs (profile_id, created_at);
create index idx_nominations_queue on public.nominations (status, election_id, category_id);
create index idx_nominations_audit_ip_created on public.nominations (ip_address, created_at);
create index idx_nominations_voter_hash on public.nominations (election_id, category_id, voter_identifier_hash);
create index idx_candidates_commercial_follow_up on public.candidates (commercial_status, commercial_follow_up_date);

-- ============================================================================
-- 7. CRIAÇÃO DE PROCEDIMENTOS DO BANCO (RPC)
-- ============================================================================

-------------------------------------------------------------------------------
-- RPC 1: cast_vote (Computar Votos e Registrar Tentativas com Rate Limits)
-------------------------------------------------------------------------------
create or replace function public.cast_vote(
  p_election_id uuid,
  p_category_id uuid,
  p_candidate_id uuid,
  p_voter_name text,
  p_voter_identifier text,
  p_voter_type text,
  p_ip_address inet,
  p_user_agent text,
  p_cookie_id uuid,
  p_privacy_consent boolean,
  p_validation_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = '' -- Mitigar ataques de injeção de search_path
as $$
declare
  v_election_status text;
  v_start_date timestamp with time zone;
  v_end_date timestamp with time zone;
  v_candidate_status text;
  v_candidate_election uuid;
  v_candidate_category uuid;
  v_category_exists boolean;
  v_recent_attempts integer;
begin
  -- 1. Rate Limit: máximo 15 tentativas gerais por IP a cada 5 minutos
  select count(*) into v_recent_attempts
  from public.vote_attempts
  where ip_address = p_ip_address
    and created_at > now() - interval '5 minutes';
    
  if v_recent_attempts >= 15 then
    insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success, reason)
    values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, false, 'Rate limit excedido por IP');
    return jsonb_build_object('success', false, 'reason', 'rate_limit');
  end if;

  -- 2. Validar consentimentos LGPD obrigatórios
  if not p_privacy_consent or not p_validation_consent then
    insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success, reason)
    values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, false, 'Consentimento LGPD ausente');
    return jsonb_build_object('success', false, 'reason', 'lgpd_consent_missing');
  end if;

  -- 3. Validar status e datas da eleição
  select status, start_date, end_date into v_election_status, v_start_date, v_end_date
  from public.elections
  where id = p_election_id;
  
  if v_election_status is null or v_election_status != 'aberta' or now() not between v_start_date and v_end_date then
    insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success, reason)
    values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, false, 'Eleição fechada ou fora do prazo');
    return jsonb_build_object('success', false, 'reason', 'election_not_open');
  end if;

  -- 4. Validar se a categoria está ativa na eleição
  select exists (
    select 1 from public.city_categories 
    where election_id = p_election_id and category_id = p_category_id
  ) into v_category_exists;

  if not v_category_exists then
    insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success, reason)
    values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, false, 'Categoria inativa na eleição');
    return jsonb_build_object('success', false, 'reason', 'category_inactive');
  end if;

  -- 5. Validar integridade e status do candidato
  select status, election_id, category_id 
  into v_candidate_status, v_candidate_election, v_candidate_category
  from public.candidates
  where id = p_candidate_id;

  if v_candidate_status is null or v_candidate_status != 'aprovado' or v_candidate_election != p_election_id or v_candidate_category != p_category_id then
    insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success, reason)
    values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, false, 'Candidato inválido ou não aprovado');
    return jsonb_build_object('success', false, 'reason', 'invalid_candidate');
  end if;

  -- 6. Tentar inserir o voto
  begin
    insert into public.votes (
      election_id, category_id, candidate_id, voter_name, voter_identifier, voter_type,
      ip_address, user_agent, cookie_id, privacy_consent, validation_consent, status
    ) values (
      p_election_id, p_category_id, p_candidate_id, p_voter_name, p_voter_identifier, p_voter_type,
      p_ip_address, p_user_agent, p_cookie_id, p_privacy_consent, p_validation_consent, 'valido'
    );
  exception
    when unique_violation then
      insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success, reason)
      values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, false, 'Voto duplicado');
      return jsonb_build_object('success', false, 'reason', 'duplicate_vote');
  end;

  -- 7. Gravar sucesso na tabela de tentativas
  insert into public.vote_attempts (election_id, category_id, candidate_id, ip_address, cookie_id, voter_identifier_hash, success)
  values (p_election_id, p_category_id, p_candidate_id, p_ip_address, p_cookie_id, p_voter_identifier, true);

  return jsonb_build_object('success', true);
end;
$$;

-- Revogar execução pública da cast_vote
revoke execute on function public.cast_vote(uuid, uuid, uuid, text, text, text, inet, text, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid, uuid, text, text, text, inet, text, uuid, boolean, boolean) to service_role;

-------------------------------------------------------------------------------
-- RPC: get_my_candidate_profile (Candidato acessa seus dados privados de forma segura)
-------------------------------------------------------------------------------
create or replace function public.get_my_candidate_profile()
returns table (
  id uuid,
  election_id uuid,
  category_id uuid,
  name text,
  type text,
  instagram text,
  whatsapp text,
  email text,
  logo_url text,
  description text,
  status text,
  merged_into_candidate_id uuid,
  commercial_status text,
  commercial_notes text,
  last_contact_date timestamp with time zone,
  profile_id uuid,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select 
    c.id,
    c.election_id,
    c.category_id,
    c.name,
    c.type,
    c.instagram,
    c.whatsapp,
    c.email,
    c.logo_url,
    c.description,
    c.status,
    c.merged_into_candidate_id,
    c.commercial_status,
    c.commercial_notes,
    c.last_contact_date,
    c.profile_id,
    c.created_at
  from public.candidates c
  where c.profile_id = auth.uid()
  limit 1;
end;
$$;

revoke execute on function public.get_my_candidate_profile() from public, anon, authenticated;
grant execute on function public.get_my_candidate_profile() to authenticated;

-------------------------------------------------------------------------------
-- RPC 2: update_candidate_profile (Edição Segura pelo Próprio Candidato)
-------------------------------------------------------------------------------
create or replace function public.update_candidate_profile(
  p_candidate_id uuid,
  p_instagram text,
  p_whatsapp text,
  p_email text,
  p_logo_url text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Validar se o usuário autenticado na sessão é dono do perfil candidato
  if not exists (
    select 1 from public.candidates
    where id = p_candidate_id and profile_id = auth.uid()
  ) then
    raise exception 'Acesso negado: Você não é dono deste perfil.';
  end if;

  -- Atualizar apenas as colunas liberadas
  update public.candidates
  set
    instagram = p_instagram,
    whatsapp = p_whatsapp,
    email = p_email,
    logo_url = p_logo_url,
    description = p_description
  where id = p_candidate_id;
end;
$$;

-- Revogar execução para anon e public
revoke execute on function public.update_candidate_profile(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_candidate_profile(uuid, text, text, text, text, text) to authenticated;

-------------------------------------------------------------------------------
-- RPC: approve_nomination (Aprovação Transacional de Indicações)
-------------------------------------------------------------------------------
create or replace function public.approve_nomination(
  p_nomination_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
  v_nom public.nominations%rowtype;
  v_candidate_id uuid;
  v_vote_created boolean := false;
  v_vote_skipped_reason text := null;
begin
  v_admin_profile_id := auth.uid();

  if not exists (
    select 1 from public.profiles
    where id = v_admin_profile_id and role in ('admin', 'super_admin', 'moderador')
  ) then
    raise exception 'Acesso negado: Perfil executor sem privilégio de moderação.';
  end if;

  select * into v_nom
  from public.nominations
  where id = p_nomination_id
  for update;

  if v_nom.id is null then
    raise exception 'Indicação não encontrada.';
  end if;

  if v_nom.status != 'pendente' then
    raise exception 'Apenas indicações pendentes podem ser aprovadas.';
  end if;

  insert into public.candidates (
    election_id,
    category_id,
    name,
    normalized_name,
    type,
    instagram,
    whatsapp,
    email,
    status
  ) values (
    v_nom.election_id,
    v_nom.category_id,
    v_nom.name,
    v_nom.normalized_name,
    v_nom.type,
    v_nom.instagram,
    coalesce(v_nom.whatsapp, 'Não informado'),
    coalesce(v_nom.email, 'Não informado'),
    'aprovado'
  )
  returning id into v_candidate_id;

  update public.nominations
  set status = 'aprovado', candidate_id = v_candidate_id
  where id = p_nomination_id;

  if v_nom.voter_identifier_hash is not null
    and v_nom.voter_name is not null
    and v_nom.voter_type is not null
    and v_nom.ip_address is not null
    and v_nom.cookie_id is not null
    and v_nom.privacy_consent is true
    and v_nom.validation_consent is true
  then
    begin
      insert into public.votes (
        election_id,
        category_id,
        candidate_id,
        voter_name,
        voter_identifier,
        voter_type,
        ip_address,
        user_agent,
        cookie_id,
        privacy_consent,
        validation_consent,
        status
      ) values (
        v_nom.election_id,
        v_nom.category_id,
        v_candidate_id,
        v_nom.voter_name,
        v_nom.voter_identifier_hash,
        v_nom.voter_type,
        v_nom.ip_address,
        v_nom.user_agent,
        v_nom.cookie_id,
        v_nom.privacy_consent,
        v_nom.validation_consent,
        'valido'
      );
      v_vote_created := true;
    exception
      when unique_violation then
        v_vote_skipped_reason := 'duplicate_vote';
    end;
  else
    v_vote_skipped_reason := 'missing_audit_fields';
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'aprovou_indicacao',
    jsonb_build_object(
      'nomination_id', p_nomination_id,
      'candidate_id', v_candidate_id,
      'name', v_nom.name,
      'initial_vote_created', v_vote_created,
      'initial_vote_skipped_reason', v_vote_skipped_reason
    )
  );

  return jsonb_build_object(
    'success', true,
    'candidate_id', v_candidate_id,
    'initial_vote_created', v_vote_created,
    'initial_vote_skipped_reason', v_vote_skipped_reason
  );
end;
$$;

revoke execute on function public.approve_nomination(uuid) from public, anon, authenticated;
grant execute on function public.approve_nomination(uuid) to authenticated;

-------------------------------------------------------------------------------
-- RPC: reject_nomination (Rejeição Auditada de Indicações)
-------------------------------------------------------------------------------
create or replace function public.reject_nomination(
  p_nomination_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
  v_nom_name text;
begin
  v_admin_profile_id := auth.uid();

  if not exists (
    select 1 from public.profiles
    where id = v_admin_profile_id and role in ('admin', 'super_admin', 'moderador')
  ) then
    raise exception 'Acesso negado: Perfil executor sem privilégio de moderação.';
  end if;

  update public.nominations
  set status = 'rejeitado'
  where id = p_nomination_id and status = 'pendente'
  returning name into v_nom_name;

  if v_nom_name is null then
    raise exception 'Indicação pendente não encontrada.';
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'rejeitou_indicacao',
    jsonb_build_object(
      'nomination_id', p_nomination_id,
      'name', v_nom_name
    )
  );
end;
$$;

revoke execute on function public.reject_nomination(uuid) from public, anon, authenticated;
grant execute on function public.reject_nomination(uuid) to authenticated;

-------------------------------------------------------------------------------
-- RPC 3: update_candidate_commercial_status (Edição Limitada de CRM)
-------------------------------------------------------------------------------
create or replace function public.update_candidate_commercial_status(
  p_candidate_id uuid,
  p_commercial_status text,
  p_commercial_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
begin
  v_admin_profile_id := auth.uid();

  -- Validar papel comercial ou administrativo do executor no banco
  if not exists (
    select 1 from public.profiles
    where id = v_admin_profile_id and role in ('admin', 'super_admin', 'comercial')
  ) then
    raise exception 'Acesso negado: Perfil executor sem privilégios comerciais.';
  end if;

  update public.candidates
  set
    commercial_status = p_commercial_status,
    commercial_notes = p_commercial_notes,
    last_contact_date = now()
  where id = p_candidate_id;

  -- Gravar auditoria
  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'atualizou_crm_candidato',
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'commercial_status', p_commercial_status
    )
  );
end;
$$;

revoke execute on function public.update_candidate_commercial_status(uuid, text, text) from public, anon, authenticated;
-- RPC legada mantida apenas por compatibilidade de schema. Use update_candidate_commercial_status_v2().

-------------------------------------------------------------------------------
-- RPC: get_crm_candidates (Busca candidatos com dados comerciais para o Funil CRM)
-------------------------------------------------------------------------------
create or replace function public.get_crm_candidates(p_election_id uuid)
returns table (
  id uuid,
  name text,
  category_name text,
  whatsapp text,
  email text,
  commercial_status text,
  commercial_notes text,
  last_contact_date timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Validar se o executor possui papel comercial ou admin (usando helper has_role)
  if not public.has_role(array['admin', 'super_admin', 'moderador', 'comercial']) then
    raise exception 'Acesso negado: Perfil sem privilégios comerciais.';
  end if;

  return query
  select 
    c.id,
    c.name,
    cat.name as category_name,
    c.whatsapp,
    c.email,
    c.commercial_status,
    c.commercial_notes,
    c.last_contact_date
  from public.candidates c
  join public.categories cat on c.category_id = cat.id
  where c.election_id = p_election_id
  order by cat.name, c.name;
end;
$$;

revoke execute on function public.get_crm_candidates(uuid) from public, anon, authenticated;
-- RPC legada mantida apenas por compatibilidade de schema. Use get_crm_candidates_v2().

-------------------------------------------------------------------------------
-- RPCs comerciais e administrativas adicionais para producao
-------------------------------------------------------------------------------

create or replace function public.get_crm_candidates_v2(p_election_id uuid)
returns table (
  id uuid,
  name text,
  category_name text,
  whatsapp text,
  email text,
  commercial_status text,
  commercial_notes text,
  last_contact_date timestamp with time zone,
  commercial_package text,
  commercial_owner_id uuid,
  commercial_owner_name text,
  commercial_next_action text,
  commercial_follow_up_date date,
  commercial_value_estimate numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin', 'super_admin', 'moderador', 'comercial']) then
    raise exception 'Acesso negado: perfil sem privilegios comerciais.';
  end if;

  return query
  select
    c.id,
    c.name,
    cat.name as category_name,
    c.whatsapp,
    c.email,
    c.commercial_status,
    c.commercial_notes,
    c.last_contact_date,
    c.commercial_package,
    c.commercial_owner_id,
    p.name as commercial_owner_name,
    c.commercial_next_action,
    c.commercial_follow_up_date,
    c.commercial_value_estimate
  from public.candidates c
  join public.categories cat on c.category_id = cat.id
  left join public.profiles p on p.id = c.commercial_owner_id
  where c.election_id = p_election_id
    and c.status = 'aprovado'
  order by c.commercial_follow_up_date nulls last, cat.name, c.name;
end;
$$;

revoke execute on function public.get_crm_candidates_v2(uuid) from public, anon, authenticated;
grant execute on function public.get_crm_candidates_v2(uuid) to authenticated;

create or replace function public.update_candidate_commercial_status_v2(
  p_candidate_id uuid,
  p_commercial_status text,
  p_commercial_notes text,
  p_commercial_package text,
  p_commercial_next_action text,
  p_commercial_follow_up_date date,
  p_commercial_value_estimate numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if not exists (
    select 1 from public.profiles
    where id = v_profile_id and role in ('admin', 'super_admin', 'comercial')
  ) then
    raise exception 'Acesso negado: perfil sem privilegios comerciais.';
  end if;

  if p_commercial_status not in ('nÃ£o contatado', 'chamou no WhatsApp', 'interessado', 'comprou', 'recusou') then
    raise exception 'Status comercial invalido.';
  end if;

  if coalesce(p_commercial_package, 'nao_definido') not in ('nao_definido', 'selo_digital', 'placa_classica', 'kit_premium') then
    raise exception 'Pacote comercial invalido.';
  end if;

  update public.candidates
  set
    commercial_status = p_commercial_status,
    commercial_notes = p_commercial_notes,
    commercial_package = coalesce(p_commercial_package, 'nao_definido'),
    commercial_owner_id = v_profile_id,
    commercial_next_action = p_commercial_next_action,
    commercial_follow_up_date = p_commercial_follow_up_date,
    commercial_value_estimate = p_commercial_value_estimate,
    last_contact_date = now()
  where id = p_candidate_id;

  if not found then
    raise exception 'Candidato nao encontrado.';
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'atualizou_crm_candidato',
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'commercial_status', p_commercial_status,
      'commercial_package', coalesce(p_commercial_package, 'nao_definido'),
      'commercial_value_estimate', p_commercial_value_estimate,
      'commercial_follow_up_date', p_commercial_follow_up_date
    )
  );
end;
$$;

revoke execute on function public.update_candidate_commercial_status_v2(uuid, text, text, text, text, date, numeric) from public, anon, authenticated;
grant execute on function public.update_candidate_commercial_status_v2(uuid, text, text, text, text, date, numeric) to authenticated;

create or replace function public.open_election(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_category_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = v_profile_id and role in ('admin', 'super_admin')
  ) then
    raise exception 'Acesso negado: perfil sem privilegio para abrir votacao.';
  end if;

  select count(*) into v_category_count
  from public.city_categories
  where election_id = p_election_id;

  if v_category_count = 0 then
    raise exception 'Vincule pelo menos uma categoria antes de abrir a votacao.';
  end if;

  update public.elections
  set status = 'aberta'
  where id = p_election_id
    and status = 'rascunho'
    and start_date < end_date;

  if not found then
    raise exception 'Eleicao nao encontrada, ja aberta/publicada ou com periodo invalido.';
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'abriu_eleicao',
    jsonb_build_object('election_id', p_election_id, 'new_status', 'aberta')
  );
end;
$$;

revoke execute on function public.open_election(uuid) from public, anon, authenticated;
grant execute on function public.open_election(uuid) to authenticated;

create or replace function public.admin_create_city(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_id uuid;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  insert into public.cities (name)
  values (trim(p_name))
  returning id into v_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'criou_cidade', jsonb_build_object('city_id', v_id, 'name', trim(p_name)));

  return v_id;
end;
$$;

revoke execute on function public.admin_create_city(text) from public, anon, authenticated;
grant execute on function public.admin_create_city(text) to authenticated;

create or replace function public.admin_delete_city(p_city_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_name text;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  select name into v_name from public.cities where id = p_city_id;
  if v_name is null then
    raise exception 'Cidade nao encontrada.';
  end if;

  if exists (select 1 from public.elections where city_id = p_city_id) then
    raise exception 'Cidade possui eleicoes vinculadas e nao pode ser removida.';
  end if;

  delete from public.cities where id = p_city_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'removeu_cidade', jsonb_build_object('city_id', p_city_id, 'name', v_name));
end;
$$;

revoke execute on function public.admin_delete_city(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_city(uuid) to authenticated;

create or replace function public.admin_create_category(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_id uuid;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  insert into public.categories (name)
  values (trim(p_name))
  returning id into v_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'criou_categoria', jsonb_build_object('category_id', v_id, 'name', trim(p_name)));

  return v_id;
end;
$$;

revoke execute on function public.admin_create_category(text) from public, anon, authenticated;
grant execute on function public.admin_create_category(text) to authenticated;

create or replace function public.admin_delete_category(p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_name text;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  select name into v_name from public.categories where id = p_category_id;
  if v_name is null then
    raise exception 'Categoria nao encontrada.';
  end if;

  if exists (select 1 from public.city_categories where category_id = p_category_id)
    or exists (select 1 from public.candidates where category_id = p_category_id) then
    raise exception 'Categoria possui vinculos e nao pode ser removida.';
  end if;

  delete from public.categories where id = p_category_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'removeu_categoria', jsonb_build_object('category_id', p_category_id, 'name', v_name));
end;
$$;

revoke execute on function public.admin_delete_category(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_category(uuid) to authenticated;

create or replace function public.admin_create_election(
  p_city_id uuid,
  p_year integer,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_id uuid;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  if p_start_date >= p_end_date then
    raise exception 'Periodo de votacao invalido.';
  end if;

  insert into public.elections (city_id, year, start_date, end_date, status)
  values (p_city_id, p_year, p_start_date, p_end_date, 'rascunho')
  returning id into v_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'criou_eleicao', jsonb_build_object('election_id', v_id, 'city_id', p_city_id, 'year', p_year));

  return v_id;
end;
$$;

revoke execute on function public.admin_create_election(uuid, integer, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.admin_create_election(uuid, integer, timestamp with time zone, timestamp with time zone) to authenticated;

create or replace function public.admin_save_election_categories(
  p_election_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  delete from public.city_categories
  where election_id = p_election_id;

  insert into public.city_categories (election_id, category_id)
  select p_election_id, selected.category_id
  from unnest(coalesce(p_category_ids, array[]::uuid[])) as selected(category_id)
  join public.categories c on c.id = selected.category_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'salvou_categorias_eleicao',
    jsonb_build_object('election_id', p_election_id, 'category_count', coalesce(array_length(p_category_ids, 1), 0))
  );
end;
$$;

revoke execute on function public.admin_save_election_categories(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_save_election_categories(uuid, uuid[]) to authenticated;

create or replace function public.admin_upsert_candidate(
  p_candidate_id uuid,
  p_election_id uuid,
  p_category_id uuid,
  p_name text,
  p_type text,
  p_instagram text,
  p_whatsapp text,
  p_email text,
  p_logo_url text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_id uuid;
begin
  if not public.has_role(array['admin', 'super_admin', 'moderador']) then
    raise exception 'Acesso negado.';
  end if;

  if p_type not in ('profissional', 'empresa') then
    raise exception 'Tipo de candidato invalido.';
  end if;

  if p_candidate_id is null then
    insert into public.candidates (
      election_id, category_id, name, normalized_name, type, instagram, whatsapp, email, logo_url, description, status
    ) values (
      p_election_id,
      p_category_id,
      trim(p_name),
      lower(unaccent(trim(p_name))),
      p_type,
      nullif(p_instagram, ''),
      coalesce(nullif(p_whatsapp, ''), 'Nao informado'),
      coalesce(nullif(p_email, ''), 'Nao informado'),
      nullif(p_logo_url, ''),
      nullif(p_description, ''),
      'aprovado'
    )
    returning id into v_id;

    insert into public.admin_action_logs (profile_id, action, details)
    values (v_profile_id, 'criou_candidato', jsonb_build_object('candidate_id', v_id, 'name', trim(p_name)));
  else
    update public.candidates
    set
      election_id = p_election_id,
      category_id = p_category_id,
      name = trim(p_name),
      normalized_name = lower(unaccent(trim(p_name))),
      type = p_type,
      instagram = nullif(p_instagram, ''),
      whatsapp = coalesce(nullif(p_whatsapp, ''), 'Nao informado'),
      email = coalesce(nullif(p_email, ''), 'Nao informado'),
      logo_url = nullif(p_logo_url, ''),
      description = nullif(p_description, '')
    where id = p_candidate_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Candidato nao encontrado.';
    end if;

    insert into public.admin_action_logs (profile_id, action, details)
    values (v_profile_id, 'atualizou_candidato', jsonb_build_object('candidate_id', v_id, 'name', trim(p_name)));
  end if;

  return v_id;
end;
$$;

revoke execute on function public.admin_upsert_candidate(uuid, uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_candidate(uuid, uuid, uuid, text, text, text, text, text, text, text) to authenticated;

create or replace function public.admin_archive_candidate(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_name text;
begin
  if not public.has_role(array['admin', 'super_admin', 'moderador']) then
    raise exception 'Acesso negado.';
  end if;

  update public.candidates
  set status = 'rejeitado'
  where id = p_candidate_id
  returning name into v_name;

  if v_name is null then
    raise exception 'Candidato nao encontrado.';
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'arquivou_candidato', jsonb_build_object('candidate_id', p_candidate_id, 'name', v_name));
end;
$$;

revoke execute on function public.admin_archive_candidate(uuid) from public, anon, authenticated;
grant execute on function public.admin_archive_candidate(uuid) to authenticated;

create or replace function public.resolve_first_place_tie(
  p_election_id uuid,
  p_category_id uuid,
  p_winner_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_marker text := 'manual_tiebreak:' || p_election_id::text || ':' || p_category_id::text;
  v_top_votes integer;
  v_candidate_votes integer;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  select max(vote_count) into v_top_votes
  from (
    select candidate_id, count(*) as vote_count
    from public.votes
    where election_id = p_election_id and category_id = p_category_id and status = 'valido'
    group by candidate_id
  ) ranked;

  select count(*) into v_candidate_votes
  from public.votes
  where election_id = p_election_id
    and category_id = p_category_id
    and candidate_id = p_winner_candidate_id
    and status = 'valido';

  if v_top_votes is null or v_candidate_votes != v_top_votes then
    raise exception 'Candidato escolhido nao esta empatado no primeiro lugar.';
  end if;

  if (
    select count(*)
    from (
      select candidate_id, count(*) as vote_count
      from public.votes
      where election_id = p_election_id and category_id = p_category_id and status = 'valido'
      group by candidate_id
    ) ranked
    where vote_count = v_top_votes
  ) < 2 then
    raise exception 'Nao ha empate de primeiro lugar nesta categoria.';
  end if;

  insert into public.votes (
    election_id,
    category_id,
    candidate_id,
    voter_name,
    voter_identifier,
    voter_type,
    ip_address,
    user_agent,
    cookie_id,
    privacy_consent,
    validation_consent,
    status
  ) values (
    p_election_id,
    p_category_id,
    p_winner_candidate_id,
    'Desempate administrativo',
    v_marker,
    'email',
    '127.0.0.1',
    'admin-manual-tiebreak',
    '00000000-0000-0000-0000-000000000000',
    true,
    true,
    'valido'
  )
  on conflict (election_id, category_id, voter_identifier) do update
  set candidate_id = excluded.candidate_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'resolveu_empate_primeiro_lugar',
    jsonb_build_object(
      'election_id', p_election_id,
      'category_id', p_category_id,
      'winner_candidate_id', p_winner_candidate_id
    )
  );
end;
$$;

revoke execute on function public.resolve_first_place_tie(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_first_place_tie(uuid, uuid, uuid) to authenticated;

-------------------------------------------------------------------------------
-- RPC 4: merge_candidates (Mesclagem Transacional de Candidatos Duplicados)
-------------------------------------------------------------------------------
create or replace function public.merge_candidates(
  p_target_id uuid,
  p_duplicate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
  v_dup_name text;
  v_dup_election uuid;
  v_dup_category uuid;
  v_tar_election uuid;
  v_tar_category uuid;
  v_votes_migrated integer;
  v_votes_annulled integer;
  v_nominations_migrated integer;
begin
  v_admin_profile_id := auth.uid();

  -- 1. Validar papel administrativo/moderador do executor (RBAC real no banco)
  if not exists (
    select 1 from public.profiles
    where id = v_admin_profile_id and role in ('admin', 'super_admin', 'moderador')
  ) then
    raise exception 'Acesso negado: Perfil executor sem privilégios administrativos.';
  end if;

  -- 2. Validar candidato duplicado
  select name, election_id, category_id 
  into v_dup_name, v_dup_election, v_dup_category
  from public.candidates
  where id = p_duplicate_id;

  if v_dup_name is null then
    raise exception 'Candidato duplicado não encontrado.';
  end if;

  -- 3. Validar candidato oficial/destino
  select election_id, category_id 
  into v_tar_election, v_tar_category
  from public.candidates
  where id = p_target_id;

  if v_tar_election is null then
    raise exception 'Candidato oficial não encontrado.';
  end if;

  -- 4. Assegurar compatibilidade de eleição e categoria
  if v_dup_election != v_tar_election or v_dup_category != v_tar_category then
    raise exception 'Erro: Concorrentes pertencem a eleições ou categorias diferentes.';
  end if;

  -- 5. Criar Alias de pesquisa
  insert into public.candidate_aliases (candidate_id, election_id, category_id, alias, normalized_alias)
  values (
    p_target_id, 
    v_dup_election, 
    v_dup_category, 
    v_dup_name, 
    lower(unaccent(trim(v_dup_name)))
  )
  on conflict (election_id, category_id, normalized_alias) do nothing;

  -- 6. Migrar indicações
  update public.nominations
  set candidate_id = p_target_id, status = 'mesclado'
  where candidate_id = p_duplicate_id;
  get diagnostics v_nominations_migrated = row_count;

  -- 7. Anular votos conflitantes (eleitor votou em ambos)
  update public.votes
  set status = 'anulado'
  where candidate_id = p_duplicate_id
    and voter_identifier in (
      select voter_identifier from public.votes where candidate_id = p_target_id
    );
  get diagnostics v_votes_annulled = row_count;

  -- Migrar votos válidos
  update public.votes
  set candidate_id = p_target_id
  where candidate_id = p_duplicate_id and status != 'anulado';
  get diagnostics v_votes_migrated = row_count;

  -- 8. Logar detalhadamente na auditoria (snapshot de votos migrados e anulados)
  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'mesclou_duplicado',
    jsonb_build_object(
      'target_candidate_id', p_target_id,
      'duplicate_candidate_id', p_duplicate_id,
      'duplicate_name', v_dup_name,
      'votes_migrated', v_votes_migrated,
      'votes_annulled', v_votes_annulled,
      'nominations_migrated', v_nominations_migrated
    )
  );

  -- 9. Marcar como mesclado sem deletar (preserva chaves estrangeiras restrict)
  update public.candidates
  set status = 'mesclado', merged_into_candidate_id = p_target_id
  where id = p_duplicate_id;

end;
$$;

revoke execute on function public.merge_candidates(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_candidates(uuid, uuid) to authenticated;

-------------------------------------------------------------------------------
-- RPC: close_election (Encerramento Auditado de Votação)
-------------------------------------------------------------------------------
create or replace function public.close_election(
  p_election_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
  v_previous_status text;
begin
  v_admin_profile_id := auth.uid();

  if not exists (
    select 1 from public.profiles
    where id = v_admin_profile_id and role in ('admin', 'super_admin')
  ) then
    raise exception 'Acesso negado: Perfil executor sem privilégio para encerrar votação.';
  end if;

  update public.elections
  set status = 'encerrada'
  where id = p_election_id and status = 'aberta'
  returning 'aberta' into v_previous_status;

  if v_previous_status is null then
    raise exception 'Operação rejeitada: eleição não encontrada ou não está aberta.';
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'encerrou_eleicao',
    jsonb_build_object(
      'election_id', p_election_id,
      'previous_status', v_previous_status,
      'new_status', 'encerrada'
    )
  );
end;
$$;

revoke execute on function public.close_election(uuid) from public, anon, authenticated;
grant execute on function public.close_election(uuid) to authenticated;

-------------------------------------------------------------------------------
-- RPC 5: publish_results (Consolidação de Resultados e Tratamento de Empates)
-------------------------------------------------------------------------------
create or replace function public.publish_results(
  p_election_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
  r_row record;
  v_election_status text;
begin
  v_admin_profile_id := auth.uid();

  -- 1. Validar papel do executor (Admin ou Super Admin)
  if not exists (
    select 1 from public.profiles
    where id = v_admin_profile_id and role in ('admin', 'super_admin')
  ) then
    raise exception 'Acesso negado: Perfil executor sem privilégios para publicação.';
  end if;

  -- 2. Validar status da eleição (apenas se estiver encerrada ou em apuração)
  select status into v_election_status 
  from public.elections
  where id = p_election_id;
  
  if v_election_status is null or v_election_status not in ('encerrada', 'apuracao') then
    raise exception 'Operação rejeitada: A publicação requer eleição encerrada ou em apuração.';
  end if;

  -- 3. Detecção e Bloqueio de Empates para o 1º Lugar
  if exists (
    select 1 from (
      select category_id, count(*) as vote_count,
             rank() over (partition by category_id order by count(*) desc) as rk
      from public.votes
      where election_id = p_election_id and status = 'valido'
      group by category_id, candidate_id
    ) t
    where rk = 1
    group by category_id
    having count(*) > 1
  ) then
    raise exception 'Publicação abortada: Empate detectado no primeiro lugar em uma ou mais categorias. Realize o desempate manual antes de publicar.';
  end if;

  -- 4. Limpar publicações de snapshots anteriores para re-publicação limpa
  delete from public.winners where election_id = p_election_id;

  -- 5. Consolidar ranking por categoria e inserir snapshots
  for r_row in (
    select 
      candidate_id,
      category_id,
      count(*) as total_votes,
      row_number() over (partition by category_id order by count(*) desc) as pos
    from public.votes
    where election_id = p_election_id and status = 'valido'
    group by category_id, candidate_id
  ) loop
    insert into public.winners (
      election_id,
      category_id,
      candidate_id,
      vote_count_snapshot,
      position,
      published_by,
      is_public
    ) values (
      p_election_id,
      r_row.category_id,
      r_row.candidate_id,
      r_row.total_votes,
      r_row.pos,
      v_admin_profile_id,
      true
    );
  end loop;

  -- 6. Atualizar status da eleição
  update public.elections
  set status = 'publicada'
  where id = p_election_id;

  -- 7. Registrar logs na auditoria
  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'publicou_resultado',
    jsonb_build_object(
      'election_id', p_election_id,
      'published_at', now()
    )
  );
end;
$$;

revoke execute on function public.publish_results(uuid) from public, anon, authenticated;
grant execute on function public.publish_results(uuid) to authenticated;
