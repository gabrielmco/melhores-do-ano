/* ============================================================================
   TESTE AUTOMATIZADO - ETAPA 1: SEGURANÇA, ANTI-FRAUDE E VALIDAÇÃO DE ELEITORES
   ============================================================================ */

import { validateWhatsapp, validateEmail, maskContact, VALID_BRAZILIAN_DDDS } from '../src/js/modules/voterValidation.js';

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

console.log('\n--- 1. TESTE DE VALIDAÇÃO DE WHATSAPP ---');

// Casos Válidos
const validPhones = [
  { input: '(32) 99845-2003', desc: 'DDD 32 (Zona da Mata/Bom Jardim) celular padrão' },
  { input: '32998452003', desc: 'DDD 32 sem máscara' },
  { input: '+55 32 99845-2003', desc: 'DDD 32 com DDI +55' },
  { input: '5532998452003', desc: 'Com DDI 55 sem símbolos' },
  { input: '(11) 98765-4321', desc: 'DDD 11 (SP) celular' },
  { input: '(21) 97654-3210', desc: 'DDD 21 (RJ) celular' },
  { input: '(31) 99123-4567', desc: 'DDD 31 (BH) celular' },
  { input: '(32) 3331-1234', desc: 'DDD 32 fixo corporativo (10 dígitos)' }
];

for (const tc of validPhones) {
  const res = validateWhatsapp(tc.input);
  assert(res.valid === true, `${tc.desc}: "${tc.input}" deve ser válido`);
}

console.log('\n--- 2. TESTE DE BLOQUEIO DE NÚMEROS FRAUDULENTOS/INVÁLIDOS ---');

// Casos Inválidos
const invalidPhones = [
  { input: '', desc: 'Vazio' },
  { input: '12345', desc: 'Dígitos insuficientes' },
  { input: '11111111111', desc: 'Dígitos todos repetidos (11)' },
  { input: '00000000000', desc: 'Dígitos todos zeros' },
  { input: '99999999999', desc: 'Dígitos todos noves' },
  { input: '32999999999', desc: 'DDD válido mas número local todo repetido (99999-9999)' },
  { input: '11888888888', desc: 'DDD 11 com número repetido (88888-8888)' },
  { input: '(00) 99999-8888', desc: 'DDD 00 inexistente' },
  { input: '(36) 99845-2003', desc: 'DDD 36 inexistente' },
  { input: '(23) 99845-2003', desc: 'DDD 23 inexistente' },
  { input: '(32) 89845-2003', desc: 'Celular 11 dígitos sem dígito 9 (inicia com 8)' },
  { input: '12345678901', desc: 'Sequência progressiva óbvia' },
  { input: '98765432109', desc: 'Sequência regressiva óbvia' }
];

for (const tc of invalidPhones) {
  const res = validateWhatsapp(tc.input);
  assert(res.valid === false, `${tc.desc}: "${tc.input}" deve ser rejeitado (Motivo: ${res.reason})`);
}

console.log('\n--- 3. TESTE DE VALIDAÇÃO DE E-MAIL ---');

const validEmails = [
  'eleitor@gmail.com',
  'contato.empresa@bomjardim.mg.gov.br',
  'maria_silva+voto@outlook.com'
];
for (const email of validEmails) {
  const res = validateEmail(email);
  assert(res.valid === true, `E-mail válido: "${email}"`);
}

const invalidEmails = [
  '',
  'invalido',
  'teste@',
  '@dominio.com',
  'test@test.com', // Dummy
  'teste@teste.com' // Dummy
];
for (const email of invalidEmails) {
  const res = validateEmail(email);
  assert(res.valid === false, `E-mail inválido rejeitado: "${email}" (Motivo: ${res.reason})`);
}

console.log('\n--- 4. TESTE DE MASCARAMENTO DIEGÉTICO ---');
const maskedPhone = maskContact('32998452003', 'whatsapp');
assert(maskedPhone === '(32) 9****-2003', `Máscara WhatsApp: "${maskedPhone}"`);

const maskedEmail = maskContact('gabriel@gmail.com', 'email');
assert(maskedEmail === 'g***l@gmail.com', `Máscara E-mail: "${maskedEmail}"`);

console.log(`\n========================================`);
console.log(`TOTAL: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
