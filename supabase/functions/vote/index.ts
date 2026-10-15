// Deno Supabase Edge Function - /functions/vote/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const TURNSTILE_SECRET = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY") ?? "";
const VOTE_HASH_SECRET = Deno.env.get("VOTE_HASH_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function getSupabaseAdminKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (legacyKey) return legacyKey;

  try {
    const availableKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return availableKeys.default ?? Object.values(availableKeys)[0] ?? "";
  } catch {
    return "";
  }
}

const SUPABASE_ADMIN_KEY = getSupabaseAdminKey();
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const TURNSTILE_EXPECTED_HOSTNAMES = (Deno.env.get("TURNSTILE_EXPECTED_HOSTNAMES") ?? "")
  .split(",")
  .map((hostname) => hostname.trim().toLowerCase())
  .filter(Boolean);
const TURNSTILE_EXPECTED_ACTION = Deno.env.get("TURNSTILE_EXPECTED_ACTION") ?? "voting";

// 67 DDDs legítimos reconhecidos pela Anatel no Brasil
const VALID_BRAZILIAN_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99"
]);

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    ALLOWED_ORIGINS.includes(origin)
      ? origin || "*"
      : ALLOWED_ORIGINS[0] ?? "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-voter-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function requiredConfigIsPresent() {
  return Boolean(
    TURNSTILE_SECRET &&
    VOTE_HASH_SECRET.length >= 32 &&
    SUPABASE_URL &&
    SUPABASE_ADMIN_KEY &&
    ALLOWED_ORIGINS.length > 0 &&
    TURNSTILE_EXPECTED_HOSTNAMES.length > 0
  );
}

function originIsAllowed(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
}

async function hmacValue(namespace: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(VOTE_HASH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(namespace ? `${namespace}:${value}` : value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function validateBrazilianPhone(phone: string): { valid: boolean; reason?: string; normalized?: string } {
  if (!phone || typeof phone !== "string") {
    return { valid: false, reason: "Informe o número do WhatsApp." };
  }

  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return { valid: false, reason: "O WhatsApp deve conter DDD + número (10 ou 11 dígitos)." };
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return { valid: false, reason: `DDD (${ddd}) não é válido no Brasil.` };
  }

  if (digits.length === 11 && digits[2] !== "9") {
    return { valid: false, reason: "Celular brasileiro deve iniciar com o dígito 9 após o DDD." };
  }

  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, reason: "Número inválido (dígitos todos repetidos)." };
  }

  const localPart = digits.slice(2);
  if (/^(\d)\1+$/.test(localPart)) {
    return { valid: false, reason: "Número fictício com dígitos locais repetidos." };
  }

  const obviousSequences = [
    "0123456789", "1234567890", "2345678901",
    "9876543210", "0987654321", "12345678901",
    "98765432109"
  ];
  if (obviousSequences.some((seq) => digits.includes(seq) || localPart.includes(seq))) {
    return { valid: false, reason: "Número sequencial não permitido." };
  }

  return { valid: true, normalized: digits };
}

function validateEmail(email: string): { valid: boolean; reason?: string; normalized?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Informe o endereço de e-mail." };
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) {
    return { valid: false, reason: "Tamanho de e-mail inválido." };
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: "Formato de e-mail inválido." };
  }
  const dummyEmails = ["test@test.com", "teste@teste.com", "a@a.com", "admin@admin.com"];
  if (dummyEmails.includes(trimmed)) {
    return { valid: false, reason: "E-mail genérico/fictício não permitido." };
  }
  return { valid: true, normalized: trimmed };
}

