/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE ELEIÇÕES, DESEMPATE E FASES
   Gestão do ciclo de vida das edições, desempate auditado e fases do evento.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { isOfficialCity } from '../siteConfig.js';
import { escapeHtml } from './helpers.js';

export async function loadElections() {
  const electionsTableBody = document.getElementById('electionsTableBody');
  if (!electionsTableBody) return;

  try {
    electionsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando edições...</td></tr>';

    const { data, error } = await supabase
      .from('elections')
      .select('*, cities(name)')
      .order('year', { ascending: false });

    if (error) throw error;

    const officialElections = (data || []).filter(election => isOfficialCity(election.cities));
    electionsTableBody.innerHTML = '';
    populateTieElectionOptions(officialElections);
    
    officialElections.forEach(el => {
      const row = document.createElement('tr');
      const start = new Date(el.start_date).toLocaleDateString('pt-BR');
      const end = new Date(el.end_date).toLocaleDateString('pt-BR');

      let actionsHtml = '';
      if (el.status === 'rascunho') {
        actionsHtml = `<button class="btn btn-open-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 12px;">Abrir Votação</button>`;
      } else if (el.status === 'aberta') {
        actionsHtml = `<button class="btn btn-danger btn-close-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 12px;">Encerrar Votação</button>`;
      } else if (el.status === 'encerrada' || el.status === 'apuracao') {
        actionsHtml = `<button class="btn btn-close-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 12px; background: linear-gradient(135deg, #a8ff78 0%, #78ffd6 100%);">Apurar e Publicar</button>`;
      } else if (el.status === 'publicada') {
        actionsHtml = `<span style="color: #2ecc71; font-weight:600; font-size:0.8rem; text-transform:uppercase;">Publicada</span>`;
      } else {
        actionsHtml = `<span style="color: rgba(255,255,255,0.3); font-size:0.8rem;">Rascunho</span>`;
      }

      row.innerHTML = `
        <td style="font-weight: 600;">Melhores do Ano ${escapeHtml(el.cities ? el.cities.name : 'N/A')}</td>
        <td>${escapeHtml(el.year)}</td>
        <td style="font-size:0.8rem; color: rgba(255,255,255,0.6);">${start} até ${end}</td>
        <td>
          <span style="font-size: 0.75rem; font-weight:700; padding: 2px 6px; border-radius:4px; text-transform: uppercase;" 
                class="status-badge status-${escapeHtml(el.status.toLowerCase())}">${escapeHtml(el.status)}</span>
        </td>
        <td>${actionsHtml}</td>
      `;

      // Evento de Clique das Ações
      const btn = row.querySelector('.btn-close-election, .btn-open-election');
      if (btn) {
        btn.addEventListener('click', () => handleElectionAction(el));
      }

      electionsTableBody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    electionsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter edições de eleições.</td></tr>';
  }
}

export async function handleElectionAction(election) {
  if (election.status === 'rascunho') {
    if (typeof window.showConfirm === 'function') {
      const confirmed = await window.showConfirm({
        eyebrow: 'Abertura',
        title: 'Abrir votação',
        message: `Deseja abrir a votação do prêmio "${election.year}"? A página pública passará a aceitar votos dentro do período configurado.`,
        confirmText: 'Abrir votação'
      });
      if (!confirmed) return;
    }

    try {
      const { error } = await supabase.rpc('open_election', {
        p_election_id: election.id
      });

      if (error) throw error;

      if (typeof window.showToast === 'function') {
        window.showToast('Votação aberta com sucesso!', 'success');
      }
      await loadElections();
    } catch (err) {
      console.error(err);
      if (typeof window.showToast === 'function') {
        window.showToast('Erro ao abrir votação: ' + err.message, 'error');
      }
    }
  } else if (election.status === 'aberta') {
    if (typeof window.showConfirm === 'function') {
      const confirmed = await window.showConfirm({
        eyebrow: 'Encerramento',
        title: 'Encerrar votação',
        message: `Deseja encerrar definitivamente a votação do prêmio "${election.year}"? Ninguém mais poderá votar.`,
        confirmText: 'Encerrar votação',
        variant: 'danger'
      });
      if (!confirmed) return;
    }

    try {
      const { error } = await supabase.rpc('close_election', {
        p_election_id: election.id
      });

      if (error) throw error;
      
      if (typeof window.showToast === 'function') {
        window.showToast('Votação encerrada com sucesso!', 'success');
      }
      await loadElections();
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast('Erro ao fechar: ' + err.message, 'error');
      }
    }
  } else if (election.status === 'encerrada' || election.status === 'apuracao') {
    if (typeof window.showConfirm === 'function') {
      const confirmed = await window.showConfirm({
        eyebrow: 'Publicação',
        title: 'Apurar e publicar resultados',
        message: 'O sistema verificará empates, calculará os rankings oficiais e publicará a lista final no site.',
        confirmText: 'Publicar resultados'
      });
      if (!confirmed) return;
    }

    try {
      const { error } = await supabase.rpc('publish_results', {
        p_election_id: election.id
      });

      if (error) throw error;

      if (typeof window.showToast === 'function') {
        window.showToast('Resultados consolidados e publicados com sucesso no website público!', 'success');
      }
      await loadElections();
    } catch (err) {
      console.error(err);
      if (typeof window.showToast === 'function') {
        window.showToast('Erro na publicação/empate: ' + err.message, 'error');
      }
    }
  }
}

export function populateTieElectionOptions(elections) {
  const tieElection = document.getElementById('tieElection');
  if (!tieElection) return;

  const currentValue = tieElection.value;
  tieElection.innerHTML = '<option value="">Selecione...</option>';
  (elections || [])
    .filter(el => el.status === 'encerrada' || el.status === 'apuracao')
    .forEach(el => {
      const option = document.createElement('option');
      option.value = el.id;
      option.textContent = `${el.cities ? el.cities.name : 'N/A'} (${el.year}) - ${el.status}`;
      tieElection.appendChild(option);
    });

  if (currentValue && Array.from(tieElection.options).some(opt => opt.value === currentValue)) {
    tieElection.value = currentValue;
  }
}

export async function loadTieCandidates(electionId, categoryId) {
  const tieCandidate = document.getElementById('tieCandidate');
  if (!tieCandidate) return;

  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('id, name, instagram')
      .eq('election_id', electionId)
      .eq('category_id', categoryId)
      .eq('status', 'aprovado')
      .order('name');

    if (error) throw error;

    tieCandidate.innerHTML = '<option value="">Selecione o vencedor</option>';
    (data || []).forEach(candidate => {
      const option = document.createElement('option');
      option.value = candidate.id;
      option.textContent = candidate.name + (candidate.instagram ? ` (${candidate.instagram})` : '');
      tieCandidate.appendChild(option);
    });
    tieCandidate.disabled = (data || []).length === 0;
  } catch (err) {
    console.error(err);
    tieCandidate.innerHTML = '<option value="">Erro ao carregar candidatos</option>';
  }
}

