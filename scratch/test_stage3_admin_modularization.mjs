/* ============================================================================
   TESTE AUTOMATIZADO - ETAPA 3: MODULARIZAÇÃO DO ADMIN & ISOLAMENTO DO MOCK
   ============================================================================ */

import {
  escapeHtml,
  CRM_PACKAGES,
  renderCrmPackageOptions,
  formatDateInput,
  formatCurrencyInput
} from '../src/js/admin/helpers.js';

import {
  getCurrentStaff,
  applyRolePermissions,
  showLogin
} from '../src/js/admin/auth.js';

import {
  loadNominations,
  approveNomination,
  rejectNomination
} from '../src/js/admin/moderation.js';

import {
  initMergeTab,
  loadMergeCategories,
  loadMergeCandidates,
  executeMergeFlow,
  setupMergeListeners
} from '../src/js/admin/merge.js';

import {
  initCrmTab,
  loadCrmData,
  setupCrmListeners
} from '../src/js/admin/crm.js';

import {
  loadElections,
  handleElectionAction,
  populateTieElectionOptions,
  loadTieCandidates,
  handleResolveTie,
  loadEventPhase,
  saveEventPhase,
  setupElectionsListeners
} from '../src/js/admin/elections.js';

import { loadLogsAndAudits } from '../src/js/admin/logs.js';

import {
  loadStructureSubTabData,
  loadCitiesList,
  handleAddCity,
  handleDeleteCity,
  loadCategoriesList,
  handleAddCategory,
  handleDeleteCategory,
  loadElectionsDropdowns,
  handleAddElection,
  loadLinkedCategoriesCheckboxList,
  handleSaveCategoryLinks,
  loadCandidatesDropdowns,
  loadCategoriesForElectionSelect,
  loadCandidatesForStructureList,
  handleEditCandidate,
  resetCandidateForm,
  handleAddOrUpdateCandidate,
  handleDeleteCandidate,
  setupStructureListeners
} from '../src/js/admin/structure.js';

import { createMockClient } from '../src/js/mockClient.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n--- 1. TESTE DE HELPERS DO ADMIN (escapeHtml, formatação, CRM packages) ---');

// escapeHtml
assert(escapeHtml('<script>alert("xss")</script>') === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'XSS com script sanitizado');
assert(escapeHtml("João & Maria's 'Bar'") === 'João &amp; Maria&#039;s &#039;Bar&#039;', 'Aspas e ampersand sanitizados');
assert(escapeHtml(null) === '', 'escapeHtml com null retorna string vazia');

// CRM packages
assert(Array.isArray(CRM_PACKAGES) && CRM_PACKAGES.length === 4, '4 pacotes de CRM definidos');
const optionsHtml = renderCrmPackageOptions('kit_premium');
assert(optionsHtml.includes('value="kit_premium" selected'), 'Pacote kit_premium renderizado como selecionado');
assert(optionsHtml.includes('value="selo_digital"'), 'Pacote selo_digital presente nas opções');

// formatDateInput
assert(formatDateInput('2026-10-15T14:30:00Z') === '2026-10-15', 'formatDateInput extrai YYYY-MM-DD');
assert(formatDateInput(null) === '', 'formatDateInput lida com null');

// formatCurrencyInput
assert(formatCurrencyInput(1500) === '1500.00', 'formatCurrencyInput formata número com 2 casas');
assert(formatCurrencyInput('249.9') === '249.90', 'formatCurrencyInput converte string numérica');
assert(formatCurrencyInput('') === '', 'formatCurrencyInput lida com string vazia');
assert(formatCurrencyInput(null) === '', 'formatCurrencyInput lida com null');

console.log('\n--- 2. TESTE DE MÓDULO DE AUTENTICAÇÃO E RBAC (admin/auth.js) ---');
assert(typeof getCurrentStaff === 'function', 'Função getCurrentStaff exportada');
assert(getCurrentStaff() === null, 'Estado inicial de currentStaff é null');
assert(typeof showLogin === 'function', 'Função showLogin exportada');
assert(typeof applyRolePermissions === 'function', 'Função applyRolePermissions exportada');

