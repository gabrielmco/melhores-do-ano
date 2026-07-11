// Deno Supabase Edge Function - /functions/vote/index.ts
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

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (!originIsAllowed(req)) {
    return new Response(JSON.stringify({ error: "Origem nao permitida" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tratar requisição OPTIONS (Preflight check do CORS)
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
      voter_identifier, // WhatsApp ou E-mail cru do frontend
      voter_type, // 'email' ou 'whatsapp'
      cookie_id,
      privacy_consent,
      validation_consent,
      turnstile_token,
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
      !validation_consent ||
      !turnstile_token
    ) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
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

    if (voter_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voter_identifier.trim())) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (voter_type === "whatsapp" && voter_identifier.replace(/\D/g, "").length < 10) {
      return new Response(JSON.stringify({ error: "WhatsApp inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validar Token Turnstile com a API da Cloudflare
    const turnstileUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    const turnstileResponse = await fetch(turnstileUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET,
        response: turnstile_token,
      }),
    });

    const turnstileData = await turnstileResponse.json();
    if (!turnstileData.success) {
      return new Response(JSON.stringify({ error: "Validação anti-bot (Turnstile) falhou" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Obter dados de IP e User-Agent diretamente dos cabeçalhos da requisição
    // Evita falsificação de IP pelo cliente
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "";

    // 4. Sanitizar e Normalizar o identificador do eleitor
    let normalizedIdentifier = voter_identifier.trim().toLowerCase();
    if (voter_type === "whatsapp") {
      // Deixar apenas números para WhatsApp
      normalizedIdentifier = normalizedIdentifier.replace(/\D/g, "");
    }

    // 5. Gerar Hash HMAC-SHA256 seguro usando a chave do servidor
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(VOTE_HASH_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(normalizedIdentifier)
    );
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hmacVoterHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 6. Conectar ao Supabase via Service Role (Bypass RLS para executar a RPC privada)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 7. Chamar a RPC cast_vote no banco de dados
    const { data, error } = await supabase.rpc("cast_vote", {
      p_election_id: election_id,
      p_category_id: category_id,
      p_candidate_id: candidate_id,
      p_voter_name: voter_name,
      p_voter_identifier: hmacVoterHash, // Envia o hash assinado
      p_voter_type: voter_type,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_cookie_id: cookie_id,
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

    // Traduzir a resposta estruturada JSONB do banco em respostas HTTP corretas
    const voteResult = data as { success?: boolean; reason?: string } | null;

    if (!voteResult || !voteResult.success) {
      let status = 400;
      let msg = "Falha ao processar voto";
      const reason = voteResult?.reason || "unknown";
      
      if (reason === "rate_limit") {
        status = 429;
        msg = "Muitas tentativas de voto vindas deste dispositivo. Aguarde 5 minutos.";
      } else if (reason === "duplicate_vote") {
        status = 409;
        msg = "Você já registrou seu voto nesta categoria!";
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro na Edge Function:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
