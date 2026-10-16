/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE ELEIÇÕES, DESEMPATE, PRAZOS E REABERTURA
   Gestão do ciclo de vida das edições, reabertura, prazos flexíveis e fases.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { isOfficialCity } from '../siteConfig.js';
import { escapeHtml } from './helpers.js';

let cachedElections = [];

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

    cachedElections = (data || []).filter(election => isOfficialCity(election.cities));
    electionsTableBody.innerHTML = '';
    populateTieElectionOptions(cachedElections);
    
    if (cachedElections.length === 0) {
      electionsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 24px;">Nenhuma eleição cadastrada ainda.</td></tr>';
      return;
    }

    cachedElections.forEach(el => {
      const row = document.createElement('tr');
      const start = new Date(el.start_date).toLocaleDateString('pt-BR');
      const end = new Date(el.end_date).toLocaleDateString('pt-BR');

      let actionsHtml = '';
      if (el.status === 'rascunho') {
        actionsHtml = `
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-open-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px;">Abrir Votação</button>
            <button class="btn btn-secondary btn-extend-deadline" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px;">Definir Prazo</button>
          </div>
        `;
      } else if (el.status === 'aberta') {
        actionsHtml = `
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-extend-deadline" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px; color: #f5d788; border-color: rgba(212,175,55,0.3);">Mudar Prazo</button>
            <button class="btn btn-danger btn-close-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px;">Encerrar Votação</button>
          </div>
        `;
      } else if (el.status === 'encerrada' || el.status === 'apuracao') {
        actionsHtml = `
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-reopen-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px; background: rgba(46, 204, 113, 0.15); border: 1px solid #2ecc71; color: #2ecc71;">Reabrir Votação</button>
            <button class="btn btn-secondary btn-extend-deadline" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px;">Mudar Prazo</button>
            <button class="btn btn-publish-results" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 10px; background: linear-gradient(135deg, #a8ff78 0%, #78ffd6 100%); color: #000; font-weight: 600;">Apurar & Publicar</button>
          </div>
        `;
      } else if (el.status === 'publicada') {
        actionsHtml = `
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <span style="color: #2ecc71; font-weight:700; font-size:0.75rem; text-transform:uppercase;">Publicada Oficial</span>
            <button class="btn btn-secondary btn-reopen-election" data-id="${el.id}" style="font-size: 0.72rem; padding: 4px 8px; color: rgba(255,255,255,0.6);">Reabrir se Necessário</button>
          </div>
        `;
      } else {
        actionsHtml = `<span style="color: rgba(255,255,255,0.3); font-size:0.8rem;">Rascunho</span>`;
      }

      row.innerHTML = `
        <td style="font-weight: 600;">
          Melhores do Ano ${escapeHtml(el.cities ? el.cities.name : 'N/A')}
        </td>
        <td>${escapeHtml(el.year)}</td>
        <td style="font-size:0.8rem; color: rgba(255,255,255,0.75);">
          <div>De: <strong>${start}</strong></div>
          <div>Até: <strong style="color: #d4af37;">${end}</strong></div>
        </td>
        <td>
          <span style="font-size: 0.75rem; font-weight:700; padding: 3px 8px; border-radius:4px; text-transform: uppercase;" 
                class="status-badge status-${escapeHtml(el.status.toLowerCase())}">${escapeHtml(el.status)}</span>
        </td>
        <td>${actionsHtml}</td>
      `;

      // Eventos de Botões
      const btnOpen = row.querySelector('.btn-open-election');
      if (btnOpen) {
        btnOpen.addEventListener('click', () => handleElectionAction(el));
      }

      const btnClose = row.querySelector('.btn-close-election');
      if (btnClose) {
        btnClose.addEventListener('click', () => handleElectionAction(el));
      }

      const btnPublish = row.querySelector('.btn-publish-results');
      if (btnPublish) {
        btnPublish.addEventListener('click', () => handlePublishResults(el));
      }

      const btnReopen = row.querySelector('.btn-reopen-election');
      if (btnReopen) {
        btnReopen.addEventListener('click', () => handleReopenElection(el));
      }

      const btnExtend = row.querySelector('.btn-extend-deadline');
      if (btnExtend) {
        btnExtend.addEventListener('click', () => handleChangeElectionDeadline(el));
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
        eyebrow: 'Abertura da Votação',
        title: 'Abrir votação ao público?',
        message: `Deseja abrir oficialmente a votação do prêmio "${election.year}"? A página pública passará a aceitar votos imediatamente dentro do prazo configurado.`,
        confirmText: 'Sim, Abrir Votação'
      });
      if (!confirmed) return;
    }

    try {
      const { error } = await supabase.rpc('open_election', {
        p_election_id: election.id
      });

      if (error) throw error;

      if (typeof window.showToast === 'function') {
        window.showToast('Votação aberta com sucesso! O público já pode votar.', 'success');
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
        eyebrow: 'Encerramento de Votação',
        title: 'Encerrar votação agora?',
        message: `Atenção: Ao encerrar, os eleitores não poderão mais votar na edição "${election.year}". (Caso tenha clicado sem querer, você poderá reabrir a qualquer momento).`,
        confirmText: 'Sim, Encerrar Votação',
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
        window.showToast('Votação encerrada com sucesso! Você pode apurar os resultados ou reabrir se necessário.', 'success');
      }
      await loadElections();
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast('Erro ao fechar votação: ' + err.message, 'error');
      }
    }
  }
}

