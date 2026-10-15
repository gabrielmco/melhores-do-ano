/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE GESTÃO DE ESTRUTURA
   CRUD de Cidades, Categorias, Eleições, Vínculos e Candidatos.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { OFFICIAL_CITY, findOfficialCity, isOfficialCity } from '../siteConfig.js';
import { escapeHtml } from './helpers.js';

export async function loadStructureSubTabData(subtabId) {
  if (subtabId === 'subtab-cidades') await loadCitiesList();
  if (subtabId === 'subtab-categorias') await loadCategoriesList();
  if (subtabId === 'subtab-eleicoes') await loadElectionsDropdowns();
  if (subtabId === 'subtab-candidatos') await loadCandidatesDropdowns();
}

// 1. Cidades CRUD
export async function loadCitiesList() {
  const citiesTableBody = document.getElementById('citiesTableBody');
  if (!citiesTableBody) return;

  try {
    citiesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando cidades...</td></tr>';
    const { data, error } = await supabase.from('cities').select('*').order('name');
    if (error) throw error;

    citiesTableBody.innerHTML = '';
    const officialCity = findOfficialCity(data);
    if (!officialCity) {
      citiesTableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: rgba(255,255,255,0.3);">${OFFICIAL_CITY.displayName} ainda não foi cadastrada.</td></tr>`;
      return;
    }

    citiesTableBody.innerHTML = `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(OFFICIAL_CITY.displayName)}</td>
        <td><span style="color:#d4af37; font-size:0.75rem; font-weight:700; text-transform:uppercase;">Localidade protegida</span></td>
      </tr>
    `;
  } catch (err) {
    console.error(err);
    citiesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #ff5555;">Erro ao obter cidades.</td></tr>';
  }
}

export async function handleAddCity(e) {
  if (e && e.preventDefault) e.preventDefault();
  const inputCityName = document.getElementById('inputCityName');
  const name = OFFICIAL_CITY.displayName;

  try {
    const { error } = await supabase.rpc('admin_create_city', { p_name: name });
    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast(`${OFFICIAL_CITY.displayName} está configurada como localidade oficial.`, 'success');
    }
    if (inputCityName) inputCityName.value = OFFICIAL_CITY.displayName;
    await loadCitiesList();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao cadastrar cidade: ' + err.message, 'error');
    }
  }
}

export async function handleDeleteCity(cityId, cityName) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Remoção de Cidade',
      title: 'Excluir cidade permanentemente?',
      message: `Deseja excluir a cidade "${cityName}"? Isso pode afetar eleições e candidatos vinculados.`,
      confirmText: 'Remover',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  try {
    const { error } = await supabase.rpc('admin_delete_city', { p_city_id: cityId });
    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Cidade removida com sucesso!', 'success');
    }
    await loadCitiesList();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao remover: ' + err.message, 'error');
    }
  }
}

