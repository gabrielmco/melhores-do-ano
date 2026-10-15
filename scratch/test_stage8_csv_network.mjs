import assert from 'node:assert/strict';
import {
  formatCsvField,
  buildCsvContent,
  exportAuditLogsToCsv,
  exportResultsToCsv,
  exportCrmLeadsToCsv
} from '../src/js/modules/csvExporter.js';
import {
  initNetworkMonitor,
  checkIsOnline
} from '../src/js/modules/networkMonitor.js';

console.log('=== INICIANDO SUÍTE DE TESTES: ETAPA 8 - CSV EXPORTER & NETWORK MONITOR ===');

// TESTE 1: Formatação de campos CSV (RFC 4180 e escape de aspas)
{
  assert.equal(formatCsvField('Padaria Central'), '"Padaria Central"');
  assert.equal(formatCsvField('Empresa "Top 1" do Ano'), '"Empresa ""Top 1"" do Ano"');
  assert.equal(formatCsvField(null), '""');
  assert.equal(formatCsvField(undefined), '""');
  assert.equal(formatCsvField(12345), '"12345"');
  console.log('✔ Teste 1 Aprovado: Formatação e escape RFC 4180 de campos CSV.');
}

// TESTE 2: Construção de CSV com UTF-8 BOM e delimitador ponto-e-vírgula
{
  const headers = ['Nome', 'Categoria', 'Cidade'];
  const rows = [
    ['Farmácia São Bento', 'Saúde & Farmácia', 'Bom Jardim – MG'],
    ['Restaurante Fogão à Lenha', 'Gastronomia', 'Bom Jardim – MG']
  ];

  const csv = buildCsvContent(headers, rows);

  // Deve iniciar com o Byte Order Mark (BOM) UTF-8 (\uFEFF)
  assert.ok(csv.startsWith('\uFEFF'), 'CSV deve iniciar com UTF-8 BOM para evitar corrupção no Microsoft Excel');
  // Deve usar delimitador de ponto e vírgula
  assert.ok(csv.includes('"Nome";"Categoria";"Cidade"'), 'Deve usar ponto e vírgula como delimitador regional padrão');
  // Deve preservar acentuação correta
  assert.ok(csv.includes('Farmácia São Bento'));
  assert.ok(csv.includes('Fogão à Lenha'));
  // Deve conter quebras de linha padrão Windows/RFC 4180 (\r\n)
  assert.ok(csv.includes('\r\n'));
  console.log('✔ Teste 2 Aprovado: Estrutura CSV com UTF-8 BOM e suporte a acentos no Excel.');
}

// TESTE 3: Exportação de Auditoria de Votos e Logs
{
  const mockLogs = [
    {
      created_at: '2026-10-15T12:00:00Z',
      voter_name: 'Carlos Oliveira',
      category_name: 'Melhor Padaria',
      candidate_name: 'Pão Dourado',
      status: 'Válido',
      ip_hashed: '187.xxx.xxx.12',
      user_agent: 'Mozilla/5.0 Android',
      notes: 'Auditado OK'
    }
  ];

  const csvAudit = exportAuditLogsToCsv(mockLogs, 'teste_auditoria.csv');
  assert.ok(csvAudit.includes('"Data / Hora";"Eleitor";"Categoria";"Candidato"'));
  assert.ok(csvAudit.includes('Carlos Oliveira'));
  assert.ok(csvAudit.includes('Pão Dourado'));
  assert.ok(csvAudit.includes('187.xxx.xxx.12'));
  console.log('✔ Teste 3 Aprovado: Geração de relatório de auditoria de votos e logs.');
}

// TESTE 4: Exportação de Resultados Oficiais e Vencedores
{
  const mockWinners = [
    {
      category_name: 'Supermercados',
      position: 1,
      is_winner: true,
      candidate_name: 'Supermercado Central',
      candidate_instagram: '@supercentral',
      vote_count_snapshot: 1420
    },
    {
      category_name: 'Supermercados',
      position: 2,
      is_winner: false,
      candidate_name: 'Mercado da Vila',
      candidate_instagram: '@mercadovila',
      vote_count_snapshot: 980
    }
  ];

  const csvResults = exportResultsToCsv(mockWinners, 'teste_resultados.csv');
  assert.ok(csvResults.includes('1º Lugar (Vencedor)'));
  assert.ok(csvResults.includes('Finalista Oficial'));
  assert.ok(csvResults.includes('"1420"'));
  assert.ok(csvResults.includes('"980"'));
  console.log('✔ Teste 4 Aprovado: Geração de planilha de apuração e vencedores.');
}

// TESTE 5: Exportação de Leads Comerciais do CRM
{
  const mockLeads = [
    {
      name: 'Auto Escola Piloto',
      category_name: 'Educação & Trânsito',
      whatsapp: '(32) 99876-5432',
      stage: 'interessado',
      package: 'Placa Ouro + Selo Digital',
      contract_value: 1250.50,
      notes: 'Retornar após reunião dia 20'
    }
  ];

  const csvCrm = exportCrmLeadsToCsv(mockLeads, 'teste_crm.csv');
  assert.ok(csvCrm.includes('Auto Escola Piloto'));
  assert.ok(csvCrm.includes('(32) 99876-5432'));
  assert.ok(csvCrm.includes('1250.50'));
  console.log('✔ Teste 5 Aprovado: Geração de planilha de prospecção comercial CRM.');
}

// TESTE 6: Resiliência do Monitor de Rede em Ambiente Headless
{
  assert.doesNotThrow(() => {
    initNetworkMonitor();
    const online = checkIsOnline();
    assert.equal(typeof online, 'boolean');
  }, 'Monitor de rede não deve quebrar em ambientes sem window/document');
  console.log('✔ Teste 6 Aprovado: Network Monitor seguro e operacional.');
}

console.log('=================================================================');
console.log('🏆 100% DOS TESTES DA ETAPA 8 (CSV & NETWORK) APROVADOS (6/6)!');
console.log('=================================================================');
