import fs from 'fs';
import path from 'path';
import assert from 'assert';

const ROOT = 'C:\\Users\\biel3\\OneDrive\\Documentos\\Projetos-de-sites\\04_Projetos_em_Desenvolvimento_e_Inacabados\\projeto-melhores-do-ano';

console.log('=== TESTE DE VALIDAÇÃO: BOTÃO APENAS ÍCONE DE OLHO ADAPTATIVO (PRETO NO CLARO / BRANCO NO ESCURO) ===\n');

// 1. Validar admin.html (Sem texto "Ver", apenas ícone)
const adminHtml = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf-8');
assert(adminHtml.includes('btnToggleAdminPassword'), 'admin.html deve conter btnToggleAdminPassword');
assert(adminHtml.includes('data-toggle-password="adminPassword"'), 'admin.html deve conter data-toggle-password="adminPassword"');
assert(adminHtml.includes('password-input-wrapper'), 'admin.html deve conter password-input-wrapper');
assert(!adminHtml.includes('<span>Ver</span>'), 'admin.html NÃO deve conter o texto Ver (apenas o ícone de olho)');
console.log('[PASS] admin.html possui botão de senha com apenas o ícone de olho (sem texto "Ver")');

// 2. Validar candidato.html (Sem texto "Ver", apenas ícone)
const candidatoHtml = fs.readFileSync(path.join(ROOT, 'candidato.html'), 'utf-8');
assert(candidatoHtml.includes('btnToggleLoginPassword'), 'candidato.html deve conter btnToggleLoginPassword');
assert(candidatoHtml.includes('btnToggleRegisterPassword'), 'candidato.html deve conter btnToggleRegisterPassword');
assert(!candidatoHtml.includes('<span>Ver</span>'), 'candidato.html NÃO deve conter o texto Ver');
console.log('[PASS] candidato.html possui botões com apenas o ícone de olho no Login e Cadastro');

// 3. Validar definir-senha.html (Sem texto "Ver", apenas ícone)
const definirSenhaHtml = fs.readFileSync(path.join(ROOT, 'definir-senha.html'), 'utf-8');
assert(definirSenhaHtml.includes('btnToggleNewPassword'), 'definir-senha.html deve conter btnToggleNewPassword');
assert(definirSenhaHtml.includes('btnToggleConfirmPassword'), 'definir-senha.html deve conter btnToggleConfirmPassword');
assert(!definirSenhaHtml.includes('<span>Ver</span>'), 'definir-senha.html NÃO deve conter o texto Ver');
console.log('[PASS] definir-senha.html possui botões com apenas o ícone de olho');

// 4. Validar authHelpers.js (apenas SVGs 18x18 e adaptação on-light-bg)
const authHelpersJs = fs.readFileSync(path.join(ROOT, 'src/js/modules/authHelpers.js'), 'utf-8');
assert(authHelpersJs.includes('export function setupPasswordToggle'), 'authHelpers.js deve exportar setupPasswordToggle');
assert(authHelpersJs.includes('on-light-bg'), 'authHelpers.js deve detectar e aplicar on-light-bg');
assert(authHelpersJs.includes('EYE_OPEN_SVG'), 'authHelpers.js deve exportar EYE_OPEN_SVG');
assert(authHelpersJs.includes('EYE_OFF_SVG'), 'authHelpers.js deve exportar EYE_OFF_SVG');
console.log('[PASS] authHelpers.js gerencia alternância pura de ícone e detecção automática de contraste');

// 5. Validar CSS em _reset.scss
const resetScss = fs.readFileSync(path.join(ROOT, 'src/styles/base/_reset.scss'), 'utf-8');
assert(resetScss.includes('.password-input-wrapper'), '_reset.scss deve definir .password-input-wrapper');
assert(resetScss.includes('.btn-toggle-password'), '_reset.scss deve definir .btn-toggle-password');
assert(resetScss.includes('&.on-light-bg'), '_reset.scss deve definir &.on-light-bg para olho preto');
assert(resetScss.includes('input:-webkit-autofill ~ .btn-toggle-password'), '_reset.scss deve estilizar irmão de autofill');
console.log('[PASS] _reset.scss possui regras de contraste: preto para blocos claros/autofill e branco/cinza para padrão escuro');

// 6. Validar lógica de alternância (simulação DOM)
import { pathToFileURL } from 'url';
global.document = { getElementById: () => null, querySelectorAll: () => [] };
global.window = { getComputedStyle: () => ({ backgroundColor: 'rgb(20, 20, 22)' }) };
const { setupPasswordToggle, EYE_OPEN_SVG, EYE_OFF_SVG } = await import(pathToFileURL(path.join(ROOT, 'src/js/modules/authHelpers.js')).href);

class MockElement {
  constructor(id, type = 'text') {
    this.id = id;
    this.type = type;
    this.value = 'minhasenha123';
    this.attributes = {};
    this.listeners = {};
    this.innerHTML = '';
    const set = new Set();
    this.classList = {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c)
    };
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(ev, fn) { this.listeners[ev] = fn; }
  trigger(ev, args = {}) { if (this.listeners[ev]) this.listeners[ev]({ preventDefault: () => {}, ...args }); }
  focus() {}
  setSelectionRange() {}
  matches() { return false; }
}

const mockBtn = new MockElement('btnTest');
const mockInput = new MockElement('inputTest', 'password');

setupPasswordToggle(mockBtn, mockInput);

// Estado inicial: senha oculta -> apenas ícone de olho aberto
assert.strictEqual(mockInput.type, 'password');
assert.strictEqual(mockBtn.innerHTML, EYE_OPEN_SVG);
assert.strictEqual(mockBtn.getAttribute('aria-label'), 'Ver senha');

// 1º Clique: revelar senha -> apenas ícone de olho cortado
mockBtn.trigger('click');
assert.strictEqual(mockInput.type, 'text');
assert.strictEqual(mockBtn.innerHTML, EYE_OFF_SVG);
assert.strictEqual(mockBtn.getAttribute('aria-label'), 'Ocultar senha');

// 2º Clique: ocultar novamente -> apenas ícone de olho aberto
mockBtn.trigger('click');
assert.strictEqual(mockInput.type, 'password');
assert.strictEqual(mockBtn.innerHTML, EYE_OPEN_SVG);
assert.strictEqual(mockBtn.getAttribute('aria-label'), 'Ver senha');

console.log('[PASS] Simulação DOM aprovada: exibição 100% de ícone puro sem texto "Ver", com alternância precisa');

console.log('\n----------------------------------------');
console.log(' TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
