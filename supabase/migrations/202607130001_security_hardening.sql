begin;

-- Novos registros guardam apenas pseudônimos HMAC de rede, navegador e dispositivo.
alter table public.votes add column if not exists ip_address_hash text;
alter table public.votes add column if not exists user_agent_hash text;
alter table public.votes add column if not exists cookie_id_hash text;
alter table public.votes alter column ip_address drop not null;
alter table public.votes alter column cookie_id drop not null;

alter table public.vote_attempts add column if not exists ip_address_hash text;
alter table public.vote_attempts add column if not exists user_agent_hash text;
alter table public.vote_attempts add column if not exists cookie_id_hash text;
alter table public.vote_attempts alter column ip_address drop not null;

alter table public.nominations add column if not exists ip_address_hash text;
alter table public.nominations add column if not exists user_agent_hash text;
alter table public.nominations add column if not exists cookie_id_hash text;

create index if not exists idx_vote_attempts_ip_hash_created
  on public.vote_attempts (ip_address_hash, created_at);
create index if not exists idx_votes_cookie_hash_created
  on public.votes (cookie_id_hash, created_at);
create index if not exists idx_votes_contact_created
  on public.votes (voter_identifier, created_at);
create index if not exists idx_nominations_ip_hash_created
  on public.nominations (ip_address_hash, created_at);
create unique index if not exists idx_candidates_unique_active_name
  on public.candidates (election_id, category_id, normalized_name)
  where status in ('pendente', 'aprovado');
create unique index if not exists idx_flags_vote_reason
  on public.suspicious_vote_flags (vote_id, reason);

-- O comercial não precisa receber os dados pessoais de quem fez indicações.
drop policy if exists admin_candidates_all on public.candidates;
create policy admin_candidates_all on public.candidates
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin']))
  with check (public.has_role(array['admin', 'super_admin']));

drop policy if exists staff_nominations_select on public.nominations;
create policy staff_nominations_select on public.nominations
  for select to authenticated
  using (public.has_role(array['admin', 'super_admin', 'moderador']));

drop policy if exists staff_nominations_mod on public.nominations;
create policy staff_nominations_mod on public.nominations
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin', 'moderador']))
  with check (public.has_role(array['admin', 'super_admin', 'moderador']));

drop policy if exists staff_flags_all on public.suspicious_vote_flags;
create policy staff_flags_select on public.suspicious_vote_flags
  for select to authenticated
  using (public.has_role(array['admin', 'super_admin', 'moderador']));
create policy admin_flags_manage on public.suspicious_vote_flags
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin']))
  with check (public.has_role(array['admin', 'super_admin']));

revoke all on public.votes, public.vote_attempts, public.suspicious_vote_flags,
  public.nominations, public.admin_action_logs from anon;

-- Mantém a assinatura usada pelo frontend, mas contatos não podem ser alterados pelo candidato.
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
  if not exists (
    select 1 from public.candidates
    where id = p_candidate_id and profile_id = auth.uid()
  ) then
    raise exception 'Acesso negado: você não é dono deste perfil.';
  end if;

  if nullif(trim(p_instagram), '') is not null
    and trim(p_instagram) !~ '^@?[A-Za-z0-9._]{1,30}$' then
    raise exception 'Instagram inválido.';
  end if;

  if p_logo_url is not null
    and length(p_logo_url) > 500 then
    raise exception 'URL do logo muito longa.';
  end if;

  if p_logo_url is not null
    and p_logo_url !~ '^https://'
    and p_logo_url !~ '^/assets/' then
    raise exception 'O logo deve usar HTTPS ou um arquivo interno.';
  end if;

  if p_description is not null and length(p_description) > 1000 then
    raise exception 'Descrição muito longa.';
  end if;

  update public.candidates
  set
    instagram = nullif(trim(p_instagram), ''),
    logo_url = nullif(trim(p_logo_url), ''),
    description = nullif(trim(p_description), '')
  where id = p_candidate_id;
