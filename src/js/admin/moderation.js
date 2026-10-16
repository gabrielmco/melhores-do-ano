/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE MODERAÇÃO & AUTOCADASTROS
   Fila de aprovação de indicações populares e gestão de empresas autocadastradas.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { isOfficialCity } from '../siteConfig.js';
import { escapeHtml } from './helpers.js';

let cachedNominations = [];
let cachedSelfRegistered = [];

export async function loadNominations() {
  await Promise.all([
    loadPublicNominationsList(),
    loadSelfRegisteredCandidatesList()
  ]);
}

// 1. Fila de Indicações enviadas pelo público
export async function loadPublicNominationsList() {
  const nominationsTableBody = document.getElementById('nominationsTableBody');
  const statPendingNominations = document.getElementById('statPendingNominations');
  const statPendingNominationsBadge = document.getElementById('statPendingNominationsBadge');
  if (!nominationsTableBody) return;

  try {
    nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando fila de indicações...</td></tr>';

    const { data, error } = await supabase
      .from('nominations')
      .select('*, categories(name), elections(year, cities(name))')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (error) throw error;

    cachedNominations = (data || []).filter(nomination => isOfficialCity(nomination.elections?.cities));
    
    if (statPendingNominations) {
      statPendingNominations.textContent = cachedNominations.length;
    }
    if (statPendingNominationsBadge) {
      statPendingNominationsBadge.textContent = cachedNominations.length;
    }
    
    nominationsTableBody.innerHTML = '';

    if (cachedNominations.length === 0) {
      nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 24px 0;">Fila limpa! Nenhuma indicação pendente de moderação.</td></tr>';
      return;
    }

    cachedNominations.forEach(nom => {
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

      const btnApprove = row.querySelector('.btn-approve');
      if (btnApprove) btnApprove.addEventListener('click', () => approveNomination(nom));

      const btnReject = row.querySelector('.btn-reject');
      if (btnReject) btnReject.addEventListener('click', () => rejectNomination(nom.id));

      nominationsTableBody.appendChild(row);
    });
  } catch (err) {
    console.error('Erro ao buscar indicações:', err);
    nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter indicações pendentes.</td></tr>';
  }
}

// 2. Empresas e Concorrentes que se Autocadastraram no Portal
export async function loadSelfRegisteredCandidatesList() {
  const selfRegTableBody = document.getElementById('selfRegisteredTableBody');
  const statSelfRegistered = document.getElementById('statSelfRegistered');
  const statSelfRegisteredBadge = document.getElementById('statSelfRegisteredBadge');
  if (!selfRegTableBody) return;

  try {
    selfRegTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando empresas autocadastradas...</td></tr>';

    // Buscar candidatos que possuem profile_id vinculado (autocadastro de candidato)
    const { data, error } = await supabase
      .from('candidates')
      .select('*, categories(name), elections(year, cities(name))')
      .not('profile_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    cachedSelfRegistered = data || [];

    if (statSelfRegistered) {
      statSelfRegistered.textContent = cachedSelfRegistered.length;
    }
    if (statSelfRegisteredBadge) {
      statSelfRegisteredBadge.textContent = cachedSelfRegistered.length;
    }

    selfRegTableBody.innerHTML = '';

    if (cachedSelfRegistered.length === 0) {
      selfRegTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 24px 0;">Nenhuma empresa se autocadastrou até o momento.</td></tr>';
      return;
    }

    cachedSelfRegistered.forEach(cand => {
      const row = document.createElement('tr');
      const categoryName = cand.categories?.name || 'N/A';
      const cleanWa = String(cand.whatsapp || '').replace(/\D/g, '');
      const waUrl = cleanWa ? `https://wa.me/${cleanWa.startsWith('55') ? cleanWa : '55' + cleanWa}?text=${encodeURIComponent(`Olá, equipe da ${cand.name}! Vimos que você se cadastrou no prêmio Melhores do Ano.`)}` : null;
      
      const waLink = waUrl ? `
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="color: #2ecc71; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; margin-top: 2px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Chamar no WhatsApp
        </a>
      ` : '';

      const contacts = `Email: ${escapeHtml(cand.email || 'N/A')}<br/>WA: ${escapeHtml(cand.whatsapp || 'N/A')}<br/>${waLink}`;

      row.innerHTML = `
        <td>
          <div style="font-weight:600; color: #ffffff;">${escapeHtml(cand.name)}</div>
          <span style="display: inline-block; background: rgba(212,175,55,0.15); color: #f5d788; border: 1px solid rgba(212,175,55,0.25); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; margin-top: 4px;">Autocadastrado</span>
        </td>
        <td><span style="font-size: 0.82rem; color: rgba(255,255,255,0.7);">${escapeHtml(categoryName)}</span></td>
        <td><span style="color: #d4af37; font-weight: 500;">${escapeHtml(cand.instagram || 'Sem Instagram')}</span></td>
        <td style="font-size: 0.8rem; color: rgba(255,255,255,0.65);">${contacts}</td>
        <td>
          <div style="display: flex; gap: 6px; align-items: center;">
            <span class="status-badge status-${escapeHtml(cand.status?.toLowerCase() || 'aprovado')}" style="font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">${escapeHtml(cand.status || 'Ativo')}</span>
          </div>
        </td>
      `;

      selfRegTableBody.appendChild(row);
    });

  } catch (err) {
    console.error('Erro ao buscar empresas autocadastradas:', err);
    selfRegTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter empresas autocadastradas.</td></tr>';
  }
}

// Processar aprovação de indicação
export async function approveNomination(nom) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Aprovação de Concorrente',
      title: 'Aprovar indicação pública?',
      message: `Deseja aprovar e cadastrar "${nom.name}" como candidato oficial na categoria "${nom.categories?.name || ''}"?`,
      confirmText: 'Sim, Aprovar Candidato'
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
      eyebrow: 'Rejeição de Indicação',
      title: 'Rejeitar esta indicação?',
      message: 'Esta indicação será retirada da fila de moderação e não participará da eleição.',
      confirmText: 'Sim, Rejeitar',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  try {
    const { error } = await supabase.rpc('reject_nomination', {
      p_nomination_id: id
    });

    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Indicação rejeitada com sucesso.', 'info');
    }
    await loadNominations();
  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao processar ação de moderação.', 'error');
    }
  }
}

export function setupModerationListeners() {
  const btnTabNominations = document.getElementById('btnTabNominations');
  const btnTabSelfRegistered = document.getElementById('btnTabSelfRegistered');
  const viewNominations = document.getElementById('viewNominations');
  const viewSelfRegistered = document.getElementById('viewSelfRegistered');

  if (btnTabNominations && btnTabSelfRegistered && viewNominations && viewSelfRegistered) {
    btnTabNominations.addEventListener('click', () => {
      btnTabNominations.classList.add('active');
      btnTabSelfRegistered.classList.remove('active');
      viewNominations.style.display = 'block';
      viewSelfRegistered.style.display = 'none';
    });

    btnTabSelfRegistered.addEventListener('click', () => {
      btnTabSelfRegistered.classList.add('active');
      btnTabNominations.classList.remove('active');
      viewSelfRegistered.style.display = 'block';
      viewNominations.style.display = 'none';
      loadSelfRegisteredCandidatesList();
    });
  }
}
