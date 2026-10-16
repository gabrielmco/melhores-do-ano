import fs from 'fs';
import path from 'path';

console.log('=== TESTE DE VALIDAÇÃO: ETAPA 12 - UX RESILIÊNCIA, PACIFICADOR E ADMIN SIMPLIFICADO ===\n');

let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Validar candidato.html
const candHtml = fs.readFileSync('candidato.html', 'utf-8');
assert(!candHtml.includes('top: -16px'), 'candidato.html não possui mais o estilo quebrado top: -16px');
assert(candHtml.includes('auth-card-nav') && candHtml.includes('btn-back-clean'), 'candidato.html possui auth-card-nav e btn-back-clean integrados no fluxo');
assert(candHtml.includes('data-safe-back'), 'candidato.html usa data-safe-back');
assert(!candHtml.includes('✉️'), 'candidato.html não contém emoji de envelope');
assert(!candHtml.includes('🗳️'), 'candidato.html não contém emoji de urna');
assert(!candHtml.includes('🏠'), 'candidato.html não contém emoji de casa');
assert(!candHtml.includes('📥'), 'candidato.html não contém emoji de inbox');
assert(!candHtml.includes('📋'), 'candidato.html não contém emoji de prancheta');
assert(candHtml.includes('Placa Oficial com Certificado'), 'candidato.html apresenta a Placa Oficial com Certificado');

// 2. Validar admin.html
const adminHtml = fs.readFileSync('admin.html', 'utf-8');
assert(!adminHtml.includes('panel-mode-switcher'), 'admin.html não possui o bloco confuso panel-mode-switcher');
assert(!adminHtml.includes('👑 Gestão'), 'admin.html não possui botões com emojis');
assert(!adminHtml.includes('⚡'), 'admin.html não contém emoji de raio');
assert(!adminHtml.includes('💼'), 'admin.html não contém emoji de maleta');
assert(adminHtml.includes('Aprovar Candidatos'), 'admin.html possui nome amigável "Aprovar Candidatos"');
assert(adminHtml.includes('Juntar Nomes Duplicados'), 'admin.html possui nome amigável "Juntar Nomes Duplicados"');
assert(adminHtml.includes('Controle da Votação & Prazo'), 'admin.html possui nome amigável "Controle da Votação & Prazo"');
assert(adminHtml.includes('Cidades & Categorias'), 'admin.html possui nome amigável "Cidades & Categorias"');
assert(adminHtml.includes('Vendas da Placa Oficial'), 'admin.html possui nome amigável "Vendas da Placa Oficial"');
assert(adminHtml.includes('Segurança & Votos'), 'admin.html possui nome amigável "Segurança & Votos"');
assert(adminHtml.includes('panel-guide-card'), 'admin.html possui cards de ajuda/guia (panel-guide-card)');
assert(adminHtml.includes('selfRegisteredTableBody'), 'admin.html possui tabela para empresas autocadastradas');

// 3. Validar CRM helpers e packages
const helpersJs = fs.readFileSync('src/js/admin/helpers.js', 'utf-8');
assert(!helpersJs.includes('Pacote a definir'), 'helpers.js não inclui "Pacote a definir"');
assert(!helpersJs.includes('selo_digital'), 'helpers.js não inclui "Selo digital"');
assert(!helpersJs.includes('kit_premium'), 'helpers.js não inclui "Kit premium"');
assert(helpersJs.includes('Placa Oficial com Certificado'), 'helpers.js trabalha exclusivamente com a Placa Oficial com Certificado');

// 4. Validar elections.js
const electionsJs = fs.readFileSync('src/js/admin/elections.js', 'utf-8');
assert(electionsJs.includes('handleReopenElection'), 'elections.js implementa handleReopenElection');
assert(electionsJs.includes('handleChangeElectionDeadline'), 'elections.js implementa handleChangeElectionDeadline');
assert(electionsJs.includes('Reabrir Votação'), 'elections.js possui texto amigável Reabrir Votação');

// 5. Validar safeBackNavigation.js
const safeBackJs = fs.readFileSync('src/js/safeBackNavigation.js', 'utf-8');
assert(safeBackJs.includes('mda_last_section'), 'safeBackNavigation.js rastreia seção mda_last_section');
assert(safeBackJs.includes('handleSafeBack'), 'safeBackNavigation.js exporta handleSafeBack');

// 6. Validar structure.js
const structJs = fs.readFileSync('src/js/admin/structure.js', 'utf-8');
assert(structJs.includes('Autocadastrado'), 'structure.js exibe badge de Autocadastrado');

// 7. Validar moderation.js
const modJs = fs.readFileSync('src/js/admin/moderation.js', 'utf-8');
assert(modJs.includes('loadSelfRegisteredCandidatesList'), 'moderation.js implementa loadSelfRegisteredCandidatesList');

console.log('\n----------------------------------------');
if (failed === 0) {
  console.log(' TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
} else {
  console.error(` ${failed} TESTES FALHARAM.`);
  process.exit(1);
}
