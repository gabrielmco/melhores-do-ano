-- ============================================================================
-- EMPÓRIO EXCELÊNCIA - SCRIPT DE TESTES E VALIDAÇÃO DO BANCO DE DADOS
-- ============================================================================
-- Este script permite validar a criação de tabelas, inserção de dados fictícios,
-- funcionamento das políticas de RLS e validação de todas as RPCs implementadas.
-- Execute este script no Query Editor do Supabase para testar local ou remotamente.

BEGIN;

-- 1. LIMPEZA DE DADOS ANTERIORES PARA UM TESTE LIMPO
TRUNCATE public.profiles, public.cities, public.categories, public.elections, 
         public.candidates, public.candidate_aliases, public.nominations, 
         public.votes, public.vote_attempts, public.suspicious_vote_flags, 
         public.admin_action_logs, public.winners CASCADE;

-- 2. INSERIR PERFIS DE TESTE COM DIFERENTES CRÉDITOS E PAPÉIS
-- NOTA: Como a tabela profiles aponta para auth.users, criamos UUIDs fictícios para simular as sessões de login.
INSERT INTO public.profiles (id, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Super Admin Teste', 'super_admin'),
  ('00000000-0000-0000-0000-000000000002', 'Admin Teste', 'admin'),
  ('00000000-0000-0000-0000-000000000003', 'Moderador Teste', 'moderador'),
  ('00000000-0000-0000-0000-000000000004', 'Comercial Teste', 'comercial'),
  ('00000000-0000-0000-0000-000000000005', 'Candidato Teste 1', 'candidato'),
  ('00000000-0000-0000-0000-000000000006', 'Candidato Teste 2', 'candidato'),
  ('00000000-0000-0000-0000-000000000007', 'Visitante Autenticado', 'candidato');

-- 3. INSERIR ESTRUTURA BÁSICA (Cidade, Eleição, Categorias)
INSERT INTO public.cities (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'São Paulo');

-- Criar Eleição aberta (em andamento)
INSERT INTO public.elections (id, city_id, year, status, start_date, end_date) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2026, 'aberta', now() - interval '1 day', now() + interval '5 days');

-- Inserir Categorias
INSERT INTO public.categories (id, name) VALUES
  ('33333333-3333-3333-3333-333333333331', 'Melhor Restaurante'),
  ('33333333-3333-3333-3333-333333333332', 'Melhor Confeitaria');

-- Associar Categorias à Eleição
INSERT INTO public.city_categories (election_id, category_id) VALUES
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331'),
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333332');

-- 4. INSERIR CANDIDATOS
INSERT INTO public.candidates (id, election_id, category_id, name, normalized_name, type, instagram, whatsapp, email, status, profile_id) VALUES
  (
    '44444444-4444-4444-4444-444444444441', 
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333331', 
    'Restaurante Sabor Imperial', 
    'restaurante sabor imperial', 
    'empresa', 
    '@saborimperial', 
    '11999999991', 
    'contato@saborimperial.com.br', 
    'aprovado', 
    '00000000-0000-0000-0000-000000000005'
  ),
  (
    '44444444-4444-4444-4444-444444444442', 
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333331', 
    'Chefe Joao Silva (Sabor Imperial)', -- Duplicado a ser mesclado
    'chefe joao silva sabor imperial', 
    'profissional', 
    '@chefejoaosilva', 
    '11999999992', 
    'joao@saborimperial.com.br', 
    'aprovado', 
    '00000000-0000-0000-0000-000000000006'
  ),
  (
    '44444444-4444-4444-4444-444444444443', 
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333332', 
    'Doce Encanto Confeitaria', 
    'doce encanto confeitaria', 
    'empresa', 
    '@doceencanto', 
    '11999999993', 
    'contato@doceencanto.com.br', 
    'aprovado', 
    null
  );

-- 5. SIMULAR CONTEXTOS DE USUÁRIOS E RLS
-- Simular usuário anônimo / visitante (sem login)
-- RLS e privilégios devem impedir leitura de candidates direto, permitindo apenas pela view pública.
RAISE NOTICE '=== Testando restrições de tabelas para Anônimo ===';
SET LOCAL role to anon;
SET LOCAL "request.jwt.claims" to '{"sub":null}';

-- Tentativa de ler a tabela candidates direto deve retornar erro ou ser bloqueada
-- select whatsapp from public.candidates; -- Descomente para ver o erro de Grant disparar

-- Leitura via View Pública (Deve rodar com sucesso e omitir whatsapp/email)
SELECT id, name, instagram FROM public.public_candidates;

-- Simular usuário candidato logado (Candidato 1)
RAISE NOTICE '=== Testando restrições para Candidato Logado ===';
SET LOCAL role to authenticated;
SET LOCAL "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000005"}';

