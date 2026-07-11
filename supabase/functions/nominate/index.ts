// Deno Supabase Edge Function - /functions/nominate/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const TURNSTILE_SECRET = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY") ?? "";
const VOTE_HASH_SECRET = Deno.env.get("VOTE_HASH_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    ALLOWED_ORIGINS.includes(origin)
      ? origin || "*"
      : ALLOWED_ORIGINS[0] ?? "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function requiredConfigIsPresent() {
  return Boolean(TURNSTILE_SECRET && VOTE_HASH_SECRET && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && ALLOWED_ORIGINS.length > 0);
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

function normalizeIdentifier(value: string, type: string) {
  const trimmed = value.trim().toLowerCase();
  if (type === "whatsapp") return trimmed.replace(/\D/g, "");
  return trimmed;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWhatsapp(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

async function hmacIdentifier(value: string) {
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
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (!originIsAllowed(req)) {
    return new Response(JSON.stringify({ error: "Origem nao permitida" }), {
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
      !validation_consent ||
      !turnstile_token
    ) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
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

    if (voter_type === "email" && !isValidEmail(String(voter_identifier).trim())) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (voter_type === "whatsapp" && !isValidWhatsapp(String(voter_identifier))) {
      return new Response(JSON.stringify({ error: "WhatsApp inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: turnstile_token,
      }),
    });

    const turnstileData = await turnstileResponse.json();
    if (!turnstileData.success) {
      return new Response(JSON.stringify({ error: "Validação anti-bot falhou" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "";
    const normalizedIdentifier = normalizeIdentifier(String(voter_identifier), String(voter_type));
    const voterIdentifierHash = await hmacIdentifier(normalizedIdentifier);
    const normalizedCandidateName = normalizeText(candidateName);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const recentSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentIpCount, error: recentIpError } = await supabase
      .from("nominations")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .gt("created_at", recentSince);

    if (recentIpError) throw recentIpError;

    if ((recentIpCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas indicacoes recentes. Aguarde alguns minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: recentCookieCount, error: recentCookieError } = await supabase
      .from("nominations")
      .select("id", { count: "exact", head: true })
      .eq("cookie_id", cookie_id)
      .gt("created_at", recentSince);

    if (recentCookieError) throw recentCookieError;

    if ((recentCookieCount ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Muitas indicacoes recentes neste dispositivo." }), {
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
      return new Response(JSON.stringify({ error: "Muitas indicacoes recentes para este contato." }), {
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

    const { data: existingCandidates, error: existingCandidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("election_id", election_id)
      .eq("category_id", category_id)
      .eq("normalized_name", normalizedCandidateName)
      .neq("status", "mesclado")
      .limit(1);

    if (existingCandidateError) throw existingCandidateError;

    if (existingCandidates && existingCandidates.length > 0) {
      return new Response(JSON.stringify({ error: "Este candidato ja existe nesta categoria." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingNominations, error: existingNominationError } = await supabase
      .from("nominations")
      .select("id")
      .eq("election_id", election_id)
      .eq("category_id", category_id)
      .eq("normalized_name", normalizedCandidateName)
      .in("status", ["pendente", "aprovado"])
      .limit(1);

    if (existingNominationError) throw existingNominationError;

    if (existingNominations && existingNominations.length > 0) {
      return new Response(JSON.stringify({ error: "Esta indicacao ja esta na fila de moderacao." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.from("nominations").insert({
      election_id,
      category_id,
      name: candidateName,
      normalized_name: normalizedCandidateName,
      type,
      instagram: normalizeInstagram(instagram),
      whatsapp: voter_type === "whatsapp" ? String(voter_identifier).trim() : null,
      email: voter_type === "email" ? String(voter_identifier).trim().toLowerCase() : null,
      status: "pendente",
      voter_name: String(voter_name).trim(),
      voter_identifier_hash: voterIdentifierHash,
      voter_type,
      ip_address: ipAddress,
      user_agent: userAgent,
      cookie_id,
      privacy_consent,
      validation_consent,
    });

    if (error) {
      console.error("Erro ao registrar indicação:", error);
      return new Response(JSON.stringify({ error: "Erro interno ao registrar indicação" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function nominate:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
