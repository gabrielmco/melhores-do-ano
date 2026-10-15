/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE MODERAÇÃO DE INDICAÇÕES
   Fila de aprovação/rejeição de indicações populares com auditoria.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { isOfficialCity } from '../siteConfig.js';
import { escapeHtml } from './helpers.js';

export async function loadNominations() {
  const nominationsTableBody = document.getElementById('nominationsTableBody');
  const statPendingNominations = document.getElementById('statPendingNominations');
  if (!nominationsTableBody) return;

  try {
    nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando fila de moderação...</td></tr>';

    // Buscar indicações pendentes ordenadas por data
    const { data, error } = await supabase
      .from('nominations')
      .select('*, categories(name), elections(year, cities(name))')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const officialNominations = (data || []).filter(nomination => isOfficialCity(nomination.elections?.cities));
    if (statPendingNominations) {
      statPendingNominations.textContent = officialNominations.length;
    }
    nominationsTableBody.innerHTML = '';

    if (officialNominations.length === 0) {
      nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 24px 0;">Fila limpa! Nenhuma indicação pendente de moderação.</td></tr>';
      return;
    }

    officialNominations.forEach(nom => {
      const row = document.createElement('tr');
      const cityName = nom.elections && nom.elections.cities ? nom.elections.cities.name : 'N/A';
      const year = nom.elections ? nom.elections.year : 'N/A';
      const voterContact = nom.whatsapp ? `WA: ${nom.whatsapp}` : (nom.email ? `Email: ${nom.email}` : 'N/A');

      row.innerHTML = `
        <td>
          <div style="font-weight:600; color: #ffffff;">${escapeHtml(nom.name)}</div>
          <div style="font-size:0.75rem; color: rgba(255,255,255,0.4);">${escapeHtml(cityName)} (${escapeHtml(year)})</div>
        </td>
        <td><span style="font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius:4px; text-transform: capitalize;">${escapeHtml(nom.type)}</span></td>
        <td><span style="color: rgba(212,175,55,0.85);">${escapeHtml(nom.instagram || 'N/A')}</span></td>
        <td style="color: rgba(255,255,255,0.55); font-size: 0.85rem;">${escapeHtml(voterContact)}</td>
        <td>
          <div style="display:flex; gap: 8px;">
            <button class="btn btn-approve" data-id="${nom.id}" style="font-size: 0.75rem; padding: 6px 12px;">Aprovar</button>
            <button class="btn btn-secondary btn-reject" data-id="${nom.id}" style="font-size: 0.75rem; padding: 6px 12px;">Rejeitar</button>
          </div>
        </td>
      `;

      // Evento Aprovar
      const btnApprove = row.querySelector('.btn-approve');
      if (btnApprove) btnApprove.addEventListener('click', () => approveNomination(nom));

      // Evento Rejeitar
      const btnReject = row.querySelector('.btn-reject');
      if (btnReject) btnReject.addEventListener('click', () => rejectNomination(nom.id));

      nominationsTableBody.appendChild(row);
    });
  } catch (err) {
    console.error('Erro ao buscar indicações:', err);
    nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter indicações pendentes.</td></tr>';
  }
}

// Processar aprovação
export async function approveNomination(nom) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Moderação',
      title: 'Aprovar indicação',
      message: `Deseja aprovar e cadastrar "${nom.name}" como candidato oficial?`,
      confirmText: 'Aprovar candidato'
    });
    if (!confirmed) return;
  }

  try {
    const { error } = await supabase.rpc('approve_nomination', {
      p_nomination_id: nom.id
    });

    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Indicação aprovada e convertida em candidato oficial com sucesso!', 'success');
    }
    await loadNominations();
  } catch (err) {
    console.error('Erro ao aprovar indicação:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao aprovar indicação: ' + err.message, 'error');
    }
  }
}

// Processar rejeição
export async function rejectNomination(id) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Moderação',
      title: 'Rejeitar indicação',
      message: 'Esta indicação será retirada da fila de moderação.',
      confirmText: 'Rejeitar',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  try {
    const { error } = await supabase.rpc('reject_nomination', {
      p_nomination_id: id
    });

    if (error) throw error;

    await loadNominations();
  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao processar ação de moderação.', 'error');
    }
  }
}