// 2. Categorias CRUD
export async function loadCategoriesList() {
  const categoriesTableBody = document.getElementById('categoriesTableBody');
  if (!categoriesTableBody) return;

  try {
    categoriesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando categorias...</td></tr>';
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;

    categoriesTableBody.innerHTML = '';
    if (!data || data.length === 0) {
      categoriesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhuma categoria cadastrada.</td></tr>';
      return;
    }

    data.forEach(cat => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(cat.name)}</td>
        <td>
          <button class="btn btn-danger btn-delete-cat" data-id="${cat.id}" style="font-size:0.75rem; padding: 4px 8px;">Remover</button>
        </td>
      `;
      const btnDel = row.querySelector('.btn-delete-cat');
      if (btnDel) btnDel.addEventListener('click', () => handleDeleteCategory(cat.id, cat.name));
      categoriesTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    categoriesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #ff5555;">Erro ao obter categorias.</td></tr>';
  }
}

export async function handleAddCategory(e) {
  if (e && e.preventDefault) e.preventDefault();
  const inputCategoryName = document.getElementById('inputCategoryName');
  const formAddCategory = document.getElementById('formAddCategory');
  const name = inputCategoryName ? inputCategoryName.value.trim() : '';
  if (!name) return;

  try {
    const { error } = await supabase.rpc('admin_create_category', { p_name: name });
    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Categoria cadastrada com sucesso!', 'success');
    }
    if (formAddCategory) formAddCategory.reset();
    await loadCategoriesList();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao cadastrar categoria: ' + err.message, 'error');
    }
  }
}

export async function handleDeleteCategory(catId, catName) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Remoção de Categoria',
      title: 'Excluir categoria permanentemente?',
      message: `Deseja excluir a categoria "${catName}"? Isso removerá a categoria de todas as eleições vinculadas.`,
      confirmText: 'Remover',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  try {
    const { error } = await supabase.rpc('admin_delete_category', { p_category_id: catId });
    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Categoria removida com sucesso!', 'success');
    }
    await loadCategoriesList();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao remover: ' + err.message, 'error');
    }
  }
}

// 3. Eleições CRUD & Vínculos
export async function loadElectionsDropdowns() {
  const selectElectionCity = document.getElementById('selectElectionCity');
  const selectLinkElection = document.getElementById('selectLinkElection');

  try {
    const { data: cities, error: citiesErr } = await supabase.from('cities').select('*').order('name');
    if (citiesErr) throw citiesErr;

    const officialCity = findOfficialCity(cities);
    if (!officialCity) throw new Error(`${OFFICIAL_CITY.displayName} não está cadastrada.`);
    
    if (selectElectionCity) {
      selectElectionCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
      selectElectionCity.value = officialCity.id;
      selectElectionCity.disabled = true;
    }

    const { data: elections, error: electErr } = await supabase
      .from('elections')
      .select('*, cities(name)')
      .eq('city_id', officialCity.id)
      .order('year', { ascending: false });

    if (electErr) throw electErr;

    if (selectLinkElection) {
      selectLinkElection.innerHTML = '<option value="">Selecione uma eleição...</option>';
      (elections || []).forEach(el => {
        const opt = document.createElement('option');
        opt.value = el.id;
        opt.textContent = `${el.cities ? el.cities.name : 'N/A'} (${el.year}) - ${el.status}`;
        selectLinkElection.appendChild(opt);
      });
    }

  } catch (err) {
    console.error(err);
  }
}

export async function handleAddElection(e) {
  if (e && e.preventDefault) e.preventDefault();
  const selectElectionCity = document.getElementById('selectElectionCity');
  const inputElectionYear = document.getElementById('inputElectionYear');
  const inputElectionStart = document.getElementById('inputElectionStart');
  const inputElectionEnd = document.getElementById('inputElectionEnd');
  const formAddElection = document.getElementById('formAddElection');

  const city_id = selectElectionCity ? selectElectionCity.value : '';
  const year = inputElectionYear ? parseInt(inputElectionYear.value) : 0;
  const start_date = inputElectionStart ? inputElectionStart.value : '';
  const end_date = inputElectionEnd ? inputElectionEnd.value : '';

  if (!city_id || !year || !start_date || !end_date) return;

  try {
    const { error } = await supabase.rpc('admin_create_election', {
      p_city_id: city_id,
      p_year: year,
      p_start_date: start_date,
      p_end_date: end_date
    });

    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Eleição/Edição criada em rascunho com sucesso!', 'success');
    }
    if (formAddElection) formAddElection.reset();
    await loadElectionsDropdowns();
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao criar eleição: ' + err.message, 'error');
    }
  }
}

export async function loadLinkedCategoriesCheckboxList() {
  const selectLinkElection = document.getElementById('selectLinkElection');
  const linkCategoriesCheckboxes = document.getElementById('linkCategoriesCheckboxes');
  const btnSaveCategoryLinks = document.getElementById('btnSaveCategoryLinks');
  if (!selectLinkElection || !linkCategoriesCheckboxes) return;

  const electionId = selectLinkElection.value;
  linkCategoriesCheckboxes.innerHTML = '';
  if (btnSaveCategoryLinks) btnSaveCategoryLinks.disabled = true;

  if (!electionId) {
    linkCategoriesCheckboxes.innerHTML = '<span style="color: rgba(255,255,255,0.3); font-size: 0.85rem;">Selecione primeiro uma eleição...</span>';
    return;
  }

  try {
    const { data: allCategories, error: catErr } = await supabase.from('categories').select('*').order('name');
    if (catErr) throw catErr;

    const { data: linkedCategories, error: linkErr } = await supabase
      .from('city_categories')
      .select('category_id')
      .eq('election_id', electionId);

    if (linkErr) throw linkErr;

    const linkedIds = new Set((linkedCategories || []).map(lc => lc.category_id));

    if (!allCategories || allCategories.length === 0) {
      linkCategoriesCheckboxes.innerHTML = '<span style="color: rgba(255,255,255,0.3); font-size: 0.85rem;">Nenhuma categoria geral cadastrada.</span>';
      return;
    }

    allCategories.forEach(cat => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '8px';
      label.style.cursor = 'pointer';
      label.style.fontSize = '0.9rem';
      label.style.color = '#ffffff';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = cat.id;
      checkbox.checked = linkedIds.has(cat.id);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(cat.name));
      linkCategoriesCheckboxes.appendChild(label);
    });

    if (btnSaveCategoryLinks) btnSaveCategoryLinks.disabled = false;
  } catch (err) {
    console.error(err);
    linkCategoriesCheckboxes.innerHTML = '<span style="color: #ff5555; font-size: 0.85rem;">Erro ao carregar vínculos.</span>';
  }
}

export async function handleSaveCategoryLinks(e) {
  if (e && e.preventDefault) e.preventDefault();
  const selectLinkElection = document.getElementById('selectLinkElection');
  const linkCategoriesCheckboxes = document.getElementById('linkCategoriesCheckboxes');
  const btnSaveCategoryLinks = document.getElementById('btnSaveCategoryLinks');

  const electionId = selectLinkElection ? selectLinkElection.value : '';
  if (!electionId || !linkCategoriesCheckboxes) return;

  const checkedCheckboxes = linkCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
  const selectedCategoryIds = Array.from(checkedCheckboxes).map(cb => cb.value);

  if (btnSaveCategoryLinks) {
    btnSaveCategoryLinks.disabled = true;
    btnSaveCategoryLinks.textContent = 'Salvando...';
  }

  try {
    const { error } = await supabase.rpc('admin_save_election_categories', {
      p_election_id: electionId,
      p_category_ids: selectedCategoryIds
    });
    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Vínculos de categoria salvos com sucesso!', 'success');
    }
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao salvar vínculos: ' + err.message, 'error');
    }
  } finally {
    if (btnSaveCategoryLinks) {
      btnSaveCategoryLinks.disabled = false;
      btnSaveCategoryLinks.textContent = 'Salvar Vínculos de Categoria';
    }
  }
}

// 4. Candidatos CRUD
export async function loadCandidatesDropdowns() {
  const selectCandElection = document.getElementById('selectCandElection');
  const filterListElection = document.getElementById('filterListElection');

  try {
    const { data: elections, error } = await supabase.from('elections').select('*, cities(name)').order('year', { ascending: false });
    if (error) throw error;
    const officialElections = (elections || []).filter(election => isOfficialCity(election.cities));

    if (selectCandElection) {
      selectCandElection.innerHTML = '<option value="">Selecione a eleição...</option>';
    }
    if (filterListElection) {
      filterListElection.innerHTML = '<option value="">Filtrar por Eleição...</option>';
    }

    officialElections.forEach(el => {
      const label = `${el.cities ? el.cities.name : 'N/A'} (${el.year}) - ${el.status}`;
      
      if (selectCandElection) {
        const opt1 = document.createElement('option');
        opt1.value = el.id;
        opt1.textContent = label;
        selectCandElection.appendChild(opt1);
      }

      if (filterListElection) {
        const opt2 = document.createElement('option');
        opt2.value = el.id;
        opt2.textContent = label;
        filterListElection.appendChild(opt2);
      }
    });

  } catch (err) {
    console.error(err);
  }
}

export async function loadCategoriesForElectionSelect(electionId, selectElement) {
  if (!selectElement) return;

  try {
    const { data, error } = await supabase
      .from('city_categories')
      .select('category_id, categories(id, name)')
      .eq('election_id', electionId);

    if (error) throw error;

    selectElement.innerHTML = '<option value="">Selecione...</option>';
    (data || []).forEach(row => {
      if (row.categories) {
        const opt = document.createElement('option');
        opt.value = row.categories.id;
        opt.textContent = row.categories.name;
        selectElement.appendChild(opt);
      }
    });
    selectElement.disabled = false;
  } catch (err) {
    console.error(err);
  }
}

export async function loadCandidatesForStructureList(electionId) {
  const candidatesTableBody = document.getElementById('candidatesTableBody');
  if (!candidatesTableBody) return;

  try {
    candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando concorrentes...</td></tr>';

    const { data, error } = await supabase
      .from('candidates')
      .select('*, categories(name), elections(year, cities(name))')
      .eq('election_id', electionId)
      .order('name');

    if (error) throw error;

    candidatesTableBody.innerHTML = '';
    if (!data || data.length === 0) {
      candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhum candidato nesta edição.</td></tr>';
      return;
    }

    data.forEach(cand => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div style="font-weight:600; color: #ffffff;">${escapeHtml(cand.name)}</div>
          <div style="font-size:0.75rem; color: #d4af37;">${escapeHtml(cand.instagram || 'Sem Instagram')}</div>
        </td>
        <td><span style="font-size:0.8rem; color: rgba(255,255,255,0.6);">${escapeHtml(cand.categories ? cand.categories.name : 'N/A')}</span></td>
        <td style="font-size:0.8rem; color: rgba(255,255,255,0.45);">${escapeHtml(cand.elections && cand.elections.cities ? cand.elections.cities.name : 'N/A')} (${escapeHtml(cand.elections ? cand.elections.year : 'N/A')})</td>
        <td>
          <div style="display:flex; gap: 8px;">
            <button class="btn btn-edit-cand" style="font-size: 0.75rem; padding: 4px 8px;">Editar</button>
            <button class="btn btn-danger btn-delete-cand" style="font-size: 0.75rem; padding: 4px 8px;">Remover</button>
          </div>
        </td>
      `;

      const btnEdit = row.querySelector('.btn-edit-cand');
      if (btnEdit) btnEdit.addEventListener('click', () => handleEditCandidate(cand));

      const btnDel = row.querySelector('.btn-delete-cand');
      if (btnDel) btnDel.addEventListener('click', () => handleDeleteCandidate(cand.id, cand.name));

      candidatesTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff5555;">Erro ao obter concorrentes.</td></tr>';
  }
}

