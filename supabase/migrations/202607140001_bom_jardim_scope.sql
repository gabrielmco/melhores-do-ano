begin;

create or replace function public.is_official_city_name(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(public.unaccent(trim(coalesce(p_name, '')))) in (
    'bom jardim',
    'bom jardim - mg',
    'bom jardim/mg'
  );
$$;

revoke execute on function public.is_official_city_name(text) from public;
grant execute on function public.is_official_city_name(text) to anon, authenticated, service_role;

do $$
declare
  v_city_count integer;
  v_city_id uuid;
begin
  select count(*)
  into v_city_count
  from public.cities
  where public.is_official_city_name(name);

  select id
  into v_city_id
  from public.cities
  where public.is_official_city_name(name)
  order by id::text
  limit 1;

  if v_city_count > 1 then
    raise exception 'Existem cadastros duplicados para Bom Jardim/MG. Unifique-os antes de aplicar esta migration.';
  elsif v_city_count = 0 then
    insert into public.cities (name)
    values ('Bom Jardim - MG');
  else
    update public.cities
    set name = 'Bom Jardim - MG'
    where id = v_city_id;
  end if;
end;
$$;

create or replace function public.enforce_official_city_name_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_official_city_name(new.name) then
    raise exception 'Este projeto aceita somente a localidade Bom Jardim - MG.';
  end if;

  new.name := 'Bom Jardim - MG';
  return new;
end;
$$;

revoke execute on function public.enforce_official_city_name_scope() from public, anon, authenticated;

drop trigger if exists enforce_official_scope_cities on public.cities;
create trigger enforce_official_scope_cities
  before insert or update of name on public.cities
  for each row execute function public.enforce_official_city_name_scope();

create or replace function public.is_official_city(p_city_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cities c
    where c.id = p_city_id
      and public.is_official_city_name(c.name)
  );
$$;

revoke execute on function public.is_official_city(uuid) from public;
grant execute on function public.is_official_city(uuid) to anon, authenticated, service_role;

create or replace function public.is_official_election(p_election_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.elections e
    where e.id = p_election_id
      and public.is_official_city(e.city_id)
  );
$$;

revoke execute on function public.is_official_election(uuid) from public;
grant execute on function public.is_official_election(uuid) to anon, authenticated, service_role;

-- A API pública enxerga somente a operação municipal de Bom Jardim/MG.
drop policy if exists select_cities_public on public.cities;
create policy select_cities_public on public.cities
  for select to anon, authenticated
  using (public.is_official_city(id));

drop policy if exists select_elections_public on public.elections;
create policy select_elections_public on public.elections
  for select to anon, authenticated
  using (
    status in ('aberta', 'publicada')
    and public.is_official_city(city_id)
  );

drop policy if exists select_city_categories_public on public.city_categories;
create policy select_city_categories_public on public.city_categories
  for select to anon, authenticated
  using (public.is_official_election(election_id));

drop policy if exists select_aliases_public on public.candidate_aliases;
create policy select_aliases_public on public.candidate_aliases
  for select to anon, authenticated
  using (public.is_official_election(election_id));

drop policy if exists select_winners_public on public.winners;
create policy select_winners_public on public.winners
  for select to anon, authenticated
  using (is_public and public.is_official_election(election_id));

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
join public.cities city on city.id = e.city_id
where c.status = 'aprovado'
  and e.status = 'aberta'
  and now() between e.start_date and e.end_date
  and public.is_official_city_name(city.name);

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
join public.cities city on city.id = e.city_id
where w.is_public = true
  and e.status = 'publicada'
  and public.is_official_city_name(city.name);

grant select on public.public_candidates to anon, authenticated;
grant select on public.public_winners to anon, authenticated;

-- Defesa no banco: mesmo uma chamada manual não cria registros fora da cidade oficial.
create or replace function public.enforce_official_election_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.election_id is not null
    and not public.is_official_election(new.election_id) then
    raise exception 'Operação permitida apenas para a eleição de Bom Jardim - MG.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_official_election_scope() from public, anon, authenticated;

drop trigger if exists enforce_official_scope_candidates on public.candidates;
create trigger enforce_official_scope_candidates
  before insert or update of election_id on public.candidates
  for each row execute function public.enforce_official_election_scope();

drop trigger if exists enforce_official_scope_aliases on public.candidate_aliases;
create trigger enforce_official_scope_aliases
  before insert or update of election_id on public.candidate_aliases
  for each row execute function public.enforce_official_election_scope();

drop trigger if exists enforce_official_scope_nominations on public.nominations;
create trigger enforce_official_scope_nominations
  before insert or update of election_id on public.nominations
  for each row execute function public.enforce_official_election_scope();

drop trigger if exists enforce_official_scope_votes on public.votes;
create trigger enforce_official_scope_votes
  before insert or update of election_id on public.votes
  for each row execute function public.enforce_official_election_scope();

drop trigger if exists enforce_official_scope_vote_attempts on public.vote_attempts;
create trigger enforce_official_scope_vote_attempts
  before insert or update of election_id on public.vote_attempts
  for each row execute function public.enforce_official_election_scope();

drop trigger if exists enforce_official_scope_winners on public.winners;
create trigger enforce_official_scope_winners
  before insert or update of election_id on public.winners
  for each row execute function public.enforce_official_election_scope();

drop trigger if exists enforce_official_scope_tiebreaks on public.manual_tiebreaks;
create trigger enforce_official_scope_tiebreaks
  before insert or update of election_id on public.manual_tiebreaks
  for each row execute function public.enforce_official_election_scope();

create or replace function public.enforce_official_city_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_official_city(new.city_id) then
    raise exception 'Edições só podem ser criadas para Bom Jardim - MG.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_official_city_scope() from public, anon, authenticated;

drop trigger if exists enforce_official_scope_elections on public.elections;
create trigger enforce_official_scope_elections
  before insert or update of city_id on public.elections
  for each row execute function public.enforce_official_city_scope();

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

  if not public.is_official_city_name(p_name) then
    raise exception 'Este projeto está configurado exclusivamente para Bom Jardim - MG.';
  end if;

  select id into v_id
  from public.cities
  where public.is_official_city_name(name)
  limit 1;

  if v_id is null then
    insert into public.cities (name)
    values ('Bom Jardim - MG')
    returning id into v_id;
  end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'confirmou_localidade_oficial',
    jsonb_build_object('city_id', v_id, 'name', 'Bom Jardim - MG')
  );

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
  if v_name is null then raise exception 'Cidade não encontrada.'; end if;
  if public.is_official_city_name(v_name) then
    raise exception 'Bom Jardim - MG é a localidade oficial e não pode ser removida.';
  end if;
  if exists (select 1 from public.elections where city_id = p_city_id) then
    raise exception 'Cidade possui eleições vinculadas e não pode ser removida.';
  end if;

  delete from public.cities where id = p_city_id;
  insert into public.admin_action_logs (profile_id, action, details)
  values (v_profile_id, 'removeu_cidade_legada', jsonb_build_object('city_id', p_city_id, 'name', v_name));
end;
$$;

revoke execute on function public.admin_delete_city(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_city(uuid) to authenticated;

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
  if not public.is_official_city(p_city_id) then
    raise exception 'A eleição deve pertencer a Bom Jardim - MG.';
  end if;
  if p_year not between 2026 and 2100 then
    raise exception 'Ano da edição inválido.';
  end if;
  if p_start_date >= p_end_date then
    raise exception 'Período de votação inválido.';
  end if;

  insert into public.elections (city_id, year, start_date, end_date, status)
  values (p_city_id, p_year, p_start_date, p_end_date, 'rascunho')
  returning id into v_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'criou_eleicao_bom_jardim',
    jsonb_build_object('election_id', v_id, 'city_id', p_city_id, 'year', p_year)
  );
  return v_id;
end;
$$;

revoke execute on function public.admin_create_election(uuid, integer, timestamp with time zone, timestamp with time zone)
  from public, anon, authenticated;
grant execute on function public.admin_create_election(uuid, integer, timestamp with time zone, timestamp with time zone)
  to authenticated;

commit;