export async function handleResolveTie(e) {
  if (e && e.preventDefault) e.preventDefault();

  const tieElection = document.getElementById('tieElection');
  const tieCategory = document.getElementById('tieCategory');
  const tieCandidate = document.getElementById('tieCandidate');
  const btnResolveTie = document.getElementById('btnResolveTie');
  const formResolveTie = document.getElementById('formResolveTie');

  if (!tieElection || !tieCategory || !tieCandidate) return;
  if (!tieElection.value || !tieCategory.value || !tieCandidate.value) return;

  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Desempate',
      title: 'Registrar desempate auditado',
      message: 'Esta ação registra uma decisão administrativa separada, sem alterar a quantidade real de votos.',
      confirmText: 'Registrar desempate',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  if (btnResolveTie) {
    btnResolveTie.disabled = true;
    btnResolveTie.textContent = 'Registrando...';
  }

  try {
    const { error } = await supabase.rpc('resolve_first_place_tie', {
      p_election_id: tieElection.value,
      p_category_id: tieCategory.value,
      p_winner_candidate_id: tieCandidate.value
    });

    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Desempate registrado com sucesso. Agora tente publicar novamente.', 'success');
    }
    if (formResolveTie) formResolveTie.reset();
    tieCategory.disabled = true;
    tieCandidate.disabled = true;
    await loadElections();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao registrar desempate: ' + err.message, 'error');
    }
  } finally {
    if (btnResolveTie) {
      btnResolveTie.disabled = false;
      btnResolveTie.textContent = 'Registrar Desempate';
    }
  }
}

// Controle de Fases do Evento
export async function loadEventPhase() {
  const selectEventPhase = document.getElementById('selectEventPhase');
  if (!selectEventPhase) return;
  try {
    const { data, error } = await supabase
      .from('event_config')
      .select('value')
      .eq('key', 'current_phase')
      .single();
    if (!error && data) {
      selectEventPhase.value = data.value;
    }
  } catch (err) {
    console.error('Erro ao carregar fase do evento:', err);
  }
}

export async function saveEventPhase() {
  const selectEventPhase = document.getElementById('selectEventPhase');
  const btnSavePhase = document.getElementById('btnSavePhase');
  if (!selectEventPhase || !btnSavePhase) return;

  btnSavePhase.disabled = true;
  btnSavePhase.textContent = 'Salvando...';

  const phaseValue = selectEventPhase.value;

  try {
    const { error } = await supabase
      .from('event_config')
      .upsert({ key: 'current_phase', value: phaseValue });

    if (error) throw error;
    if (typeof window.showToast === 'function') {
      window.showToast('Fase do evento atualizada com sucesso!', 'success');
    }
  } catch (err) {
    console.error('Erro ao salvar fase do evento:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Falha ao salvar fase: ' + err.message, 'error');
    }
  } finally {
    btnSavePhase.disabled = false;
    btnSavePhase.textContent = 'Salvar Fase';
  }
}

export function setupElectionsListeners(loadCategoriesCallback) {
  const tieElection = document.getElementById('tieElection');
  const tieCategory = document.getElementById('tieCategory');
  const formResolveTie = document.getElementById('formResolveTie');
  const btnSavePhase = document.getElementById('btnSavePhase');

  if (tieElection) {
    tieElection.addEventListener('change', async () => {
      const tieCandidate = document.getElementById('tieCandidate');
      if (tieCategory) {
        tieCategory.innerHTML = '<option value="">Selecione a eleição</option>';
        tieCategory.disabled = true;
      }
      if (tieCandidate) {
        tieCandidate.innerHTML = '<option value="">Selecione a categoria</option>';
        tieCandidate.disabled = true;
      }
      if (tieElection.value && typeof loadCategoriesCallback === 'function' && tieCategory) {
        await loadCategoriesCallback(tieElection.value, tieCategory);
      }
    });
  }

  if (tieCategory) {
    tieCategory.addEventListener('change', async () => {
      const tieCandidate = document.getElementById('tieCandidate');
      if (tieCandidate) {
        tieCandidate.innerHTML = '<option value="">Carregando candidatos...</option>';
        tieCandidate.disabled = true;
      }
      if (tieElection && tieElection.value && tieCategory.value) {
        await loadTieCandidates(tieElection.value, tieCategory.value);
      }
    });
  }

  if (formResolveTie) {
    formResolveTie.addEventListener('submit', handleResolveTie);
  }

  if (btnSavePhase) {
    btnSavePhase.addEventListener('click', saveEventPhase);
  }
}