export function handleEditCandidate(candidate) {
  const inputCandidateId = document.getElementById('inputCandidateId');
  const selectCandElection = document.getElementById('selectCandElection');
  const selectCandCategory = document.getElementById('selectCandCategory');
  const inputCandName = document.getElementById('inputCandName');
  const selectCandType = document.getElementById('selectCandType');
  const inputCandInstagram = document.getElementById('inputCandInstagram');
  const inputCandWhatsapp = document.getElementById('inputCandWhatsapp');
  const inputCandEmail = document.getElementById('inputCandEmail');
  const inputCandLogo = document.getElementById('inputCandLogo');
  const inputCandDesc = document.getElementById('inputCandDesc');
  const lblCandidateForm = document.getElementById('lblCandidateForm');
  const btnCancelCandEdit = document.getElementById('btnCancelCandEdit');
  const formAddCandidate = document.getElementById('formAddCandidate');

  if (inputCandidateId) inputCandidateId.value = candidate.id;
  if (selectCandElection) selectCandElection.value = candidate.election_id;
  
  if (selectCandCategory) {
    loadCategoriesForElectionSelect(candidate.election_id, selectCandCategory).then(() => {
      selectCandCategory.value = candidate.category_id;
    });
  }

  if (inputCandName) inputCandName.value = candidate.name;
  if (selectCandType) selectCandType.value = candidate.type;
  if (inputCandInstagram) inputCandInstagram.value = candidate.instagram ? candidate.instagram.replace(/^@+/, '') : '';
  if (inputCandWhatsapp) inputCandWhatsapp.value = candidate.whatsapp || '';
  if (inputCandEmail) inputCandEmail.value = candidate.email || '';
  if (inputCandLogo) inputCandLogo.value = candidate.logo_url || '';
  if (inputCandDesc) inputCandDesc.value = candidate.description || '';

  if (lblCandidateForm) lblCandidateForm.textContent = 'Editar Concorrente';
  if (btnCancelCandEdit) btnCancelCandEdit.style.display = 'inline-flex';
  
  if (formAddCandidate) {
    formAddCandidate.scrollIntoView({ behavior: 'smooth' });
  }
}

