-- ============================================================================
-- MELHORES DO ANO - BOM JARDIM / MG
-- DADOS REAIS INICIAIS DA EDIÇÃO 2026 (SEM DADOS FICTÍCIOS OU MOCKS)
-- Execute este script no SQL Editor após o 01_SCHEMA_COMPLETO_PRODUCAO.sql
-- ============================================================================

BEGIN;

-- 1. GARANTIR A CIDADE OFICIAL DE BOM JARDIM - MG
DO $$
DECLARE
  v_city_id uuid;
BEGIN
  SELECT id INTO v_city_id FROM public.cities WHERE name = 'Bom Jardim - MG' LIMIT 1;
  IF v_city_id IS NULL THEN
    INSERT INTO public.cities (name) VALUES ('Bom Jardim - MG');
  END IF;
END $$;

-- 2. GARANTIR A ELEIÇÃO OFICIAL DE 2026
DO $$
DECLARE
  v_city_id uuid;
  v_election_id uuid;
BEGIN
  SELECT id INTO v_city_id FROM public.cities WHERE name = 'Bom Jardim - MG' LIMIT 1;

  SELECT id INTO v_election_id 
  FROM public.elections 
  WHERE city_id = v_city_id AND year = 2026 
  LIMIT 1;

  IF v_election_id IS NULL THEN
    INSERT INTO public.elections (city_id, year, status, start_date, end_date)
    VALUES (
      v_city_id, 
      2026, 
      'aberta', 
      '2026-01-01 00:00:00-03', 
      '2026-12-31 23:59:59-03'
    );
  ELSE
    UPDATE public.elections
    SET status = 'aberta'
    WHERE id = v_election_id;
  END IF;
END $$;

-- 3. CONFIGURAR FASE OFICIAL DA ELEIÇÃO
-- Opções de fase: 'voting' (votação liberada ao público) ou 'registration' (período de cadastro prévio)
INSERT INTO public.event_config (key, value)
VALUES ('current_phase', 'voting')
ON CONFLICT (key) DO UPDATE SET value = 'voting', updated_at = now();

-- 4. INSERIR CATEGORIAS COMERCIAIS E PROFISSIONAIS REAIS
INSERT INTO public.categories (name) VALUES
  ('Melhor Restaurante'),
  ('Melhor Pizzaria'),
  ('Melhor Hamburgueria'),
  ('Melhor Lanchonete'),
  ('Melhor Padaria e Confeitaria'),
  ('Melhor Cafeteria'),
  ('Melhor Bar e Petiscaria'),
  ('Melhor Sorveteria e Açaí'),
  ('Melhor Supermercado'),
  ('Melhor Farmácia'),
  ('Melhor Academia de Ginástica'),
  ('Melhor Salão de Beleza'),
  ('Melhor Barbearia'),
  ('Melhor Clínica de Estética'),
  ('Melhor Clínica Odontológica'),
  ('Melhor Loja de Moda e Vestuário'),
  ('Melhor Loja de Calçados'),
  ('Melhor Loja de Materiais de Construção'),
  ('Melhor Pet Shop e Agropecuária'),
  ('Melhor Ótica'),
  ('Melhor Oficina Mecânica'),
  ('Melhor Autoelétrica'),
  ('Melhor Provedor de Internet'),
  ('Melhor Escritório de Contabilidade'),
  ('Melhor Imobiliária'),
  ('Melhor Gráfica e Comunicação Visual'),
  ('Melhor Fotógrafo(a)')
ON CONFLICT (name) DO NOTHING;

-- 5. VINCULAR TODAS AS CATEGORIAS REAIS À ELEIÇÃO 2026 DE BOM JARDIM
DO $$
DECLARE
  v_election_id uuid;
  v_cat RECORD;
BEGIN
  SELECT e.id INTO v_election_id
  FROM public.elections e
  JOIN public.cities c ON c.id = e.city_id
  WHERE c.name = 'Bom Jardim - MG' AND e.year = 2026
  LIMIT 1;

  FOR v_cat IN SELECT id FROM public.categories LOOP
    INSERT INTO public.city_categories (election_id, category_id)
    VALUES (v_election_id, v_cat.id)
    ON CONFLICT (election_id, category_id) DO NOTHING;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- SUCESSO: Bom Jardim - MG e categorias oficiais de 2026 configuradas com dados reais!
-- Candidatos serão cadastrados pelas próprias empresas ou via indicação popular.
-- ============================================================================
