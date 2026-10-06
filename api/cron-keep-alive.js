/* ============================================================================
   PROJETOS MELHORES DO ANO - VERCEL CRON KEEP-ALIVE & AUTO-RESTORE
   Serverless Function para manter o Supabase ativo 24/7 e recuperar projetos pausados
   ============================================================================ */

export default async function handler(req, res) {
  // Autenticação opcional do cron da Vercel (CRON_SECRET)
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(400).json({
      success: false,
      error: 'Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas nas Environment Variables da Vercel.'
    });
  }

  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  const projectRef = match ? match[1] : null;

  const start = Date.now();

  try {
    // Consulta SQL real na tabela categories para forçar compute ativo no Postgres
    const response = await fetch(`${supabaseUrl}/rest/v1/categories?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json'
      }
    });

    const latency = Date.now() - start;

    if (response.ok) {
      return res.status(200).json({
        success: true,
        status: 'active',
        message: '⚡ Ping de atividade do Supabase (Melhores do Ano) executado com sucesso!',
        httpStatus: response.status,
        latencyMs: latency,
        timestamp: new Date().toISOString()
      });
    }

    // Se retornar 503 ou erro, o projeto pode estar pausado
    let autoRestored = false;
    if (projectRef && supabaseAccessToken && (response.status === 503 || response.status === 500)) {
      const restoreRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAccessToken}`,
          'Content-Type': 'application/json'
        }
      });
      autoRestored = restoreRes.ok;
    }

    return res.status(200).json({
      success: true,
      status: 'restoring_or_warning',
      projectRef,
      httpStatus: response.status,
      autoRestored,
      message: autoRestored 
        ? '🚀 Projeto estava pausado e a restauração automática foi disparada via Supabase Management API!' 
        : `⚠️ Supabase retornou HTTP ${response.status}. Se o projeto estiver pausado, configure SUPABASE_ACCESS_TOKEN para restauração automática.`
    });
  } catch (error) {
    // Falha de DNS (ENOTFOUND) ocorre quando o projeto é pausado e perde o DNS Cloudflare
    let autoRestored = false;
    if (projectRef && supabaseAccessToken) {
      try {
        const restoreRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/restore`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAccessToken}`,
            'Content-Type': 'application/json'
          }
        });
        autoRestored = restoreRes.ok;
      } catch (e) {
        // Ignora erro da chamada de restore
      }
    }

    return res.status(200).json({
      success: true,
      status: 'dns_unresolved_or_paused',
      projectRef,
      autoRestored,
      error: error.message,
      message: autoRestored 
        ? '🚀 Projeto estava pausado (DNS inativo) e a restauração automática foi disparada com sucesso!' 
        : '⚠️ Supabase inacessível (DNS inexistente/pausado). Reative no painel ou configure SUPABASE_ACCESS_TOKEN.'
    });
  }
}