export function resetCandidateForm() {
  const inputCandidateId = document.getElementById('inputCandidateId');
  const formAddCandidate = document.getElementById('formAddCandidate');
  const selectCandCategory = document.getElementById('selectCandCategory');
  const lblCandidateForm = document.getElementById('lblCandidateForm');
  const btnCancelCandEdit = document.getElementById('btnCancelCandEdit');

  if (inputCandidateId) inputCandidateId.value = '';
  if (formAddCandidate) formAddCandidate.reset();
  if (selectCandCategory) {
    selectCandCategory.innerHTML = '<option value="">Selecione primeiro a eleição</option>';
    selectCandCategory.disabled = true;
  }
  if (lblCandidateForm) lblCandidateForm.textContent = 'Adicionar Candidato Oficial';
  if (btnCancelCandEdit) btnCancelCandEdit.style.display = 'none';
}

export async function handleAddOrUpdateCandidate(e) {
  if (e && e.preventDefault) e.preventDefault();

  const inputCandidateId = document.getElementById('inputCandidateId');
  const selectCandElection = document.getElementById('selectCandElection');
  const selectCandCategory = document.getElementById('selectCandCategory');
  const inputCandName = document.getElementById('inputCandName');
  const selectCandType = document.getElementById('selectCandType');
  const inputCandInstagram = document.getElementById('inputCandInstagram');
  const inputCandWhatsapp = document.getElementById('inputCandWhatsapp');
  const inputCandEmail = document.getElementById('inputCandEmail');
  const inputCandLogo = document.getElementById('inputCandLogo');
  const inputCandDesc = document.getElementById('inputCandDesc');
  const filterListElection = document.getElementById('filterListElection');

  const id = inputCandidateId ? inputCandidateId.value : '';
  const election_id = selectCandElection ? selectCandElection.value : '';
  const category_id = selectCandCategory ? selectCandCategory.value : '';
  const name = inputCandName ? inputCandName.value.trim() : '';
  const type = selectCandType ? selectCandType.value : '';
  
  let instagram = inputCandInstagram ? inputCandInstagram.value.trim() : '';
  if (instagram) instagram = '@' + instagram.replace(/^@+/, '');

  const whatsapp = (inputCandWhatsapp && inputCandWhatsapp.value.trim()) || null;
  const email = (inputCandEmail && inputCandEmail.value.trim()) || null;
  const logo_url = (inputCandLogo && inputCandLogo.value.trim()) || null;
  const description = (inputCandDesc && inputCandDesc.value.trim()) || null;

  if (!election_id || !category_id || !name || !type) return;

  try {
    const { error: rpcError } = await supabase.rpc('admin_upsert_candidate', {
      p_candidate_id: id || null,
      p_election_id: election_id,
      p_category_id: category_id,
      p_name: name,
      p_type: type,
      p_instagram: instagram,
      p_whatsapp: whatsapp,
      p_email: email,
      p_logo_url: logo_url,
      p_description: description
    });

    if (rpcError) throw rpcError;

    if (typeof window.showToast === 'function') {
      window.showToast(id ? 'Informações do concorrente atualizadas!' : 'Concorrente cadastrado com sucesso!', 'success');
    }

    resetCandidateForm();

    if (filterListElection) {
      if (filterListElection.value === election_id) {
        await loadCandidatesForStructureList(election_id);
      } else {
        filterListElection.value = election_id;
        await loadCandidatesForStructureList(election_id);
      }
    }
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao salvar concorrente: ' + err.message, 'error');
    }
  }
}

