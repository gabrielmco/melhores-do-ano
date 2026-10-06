-- Supabase Migration - 202607150003_vote_rectification_support.sql
-- Adiciona suporte à retificação e mudança de voto pelo mesmo eleitor na mesma categoria
begin;

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
  v_vote_id uuid;
  v_current_phase text;
  v_existing_candidate_id uuid;
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

    -- 9. Registrar tentativa de voto com sucesso para fins de log de auditoria
    insert into public.vote_attempts (
      election_id, category_id, candidate_id, voter_identifier_hash,
      ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
    ) values (
      p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
      p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, true, 'success'
    );

    return jsonb_build_object('success', true, 'action', 'created');

  exception
    when unique_violation then
      -- O eleitor já possui um voto nesta categoria
      select candidate_id into v_existing_candidate_id
      from public.votes
      where election_id = p_election_id
        and category_id = p_category_id
        and voter_identifier = p_voter_identifier;

      if v_existing_candidate_id = p_candidate_id then
        -- Votou exatamente no mesmo candidato: duplicado real
        insert into public.vote_attempts (
          election_id, category_id, candidate_id, voter_identifier_hash,
          ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
        ) values (
          p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
          p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, false, 'duplicate_vote'
        );
        return jsonb_build_object(
          'success', false,
          'reason', 'duplicate_vote',
          'message', 'Você já confirmou seu voto neste candidato nesta categoria.'
        );
      else
        -- Eleitor quer retificar e mudar seu voto para outro candidato da mesma categoria
        update public.votes
        set candidate_id = p_candidate_id,
            voter_name = trim(p_voter_name),
            voter_type = p_voter_type,
            ip_address_hash = p_ip_address_hash,
            user_agent_hash = p_user_agent_hash,
            cookie_id_hash = p_cookie_id_hash,
            created_at = now()
        where election_id = p_election_id
          and category_id = p_category_id
          and voter_identifier = p_voter_identifier;

        insert into public.vote_attempts (
          election_id, category_id, candidate_id, voter_identifier_hash,
          ip_address_hash, user_agent_hash, cookie_id_hash, success, reason
        ) values (
          p_election_id, p_category_id, p_candidate_id, p_voter_identifier,
          p_ip_address_hash, p_user_agent_hash, p_cookie_id_hash, true, 'vote_updated'
        );

        return jsonb_build_object(
          'success', true,
          'action', 'updated',
          'message', 'Seu voto foi retificado com sucesso! Sua nova escolha substituiu o voto anterior.'
        );
      end if;
  end;
end;
$$;

-- Atualizar approve_nomination para transferir o voto caso o indicante já tenha votado na categoria
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
      -- O indicante já havia votado antes: transferimos o voto dele para o candidato que ele acabou de indicar
      update public.votes
      set candidate_id = v_candidate_id,
          voter_name = v_nom.voter_name,
          voter_type = v_nom.voter_type,
          ip_address_hash = v_nom.ip_address_hash,
          user_agent_hash = v_nom.user_agent_hash,
          cookie_id_hash = v_nom.cookie_id_hash,
          created_at = now()
      where election_id = v_nom.election_id
        and category_id = v_nom.category_id
        and voter_identifier = v_nom.voter_identifier_hash;
      v_vote_created := true;
      v_vote_skipped_reason := 'vote_updated';
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

revoke execute on function public.approve_nomination(uuid) from public, anon, authenticated;
grant execute on function public.approve_nomination(uuid) to authenticated;

commit;
