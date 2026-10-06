/**
 * ============================================================================
 * PROJETOS MELHORES DO ANO - SUPABASE KEEP-ALIVE & AUTO-RESTORE ENGINE
 * ============================================================================
 * Executa uma consulta real ao banco PostgreSQL do Supabase para impedir a
 * pausa de inatividade de 7 dias do Free Tier.
 * 
 * Se o projeto já estiver pausado (DNS ENOTFOUND ou 503), e o token de acesso
 * SUPABASE_ACCESS_TOKEN estiver configurado, ele restaura o projeto automaticamente
 * via Supabase Management API v1.
 */

import fs from 'fs';
import path from 'path';

// Carregar variáveis do .env se existir localmente
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO CRÍTICO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas.');
  process.exit(1);
}

// Extrair project ref do URL (ex: https://pjgaidootluetzkbqmak.supabase.co -> pjgaidootluetzkbqmak)
const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
const projectRef = match ? match[1] : null;

console.log('---------------------------------------------------------');
console.log('🔄 INICIANDO SUPABASE KEEP-ALIVE & MONITOR DE ATIVIDADE');
console.log(`📌 Alvo: ${supabaseUrl}`);
if (projectRef) console.log(`🆔 Project Ref: ${projectRef}`);
console.log('---------------------------------------------------------');

async function restoreProject(ref, token) {
  if (!token) {
    console.warn('\n⚠️ O projeto está pausado ou com DNS inativo, mas SUPABASE_ACCESS_TOKEN não foi fornecido.');
    console.warn('👉 Para ativar o auto-restore automático sem precisar entrar no painel:');
    console.warn('   1. Vá em https://supabase.com/dashboard/account/tokens');
    console.warn('   2. Crie um "Personal Access Token"');
    console.warn('   3. Adicione aos Secrets do GitHub / Vercel como "SUPABASE_ACCESS_TOKEN"');
    console.warn('👉 Enquanto isso, reative manualmente em: https://supabase.com/dashboard/project/' + ref);
    return false;
  }

  console.log('\n🚀 Tentando restaurar projeto pausado via Supabase Management API...');
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      console.log('✅ Solicitação de restauração aceita com sucesso pela Supabase API!');
      console.log('⏳ O container do banco e os registros DNS estarão ativos em 1 a 2 minutos.');
      return true;
    } else {
      const errorText = await res.text();
      console.error(`❌ Falha ao restaurar projeto via API (HTTP ${res.status}): ${errorText}`);
      return false;
    }
  } catch (err) {
    console.error('❌ Erro de rede ao chamar Supabase Management API:', err.message);
    return false;
  }
}

async function runKeepAlive() {
  const startTime = Date.now();
  let queryUrl = `${supabaseUrl}/rest/v1/categories?select=id&limit=1`;

  try {
    console.log(`📡 Executando consulta SQL real em: /rest/v1/categories...`);
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json'
      }
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      console.log(`✅ SUCESSO: Banco ativo e respondendo!`);
      console.log(`⚡ Código HTTP: ${response.status} (${response.statusText})`);
      console.log(`⏱️ Latência: ${latency}ms`);
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      console.log('🎉 O contador de inatividade de 7 dias do Supabase foi renovado com sucesso!');
      return;
    }

    if (response.status === 503 || response.status === 500) {
      console.warn(`⚠️ O Supabase retornou status HTTP ${response.status}. O projeto pode estar pausado.`);
      if (projectRef) {
        await restoreProject(projectRef, supabaseAccessToken);
      }
      return;
    }

    console.warn(`⚠️ Resposta inesperada do Supabase: HTTP ${response.status}`);
    const body = await response.text();
    console.warn(`Detalhes: ${body.slice(0, 200)}`);
  } catch (error) {
    console.error(`\n❌ Falha na conexão com o Supabase: ${error.message}`);
    
    // DNS não encontrado (ENOTFOUND) é a indicação clássica de projeto pausado no Free Tier
    if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND') || error.message.includes('fetch failed')) {
      console.error(`🔍 Diagnóstico: O domínio ${supabaseUrl} não possui registro DNS ativo. O projeto está PAUSADO.`);
      if (projectRef) {
        await restoreProject(projectRef, supabaseAccessToken);
      }
    }
  }
}

runKeepAlive();
