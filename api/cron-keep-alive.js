/* ============================================
   PROJETOS MELHORES DO ANO - VERCEL CRON KEEP-ALIVE
   Serverless Function para manter o Supabase ativo 24/7
   ============================================ */

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(400).json({
      success: false,
      error: 'Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas na Vercel.'
    });
  }

  try {
    const start = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    const latency = Date.now() - start;

    return res.status(200).json({
      success: true,
      message: '⚡ Ping de atividade do Supabase (Melhores do Ano) executado com sucesso pela Vercel!',
      httpStatus: response.status,
      latencyMs: latency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
