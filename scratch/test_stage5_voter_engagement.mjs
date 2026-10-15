import test from 'node:test';
import assert from 'node:assert/strict';

// Mock de localStorage para ambiente Node.js
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock();

const {
  getVoterStorageKey,
  getVotedCategories,
  saveVotedCategory,
  generateAuthHash,
  getShareMessage,
  copyReceiptText,
  updateVoterProgressUI
} = await import('../src/js/modules/voterEngagement.js');

test('ETAPA 5 - Isolamento de Chave Local por Eleição', () => {
  const key1 = getVoterStorageKey('eleicao_2026_bom_jardim');
  const key2 = getVoterStorageKey('eleicao_2027_bom_jardim');
  assert.strictEqual(key1, 'voted_categories_eleicao_2026_bom_jardim');
  assert.strictEqual(key2, 'voted_categories_eleicao_2027_bom_jardim');
  assert.notStrictEqual(key1, key2);
});

test('ETAPA 5 - Registro e Retificação de Categorias Votadas', () => {
  globalThis.localStorage.clear();
  const electionId = 'elec_test_01';

  // 1. Registro de voto inicial na categoria Gastronomia
  saveVotedCategory(electionId, {
    categoryId: 'cat_gastro',
    categoryName: 'Gastronomia & Restaurantes',
    candidateId: 'cand_pizzaria',
    candidateName: 'Pizzaria Bella'
  });

  let votes = getVotedCategories(electionId);
  assert.strictEqual(votes.length, 1);
  assert.strictEqual(votes[0].categoryId, 'cat_gastro');
  assert.strictEqual(votes[0].candidateName, 'Pizzaria Bella');

  // 2. Registro de voto em outra categoria (Saúde)
  saveVotedCategory(electionId, {
    categoryId: 'cat_saude',
    categoryName: 'Saúde & Odontologia',
    candidateId: 'cand_clinica',
    candidateName: 'Clínica Odonto Vida'
  });

  votes = getVotedCategories(electionId);
  assert.strictEqual(votes.length, 2);

  // 3. Retificação/Troca de voto na categoria Gastronomia
  saveVotedCategory(electionId, {
    categoryId: 'cat_gastro',
    categoryName: 'Gastronomia & Restaurantes',
    candidateId: 'cand_churrascaria',
    candidateName: 'Churrascaria Boiadeiro'
  });

  votes = getVotedCategories(electionId);
  assert.strictEqual(votes.length, 2, 'Não deve duplicar categorias, deve retificar a existente');
  const gastroVote = votes.find(v => v.categoryId === 'cat_gastro');
  assert.strictEqual(gastroVote.candidateName, 'Churrascaria Boiadeiro', 'Voto foi atualizado com sucesso');
});

test('ETAPA 5 - Geração de Hash de Autenticidade Auditável', () => {
  const hash1 = generateAuthHash('eleitor_joao_silva_token_abc');
  const hash2 = generateAuthHash('eleitor_joao_silva_token_abc');
  const hash3 = generateAuthHash('outro_eleitor_maria_token_xyz');

  assert.match(hash1, /^BJD-2026-[0-9A-F]{6}$/, 'Hash deve seguir o padrão BJD-2026-XXXXXX');
  assert.strictEqual(hash1, hash2, 'Hash deve ser determinístico para o mesmo eleitor');
  assert.notStrictEqual(hash1, hash3, 'Eleitores distintos devem gerar hashes diferentes');
});

test('ETAPA 5 - Geração de Mensagem de Compartilhamento no WhatsApp', () => {
  const electionId = 'elec_test_01';
  const msg = getShareMessage(electionId);

  assert.ok(msg.includes('Melhores do Ano 2026 – Bom Jardim/MG'), 'Deve conter o cabeçalho oficial do evento');
  assert.ok(msg.includes('2 categorias'), 'Deve indicar o número de categorias já votadas');
  assert.ok(msg.includes('https://melhores-do-ano-chi.vercel.app/votar.html'), 'Deve conter o link direto da votação');
});

test('ETAPA 5 - Formatação do Texto do Certificado/Comprovante Oficial', () => {
  const electionId = 'elec_test_01';
  const text = copyReceiptText(electionId, 'Gabriel Medeiros', 'BJD-2026-A1B2C3');

  assert.ok(text.includes('COMPROVANTE OFICIAL DE VOTO AUDITADO'));
  assert.ok(text.includes('Eleitor: Gabriel Medeiros'));
  assert.ok(text.includes('Autenticidade: BJD-2026-A1B2C3'));
  assert.ok(text.includes('Gastronomia & Restaurantes: Churrascaria Boiadeiro'));
  assert.ok(text.includes('Saúde & Odontologia: Clínica Odonto Vida'));
});

test('ETAPA 5 - Cálculo Lógico de Progresso e Percentual de Votação', () => {
  const electionId = 'elec_test_01';
  const categoriesList = [
    { id: 'cat_gastro', name: 'Gastronomia' },
    { id: 'cat_saude', name: 'Saúde' },
    { id: 'cat_educacao', name: 'Educação' },
    { id: 'cat_moda', name: 'Moda' }
  ];

  const result = updateVoterProgressUI({
    categoriesList,
    selectedCategoryId: 'cat_educacao',
    electionId
  });

  assert.strictEqual(result.total, 4, 'Total de 4 categorias');
  assert.strictEqual(result.votedCount, 2, '2 categorias votadas');
  assert.strictEqual(result.percent, 50, 'Deve corresponder a exatamente 50%');
});