// Reabertura segura caso o administrador tenha encerrado sem querer
export async function handleReopenElection(election) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Reabertura de Votação',
      title: 'Reabrir votação ao público?',
      message: `Deseja reabrir a votação da edição "${election.year}"? Ela voltará ao status 'aberta' e os eleitores poderão votar normalmente.`,
      confirmText: 'Sim, Reabrir Votação'
    });
    if (!confirmed) return;
  }

  try {
    // Se a data de fim for anterior à atual, prorroga automaticamente em 7 dias para que votos sejam válidos
    const now = new Date();
    const currentEnd = new Date(election.end_date);
    let newEnd = election.end_date;
    if (currentEnd <= now) {
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      newEnd = nextWeek.toISOString();
    }

    const { error } = await supabase
      .from('elections')
      .update({
        status: 'aberta',
        end_date: newEnd
      })
      .eq('id', election.id);

    if (error) throw error;

    // Registrar no log de auditoria
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('admin_action_logs').insert({
        profile_id: user.id,
        action: 'reabriu_eleicao',
        details: { election_id: election.id, new_status: 'aberta', end_date: newEnd }
      });
    }

    if (typeof window.showToast === 'function') {
      window.showToast('Votação reaberta com sucesso! O público já pode votar novamente.', 'success');
    }
    await loadElections();
  } catch (err) {
    console.error('Erro ao reabrir eleição:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao reabrir votação: ' + err.message, 'error');
    }
  }
}

// Prorrogação e determinação de prazo da votação
export async function handleChangeElectionDeadline(election) {
  const currentFormatted = election.end_date ? new Date(election.end_date).toISOString().slice(0, 10) : '';
  const inputDate = prompt('Informe a nova data final (prazo) da votação no formato AAAA-MM-DD (ex: 2026-12-31):', currentFormatted);
  if (!inputDate || !inputDate.trim()) return;

  const cleanDate = inputDate.trim();
  const parsedDate = new Date(`${cleanDate}T23:59:59`);
  if (isNaN(parsedDate.getTime())) {
    if (typeof window.showToast === 'function') {
      window.showToast('Data inválida. Use o formato AAAA-MM-DD.', 'error');
    }
    return;
  }

  try {
    const { error } = await supabase
      .from('elections')
      .update({ end_date: parsedDate.toISOString() })
      .eq('id', election.id);

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('admin_action_logs').insert({
        profile_id: user.id,
        action: 'alterou_prazo_eleicao',
        details: { election_id: election.id, new_end_date: parsedDate.toISOString() }
      });
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`Prazo da votação atualizado para ${parsedDate.toLocaleDateString('pt-BR')} com sucesso!`, 'success');
    }
    await loadElections();
  } catch (err) {
    console.error('Erro ao atualizar prazo:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao alterar prazo: ' + err.message, 'error');
    }
  }
}

export async function handlePublishResults(election) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Publicação Oficial',
      title: 'Apurar e publicar resultados?',
      message: 'O sistema verificará empates, calculará os vencedores oficiais e publicará a lista final no site.',
      confirmText: 'Apurar e Publicar'
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
