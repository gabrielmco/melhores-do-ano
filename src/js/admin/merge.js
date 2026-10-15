/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE MESCLAGEM DE CONCORRENTES
   Unificação de perfis duplicados com migração atômica de votos e histórico.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { OFFICIAL_CITY, findOfficialCity } from '../siteConfig.js';

let selectedElectionId = '';

export function getSelectedMergeElectionId() {
  return selectedElectionId;
}

export function resetMergeCandidatesFields() {
  const mergeTarget = document.getElementById('mergeTarget');
  const mergeDuplicate = document.getElementById('mergeDuplicate');
  const btnExecuteMerge = document.getElementById('btnExecuteMerge');

  if (mergeTarget) {
    mergeTarget.innerHTML = '<option value="">Selecione primeiro a categoria</option>';
    mergeTarget.disabled = true;
  }
  if (mergeDuplicate) {
    mergeDuplicate.innerHTML = '<option value="">Selecione primeiro a categoria</option>';
    mergeDuplicate.disabled = true;
  }
  if (btnExecuteMerge) {
    btnExecuteMerge.disabled = true;
  }
}

export async function initMergeTab() {
  const mergeForm = document.getElementById('mergeForm');
  const mergeCity = document.getElementById('mergeCity');
  const mergeCategory = document.getElementById('mergeCategory');

  if (mergeForm) mergeForm.reset();
  if (mergeCity) {
    mergeCity.innerHTML = `<option value="">Carregando ${OFFICIAL_CITY.displayName}...</option>`;
    mergeCity.disabled = false;
  }
  if (mergeCategory) {
    mergeCategory.innerHTML = '<option value="">Aguardando a localidade oficial</option>';
    mergeCategory.disabled = true;
  }
  resetMergeCandidatesFields();

  try {
    const { data, error } = await supabase.from('cities').select('*').order('name');
    if (error) throw error;

    const officialCity = findOfficialCity(data);
    if (!officialCity) throw new Error(`${OFFICIAL_CITY.displayName} não está cadastrada.`);
    if (mergeCity) {
      mergeCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
      mergeCity.value = officialCity.id;
      mergeCity.disabled = true;
    }
    await loadMergeCategories(officialCity.id);
  } catch (err) {
    console.error(err);
  }
}

export async function loadMergeCategories(cityId) {
  const mergeCategory = document.getElementById('mergeCategory');
  if (!mergeCategory) return;

  try {
    // Pegar eleição aberta
    const { data: election, error: electErr } = await supabase
      .from('elections')
      .select('id')
      .eq('city_id', cityId)
      .eq('status', 'aberta')
      .limit(1)
      .single();

    if (electErr || !election) {
      mergeCategory.innerHTML = '<option value="">Nenhuma eleição aberta encontrada</option>';
      return;
    }

    selectedElectionId = election.id;

    const { data, error } = await supabase
      .from('city_categories')
      .select('category_id, categories(id, name)')
      .eq('election_id', election.id);

    if (error) throw error;

    mergeCategory.innerHTML = '<option value="">Selecione a Categoria</option>';
    (data || []).forEach(row => {
      if (row.categories) {
        const option = document.createElement('option');
        option.value = row.categories.id;
        option.textContent = row.categories.name;
        mergeCategory.appendChild(option);
      }
    });

    mergeCategory.disabled = false;
  } catch (err) {
    console.error(err);
  }
}

export async function loadMergeCandidates(categoryId) {
  const mergeTarget = document.getElementById('mergeTarget');
  const mergeDuplicate = document.getElementById('mergeDuplicate');
  const btnExecuteMerge = document.getElementById('btnExecuteMerge');
  if (!mergeTarget || !mergeDuplicate) return;

  try {
    const { data, error } = await supabase
      .from('public_candidates')
      .select('*')
      .eq('election_id', selectedElectionId)
      .eq('category_id', categoryId);

    if (error) throw error;

    if (!data || data.length < 2) {
      mergeTarget.innerHTML = '<option value="">Número insuficiente de concorrentes para mesclar</option>';
      mergeDuplicate.innerHTML = '<option value="">Número insuficiente de concorrentes para mesclar</option>';
      return;
    }

    const fillSelect = (selectElement) => {
      selectElement.innerHTML = '<option value="">Selecione...</option>';
      data.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name + (c.instagram ? ` (${c.instagram})` : '');
        selectElement.appendChild(option);
      });
      selectElement.disabled = false;
    };

    fillSelect(mergeTarget);
    fillSelect(mergeDuplicate);
    if (btnExecuteMerge) btnExecuteMerge.disabled = false;
  } catch (err) {
    console.error(err);
  }
}

export async function executeMergeFlow(e) {
  if (e && e.preventDefault) e.preventDefault();

  const mergeTarget = document.getElementById('mergeTarget');
  const mergeDuplicate = document.getElementById('mergeDuplicate');
  const btnExecuteMerge = document.getElementById('btnExecuteMerge');

  const targetId = mergeTarget ? mergeTarget.value : '';
  const duplicateId = mergeDuplicate ? mergeDuplicate.value : '';

  if (!targetId || !duplicateId) return;
  if (targetId === duplicateId) {
    if (typeof window.showToast === 'function') {
      window.showToast('Erro: O candidato oficial e o duplicado não podem ser o mesmo.', 'error');
    }
    return;
  }

  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Ação irreversível',
      title: 'Confirmar mesclagem segura',
      message: 'A mesclagem migrará todos os votos válidos e aliases do concorrente duplicado para o oficial. O duplicado será inativado permanentemente.',
      confirmText: 'Executar mesclagem',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  if (btnExecuteMerge) {
    btnExecuteMerge.disabled = true;
    btnExecuteMerge.textContent = 'Processando mesclagem...';
  }

  try {
    const { error } = await supabase.rpc('merge_candidates', {
      p_target_id: targetId,
      p_duplicate_id: duplicateId
    });

    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Mesclagem transacional executada com absoluto sucesso no servidor!', 'success');
    }
    await initMergeTab();
  } catch (err) {
    console.error('Erro na mesclagem:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao executar mesclagem: ' + err.message, 'error');
    }
    if (btnExecuteMerge) {
      btnExecuteMerge.disabled = false;
      btnExecuteMerge.textContent = 'Executar Mesclagem Segura';
    }
  }
}

export function setupMergeListeners() {
  const mergeCity = document.getElementById('mergeCity');
  const mergeCategory = document.getElementById('mergeCategory');
  const mergeForm = document.getElementById('mergeForm');

  if (mergeCity) {
    mergeCity.addEventListener('change', async () => {
      const cityId = mergeCity.value;
      if (mergeCategory) {
        mergeCategory.innerHTML = '<option value="">Aguardando a localidade oficial</option>';
        mergeCategory.disabled = true;
      }
      resetMergeCandidatesFields();
      if (cityId) {
        await loadMergeCategories(cityId);
      }
    });
  }

  if (mergeCategory) {
    mergeCategory.addEventListener('change', async () => {
      const catId = mergeCategory.value;
      resetMergeCandidatesFields();
      if (catId) {
        await loadMergeCandidates(catId);
      }
    });
  }

  if (mergeForm) {
    mergeForm.addEventListener('submit', executeMergeFlow);
  }
}
