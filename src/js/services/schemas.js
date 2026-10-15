/* ============================================================================
   PROJETOS MELHORES DO ANO - SCHEMAS ESTREITOS DE VALIDAÇÃO (ZOD)
   Blindagem de tipos em tempo de execução, sanitização de entrada e
   mensagens de erro claras em português.
   ============================================================================ */

import { z } from 'zod';
import { validateWhatsapp, validateEmail } from '../modules/voterValidation.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Schema para UUID
export const uuidSchema = z.string().regex(UUID_REGEX, {
  message: 'Identificador único inválido (formato UUID esperado).'
});

// Schema de validação de eleitor e voto em candidato
export const voteSubmissionSchema = z.object({
  election_id: uuidSchema,
  category_id: uuidSchema,
  candidate_id: uuidSchema,
  voter_name: z.string()
    .trim()
    .min(2, { message: 'O nome completo deve conter no mínimo 2 caracteres.' })
    .max(120, { message: 'O nome não pode exceder 120 caracteres.' }),
  voter_type: z.enum(['whatsapp', 'email'], {
    errorMap: () => ({ message: 'Tipo de contato deve ser WhatsApp ou E-mail.' })
  }),
  voter_identifier: z.string().trim().min(3, { message: 'Contato obrigatório.' }),
  cookie_id: uuidSchema,
  privacy_consent: z.literal(true, {
    errorMap: () => ({ message: 'É obrigatório aceitar a Política de Privacidade.' })
  }),
  validation_consent: z.literal(true, {
    errorMap: () => ({ message: 'É obrigatório autorizar a validação anti-fraude do voto.' })
  }),
  turnstile_token: z.string().optional().nullable(),
  voter_session_token: z.string().optional().nullable(),
  idempotency_key: z.string().regex(UUID_REGEX, {
    message: 'Chave de idempotência inválida.'
  }).optional().nullable()
}).superRefine((data, ctx) => {
  if (data.voter_type === 'whatsapp') {
    const res = validateWhatsapp(data.voter_identifier);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['voter_identifier'],
        message: res.reason || 'WhatsApp inválido.'
      });
    }
  } else {
    const res = validateEmail(data.voter_identifier);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['voter_identifier'],
        message: res.reason || 'E-mail inválido.'
      });
    }
  }
});

// Schema de validação de indicação de novo candidato
export const nominationSubmissionSchema = z.object({
  election_id: uuidSchema,
  category_id: uuidSchema,
  name: z.string()
    .trim()
    .min(2, { message: 'O nome da empresa ou profissional deve conter pelo menos 2 caracteres.' })
    .max(160, { message: 'O nome não pode exceder 160 caracteres.' }),
  type: z.enum(['profissional', 'empresa'], {
    errorMap: () => ({ message: 'O tipo deve ser Profissional Liberal ou Empresa.' })
  }),
  instagram: z.string()
    .trim()
    .transform((val) => {
      const cleaned = val.replace(/^@+/, '');
      return cleaned ? `@${cleaned}` : null;
    })
    .nullable()
    .optional(),
  voter_name: z.string()
    .trim()
    .min(2, { message: 'O nome completo deve conter no mínimo 2 caracteres.' })
    .max(120, { message: 'O nome não pode exceder 120 caracteres.' }),
  voter_type: z.enum(['whatsapp', 'email'], {
    errorMap: () => ({ message: 'Tipo de contato deve ser WhatsApp ou E-mail.' })
  }),
  voter_identifier: z.string().trim().min(3, { message: 'Contato obrigatório.' }),
  cookie_id: uuidSchema,
  privacy_consent: z.literal(true, {
    errorMap: () => ({ message: 'É obrigatório aceitar a Política de Privacidade.' })
  }),
  validation_consent: z.literal(true, {
    errorMap: () => ({ message: 'É obrigatório autorizar a validação anti-fraude.' })
  }),
  turnstile_token: z.string().optional().nullable(),
  voter_session_token: z.string().optional().nullable(),
  idempotency_key: z.string().regex(UUID_REGEX, {
    message: 'Chave de idempotência inválida.'
  }).optional().nullable()
}).superRefine((data, ctx) => {
  if (data.voter_type === 'whatsapp') {
    const res = validateWhatsapp(data.voter_identifier);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['voter_identifier'],
        message: res.reason || 'WhatsApp inválido.'
      });
    }
  } else {
    const res = validateEmail(data.voter_identifier);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['voter_identifier'],
        message: res.reason || 'E-mail inválido.'
      });
    }
  }
});

// Schema de Candidato
export const candidateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  category_id: uuidSchema.optional().nullable(),
  election_id: uuidSchema.optional().nullable(),
  logo_url: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  type: z.string().optional().nullable(),
  status: z.string().optional().nullable()
});

// Schema de Categoria
export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

// Schema de Eleição
export const electionSchema = z.object({
  id: uuidSchema,
  year: z.number().int().min(2020),
  status: z.string(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable()
});

// Schema de Resposta da API de Voto
export const voteResponseSchema = z.object({
  success: z.boolean(),
  updated: z.boolean().optional(),
  action: z.string().optional(),
  message: z.string().optional(),
  voter_session_token: z.string().optional().nullable(),
  voter_masked: z.string().optional().nullable(),
  idempotency_key: z.string().optional().nullable()
});

/**
 * Função utilitária para validação segura sem disparar exceções
 * @param {z.ZodSchema} schema
 * @param {unknown} data
 * @returns {{ success: true, data: any } | { success: false, error: string, details: z.ZodIssue[] }}
 */
export function safeValidate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0]?.message || 'Dados inválidos.';
  return {
    success: false,
    error: firstError,
    details: result.error.issues
  };
}
