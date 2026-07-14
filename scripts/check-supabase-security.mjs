import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { OFFICIAL_CITY, isOfficialCity } from '../src/js/siteConfig.js';

function loadLocalEnv() {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

loadLocalEnv();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey || url.includes('sua-url-aqui') || anonKey.includes('sua-anon-key-aqui')) {
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes do teste.');
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

let failed = false;

async function expectPublicRead(table) {
  const { data, error } = await supabase.from(table).select('*').limit(5);
  if (error) {
    console.error(`FALHOU: leitura pública de ${table}: ${error.message}`);
    failed = true;
  } else {
    console.log(`OK: leitura pública controlada em ${table} (${data?.length ?? 0} registro(s) na amostra)`);
  }
}

async function expectNoAnonymousRows(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (!error && Array.isArray(data) && data.length > 0) {
    console.error(`FALHOU: visitante anônimo recebeu dados de ${table}`);
    failed = true;
  } else {
    console.log(`OK: visitante anônimo não recebeu dados de ${table}`);
  }
}

async function expectAnonymousWriteDenied(table, payload) {
  const { error } = await supabase.from(table).insert(payload);
  if (!error) {
    console.error(`FALHOU: visitante anônimo conseguiu inserir em ${table}`);
    failed = true;
  } else {
    console.log(`OK: escrita anônima bloqueada em ${table}`);
  }
}

await expectPublicRead('cities');
await expectPublicRead('categories');
await expectPublicRead('elections');
await expectPublicRead('public_candidates');
await expectPublicRead('public_winners');

const { data: publicCities, error: publicCitiesError } = await supabase
  .from('cities')
  .select('id,name');

if (publicCitiesError) {
  console.error(`FALHOU: não foi possível auditar a localidade pública: ${publicCitiesError.message}`);
  failed = true;
} else if (publicCities?.length !== 1 || !isOfficialCity(publicCities[0])) {
  console.error(`FALHOU: a API pública deve expor somente ${OFFICIAL_CITY.displayName}.`);
  failed = true;
} else {
  console.log(`OK: a API pública expõe somente ${OFFICIAL_CITY.displayName}.`);
}

for (const table of [
  'profiles',
  'candidates',
  'nominations',
  'votes',
  'vote_attempts',
  'suspicious_vote_flags',
  'admin_action_logs'
]) {
  await expectNoAnonymousRows(table);
}

await expectAnonymousWriteDenied('nominations', {
  name: 'teste-de-seguranca-sem-identificadores-validos'
});
await expectAnonymousWriteDenied('votes', {
  voter_name: 'teste-de-seguranca'
});

const { error: privateRpcError } = await supabase.rpc('cast_vote_secure', {
  p_election_id: '00000000-0000-0000-0000-000000000000',
  p_category_id: '00000000-0000-0000-0000-000000000000',
  p_candidate_id: '00000000-0000-0000-0000-000000000000',
  p_voter_name: 'Teste',
  p_voter_identifier: '0'.repeat(64),
  p_voter_type: 'email',
  p_ip_address_hash: '0'.repeat(64),
  p_user_agent_hash: '0'.repeat(64),
  p_cookie_id_hash: '0'.repeat(64),
  p_privacy_consent: true,
  p_validation_consent: true
});

if (!privateRpcError) {
  console.error('FALHOU: visitante anônimo conseguiu executar cast_vote_secure diretamente.');
  failed = true;
} else if (privateRpcError.code === 'PGRST202') {
  console.error('FALHOU: a migration de segurança ainda não criou cast_vote_secure no banco remoto.');
  failed = true;
} else {
  console.log(`OK: RPC privada cast_vote_secure bloqueada para visitante anônimo (${privateRpcError.code || 'sem código'}).`);
}

if (failed) process.exit(1);
console.log('Auditoria básica de acesso anônimo aprovada.');
