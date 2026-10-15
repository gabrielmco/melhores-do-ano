// ============================================================================
// PROJETOS MELHORES DO ANO - EXPORTADOR DE RELATÓRIOS OFICIAIS (CSV / EXCEL)
// Compatível com RFC 4180 e codificação UTF-8 com BOM para Excel
// ============================================================================

export function formatCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function buildCsvContent(headers, rows) {
  // \uFEFF é o Byte Order Mark (BOM) UTF-8 essencial para o Microsoft Excel
  // abrir caracteres acentuados em português (á, é, ã, ç) sem corrupção.
  let csv = '\uFEFF';
  csv += headers.map(formatCsvField).join(';') + '\r\n';

  rows.forEach(row => {
    csv += row.map(formatCsvField).join(';') + '\r\n';
  });

  return csv;
}

export function downloadCsvFile(filename, csvContent) {
  if (typeof document === 'undefined') return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportAuditLogsToCsv(logs = [], filename = 'auditoria_votos_bom_jardim.csv') {
  const headers = ['Data / Hora', 'Eleitor', 'Categoria', 'Candidato', 'Status', 'IP Anonimizado', 'Dispositivo / User Agent', 'Detalhes Anti-Fraude'];
  const rows = logs.map(l => [
    l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : '',
    l.voter_name || l.voter_identifier_masked || 'Eleitor',
    l.category_name || '',
    l.candidate_name || '',
    l.status || 'Válido',
    l.ip_hashed || l.ip || 'Anonimizado',
    l.user_agent || '',
    l.notes || l.fraud_score || 'Legítimo'
  ]);

  const content = buildCsvContent(headers, rows);
  downloadCsvFile(filename, content);
  return content;
}

export function exportResultsToCsv(winnersList = [], filename = 'apuracao_oficial_melhores_do_ano.csv') {
  const headers = ['Categoria', 'Posição', 'Candidato / Empresa', 'Instagram', 'Total de Votos Válidos', 'Status'];
  const rows = winnersList.map(w => {
    let posText = 'Finalista';
    if (w.position === 1 || w.is_winner) {
      posText = '1º Lugar (Vencedor)';
    } else if (w.position) {
      posText = `${w.position}º Lugar`;
    }
    return [
      w.category_name || w.category?.name || 'Geral',
      posText,
      w.candidate_name || w.name || '',
      w.candidate_instagram || w.instagram || '',
      w.vote_count_snapshot ?? w.votes ?? 0,
      w.position === 1 || w.is_winner ? 'Consagrado' : 'Finalista Oficial'
    ];
  });

  const content = buildCsvContent(headers, rows);
  downloadCsvFile(filename, content);
  return content;
}

export function exportCrmLeadsToCsv(leads = [], filename = 'crm_prospeccao_vendas.csv') {
  const headers = ['Nome da Empresa / Profissional', 'Categoria', 'Contato / WhatsApp', 'Status no Funil', 'Pacote Comercial', 'Valor Fechado (R$)', 'Observações'];
  const rows = leads.map(lead => [
    lead.name || '',
    lead.category_name || '',
    lead.whatsapp || lead.phone || lead.email || '',
    lead.stage || 'prospeccao',
    lead.package || 'Nenhum',
    lead.contract_value ? Number(lead.contract_value).toFixed(2) : '0.00',
    lead.notes || ''
  ]);

  const content = buildCsvContent(headers, rows);
  downloadCsvFile(filename, content);
  return content;
}