-- Candidato tenta ver seus dados por RPC (get_my_candidate_profile)
SELECT id, name, whatsapp, email, commercial_status FROM public.get_my_candidate_profile();

-- Candidato tenta atualizar seu próprio perfil via RPC (update_candidate_profile)
SELECT public.update_candidate_profile(
  '44444444-4444-4444-4444-444444444441', 
  '@saborimperial_oficial', 
  '11988888888', 
  'sac@saborimperial.com.br', 
  'https://images.com/logo.png', 
  'Nova descrição do restaurante imperial'
);

-- Verificar se a atualização funcionou pelo RPC
SELECT name, instagram, whatsapp, email FROM public.get_my_candidate_profile();

-- 6. SIMULAR FLUXO DE VOTAÇÃO SEGURO (RPC cast_vote executado por Service Role)
-- Esta RPC simula o processamento da Deno Edge Function após validações.
RAISE NOTICE '=== Testando Votação Segura (cast_vote) ===';
SET LOCAL role to service_role;

-- Voto 1: Valido
SELECT public.cast_vote(
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333331',
  '44444444-4444-4444-4444-444444444441',
  'Eleitor A',
  'hmachash_eleitor_a_123',
  'whatsapp',
  '189.50.21.4'::inet,
  'Mozilla/5.0',
  '66666666-6666-6666-6666-666666666661',
  true,
  true
) as voto_1;

-- Voto 2: Valido (em candidato concorrente/duplicado)
SELECT public.cast_vote(
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333331',
  '44444444-4444-4444-4444-444444444442',
  'Eleitor B',
  'hmachash_eleitor_b_456',
  'whatsapp',
  '189.50.21.5'::inet,
  'Mozilla/5.0',
  '66666666-6666-6666-6666-666666666662',
  true,
  true
) as voto_2;

-- Voto 3: Duplicado (Eleitor A tenta votar de novo na mesma categoria)
SELECT public.cast_vote(
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333331',
  '44444444-4444-4444-4444-444444444441',
  'Eleitor A de novo',
  'hmachash_eleitor_a_123',
  'whatsapp',
  '189.50.21.4'::inet,
  'Mozilla/5.0',
  '66666666-6666-6666-6666-666666666661',
  true,
  true
) as voto_duplicado;

-- 7. SIMULAR ATUALIZAÇÃO CRM PELO TIME COMERCIAL
RAISE NOTICE '=== Testando CRM Comercial ===';
SET LOCAL role to authenticated;
SET LOCAL "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000004"}';
SELECT public.update_candidate_commercial_status_v2(
  '44444444-4444-4444-4444-444444444441',
  'chamou no WhatsApp',
  'Contato inicial com o gerente. Demonstrou bastante interesse no selo.',
  'kit_premium',
  'Enviar proposta e link de pagamento',
  current_date + 2,
  799.90
);

-- Testar listagem CRM por RPC (Como Comercial)
SELECT id, name, category_name, whatsapp, email, commercial_status, commercial_package, commercial_next_action, commercial_follow_up_date, commercial_value_estimate
FROM public.get_crm_candidates_v2('22222222-2222-2222-2222-222222222222');

SET LOCAL role to service_role;

-- 8. SIMULAR MESCLAGEM DE CONCORRENTES DUPLICADOS
RAISE NOTICE '=== Testando Mesclagem de Candidatos (merge_candidates) ===';
SET LOCAL role to authenticated;
SET LOCAL "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000002"}';
-- Mesclar 'Chefe Joao Silva' (duplicado) para 'Restaurante Sabor Imperial' (alvo)
SELECT public.merge_candidates(
  '44444444-4444-4444-4444-444444444441', -- Target
  '44444444-4444-4444-4444-444444444442'  -- Duplicate
);

SET LOCAL role to service_role;

-- Verificar se os votos do duplicado foram migrados para o oficial
-- (Deverá retornar 2 votos válidos para o oficial)
SELECT count(*) as total_votos_sabor_imperial
FROM public.votes
WHERE candidate_id = '44444444-4444-4444-4444-444444444441' AND status = 'valido';

-- Verificar se o apelido/alias foi registrado
SELECT alias, normalized_alias FROM public.candidate_aliases;

-- 9. FECHAR ELEIÇÃO E PUBLICAR RESULTADOS
RAISE NOTICE '=== Testando Publicação de Resultados ===';
-- Primeiro, encerramos a eleição para permitir apuração
UPDATE public.elections SET status = 'encerrada' WHERE id = '22222222-2222-2222-2222-222222222222';

-- Publicar Resultados
SET LOCAL role to authenticated;
SET LOCAL "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000002"}';
SELECT public.publish_results(
  '22222222-2222-2222-2222-222222222222'
);

-- Visualizar vencedores oficiais gerados pela publicação
SELECT position, candidate_name, vote_count_snapshot 
FROM public.public_winners;

ROLLBACK;