export async function handleDeleteCandidate(candidateId, name) {
  if (typeof window.showConfirm === 'function') {
    const confirmed = await window.showConfirm({
      eyebrow: 'Remoção de Concorrente',
      title: 'Excluir concorrente permanentemente?',
      message: `Deseja excluir "${name}"? Isso apagará seus dados e histórico de votos associados.`,
      confirmText: 'Remover',
      variant: 'danger'
    });
    if (!confirmed) return;
  }

  try {
    const { error } = await supabase.rpc('admin_archive_candidate', { p_candidate_id: candidateId });
    if (error) throw error;

    if (typeof window.showToast === 'function') {
      window.showToast('Concorrente excluído com sucesso!', 'success');
    }
    
    const filterListElection = document.getElementById('filterListElection');
    const activeElection = filterListElection ? filterListElection.value : '';
    if (activeElection) {
      await loadCandidatesForStructureList(activeElection);
    }
  } catch (err) {
    console.error(err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao remover: ' + err.message, 'error');
    }
  }
}

export function setupStructureListeners() {
  const formAddCity = document.getElementById('formAddCity');
  const formAddCategory = document.getElementById('formAddCategory');
  const formAddElection = document.getElementById('formAddElection');
  const selectLinkElection = document.getElementById('selectLinkElection');
  const formLinkCategories = document.getElementById('formLinkCategories');
  const selectCandElection = document.getElementById('selectCandElection');
  const selectCandCategory = document.getElementById('selectCandCategory');
  const formAddCandidate = document.getElementById('formAddCandidate');
  const btnCancelCandEdit = document.getElementById('btnCancelCandEdit');
  const filterListElection = document.getElementById('filterListElection');
  const candidatesTableBody = document.getElementById('candidatesTableBody');

  if (formAddCity) formAddCity.addEventListener('submit', handleAddCity);
  if (formAddCategory) formAddCategory.addEventListener('submit', handleAddCategory);
  if (formAddElection) formAddElection.addEventListener('submit', handleAddElection);

  if (selectLinkElection) selectLinkElection.addEventListener('change', loadLinkedCategoriesCheckboxList);
  if (formLinkCategories) formLinkCategories.addEventListener('submit', handleSaveCategoryLinks);

  if (selectCandElection) {
    selectCandElection.addEventListener('change', async () => {
      const electionId = selectCandElection.value;
      if (selectCandCategory) {
        selectCandCategory.innerHTML = '<option value="">Selecione primeiro a eleição</option>';
        selectCandCategory.disabled = true;
      }
      if (electionId && selectCandCategory) {
        await loadCategoriesForElectionSelect(electionId, selectCandCategory);
      }
    });
  }

  if (formAddCandidate) formAddCandidate.addEventListener('submit', handleAddOrUpdateCandidate);
  if (btnCancelCandEdit) btnCancelCandEdit.addEventListener('click', resetCandidateForm);

  if (filterListElection) {
    filterListElection.addEventListener('change', async () => {
      const electionId = filterListElection.value;
      if (electionId) {
        await loadCandidatesForStructureList(electionId);
      } else if (candidatesTableBody) {
        candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione ou filtre por eleição para listar candidatos.</td></tr>';
      }
    });
  }
}
