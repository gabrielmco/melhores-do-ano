-- Supabase Migration - 202607150002_update_cast_vote_secure.sql
begin;

-- Atualizar a função cast_vote_secure para verificar a fase ativa do evento
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
  v_current_phase text;
begin
  -- 1. Validar payloads e formatos básicos
  if p_voter_type not in ('email', 'whatsapp')
    or length(trim(coalesce(p_voter_name, ''))) not between 2 and 120
    or coalesce(p_voter_identifier, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_ip_address_hash, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_user_agent_hash, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_cookie_id_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('success', false, 'reason', 'invalid_payload');
  end if;

  -- 2. Verificar se o evento está na fase oficial de votação
  select value into v_current_phase from public.event_config where key = 'current_phase';
  if coalesce(v_current_phase, 'voting') <> 'voting' then
    insert into public.vote_attempts (
      election_id, category_id, candidate_id, voter_identifier_hash,
      ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
    ) values (
      p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
      p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, false, 'election_not_open'
    );
    return jsonb_build_object('success', false, 'reason', 'election_not_open');
  end if;

  -- 3. Limitação de taxa por IP (Max 15 tentativas a cada 5 minutos)
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

  -- 4. Validar consentimento de privacidade e auditoria
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

  -- 5. Validar se a eleição está cadastrada e com status de aberta
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

  -- 6. Validar se a categoria está vinculada e ativa nesta eleição
  if not exists (
    select 1 from public.city_categories
    where election_id = p_election_id and category_id = p_category_id
  ) then
    return jsonb_build_object('success', false, 'reason', 'category_inactive');
  end if;

  -- 7. Validar se o candidato é legítimo, ativo e aprovado nesta categoria/eleição
  select * into v_candidate from public.candidates where id = p_candidate_id;
  if v_candidate.id is null
    or v_candidate.status <> 'aprovado'
    or v_candidate.election_id <> p_election_id
    or v_candidate.category_id <> p_category_id then
    return jsonb_build_object('success', false, 'reason', 'invalid_candidate');
  end if;

  -- 8. Tentar inserir o voto de forma transacional e segura
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

  -- 9. Registrar tentativa de voto com sucesso para fins de log de auditoria
  insert into public.vote_attempts (
    election_id, category_id, candidate_id, voter_identifier_hash,
    ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
  ) values (
    p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
    p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, true, 'success'
  );

  return jsonb_build_object('success', true);
end;
$$;

commit;