// Simular permissões com mock de DOM
const mockDomElements = {};
const fakeIds = ['navModeracao', 'navMesclagem', 'navCrm', 'navEleicoes', 'navLogs', 'navEstrutura'];
fakeIds.forEach(id => {
  mockDomElements[id] = { style: { display: '' } };
});

global.document = {
  getElementById: (id) => mockDomElements[id] || null
};

let switchedTo = '';
const mockSwitchTab = (tab) => { switchedTo = tab; };

// RBAC para Comercial
applyRolePermissions('comercial', mockSwitchTab);
assert(mockDomElements.navModeracao.style.display === 'none', 'Aba moderação oculta para comercial');
assert(mockDomElements.navCrm.style.display === 'flex', 'Aba CRM visível para comercial');
assert(mockDomElements.navEleicoes.style.display === 'none', 'Aba eleições oculta para comercial');
assert(switchedTo === 'tab-crm', 'Comercial redirecionado automaticamente para tab-crm');

// RBAC para Super Admin
applyRolePermissions('super_admin', mockSwitchTab);
assert(mockDomElements.navModeracao.style.display === 'flex', 'Aba moderação visível para super_admin');
assert(mockDomElements.navCrm.style.display === 'flex', 'Aba CRM visível para super_admin');
assert(mockDomElements.navEleicoes.style.display === 'flex', 'Aba eleições visível para super_admin');
assert(mockDomElements.navEstrutura.style.display === 'flex', 'Aba estrutura visível para super_admin');
assert(switchedTo === 'tab-moderacao', 'Super Admin redirecionado para tab-moderacao');

console.log('\n--- 3. TESTE DE CONTRATO DOS MÓDULOS DE DOMÍNIO ---');
assert(typeof loadNominations === 'function' && typeof approveNomination === 'function' && typeof rejectNomination === 'function', 'admin/moderation.js exporta todas as funções de moderação');
assert(typeof initMergeTab === 'function' && typeof loadMergeCategories === 'function' && typeof executeMergeFlow === 'function', 'admin/merge.js exporta todas as funções de mesclagem');
assert(typeof initCrmTab === 'function' && typeof loadCrmData === 'function' && typeof setupCrmListeners === 'function', 'admin/crm.js exporta todas as funções de CRM');
assert(typeof loadElections === 'function' && typeof handleResolveTie === 'function' && typeof saveEventPhase === 'function', 'admin/elections.js exporta todas as funções de eleição e fases');
assert(typeof loadLogsAndAudits === 'function', 'admin/logs.js exporta loadLogsAndAudits');
assert(typeof loadStructureSubTabData === 'function' && typeof handleAddOrUpdateCandidate === 'function' && typeof handleDeleteCandidate === 'function', 'admin/structure.js exporta todas as funções CRUD');

console.log('\n--- 4. TESTE DO MOCK CLIENT ISOLADO (mockClient.js) ---');
const mockSupabase = createMockClient();
assert(mockSupabase && typeof mockSupabase.from === 'function', 'Mock client instanciado com sucesso');
assert(typeof mockSupabase.auth.signInWithPassword === 'function', 'Mock client suporta auth.signInWithPassword');

// Teste de consulta no Mock Database
const { data: mockCities } = await mockSupabase.from('cities').select('*');
assert(Array.isArray(mockCities) && mockCities.length >= 1, 'Mock cities retorna dados iniciais');

// Teste de RPC no Mock
const { data: crmData } = await mockSupabase.rpc('get_crm_candidates_v2');
assert(Array.isArray(crmData) && crmData.length >= 2, 'Mock RPC get_crm_candidates_v2 retorna lista com candidatos');

const { data: createCityRes } = await mockSupabase.rpc('admin_create_city', { p_name: 'Cidade Teste' });
assert(createCityRes === true, 'Mock RPC admin_create_city executa com sucesso');

console.log(`\n========================================`);
console.log(`TOTAL: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ETAPA 3 VALIDADA COM 100% DE APROVAÇÃO!`);
}
