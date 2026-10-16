-- ============================================================================
-- MIGRATION: 202610160001_production_resilience_and_reopen.sql
-- Adiciona suporte no Postgres para reabertura de eleições fechadas acidentalmente,
-- prorrogação de prazo auditada e gestão granular de vínculos de categoria.
-- ============================================================================

-- 1. RPC: reopen_election (Reabertura segura de votação)
create or replace function public.reopen_election(
  p_election_id uuid,
  p_new_end_date timestamp with time zone default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid := auth.uid();
  v_prev_status text;
  v_target_end timestamp with time zone;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado: Perfil sem privilégio para reabrir votação.';
  end if;

  select status, end_date into v_prev_status, v_target_end
  from public.elections
  where id = p_election_id;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  -- Se foi fornecida nova data final, utiliza; caso contrário, se a data estiver expirada, estende por 7 dias
  if p_new_end_date is not null then
    v_target_end := p_new_end_date;
  elsif v_target_end <= now() then
    v_target_end := now() + interval '7 days';
  end if;

  update public.elections
  set status = 'aberta',
      end_date = v_target_end
  where id = p_election_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'reabriu_eleicao',
    jsonb_build_object(
      'election_id', p_election_id,
      'previous_status', v_prev_status,
      'new_status', 'aberta',
      'end_date', v_target_end
    )
  );
end;
$$;

revoke execute on function public.reopen_election(uuid, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.reopen_election(uuid, timestamp with time zone) to authenticated;

-- 2. RPC: extend_election_deadline (Prorrogação ou alteração de prazo de votação)
create or replace function public.extend_election_deadline(
  p_election_id uuid,
  p_new_end_date timestamp with time zone
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid := auth.uid();
  v_current_start timestamp with time zone;
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado: Perfil sem privilégio para alterar prazos.';
  end if;

  select start_date into v_current_start
  from public.elections
  where id = p_election_id;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  if p_new_end_date <= v_current_start then
    raise exception 'A nova data final deve ser posterior à data de início da eleição.';
  end if;

  update public.elections
  set end_date = p_new_end_date
  where id = p_election_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'alterou_prazo_eleicao',
    jsonb_build_object(
      'election_id', p_election_id,
      'new_end_date', p_new_end_date
    )
  );
end;
$$;

revoke execute on function public.extend_election_deadline(uuid, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.extend_election_deadline(uuid, timestamp with time zone) to authenticated;

-- 3. RPC: admin_link_single_category (Vincular categoria individual na eleição corrente)
create or replace function public.admin_link_single_category(
  p_election_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid := auth.uid();
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  insert into public.city_categories (election_id, category_id)
  values (p_election_id, p_category_id)
  on conflict (election_id, category_id) do nothing;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'vinculou_categoria_individual',
    jsonb_build_object('election_id', p_election_id, 'category_id', p_category_id)
  );
end;
$$;

revoke execute on function public.admin_link_single_category(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_link_single_category(uuid, uuid) to authenticated;

-- 4. RPC: admin_unlink_single_category (Desvincular categoria de eleição)
create or replace function public.admin_unlink_single_category(
  p_election_id uuid,
  p_category_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid := auth.uid();
begin
  if not public.has_role(array['admin', 'super_admin']) then
    raise exception 'Acesso negado.';
  end if;

  delete from public.city_categories
  where election_id = p_election_id
    and category_id = p_category_id;

  insert into public.admin_action_logs (profile_id, action, details)
  values (
    v_admin_profile_id,
    'desvinculou_categoria_individual',
    jsonb_build_object('election_id', p_election_id, 'category_id', p_category_id)
  );
end;
$$;

revoke execute on function public.admin_unlink_single_category(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_unlink_single_category(uuid, uuid) to authenticated;