function maskIdentifier(identifier: string, type: string): string {
  if (type === "whatsapp") {
    const digits = identifier.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) 9****-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ****-${digits.slice(6)}`;
    }
    return identifier;
  }
  const parts = identifier.split("@");
  if (parts.length === 2) {
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
    return `${maskedName}@${domain}`;
  }
  return identifier;
}

async function createVoterSessionToken(
  voterHash: string,
  voterName: string,
  voterType: string,
  voterMasked: string
): Promise<string> {
  const payloadObj = {
    sub: voterHash,
    name: voterName,
    type: voterType,
    masked: voterMasked,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 horas de validade
  };
  const payloadStr = JSON.stringify(payloadObj);
  const payloadB64 = btoa(payloadStr);
  const sig = await hmacValue("voter_session", payloadStr);
  return `${payloadB64}.${sig}`;
}

async function verifyVoterSessionToken(token: string): Promise<{
  sub: string;
  name: string;
  type: string;
  masked: string;
} | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payloadStr = atob(payloadB64);
    const expectedSig = await hmacValue("voter_session", payloadStr);
    if (sig !== expectedSig) return null;
    const data = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (typeof data.exp !== "number" || now > data.exp) return null;
    return {
      sub: String(data.sub || ""),
      name: String(data.name || ""),
      type: String(data.type || ""),
      masked: String(data.masked || "")
    };
  } catch {
    return null;
  }
}

async function turnstileIsValid(token: string, ipAddress: string) {
  if (TURNSTILE_SECRET.startsWith("1x000000") && (token === "dummy_token" || token.startsWith("XXXX.DUMMY") || token === "1x00000000000000000000AA")) {
    return true;
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: TURNSTILE_SECRET,
      response: token,
      remoteip: ipAddress,
    }),
  });
  if (!response.ok) return false;

  const result = await response.json() as {
    success?: boolean;
    hostname?: string;
    action?: string;
  };
  const hostname = String(result.hostname ?? "").toLowerCase();
  return Boolean(
    result.success &&
    (TURNSTILE_EXPECTED_HOSTNAMES.length === 0 || TURNSTILE_EXPECTED_HOSTNAMES.includes(hostname)) &&
    (!TURNSTILE_EXPECTED_ACTION || result.action === TURNSTILE_EXPECTED_ACTION)
  );
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (!originIsAllowed(req)) {
    return new Response(JSON.stringify({ error: "Origem não permitida" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!requiredConfigIsPresent()) {
    console.error("Configuração obrigatória ausente na Edge Function vote.");
    return new Response(JSON.stringify({ error: "Configuração interna indisponível" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      election_id,
      category_id,
      candidate_id,
      voter_name,
      voter_identifier,
      voter_type,
      cookie_id,
      privacy_consent,
      validation_consent,
      turnstile_token,
      voter_session_token,
      idempotency_key
    } = body;

    // 1. Validar preenchimento dos campos obrigatórios
    if (
      !election_id ||
      !category_id ||
      !candidate_id ||
      !voter_name ||
      !voter_identifier ||
      !voter_type ||
      !cookie_id ||
      !privacy_consent ||
      !validation_consent
    ) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      typeof voter_name !== "string" ||
      voter_name.trim().length < 2 ||
      voter_name.trim().length > 120 ||
      typeof voter_identifier !== "string" ||
      voter_identifier.length > 254 ||
      typeof cookie_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cookie_id)
    ) {
      return new Response(JSON.stringify({ error: "Formato dos dados inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validação de chave de idempotência (se fornecida, deve ser UUID válido)
    const headerIdempotency = req.headers.get("x-idempotency-key");
    const effectiveIdempotencyKey = idempotency_key || headerIdempotency;
    if (
      effectiveIdempotencyKey &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(effectiveIdempotencyKey)
    ) {
      return new Response(JSON.stringify({ error: "Chave de idempotência em formato inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["email", "whatsapp"].includes(voter_type)) {
      return new Response(JSON.stringify({ error: "Tipo de contato inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let normalizedIdentifier = "";
    if (voter_type === "whatsapp") {
      const phoneValidation = validateBrazilianPhone(voter_identifier);
      if (!phoneValidation.valid) {
        return new Response(JSON.stringify({ error: phoneValidation.reason }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      normalizedIdentifier = phoneValidation.normalized!;
    } else {
      const emailValidation = validateEmail(voter_identifier);
      if (!emailValidation.valid) {
        return new Response(JSON.stringify({ error: emailValidation.reason }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      normalizedIdentifier = emailValidation.normalized!;
    }

    const ipAddress = getClientIp(req);

    // Validação de Sessão Criptografada vs Anti-bot Turnstile
    const incomingSessionToken = voter_session_token || req.headers.get("x-voter-session");
    let verifiedSession = incomingSessionToken ? await verifyVoterSessionToken(incomingSessionToken) : null;

    const hmacVoterHash = await hmacValue("", normalizedIdentifier);

    // Se houver sessão assinada válida e pertencer ao mesmo eleitor, aceita sessão pré-autenticada
    const hasValidSessionForVoter = verifiedSession && verifiedSession.sub === hmacVoterHash;

    if (!hasValidSessionForVoter) {
      if (!turnstile_token || typeof turnstile_token !== "string" || turnstile_token.length > 2048) {
        return new Response(JSON.stringify({ error: "Token de validação anti-bot ausente ou inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!await turnstileIsValid(String(turnstile_token), ipAddress)) {
        return new Response(JSON.stringify({ error: "Validação anti-bot (Turnstile) falhou" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 512);
    const ipAddressHash = await hmacValue("ip", ipAddress);
    const userAgentHash = await hmacValue("user-agent", userAgent);
    const cookieIdHash = await hmacValue("device", String(cookie_id));

    // Conectar ao Supabase via Service Role para executar RPC atômica
    const supabase = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
      auth: { persistSession: false },
    });

    // Chamar RPC cast_vote_secure com dados sanitizados e hashes seguros
    const { data, error } = await supabase.rpc("cast_vote_secure", {
      p_election_id: election_id,
      p_category_id: category_id,
      p_candidate_id: candidate_id,
      p_voter_name: voter_name.trim(),
      p_voter_identifier: hmacVoterHash,
      p_voter_type: voter_type,
      p_ip_address_hash: ipAddressHash,
      p_user_agent_hash: userAgentHash,
      p_cookie_id_hash: cookieIdHash,
      p_privacy_consent: privacy_consent,
      p_validation_consent: validation_consent,
    });

    if (error) {
      console.error("Erro RPC cast_vote:", error);
      return new Response(JSON.stringify({ error: "Erro interno ao processar voto no banco" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voteResult = data as {
      success?: boolean;
      reason?: string;
      action?: string;
      message?: string;
    } | null;

    if (!voteResult || !voteResult.success) {
      let status = 400;
      let msg = "Falha ao processar voto";
      const reason = voteResult?.reason || "unknown";

      if (reason === "rate_limit") {
        status = 429;
        msg = "Muitas tentativas de voto vindas deste dispositivo. Aguarde 5 minutos.";
      } else if (reason === "duplicate_vote") {
        status = 409;
        msg = voteResult?.message || "Você já confirmou seu voto neste candidato nesta categoria! Se desejar mudar seu voto, basta escolher outro candidato.";
      } else if (reason === "lgpd_consent_missing") {
        status = 400;
        msg = "Consentimento LGPD obrigatório ausente.";
      } else if (reason === "election_not_open") {
        status = 403;
        msg = "A votação para esta edição não está aberta ou já encerrou.";
      } else if (reason === "invalid_candidate" || reason === "category_inactive") {
        status = 400;
        msg = "Dados de votação inválidos ou candidato não aprovado.";
      }

      return new Response(JSON.stringify({ error: msg, reason }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar token de sessão assinado HMAC para votação contínua fluida
    const maskedContact = maskIdentifier(normalizedIdentifier, voter_type);
    const newSessionToken = await createVoterSessionToken(
      hmacVoterHash,
      voter_name.trim(),
      voter_type,
      maskedContact
    );

    return new Response(JSON.stringify({
      success: true,
      updated: voteResult.action === "updated",
      action: voteResult.action || "created",
      voter_session_token: newSessionToken,
      voter_masked: maskedContact,
      idempotency_key: effectiveIdempotencyKey || null,
      message: voteResult.message || (voteResult.action === "updated"
        ? "Seu voto foi retificado com sucesso! Sua nova escolha substituiu o voto anterior."
        : "Voto registrado com sucesso!")
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function vote:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
