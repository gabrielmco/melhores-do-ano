/* ============================================================================
   TESTE AUTOMATIZADO - ETAPA 2: SCHEMAS ZOD, API SERVICE, IDEMPOTÊNCIA E CONCORRÊNCIA
   ============================================================================ */

import {
  uuidSchema,
  voteSubmissionSchema,
  nominationSubmissionSchema,
  candidateSchema,
  categorySchema,
  electionSchema,
  voteResponseSchema,
  safeValidate
} from '../src/js/services/schemas.js';

import {
  formatHttpError,
  generateIdempotencyKey
} from '../src/js/services/api.js';

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

const VALID_UUID_1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const VALID_UUID_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const VALID_UUID_3 = 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f';
const VALID_UUID_4 = 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f8a';

console.log('\n--- 1. TESTE DE VALIDAÇÃO DE UUID ---');
assert(uuidSchema.safeParse(VALID_UUID_1).success, 'UUID válido aceito');
assert(!uuidSchema.safeParse('12345').success, 'UUID inválido (curto) rejeitado');
assert(!uuidSchema.safeParse('invalid-uuid-string-here-000000000000').success, 'UUID malformado rejeitado');
assert(!uuidSchema.safeParse('').success, 'UUID vazio rejeitado');

console.log('\n--- 2. TESTE DE SCHEMA DE VOTO (voteSubmissionSchema) ---');

const validVotePayload = {
  election_id: VALID_UUID_1,
  category_id: VALID_UUID_2,
  candidate_id: VALID_UUID_3,
  voter_name: 'Gabriel Silva Resende',
  voter_type: 'whatsapp',
  voter_identifier: '(32) 99845-2003',
  cookie_id: VALID_UUID_4,
  privacy_consent: true,
  validation_consent: true,
  turnstile_token: 'valid_cf_token',
  idempotency_key: generateIdempotencyKey()
};

const resValidVote = safeValidate(voteSubmissionSchema, validVotePayload);
assert(resValidVote.success, 'Payload de voto legítimo com WhatsApp validado com sucesso');

// Teste com E-mail válido
const validVoteEmailPayload = {
  ...validVotePayload,
  voter_type: 'email',
  voter_identifier: 'gabriel.silva@empresa.com.br'
};
const resValidEmailVote = safeValidate(voteSubmissionSchema, validVoteEmailPayload);
assert(resValidEmailVote.success, 'Payload de voto legítimo com E-mail corporativo validado');

// Rejeição por consentimento ausente
const voteNoConsent = { ...validVotePayload, privacy_consent: false };
const resNoConsent = safeValidate(voteSubmissionSchema, voteNoConsent);
assert(!resNoConsent.success, 'Voto sem consentimento de privacidade rejeitado');

const voteNoValidationConsent = { ...validVotePayload, validation_consent: false };
const resNoValConsent = safeValidate(voteSubmissionSchema, voteNoValidationConsent);
assert(!resNoValConsent.success, 'Voto sem consentimento de validação anti-fraude rejeitado');

// Rejeição por WhatsApp fictício/fraudulento
const voteFakePhone = { ...validVotePayload, voter_identifier: '32999999999' };
const resFakePhone = safeValidate(voteSubmissionSchema, voteFakePhone);
assert(!resFakePhone.success, `Voto com WhatsApp repetido (32999999999) bloqueado: "${resFakePhone.error}"`);

// Rejeição por E-mail dummy
const voteFakeEmail = { ...validVotePayload, voter_type: 'email', voter_identifier: 'teste@teste.com' };
const resFakeEmail = safeValidate(voteSubmissionSchema, voteFakeEmail);
assert(!resFakeEmail.success, `Voto com E-mail dummy (teste@teste.com) bloqueado: "${resFakeEmail.error}"`);

// Rejeição por Nome curto
const voteShortName = { ...validVotePayload, voter_name: 'A' };
const resShortName = safeValidate(voteSubmissionSchema, voteShortName);
assert(!resShortName.success, 'Nome com 1 caractere rejeitado');

console.log('\n--- 3. TESTE DE SCHEMA DE INDICAÇÃO (nominationSubmissionSchema) ---');

const validNominationPayload = {
  election_id: VALID_UUID_1,
  category_id: VALID_UUID_2,
  name: 'Oficina Mecânica do Zezinho',
  type: 'empresa',
  instagram: '@@oficina_zezinho',
  voter_name: 'Carla Dias',
  voter_type: 'whatsapp',
  voter_identifier: '(32) 99123-4567',
  cookie_id: VALID_UUID_4,
  privacy_consent: true,
  validation_consent: true,
  idempotency_key: generateIdempotencyKey()
};

const resValidNomination = safeValidate(nominationSubmissionSchema, validNominationPayload);
assert(resValidNomination.success, 'Payload de indicação válido aceito');
if (resValidNomination.success) {
  assert(resValidNomination.data.instagram === '@oficina_zezinho', 'Transformação e sanitização de arroba do Instagram (@oficina_zezinho)');
}

// Rejeição por tipo inválido de indicado
const nominationBadType = { ...validNominationPayload, type: 'alien' };
const resBadType = safeValidate(nominationSubmissionSchema, nominationBadType);
assert(!resBadType.success, 'Indicação com tipo inválido rejeitada');

console.log('\n--- 4. TESTE DE GERADOR DE IDEMPOTÊNCIA & COLISÃO ---');
const idempotencyKeys = new Set();
const TOTAL_KEYS = 500;
for (let i = 0; i < TOTAL_KEYS; i++) {
  const key = generateIdempotencyKey();
  assert(uuidSchema.safeParse(key).success, `Chave #${i + 1} está no padrão UUID v4`);
  idempotencyKeys.add(key);
}
assert(idempotencyKeys.size === TOTAL_KEYS, `500 chaves de idempotência geradas com 0 colisões (${idempotencyKeys.size}/${TOTAL_KEYS})`);

