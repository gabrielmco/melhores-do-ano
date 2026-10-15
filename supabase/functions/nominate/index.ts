// Deno Supabase Edge Function - /functions/nominate/index.ts
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

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeInstagram(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^@+/, "");
  if (!cleaned) return null;
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleaned)) return null;
  return `@${cleaned}`;
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
    exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 horas
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

async function hmacValue(namespace: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(VOTE_HASH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(namespace ? `${namespace}:${value}` : value),
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
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
    console.error("Configuração obrigatória ausente na Edge Function nominate.");
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
      name,
      type,
      instagram,
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

    if (
      !election_id ||
      !category_id ||
      !name ||
      !type ||
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

    const candidateName = String(name).trim();
    if (candidateName.length < 2 || candidateName.length > 160) {
      return new Response(JSON.stringify({ error: "Nome indicado inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["profissional", "empresa"].includes(type)) {
      return new Response(JSON.stringify({ error: "Tipo de candidato inválido" }), {
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

    const voterIdentifierHash = await hmacValue("", normalizedIdentifier);
    const hasValidSessionForVoter = verifiedSession && verifiedSession.sub === voterIdentifierHash;

    if (!hasValidSessionForVoter) {
      if (!turnstile_token || typeof turnstile_token !== "string" || turnstile_token.length > 2048) {
        return new Response(JSON.stringify({ error: "Token de validação anti-bot ausente ou inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!await turnstileIsValid(String(turnstile_token), ipAddress)) {
        return new Response(JSON.stringify({ error: "Validação anti-bot falhou" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 512);
    const ipAddressHash = await hmacValue("ip", ipAddress);
    const userAgentHash = await hmacValue("user-agent", userAgent);
    const cookieIdHash = await hmacValue("device", String(cookie_id));
    const normalizedCandidateName = normalizeText(candidateName);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
      auth: { persistSession: false },
    });

    const recentSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentIpCount, error: recentIpError } = await supabase
      .from("nominations")
      .select("id", { count: "exact", head: true })
      .eq("ip_address_hash", ipAddressHash)
      .gt("created_at", recentSince);

    if (recentIpError) throw recentIpError;

    if ((recentIpCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas indicações recentes. Aguarde alguns minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: recentCookieCount, error: recentCookieError } = await supabase
      .from("nominations")
      .select("id", { count: "exact", head: true })
      .eq("cookie_id_hash", cookieIdHash)
      .gt("created_at", recentSince);

    if (recentCookieError) throw recentCookieError;

    if ((recentCookieCount ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Muitas indicações recentes neste dispositivo." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: recentVoterCount, error: recentVoterError } = await supabase
      .from("nominations")
      .select("id", { count: "exact", head: true })
      .eq("voter_identifier_hash", voterIdentifierHash)
      .gt("created_at", recentSince);

    if (recentVoterError) throw recentVoterError;

    if ((recentVoterCount ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Muitas indicações recentes para este contato." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: election, error: electionError } = await supabase
      .from("elections")
      .select("id, status, start_date, end_date")
      .eq("id", election_id)
      .single();

    if (electionError || !election || election.status !== "aberta") {
      return new Response(JSON.stringify({ error: "Votação não está aberta" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    if (now < new Date(election.start_date).getTime() || now > new Date(election.end_date).getTime()) {
      return new Response(JSON.stringify({ error: "Votação fora do período permitido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cityCategory, error: categoryError } = await supabase
      .from("city_categories")
      .select("id")
      .eq("election_id", election_id)
      .eq("category_id", category_id)
      .single();

    if (categoryError || !cityCategory) {
      return new Response(JSON.stringify({ error: "Categoria inativa nesta votação" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maskedContact = maskIdentifier(normalizedIdentifier, voter_type);
    const newSessionToken = await createVoterSessionToken(
      voterIdentifierHash,
      String(voter_name).trim(),
      voter_type,
      maskedContact
    );

    const { data: existingCandidates, error: existingCandidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("election_id", election_id)
      .eq("category_id", category_id)
      .eq("normalized_name", normalizedCandidateName)
      .neq("status", "mesclado")
      .limit(1);

    if (existingCandidateError) throw existingCandidateError;

    // Se o candidato já existir nesta categoria, computa o voto diretamente nele
    if (existingCandidates && existingCandidates.length > 0) {
      const existingCandidateId = existingCandidates[0].id;
      const { data: voteData, error: voteError } = await supabase.rpc("cast_vote_secure", {
        p_election_id: election_id,
        p_category_id: category_id,
        p_candidate_id: existingCandidateId,
        p_voter_name: String(voter_name).trim(),
        p_voter_identifier: voterIdentifierHash,
        p_voter_type: voter_type,
        p_ip_address_hash: ipAddressHash,
        p_user_agent_hash: userAgentHash,
        p_cookie_id_hash: cookieIdHash,
        p_privacy_consent: privacy_consent,
        p_validation_consent: validation_consent,
      });

      if (voteError) {
        console.error("Erro ao votar em candidato existente via indicação:", voteError);
        return new Response(JSON.stringify({ error: "Erro ao computar voto no candidato existente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const voteResult = voteData as {
        success?: boolean;
        reason?: string;
        action?: string;
        message?: string;
      } | null;
      if (!voteResult || !voteResult.success) {
        const isDuplicate = voteResult?.reason === "duplicate_vote";
        return new Response(JSON.stringify({
          error: isDuplicate
            ? (voteResult?.message || "Você já confirmou seu voto neste candidato nesta categoria! Se desejar mudar seu voto, escolha outro candidato.")
            : "Falha ao processar voto",
          reason: voteResult?.reason
        }), {
          status: isDuplicate ? 409 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        candidate_id: existingCandidateId,
        updated: voteResult.action === "updated",
        action: voteResult.action || "created",
        voter_session_token: newSessionToken,
        voter_masked: maskedContact,
        idempotency_key: effectiveIdempotencyKey || null,
        message: voteResult.message || (voteResult.action === "updated"
          ? "Seu voto foi retificado com sucesso para este candidato!"
          : "Voto registrado com sucesso!")
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se não existir, cadastra a indicação e auto-aprova instantaneamente
    const { data: insertedNomination, error: insertError } = await supabase
      .from("nominations")
      .insert({
        election_id,
        category_id,
        name: candidateName,
        normalized_name: normalizedCandidateName,
        type,
        instagram: normalizeInstagram(instagram),
        whatsapp: null,
        email: null,
        status: "pendente",
        voter_name: String(voter_name).trim(),
        voter_identifier_hash: voterIdentifierHash,
        voter_type,
        ip_address: null,
        user_agent: null,
        cookie_id: null,
        ip_address_hash: ipAddressHash,
        user_agent_hash: userAgentHash,
        cookie_id_hash: cookieIdHash,
        privacy_consent,
        validation_consent,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Erro ao registrar indicação:", insertError);
      return new Response(JSON.stringify({ error: "Erro interno ao registrar indicação" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-aprovação instantânea via RPC
    const { data: approveResult, error: approveError } = await supabase.rpc("approve_nomination", {
      p_nomination_id: insertedNomination.id
    });

    if (approveError) {
      console.warn("Aviso ao auto-aprovar indicação (permanecerá para moderação manual):", approveError);
    }

    const isUpdatedVote = (approveResult as any)?.initial_vote_skipped_reason === "vote_updated";

    return new Response(JSON.stringify({
      success: true,
      instant_approved: !approveError,
      updated: isUpdatedVote,
      voter_session_token: newSessionToken,
      voter_masked: maskedContact,
      idempotency_key: effectiveIdempotencyKey || null,
      message: isUpdatedVote
        ? "Novo candidato indicado e seu voto foi retificado para ele com sucesso!"
        : "Novo candidato indicado e seu voto computado com sucesso!"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function nominate:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor", details: String((err as any)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