end;
$$;

revoke execute on function public.update_candidate_profile(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.update_candidate_profile(uuid, text, text, text, text, text)
  to authenticated;

create or replace function public.cast_vote_secure(
  p_election_id uuid,
  p_category_id uuid,
  p_candidate_id uuid,
  p_voter_name text,
  p_voter_identifier text,
  p_voter_type text,
  p_ip_address_hash text,
  p_user_agent_hash text,
  p_cookie_id_hash text,
  p_privacy_consent boolean,
  p_validation_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_election public.elections%rowtype;
  v_candidate public.candidates%rowtype;
  v_recent_attempts integer;
  v_distinct_contacts integer;
  v_distinct_devices integer;
  v_vote_id uuid;
begin
  if p_voter_type not in ('email', 'whatsapp')
    or length(trim(coalesce(p_voter_name, ''))) not between 2 and 120
    or coalesce(p_voter_identifier, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_ip_address_hash, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_user_agent_hash, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_cookie_id_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('success', false, 'reason', 'invalid_payload');
  end if;

  select count(*) into v_recent_attempts
  from public.vote_attempts
  where ip_address_hash = p_ip_address_hash
    and created_at > now() - interval '5 minutes';

  if v_recent_attempts >= 15 then
    insert into public.vote_attempts (
      election_id, category_id, candidate_id, voter_identifier_hash,
      ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
    ) values (
      p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
      p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, false, 'rate_limit_ip'
    );
    return jsonb_build_object('success', false, 'reason', 'rate_limit');
  end if;

  if not p_privacy_consent or not p_validation_consent then
    insert into public.vote_attempts (
      election_id, category_id, candidate_id, voter_identifier_hash,
      ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
    ) values (
      p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
      p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, false, 'lgpd_consent_missing'
    );
    return jsonb_build_object('success', false, 'reason', 'lgpd_consent_missing');
  end if;

  select * into v_election from public.elections where id = p_election_id;
  if v_election.id is null
    or v_election.status <> 'aberta'
    or now() not between v_election.start_date and v_election.end_date then
    insert into public.vote_attempts (
      election_id, category_id, candidate_id, voter_identifier_hash,
      ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
    ) values (
      p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
      p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, false, 'election_not_open'
    );
    return jsonb_build_object('success', false, 'reason', 'election_not_open');
  end if;

  if not exists (
    select 1 from public.city_categories
    where election_id = p_election_id and category_id = p_category_id
  ) then
    return jsonb_build_object('success', false, 'reason', 'category_inactive');
  end if;

  select * into v_candidate from public.candidates where id = p_candidate_id;
  if v_candidate.id is null
    or v_candidate.status <> 'aprovado'
    or v_candidate.election_id <> p_election_id
    or v_candidate.category_id <> p_category_id then
    return jsonb_build_object('success', false, 'reason', 'invalid_candidate');
  end if;

  begin
    insert into public.votes (
      election_id, category_id, candidate_id, voter_name, voter_identifier,
      voter_type, ip_address, user_agent, cookie_id, ip_address_hash,
      user_agent_hash, cookie_id_hash, privacy_consent, validation_consent, status
    ) values (
      p_election_id, p_category_id, p_candidate_id, trim(p_voter_name),
      p_voter_identifier, p_voter_type, null, null, null, p_ip_address_hash,
      p_user_agent_hash, p_cookie_id_hash, true, true, 'valido'
    ) returning id into v_vote_id;
  exception
    when unique_violation then
      insert into public.vote_attempts (
        election_id, category_id, candidate_id, voter_identifier_hash,
        ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
      ) values (
        p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
        p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, false, 'duplicate_vote'
      );
      return jsonb_build_object('success', false, 'reason', 'duplicate_vote');
  end;

  insert into public.vote_attempts (
    election_id, category_id, candidate_id, voter_identifier_hash,
    ip_address_hash, user_agent_hash, cookie_id_hash, success
  ) values (
    p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
    p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, true
  );

  select count(distinct voter_identifier) into v_distinct_contacts
  from public.votes
  where cookie_id_hash = p_cookie_id_hash
    and created_at > now() - interval '1 hour';

  if v_distinct_contacts >= 3 then
    insert into public.suspicious_vote_flags (vote_id, reason)
    values (v_vote_id, 'multiple_contacts_same_device')
    on conflict (vote_id, reason) do nothing;
  end if;

  select count(distinct cookie_id_hash) into v_distinct_devices
  from public.votes
  where voter_identifier = p_voter_identifier
    and created_at > now() - interval '1 hour';

  if v_distinct_devices >= 3 then
    insert into public.suspicious_vote_flags (vote_id, reason)
    values (v_vote_id, 'same_contact_multiple_devices')
    on conflict (vote_id, reason) do nothing;
  end if;

  if v_recent_attempts >= 9 then
    insert into public.suspicious_vote_flags (vote_id, reason)
    values (v_vote_id, 'high_velocity_network')
    on conflict (vote_id, reason) do nothing;
  end if;

  return jsonb_build_object('success', true, 'vote_id', v_vote_id);
end;
$$;

revoke execute on function public.cast_vote_secure(
  uuid, uuid, uuid, text, text, text, text, text, text, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.cast_vote_secure(
  uuid, uuid, uuid, text, text, text, text, text, text, boolean, boolean
) to service_role;

revoke execute on function public.cast_vote(
  uuid, uuid, uuid, text, text, text, inet, text, uuid, boolean, boolean
) from service_role;

create table if not exists public.manual_tiebreaks (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  winner_candidate_id uuid not null references public.candidates on delete restrict,
  decided_by uuid references public.profiles on delete set null,
  reason text,
  decided_at timestamp with time zone not null default now(),
  unique (election_id, category_id)
);

alter table public.manual_tiebreaks enable row level security;
create policy admin_tiebreaks_all on public.manual_tiebreaks
  for all to authenticated
  using (public.has_role(array['admin', 'super_admin']))
  with check (public.has_role(array['admin', 'super_admin']));

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
  v_top_votes integer;
  v_candidate_votes integer;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  select max(vote_count) into v_top_votes
  from (
    select candidate_id, count(*)::integer as vote_count
    from public.votes
    where election_id = p_election_id
      and category_id = p_category_id
      and status = 'valido'
    group by candidate_id
  ) ranked;

  select count(*)::integer into v_candidate_votes
  from public.votes
  where election_id = p_election_id
    and category_id = p_category_id
    and candidate_id = p_winner_candidate_id
    and status = 'valido';

  if v_top_votes is null or v_candidate_votes <> v_top_votes then
    raise exception 'Candidato escolhido não está empatado no primeiro lugar.';
  end if;

  if (
    select count(*) from (
      select candidate_id, count(*) as vote_count
      from public.votes
      where election_id = p_election_id
        and category_id = p_category_id
        and status = 'valido'
      group by candidate_id
    ) ranked where vote_count = v_top_votes
  ) < 2 then
    raise exception 'Não há empate de primeiro lugar nesta categoria.';
  end if;

  insert into public.manual_tiebreaks (
    election_id, category_id, winner_candidate_id, decided_by, reason
  ) values (
    p_election_id, p_category_id, p_winner_candidate_id, v_profile_id,
    'Decisão administrativa de desempate'
  )
  on conflict (election_id, category_id) do update
  set winner_candidate_id = excluded.winner_candidate_id,
      decided_by = excluded.decided_by,
      reason = excluded.reason,
      decided_at = now();

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'resolveu_empate_primeiro_lugar',
    jsonb_build_object(
      'election_id', p_election_id,
      'category_id', p_category_id,
      'winner_candidate_id', p_winner_candidate_id,
      'method', 'governance_decision_without_synthetic_vote'
    )
  );
end;
$$;

revoke execute on function public.resolve_first_place_tie(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_first_place_tie(uuid, uuid, uuid)
  to authenticated;

create or replace function public.publish_results(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid := auth.uid();
  v_election_status text;
  r_row record;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado: perfil sem privilégios para publicação.';
  end if;

  select status into v_election_status
  from public.elections where id = p_election_id;
  if v_election_status is null
    or v_election_status not in ('encerrada', 'apuracao') then
    raise exception 'A publicação requer eleição encerrada ou em apuração.';
  end if;

  if exists (
    with totals as (
      select category_id, candidate_id, count(*)::integer as vote_count
      from public.votes
      where election_id = p_election_id and status = 'valido'
      group by category_id, candidate_id
    ),
    top_totals as (
      select category_id, max(vote_count) as top_count
      from totals group by category_id
    ),
    tied_categories as (
      select t.category_id, tt.top_count
      from totals t
      join top_totals tt
        on tt.category_id = t.category_id and tt.top_count = t.vote_count
      group by t.category_id, tt.top_count
      having count(*) > 1
    )
    select 1
    from tied_categories tc
    left join public.manual_tiebreaks mt
      on mt.election_id = p_election_id and mt.category_id = tc.category_id
    where mt.id is null
      or not exists (
        select 1 from totals t
        where t.category_id = tc.category_id
          and t.candidate_id = mt.winner_candidate_id
          and t.vote_count = tc.top_count
      )
  ) then
    raise exception 'Há empate de primeiro lugar sem decisão administrativa válida.';
  end if;

  delete from public.winners where election_id = p_election_id;

  for r_row in (
    with totals as (
      select candidate_id, category_id, count(*)::integer as total_votes
      from public.votes
      where election_id = p_election_id and status = 'valido'
      group by candidate_id, category_id
    )
    select
      t.candidate_id,
      t.category_id,
      t.total_votes,
      row_number() over (
        partition by t.category_id
        order by
          t.total_votes desc,
          (t.candidate_id = mt.winner_candidate_id) desc,
          t.candidate_id
      ) as pos
    from totals t
    left join public.manual_tiebreaks mt
      on mt.election_id = p_election_id and mt.category_id = t.category_id
  ) loop
    insert into public.winners (
      election_id, category_id, candidate_id, vote_count_snapshot,
      position, published_by, is_public
    ) values (
      p_election_id, r_row.category_id, r_row.candidate_id,
      r_row.total_votes, r_row.pos, v_admin_profile_id, true
    );
  end loop;

  update public.elections set status = 'publicada' where id = p_election_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'publicou_resultado',
    jsonb_build_object('election_id', p_election_id, 'published_at', now())
  );
end;
$$;

revoke execute on function public.publish_results(uuid)
  from public, anon, authenticated;
grant execute on function public.publish_results(uuid) to authenticated;

-- A aprovação deixa de copiar contato do indicante e só cria o voto se a eleição segue aberta.
create or replace function public.approve_nomination(p_nomination_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid := auth.uid();
  v_nom public.nominations%rowtype;
  v_election public.elections%rowtype;
  v_candidate_id uuid;
  v_vote_created boolean := false;
  v_vote_skipped_reason text := null;
begin
  if not public.has_role(array['admin', 'super_admin', 'moderador']) then
    raise exception 'Acesso negado: perfil sem privilégio de moderação.';
  end if;

  select * into v_nom from public.nominations
  where id = p_nomination_id for update;
  if v_nom.id is null or v_nom.status <> 'pendente' then
    raise exception 'Indicação pendente não encontrada.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_nom.election_id::text || ':' || v_nom.category_id::text || ':' || v_nom.normalized_name,
      0
    )
  );

  if exists (
    select 1 from public.candidates
    where election_id = v_nom.election_id
      and category_id = v_nom.category_id
      and normalized_name = v_nom.normalized_name
      and status in ('pendente', 'aprovado')
  ) then
    raise exception 'Já existe um candidato ativo com este nome.';
  end if;

  insert into public.candidates (
    election_id, category_id, name, normalized_name, type, instagram,
    whatsapp, email, status
  ) values (
    v_nom.election_id, v_nom.category_id, v_nom.name, v_nom.normalized_name,
    v_nom.type, v_nom.instagram, 'Não informado', 'Não informado', 'aprovado'
  ) returning id into v_candidate_id;

  update public.nominations
  set status = 'aprovado', candidate_id = v_candidate_id
  where id = p_nomination_id;

  select * into v_election from public.elections where id = v_nom.election_id;

  if v_election.status = 'aberta'
    and now() between v_election.start_date and v_election.end_date
    and v_nom.voter_identifier_hash is not null
    and v_nom.ip_address_hash is not null
    and v_nom.user_agent_hash is not null
    and v_nom.cookie_id_hash is not null
    and v_nom.privacy_consent
    and v_nom.validation_consent then
    begin
      insert into public.votes (
        election_id, category_id, candidate_id, voter_name, voter_identifier,
        voter_type, ip_address, user_agent, cookie_id, ip_address_hash,
        user_agent_hash, cookie_id_hash, privacy_consent, validation_consent, status
      ) values (
        v_nom.election_id, v_nom.category_id, v_candidate_id, v_nom.voter_name,
        v_nom.voter_identifier_hash, v_nom.voter_type, null, null, null,
        v_nom.ip_address_hash, v_nom.user_agent_hash, v_nom.cookie_id_hash,
        true, true, 'valido'
      );
      v_vote_created := true;
    exception when unique_violation then
      v_vote_skipped_reason := 'duplicate_vote';
    end;
  else
    v_vote_skipped_reason := case
      when v_election.status <> 'aberta'
        or now() not between v_election.start_date and v_election.end_date
        then 'election_not_open'
      else 'missing_secure_audit_fields'
    end;
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

revoke execute on function public.approve_nomination(uuid)
  from public, anon, authenticated;
grant execute on function public.approve_nomination(uuid) to authenticated;

-- Corrige o literal que impedia o estágio inicial do CRM.
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
  if not public.has_role(array['admin', 'super_admin', 'comercial']) then
    raise exception 'Acesso negado: perfil sem privilégios comerciais.';
  end if;

  if p_commercial_status not in (
    'não contatado', 'chamou no WhatsApp', 'interessado', 'comprou', 'recusou'
  ) then
    raise exception 'Status comercial inválido.';
  end if;

  if coalesce(p_commercial_package, 'nao_definido') not in (
    'nao_definido', 'selo_digital', 'placa_classica', 'kit_premium'
  ) then
    raise exception 'Pacote comercial inválido.';
  end if;

  update public.candidates
  set commercial_status = p_commercial_status,
      commercial_notes = left(p_commercial_notes, 4000),
      commercial_package = coalesce(p_commercial_package, 'nao_definido'),
      commercial_owner_id = v_profile_id,
      commercial_next_action = left(p_commercial_next_action, 500),
      commercial_follow_up_date = p_commercial_follow_up_date,
      commercial_value_estimate = p_commercial_value_estimate,
      last_contact_date = now()
  where id = p_candidate_id;

  if not found then raise exception 'Candidato não encontrado.'; end if;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_profile_id,
    'atualizou_crm_candidato',
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'commercial_status', p_commercial_status,
      'commercial_package', coalesce(p_commercial_package, 'nao_definido')
    )
  );
end;
$$;

revoke execute on function public.update_candidate_commercial_status_v2(
  uuid, text, text, text, text, date, numeric
) from public, anon, authenticated;
grant execute on function public.update_candidate_commercial_status_v2(
  uuid, text, text, text, text, date, numeric
) to authenticated;

commit;
