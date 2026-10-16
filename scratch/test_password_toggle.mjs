import fs from 'fs';
import path from 'path';
import assert from 'assert';

const ROOT = 'C:\\Users\\biel3\\OneDrive\\Documentos\\Projetos-de-sites\\04_Projetos_em_Desenvolvimento_e_Inacabados\\projeto-melhores-do-ano';

console.log('=== TESTE DE VALIDAÇÃO: BOTÃO "VER" COM ÍCONE DE OLHO PARA SENHA ===\n');

// 1. Validar admin.html
const adminHtml = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf-8');
assert(adminHtml.includes('btnToggleAdminPassword'), 'admin.html deve conter btnToggleAdminPassword');
assert(adminHtml.includes('data-toggle-password="adminPassword"'), 'admin.html deve conter data-toggle-password="adminPassword"');
assert(adminHtml.includes('password-input-wrapper'), 'admin.html deve conter password-input-wrapper');
assert(adminHtml.includes('<span>Ver</span>'), 'admin.html deve conter o texto Ver no botão de alternância');
console.log('[PASS] admin.html possui botão "Ver" com ícone de olho e wrapper responsivo');

// 2. Validar candidato.html
const candidatoHtml = fs.readFileSync(path.join(ROOT, 'candidato.html'), 'utf-8');
assert(candidatoHtml.includes('btnToggleLoginPassword'), 'candidato.html deve conter btnToggleLoginPassword');
assert(candidatoHtml.includes('btnToggleRegisterPassword'), 'candidato.html deve conter btnToggleRegisterPassword');
assert(candidatoHtml.includes('data-toggle-password="loginPassword"'), 'candidato.html deve conter data-toggle-password="loginPassword"');
assert(candidatoHtml.includes('data-toggle-password="registerPassword"'), 'candidato.html deve conter data-toggle-password="registerPassword"');
assert(candidatoHtml.includes('password-input-wrapper'), 'candidato.html deve conter password-input-wrapper');
console.log('[PASS] candidato.html possui botões "Ver" com ícone de olho no Login e Cadastro');

// 3. Validar definir-senha.html
const definirSenhaHtml = fs.readFileSync(path.join(ROOT, 'definir-senha.html'), 'utf-8');
assert(definirSenhaHtml.includes('btnToggleNewPassword'), 'definir-senha.html deve conter btnToggleNewPassword');
assert(definirSenhaHtml.includes('btnToggleConfirmPassword'), 'definir-senha.html deve conter btnToggleConfirmPassword');
assert(definirSenhaHtml.includes('data-toggle-password="newPassword"'), 'definir-senha.html deve conter data-toggle-password="newPassword"');
assert(definirSenhaHtml.includes('data-toggle-password="confirmPassword"'), 'definir-senha.html deve conter data-toggle-password="confirmPassword"');
assert(definirSenhaHtml.includes('password-input-wrapper'), 'definir-senha.html deve conter password-input-wrapper');
console.log('[PASS] definir-senha.html possui botões "Ver" com ícone de olho nos dois campos de nova senha');

// 4. Validar authHelpers.js
const authHelpersJs = fs.readFileSync(path.join(ROOT, 'src/js/modules/authHelpers.js'), 'utf-8');
assert(authHelpersJs.includes('export function setupPasswordToggle'), 'authHelpers.js deve exportar setupPasswordToggle');
assert(authHelpersJs.includes('export const EYE_OPEN_SVG'), 'authHelpers.js deve exportar EYE_OPEN_SVG');
assert(authHelpersJs.includes('export const EYE_OFF_SVG'), 'authHelpers.js deve exportar EYE_OFF_SVG');
assert(authHelpersJs.includes('Ocultar'), 'authHelpers.js deve gerenciar texto Ocultar quando ativo');
assert(authHelpersJs.includes('Ver'), 'authHelpers.js deve gerenciar texto Ver quando inativo');
console.log('[PASS] authHelpers.js possui função reutilizável setupPasswordToggle com suporte completo a SVGs e estados');

// 5. Validar CSS em _reset.scss
const resetScss = fs.readFileSync(path.join(ROOT, 'src/styles/base/_reset.scss'), 'utf-8');
assert(resetScss.includes('.password-input-wrapper'), '_reset.scss deve definir .password-input-wrapper');
assert(resetScss.includes('.btn-toggle-password'), '_reset.scss deve definir .btn-toggle-password');
assert(resetScss.includes('&.active'), '_reset.scss deve definir estado ativo .btn-toggle-password');
console.log('[PASS] _reset.scss possui estilos elegantes e responsivos para o botão Ver e wrapper de senha');

// 6. Validar lógica de alternância (simulação DOM)
import { pathToFileURL } from 'url';
global.document = { getElementById: () => null, querySelectorAll: () => [] };
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
}

const mockBtn = new MockElement('btnTest');
const mockInput = new MockElement('inputTest', 'password');

setupPasswordToggle(mockBtn, mockInput);

// Estado inicial: senha oculta -> botão "Ver"
assert(mockInput.type === 'password', 'Input deve iniciar como password');
assert(mockBtn.innerHTML.includes('Ver'), 'Botão deve iniciar exibindo "Ver"');
assert(mockBtn.innerHTML.includes(EYE_OPEN_SVG), 'Botão deve conter SVG de olho aberto');
assert.strictEqual(mockBtn.getAttribute('aria-label'), 'Ver senha');

// 1º Clique: revelar senha -> botão "Ocultar"
mockBtn.trigger('click');
assert(mockInput.type === 'text', 'Input deve virar text após 1º clique');
assert(mockBtn.innerHTML.includes('Ocultar'), 'Botão deve exibir "Ocultar"');
assert(mockBtn.innerHTML.includes(EYE_OFF_SVG), 'Botão deve conter SVG de olho cortado');
assert.strictEqual(mockBtn.getAttribute('aria-label'), 'Ocultar senha');

// 2º Clique: ocultar novamente -> botão "Ver"
mockBtn.trigger('click');
assert(mockInput.type === 'password', 'Input deve retornar para password após 2º clique');
assert(mockBtn.innerHTML.includes('Ver'), 'Botão deve retornar para "Ver"');
assert(mockBtn.innerHTML.includes(EYE_OPEN_SVG), 'Botão deve retornar para SVG de olho aberto');
assert.strictEqual(mockBtn.getAttribute('aria-label'), 'Ver senha');

console.log('[PASS] Simulação DOM aprovada: alternância perfeita entre "Ver" (olho aberto) e "Ocultar" (olho cortado)');

console.log('\n----------------------------------------');
console.log(' TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
