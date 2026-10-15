/* ============================================================================
   PROJETOS MELHORES DO ANO - VALIDAÇÃO RIGOROSA DE ELEITORES & ANTI-FRAUDE
   Validação de DDDs oficiais brasileiros, integridade de formato, bloqueio
   de repetições/fictícios e mascaramento diegético.
   ============================================================================ */

export const VALID_BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24',                                     // RJ
  '27', '28',                                           // ES
  '31', '32', '33', '34', '35', '37', '38',             // MG
  '41', '42', '43', '44', '45', '46',                   // PR
  '47', '48', '49',                                     // SC
  '51', '53', '54', '55',                               // RS
  '61', '62', '64',                                     // DF / GO
  '63',                                                 // TO
  '65', '66',                                           // MT
  '67',                                                 // MS
  '68', '69',                                           // AC / RO
  '71', '73', '74', '75', '77',                         // BA
  '79',                                                 // SE
  '81', '87',                                           // PE
  '82',                                                 // AL
  '83',                                                 // PB
  '84',                                                 // RN
  '85', '88',                                           // CE
  '86', '89',                                           // PI
  '91', '93', '94',                                     // PA
  '92', '97',                                           // AM
  '95',                                                 // RR
  '96',                                                 // AP
  '98', '99'                                            // MA
]);

/**
 * Validação profunda de número WhatsApp no Brasil
 * @param {string} phone
 * @returns {{ valid: boolean, reason?: string, normalized?: string }}
 */
export function validateWhatsapp(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, reason: 'Informe o número do WhatsApp.' };
  }

  let digits = phone.replace(/\D/g, '');

  // Tratar prefixo internacional do Brasil (+55)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // Celular nacional: 11 dígitos (DD + 9 + 8 dígitos)
  // Corporativo/Fixo: 10 dígitos (DD + 8 dígitos)
  if (digits.length !== 10 && digits.length !== 11) {
    return { valid: false, reason: 'O WhatsApp deve conter DDD + número (10 ou 11 dígitos).' };
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return { valid: false, reason: `DDD (${ddd}) não é reconhecido no Brasil.` };
  }

  // Celular (11 dígitos) DEVE ter o dígito 9 após o DDD
  if (digits.length === 11 && digits[2] !== '9') {
    return { valid: false, reason: 'Celular deve começar com o dígito 9 após o DDD.' };
  }

  // Bloqueio de repetições totais (ex: 11111111111, 00000000000, 99999999999)
  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, reason: 'Número inválido (dígitos todos repetidos).' };
  }

  // Bloqueio de repetição no número local (ex: 32 99999-9999 ou 11 0000-0000)
  const localNumber = digits.slice(2);
  if (/^(\d)\1+$/.test(localNumber)) {
    return { valid: false, reason: 'Número fictício com dígitos locais repetidos.' };
  }

  // Bloqueio de sequências óbvias
  const obviousSequences = [
    '0123456789', '1234567890', '2345678901',
    '9876543210', '0987654321', '12345678901',
    '98765432109'
  ];
  if (obviousSequences.some(seq => digits.includes(seq) || localNumber.includes(seq))) {
    return { valid: false, reason: 'Número sequencial não permitido.' };
  }

  return { valid: true, normalized: digits };
}

/**
 * Validação rigorosa de E-mail
 * @param {string} email
 * @returns {{ valid: boolean, reason?: string, normalized?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Informe o endereço de e-mail.' };
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) {
    return { valid: false, reason: 'Tamanho de e-mail inválido.' };
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: 'Formato de e-mail inválido.' };
  }
  const dummyEmails = ['test@test.com', 'teste@teste.com', 'a@a.com', 'admin@admin.com'];
  if (dummyEmails.includes(trimmed)) {
    return { valid: false, reason: 'E-mail genérico/fictício não permitido.' };
  }
  return { valid: true, normalized: trimmed };
}

/**
 * Mascarar contato diegeticamente para proteção de privacidade
 * @param {string} identifier
 * @param {'whatsapp'|'email'} type
 * @returns {string}
 */
export function maskContact(identifier, type) {
  if (!identifier) return '';
  if (type === 'whatsapp') {
    const digits = identifier.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) 9****-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ****-${digits.slice(6)}`;
    }
    return identifier;
  }
  const parts = identifier.split('@');
  if (parts.length === 2) {
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
    return `${maskedName}@${domain}`;
  }
  return identifier;
}