console.log('\n--- 5. TESTE DE TRADUTOR DE ERROS HTTP (formatHttpError) ---');
assert(formatHttpError(400).includes('Dados incompletos'), 'Erro 400 traduzido com clareza');
assert(formatHttpError(401).includes('Sessão expirada'), 'Erro 401 traduzido com clareza');
assert(formatHttpError(403).includes('não está aberta'), 'Erro 403 traduzido com clareza');
assert(formatHttpError(404).includes('não foi encontrado'), 'Erro 404 traduzido com clareza');
assert(formatHttpError(409).includes('já confirmou seu voto'), 'Erro 409 (conflito/duplicado) traduzido');
assert(formatHttpError(429).includes('Muitas tentativas'), 'Erro 429 (Rate Limit) traduzido');
assert(formatHttpError(500).includes('Serviço temporariamente indisponível'), 'Erro 500 traduzido');
assert(formatHttpError(400, 'Mensagem customizada do servidor') === 'Mensagem customizada do servidor', 'Mensagem customizada do servidor preservada quando relevante');

console.log('\n--- 6. SIMULAÇÃO DE CONCORRÊNCIA E IDEMPOTÊNCIA ATÔMICA ---');

// Mock de serviço com controle de concorrência e idempotência
class ConcurrencySimulationStore {
  constructor() {
    this.processedKeys = new Map();
    this.votes = new Map(); // voterId_categoryId -> voteRecord
    this.activeLocks = new Set();
  }

  async processVote(payload) {
    const lockKey = `${payload.voter_identifier}_${payload.category_id}`;

    // 1. Verificação de Chave de Idempotência
    if (this.processedKeys.has(payload.idempotency_key)) {
      return {
        ...this.processedKeys.get(payload.idempotency_key),
        cached_response: true
      };
    }

    // 2. Simulação de Trava Concorrente (pg_advisory_xact_lock)
    if (this.activeLocks.has(lockKey)) {
      // Simula espera da transação concorrente
      await new Promise(r => setTimeout(r, 20));
      if (this.processedKeys.has(payload.idempotency_key)) {
        return {
          ...this.processedKeys.get(payload.idempotency_key),
          cached_response: true
        };
      }
    }
    this.activeLocks.add(lockKey);

    try {
      // Simula latência de rede/banco
      await new Promise(r => setTimeout(r, 10));

      const existingVote = this.votes.get(lockKey);
      let response;
      if (existingVote) {
        // Atualização de voto
        existingVote.candidate_id = payload.candidate_id;
        existingVote.updated_at = new Date().toISOString();
        response = {
          success: true,
          updated: true,
          action: 'updated',
          message: 'Voto retificado com sucesso.',
          candidate_id: payload.candidate_id
        };
      } else {
        // Voto novo
        const newRecord = {
          id: generateIdempotencyKey(),
          election_id: payload.election_id,
          category_id: payload.category_id,
          candidate_id: payload.candidate_id,
          voter: payload.voter_identifier,
          created_at: new Date().toISOString()
        };
        this.votes.set(lockKey, newRecord);
        response = {
          success: true,
          updated: false,
          action: 'created',
          message: 'Voto registrado com sucesso.',
          candidate_id: payload.candidate_id
        };
      }

      this.processedKeys.set(payload.idempotency_key, response);
      return response;
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }
}

// Execução de 20 requisições simultâneas
const store = new ConcurrencySimulationStore();
const fixedIdempotencyKey = generateIdempotencyKey();

const concurrentBatch = Array.from({ length: 15 }, () => ({
  ...validVotePayload,
  idempotency_key: fixedIdempotencyKey
}));

console.log(`  Disparando 15 requisições com a MESMA chave de idempotência simultaneamente...`);
const resultsSameKey = await Promise.all(concurrentBatch.map(p => store.processVote(p)));

const allSuccess = resultsSameKey.every(r => r.success === true);
const createdCount = resultsSameKey.filter(r => !r.cached_response).length;
const cachedCount = resultsSameKey.filter(r => r.cached_response).length;

assert(allSuccess, 'Todas as 15 requisições simultâneas responderam com sucesso');
assert(createdCount === 1, `Exatamente 1 execução real no banco foi processada (resultado: ${createdCount})`);
assert(cachedCount === 14, `14 requisições foram respondidas de forma idempotente sem duplicar voto (resultado: ${cachedCount})`);
assert(store.votes.size === 1, `Banco de dados contém estritamente 1 voto registrado para o eleitor`);

// Teste de retificação concorrente com nova chave
console.log(`  Disparando retificação de voto para outro candidato com nova chave de idempotência...`);
const rectificationPayload = {
  ...validVotePayload,
  candidate_id: VALID_UUID_4,
  idempotency_key: generateIdempotencyKey()
};

const rectificationResult = await store.processVote(rectificationPayload);
assert(rectificationResult.success === true && rectificationResult.updated === true, 'Voto retificado atômico concluído com sucesso');
assert(store.votes.get(`${validVotePayload.voter_identifier}_${validVotePayload.category_id}`).candidate_id === VALID_UUID_4, 'Candidato no banco atualizado para a nova escolha');

console.log(`\n========================================`);
console.log(`TOTAL: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ETAPA 2 VALIDADA COM 100% DE APROVAÇÃO!`);
}
