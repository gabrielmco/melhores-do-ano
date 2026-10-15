/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE LOGS DE AUDITORIA E VOTOS SUSPEITOS
   Rastreabilidade de ações administrativas e auditoria anti-fraude.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { escapeHtml } from './helpers.js';
import { exportAuditLogsToCsv } from '../modules/csvExporter.js';

let cachedLogs = [];
let cachedFlags = [];

export async function loadLogsAndAudits() {
  const adminActionLogsTableBody = document.getElementById('adminActionLogsTableBody');
  const suspiciousVotesTableBody = document.getElementById('suspiciousVotesTableBody');

  if (adminActionLogsTableBody) {
    adminActionLogsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando logs...</td></tr>';
  }
  if (suspiciousVotesTableBody) {
    suspiciousVotesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando votos suspeitos...</td></tr>';
  }

  try {
    // 1. Carregar logs
    const { data: logs, error: logsErr } = await supabase
      .from('admin_action_logs')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsErr) throw logsErr;
    cachedLogs = logs || [];
    
    if (adminActionLogsTableBody) {
      adminActionLogsTableBody.innerHTML = '';
      cachedLogs.forEach(log => {
        const row = document.createElement('tr');
        const time = new Date(log.created_at).toLocaleString('pt-BR');
        const detailsStr = JSON.stringify(log.details);
        row.innerHTML = `
          <td style="font-size:0.75rem; color: rgba(255,255,255,0.5);">${escapeHtml(time)}</td>
          <td style="font-weight: 500;">${escapeHtml(log.profiles ? log.profiles.name : 'Sistema/Auto')}</td>
          <td style="font-size:0.8rem; background:rgba(255,255,255,0.03);">${escapeHtml(log.action)}</td>
          <td style="font-size:0.75rem; color: rgba(255,255,255,0.4); font-family: monospace; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title='${escapeHtml(detailsStr)}'>${escapeHtml(detailsStr)}</td>
        `;
        adminActionLogsTableBody.appendChild(row);
      });
    }

    // 2. Carregar votos sinalizados como suspeitos
    const { data: flags, error: flagsErr } = await supabase
      .from('suspicious_vote_flags')
      .select('*, votes(voter_name, ip_address, candidate:candidates(name))')
      .order('created_at', { ascending: false })
      .limit(50);

    if (flagsErr) throw flagsErr;
    cachedFlags = flags || [];

    if (suspiciousVotesTableBody) {
      suspiciousVotesTableBody.innerHTML = '';

      if (!flags || flags.length === 0) {
        suspiciousVotesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(46, 204, 113, 0.4); padding: 16px 0;">Nenhum voto suspeito detectado nas auditorias.</td></tr>';
        return;
      }

      flags.forEach(flag => {
        const row = document.createElement('tr');
        const vote = flag.votes || {};
        const candidateName = vote.candidate ? vote.candidate.name : 'Desconhecido';
        
        row.innerHTML = `
          <td style="font-size:0.7rem; color: rgba(255,255,255,0.4);">${escapeHtml(String(flag.vote_id || '').substring(0, 8))}...</td>
          <td style="font-weight: 500;">${escapeHtml(candidateName)}</td>
          <td>${escapeHtml(vote.voter_name || 'Anônimo')}</td>
          <td style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">${escapeHtml(vote.ip_address || 'N/A')}</td>
          <td style="color: #ff5555; font-size:0.8rem; font-weight:600;">${escapeHtml(flag.reason)}</td>
        `;
        suspiciousVotesTableBody.appendChild(row);
      });
    }

  } catch (err) {
    console.error(err);
    if (adminActionLogsTableBody) {
      adminActionLogsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff5555;">Erro ao obter logs.</td></tr>';
    }
    if (suspiciousVotesTableBody) {
      suspiciousVotesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter votos suspeitos.</td></tr>';
    }
  }
}

export function setupLogsListeners() {
  const btnExportAuditCsv = document.getElementById('btnExportAuditCsv');
  if (btnExportAuditCsv) {
    btnExportAuditCsv.addEventListener('click', () => {
      // Combina os dados para auditoria CSV
      const rows = [];

      cachedLogs.forEach(l => {
        rows.push({
          created_at: l.created_at,
          voter_name: l.profiles ? l.profiles.name : 'Admin',
          category_name: 'Ação Administrativa',
          candidate_name: l.action || 'Sistema',
          status: 'Auditoria Admin',
          ip_hashed: 'N/A',
          user_agent: 'Console',
          notes: JSON.stringify(l.details || {})
        });
      });

      cachedFlags.forEach(f => {
        const vote = f.votes || {};
        rows.push({
          created_at: f.created_at,
          voter_name: vote.voter_name || 'Anônimo',
          category_name: 'Votação Popular',
          candidate_name: vote.candidate?.name || 'Candidato',
          status: 'Sinalizado Suspeito',
          ip_hashed: vote.ip_address || 'N/A',
          user_agent: 'Votação',
          notes: f.reason || 'Sinalizado'
        });
      });

      if (rows.length === 0) {
        if (typeof window.showToast === 'function') {
          window.showToast('Nenhum log disponível para exportação no momento.', 'warning');
        }
        return;
      }

      exportAuditLogsToCsv(rows, `auditoria_melhores_do_ano_${new Date().toISOString().slice(0, 10)}.csv`);
      if (typeof window.showToast === 'function') {
        window.showToast('Relatório de auditoria CSV exportado com sucesso!', 'success');
      }
    });
  }
}
