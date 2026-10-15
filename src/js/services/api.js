/* ============================================================================
   PROJETOS MELHORES DO ANO - CAMADA DE SERVIÇO DE API UNIFICADA
   Tratamento centralizado de erros HTTP, idempotência automática, validação
   prévia via Zod, cache com TTL e comunicação desacoplada com Supabase/Edge.
   ============================================================================ */

import { supabase, isUsingMock } from '../supabaseClient.js';
import {
  voteSubmissionSchema,
  nominationSubmissionSchema,
  safeValidate
} from './schemas.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

// Cache em memória simples com TTL para consultas frequentes de leitura
const cache = new Map();

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs = 60000) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs
  });
}

export function clearApiCache() {
  cache.clear();
}

/**
 * Tradutor centralizado de erros HTTP e exceções de rede em mensagens amigáveis
 * @param {number|string} status
 * @param {string} [serverMessage]
 * @returns {string}
 */
export function formatHttpError(status, serverMessage) {
  if (serverMessage && typeof serverMessage === 'string' && serverMessage.length > 5 && !serverMessage.includes('Internal')) {
    return serverMessage;
  }

  const statusCode = Number(status);
  switch (statusCode) {
    case 400:
      return 'Dados incompletos ou em formato inválido. Verifique as informações preenchidas.';
    case 401:
      return 'Sessão expirada ou não autorizada. Atualize a página e tente novamente.';
    case 403:
      return 'A votação para esta edição não está aberta ou já foi encerrada.';
    case 404:
      return 'O item selecionado não foi encontrado no sistema.';
    case 409:
      return 'Você já confirmou seu voto nesta categoria! Se desejar mudar seu voto, escolha outro candidato.';
    case 429:
      return 'Muitas tentativas detectadas neste dispositivo. Por segurança, aguarde alguns minutos.';
    case 500:
    case 502:
    case 503:
      return 'Serviço temporariamente indisponível. Nossa equipe já está monitorando. Tente em instantes.';
    default:
      return 'Não foi possível completar a operação. Verifique sua conexão com a internet.';
  }
}

/**
 * Gera cabeçalhos seguros para chamadas a Edge Functions
 * @param {string} [sessionToken]
 * @param {string} [idempotencyKey]
 * @returns {Record<string, string>}
 */
function buildFunctionHeaders(sessionToken = '', idempotencyKey = '') {
  const apiKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers.apikey = apiKey;
    if (apiKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
  }

  if (sessionToken) {
    headers['X-Voter-Session'] = sessionToken;
  }

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  return headers;
}

/**
 * Gera chave de idempotência segura (UUID v4)
 * @returns {string}
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const api = {
  /**
   * Submissão segura de voto em candidato
   * @param {object} payload
   */
  async submitVote(payload) {
    // 1. Chave de idempotência automática se não informada
    const idempotencyKey = payload.idempotency_key || generateIdempotencyKey();
    const fullPayload = {
      ...payload,
      idempotency_key: idempotencyKey
    };

    // 2. Validação estrita via Zod no client antes de tocar a rede
    const validation = safeValidate(voteSubmissionSchema, fullPayload);
    if (!validation.success) {
      throw new Error(validation.error);
    }

    if (isUsingMock) {
      return {
        success: true,
        updated: false,
        action: 'created',
        message: 'Voto computado com sucesso no modo demonstração.',
        voter_session_token: 'mock_token',
        voter_masked: '(32) 9****-2003',
        idempotency_key: idempotencyKey
      };
    }

    const url = `${env.VITE_SUPABASE_URL || ''}/functions/v1/vote`;
    const headers = buildFunctionHeaders(fullPayload.voter_session_token, idempotencyKey);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(fullPayload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(formatHttpError(response.status, result?.error));
    }

    return result;
  },

  /**
   * Submissão segura de indicação de novo candidato
   * @param {object} payload
   */
  async submitNomination(payload) {
    const idempotencyKey = payload.idempotency_key || generateIdempotencyKey();
    const fullPayload = {
      ...payload,
      idempotency_key: idempotencyKey
    };

    const validation = safeValidate(nominationSubmissionSchema, fullPayload);
    if (!validation.success) {
      throw new Error(validation.error);
    }

    if (isUsingMock) {
      return {
        success: true,
        instant_approved: true,
        updated: false,
        message: 'Indicação registrada com sucesso no modo demonstração.',
        voter_session_token: 'mock_token',
        voter_masked: '(32) 9****-2003',
        idempotency_key: idempotencyKey
      };
    }

    const url = `${env.VITE_SUPABASE_URL || ''}/functions/v1/nominate`;
    const headers = buildFunctionHeaders(fullPayload.voter_session_token, idempotencyKey);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(fullPayload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(formatHttpError(response.status, result?.error));
    }

    return result;
  },

  /**
   * Buscar cidades cadastradas (com cache de 5 minutos)
   */
  async getCities() {
    const cacheKey = 'cities';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .order('name');

    if (error) {
      throw new Error('Não foi possível carregar a lista de cidades.');
    }

    setCache(cacheKey, data || [], 300000);
    return data || [];
  },

  /**
   * Buscar eleições de uma cidade
   * @param {string} cityId
   */
  async getElections(cityId) {
    const cacheKey = `elections_${cityId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('elections')
      .select('id, year, status, start_date, end_date')
      .eq('city_id', cityId)
      .order('year', { ascending: false });

    if (error) {
      throw new Error('Não foi possível carregar as edições da premiação.');
    }

    setCache(cacheKey, data || [], 120000);
    return data || [];
  },

  /**
   * Buscar categorias de uma eleição
   * @param {string} electionId
   */
  async getCategories(electionId) {
    const cacheKey = `categories_${electionId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('city_categories')
      .select(`
        category_id,
        categories (
          id,
          name,
          description,
          icon,
          is_active
        )
      `)
      .eq('election_id', electionId);

    if (error) {
      throw new Error('Não foi possível carregar as categorias da eleição.');
    }

    const categories = (data || [])
      .map((item) => item.categories)
      .filter((cat) => cat && cat.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    setCache(cacheKey, categories, 60000);
    return categories;
  },

  /**
   * Buscar candidatos de uma categoria
   * @param {string} electionId
   * @param {string} categoryId
   */
  async getCandidates(electionId, categoryId) {
    const cacheKey = `candidates_${electionId}_${categoryId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('public_candidates')
      .select('id, name, logo_url, instagram, type, status')
      .eq('election_id', electionId)
      .eq('category_id', categoryId)
      .eq('status', 'aprovado')
      .order('name');

    if (error) {
      throw new Error('Não foi possível carregar os candidatos desta categoria.');
    }

    setCache(cacheKey, data || [], 30000); // 30 segundos
    return data || [];
  },

  /**
   * Buscar resultados parciais ou finais
   * @param {string} electionId
   */
  async getResults(electionId) {
    const cacheKey = `results_${electionId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('candidate_votes_summary')
      .select('*')
      .eq('election_id', electionId);

    if (error) {
      throw new Error('Não foi possível carregar a apuração oficial.');
    }

    setCache(cacheKey, data || [], 15000); // 15 segundos para dinamismo
    return data || [];
  },

  /**
   * Buscar vencedores oficiais publicados
   * @param {string} electionId
   */
  async getWinners(electionId) {
    const cacheKey = `winners_${electionId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('public_winners')
      .select('*')
      .eq('election_id', electionId);

    if (error) {
      throw new Error('Não foi possível carregar os vencedores oficiais.');
    }

    setCache(cacheKey, data || [], 60000);
    return data || [];
  }
};
