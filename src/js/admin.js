import { supabase } from './supabaseClient.js';
import { OFFICIAL_CITY, findOfficialCity, isOfficialCity } from './siteConfig.js';

// Auth Elements
const adminLoginScreen = document.getElementById('adminLoginScreen');
const adminDashboardLayout = document.getElementById('adminDashboardLayout');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');

// Profile Info Elements
const txtAdminUser = document.getElementById('txtAdminUser');
const txtAdminRole = document.getElementById('txtAdminRole');
const btnAdminLogout = document.getElementById('btnAdminLogout');

// Tab Navigation Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');

// Tab 1: Moderation Elements
const nominationsTableBody = document.getElementById('nominationsTableBody');
const statPendingNominations = document.getElementById('statPendingNominations');

// Tab 2: Merge Elements
const mergeForm = document.getElementById('mergeForm');
const mergeCity = document.getElementById('mergeCity');
const mergeCategory = document.getElementById('mergeCategory');
const mergeTarget = document.getElementById('mergeTarget');
const mergeDuplicate = document.getElementById('mergeDuplicate');
const btnExecuteMerge = document.getElementById('btnExecuteMerge');

// Tab 3: CRM Elements
const crmSelectCity = document.getElementById('crmSelectCity');
const crmTableBody = document.getElementById('crmTableBody');

// Tab 4: Elections Elements
const electionsTableBody = document.getElementById('electionsTableBody');
const formResolveTie = document.getElementById('formResolveTie');
const tieElection = document.getElementById('tieElection');
const tieCategory = document.getElementById('tieCategory');
const tieCandidate = document.getElementById('tieCandidate');
const btnResolveTie = document.getElementById('btnResolveTie');

// Tab 5: Logs Elements
const adminActionLogsTableBody = document.getElementById('adminActionLogsTableBody');
const suspiciousVotesTableBody = document.getElementById('suspiciousVotesTableBody');

// Tab 6: Structure Elements
const citiesTableBody = document.getElementById('citiesTableBody');
const formAddCity = document.getElementById('formAddCity');
const inputCityName = document.getElementById('inputCityName');
const categoriesTableBody = document.getElementById('categoriesTableBody');
const formAddCategory = document.getElementById('formAddCategory');
const inputCategoryName = document.getElementById('inputCategoryName');
const selectElectionCity = document.getElementById('selectElectionCity');
const formAddElection = document.getElementById('formAddElection');
const inputElectionYear = document.getElementById('inputElectionYear');
const inputElectionStart = document.getElementById('inputElectionStart');
const inputElectionEnd = document.getElementById('inputElectionEnd');
const selectLinkElection = document.getElementById('selectLinkElection');
const linkCategoriesCheckboxes = document.getElementById('linkCategoriesCheckboxes');
const formLinkCategories = document.getElementById('formLinkCategories');
const btnSaveCategoryLinks = document.getElementById('btnSaveCategoryLinks');
const selectCandElection = document.getElementById('selectCandElection');
const selectCandCategory = document.getElementById('selectCandCategory');
const formAddCandidate = document.getElementById('formAddCandidate');
const inputCandidateId = document.getElementById('inputCandidateId');
const inputCandName = document.getElementById('inputCandName');
const selectCandType = document.getElementById('selectCandType');
const inputCandInstagram = document.getElementById('inputCandInstagram');
const inputCandWhatsapp = document.getElementById('inputCandWhatsapp');
const inputCandEmail = document.getElementById('inputCandEmail');
const inputCandLogo = document.getElementById('inputCandLogo');
const inputCandDesc = document.getElementById('inputCandDesc');
const lblCandidateForm = document.getElementById('lblCandidateForm');
const btnCancelCandEdit = document.getElementById('btnCancelCandEdit');
const filterListElection = document.getElementById('filterListElection');
const candidatesTableBody = document.getElementById('candidatesTableBody');

// State
let currentStaff = null;
let currentTab = 'tab-moderacao';
let currentSubTab = 'subtab-cidades';
let adminState = {
  selectedElectionId: ''
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const CRM_PACKAGES = [
  { value: 'nao_definido', label: 'Pacote a definir' },
  { value: 'selo_digital', label: 'Selo digital' },
  { value: 'placa_classica', label: 'Placa classica' },
  { value: 'kit_premium', label: 'Kit premium' }
];

function renderCrmPackageOptions(selectedPackage) {
  const selected = selectedPackage || 'nao_definido';
  return CRM_PACKAGES.map(pkg => (
    `<option value="${pkg.value}" ${selected === pkg.value ? 'selected' : ''}>${pkg.label}</option>`
  )).join('');
}

function formatDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function formatCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Verificar se já possui sessão ativa
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await initStaffDashboard();
  } else {
    showLogin();
  }

  // Escutar alterações de autenticação
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await initStaffDashboard();
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
});

function showLogin() {
  adminLoginScreen.style.display = 'block';
  adminDashboardLayout.style.display = 'none';
  adminLoginForm.reset();

  currentStaff = null;
}

// Inicialização Principal do Painel
async function initStaffDashboard() {
  try {
    txtAdminUser.textContent = 'Carregando...';
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nenhum usuário ativo na sessão.');

    // 1. Obter informações de perfil e cargo do usuário
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      throw new Error('Perfil do usuário não encontrado.');
    }

    // Validar se o papel é elegível para o painel de equipe
    const allowedRoles = ['super_admin', 'admin', 'moderador', 'comercial'];
    if (!allowedRoles.includes(profile.role)) {
      showToast('Acesso negado: Este perfil não possui permissões administrativas.', 'error');
      await supabase.auth.signOut();
      return;
    }

    currentStaff = {
      id: user.id,
      name: profile.name,
      role: profile.role
    };

    txtAdminUser.textContent = currentStaff.name;
    txtAdminRole.textContent = currentStaff.role;

    adminLoginScreen.style.display = 'none';
    adminDashboardLayout.style.display = 'flex';

    // 2. Aplicar controle RBAC no painel de abas
    applyRolePermissions(currentStaff.role);

  } catch (err) {
    console.error('Falha ao inicializar o painel:', err);
    showToast('Erro ao carregar painel corporativo: ' + err.message, 'error');
    await supabase.auth.signOut();
  }
}

// Aplicar restrições visuais e de navegação conforme cargo
function applyRolePermissions(role) {
  const isCrmOnly = role === 'comercial';
  const hasFullAdmin = role === 'admin' || role === 'super_admin';
  const canUseCrm = hasFullAdmin || isCrmOnly;

  document.getElementById('navModeracao').style.display = isCrmOnly ? 'none' : 'flex';
  document.getElementById('navMesclagem').style.display = isCrmOnly ? 'none' : 'flex';
  document.getElementById('navCrm').style.display = canUseCrm ? 'flex' : 'none';
  document.getElementById('navEleicoes').style.display = hasFullAdmin ? 'flex' : 'none';
  document.getElementById('navLogs').style.display = hasFullAdmin ? 'flex' : 'none';
  
  // Apenas administradores e super_admins podem gerenciar estrutura
  const navEstrutura = document.getElementById('navEstrutura');
  if (navEstrutura) {
    navEstrutura.style.display = hasFullAdmin ? 'flex' : 'none';
  }

  if (isCrmOnly) {
    switchTab('tab-crm');
  } else {
    switchTab('tab-moderacao');
  }
}

// Configurar escutas de eventos gerais
function setupEventListeners() {
  // Enviar formulário de Login
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = adminEmail.value.trim();
    const password = adminPassword.value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      showToast('Falha ao autenticar. Verifique suas credenciais.', 'error');
      console.error(err);
    }
  });

  // Botão Sair
  btnAdminLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // Alternar abas
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Configuração de eventos para Mesclagem (Tab 2)
  mergeCity.addEventListener('change', async () => {
    const cityId = mergeCity.value;
    mergeCategory.innerHTML = '<option value="">Aguardando a localidade oficial</option>';
    mergeCategory.disabled = true;
    resetMergeCandidatesFields();
    
    if (cityId) {
      await loadMergeCategories(cityId);
    }
  });

  mergeCategory.addEventListener('change', async () => {
    const catId = mergeCategory.value;
    resetMergeCandidatesFields();
    
    if (catId) {
      await loadMergeCandidates(catId);
    }
  });

  mergeForm.addEventListener('submit', executeMergeFlow);

  // Configuração de eventos para CRM (Tab 3)
  crmSelectCity.addEventListener('change', async () => {
    const cityId = crmSelectCity.value;
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione uma cidade.</td></tr>';
    
    if (cityId) {
      await loadCrmData(cityId);
    }
  });

  // Configuração de eventos para o Painel de Estrutura (Tab 5 - Gerenciar Estrutura)
  if (tieElection) {
    tieElection.addEventListener('change', async () => {
      tieCategory.innerHTML = '<option value="">Selecione a eleicao</option>';
      tieCategory.disabled = true;
      tieCandidate.innerHTML = '<option value="">Selecione a categoria</option>';
      tieCandidate.disabled = true;
      if (tieElection.value) {
        await loadCategoriesForElectionSelect(tieElection.value, tieCategory);
      }
    });
  }

  if (tieCategory) {
    tieCategory.addEventListener('change', async () => {
      tieCandidate.innerHTML = '<option value="">Carregando candidatos...</option>';
      tieCandidate.disabled = true;
      if (tieElection.value && tieCategory.value) {
        await loadTieCandidates(tieElection.value, tieCategory.value);
      }
    });
  }

  if (formResolveTie) formResolveTie.addEventListener('submit', handleResolveTie);

  const subTabBtns = document.querySelectorAll('.sub-tab-btn');
  const subTabPanels = document.querySelectorAll('.sub-tab-panel');
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetSub = btn.getAttribute('data-subtab');
      currentSubTab = targetSub;
      
      subTabPanels.forEach(p => {
        if (p.id === targetSub) {
          p.style.display = 'block';
        } else {
          p.style.display = 'none';
        }
      });
      loadStructureSubTabData(targetSub);
    });
  });

  // Cidade CRUD
  if (formAddCity) formAddCity.addEventListener('submit', handleAddCity);

  // Categoria CRUD
  if (formAddCategory) formAddCategory.addEventListener('submit', handleAddCategory);

  // Eleição CRUD
  if (formAddElection) formAddElection.addEventListener('submit', handleAddElection);

  // Vínculos de Categoria
  if (selectLinkElection) selectLinkElection.addEventListener('change', loadLinkedCategoriesCheckboxList);
  if (formLinkCategories) formLinkCategories.addEventListener('submit', handleSaveCategoryLinks);

  // Candidatos CRUD
  if (selectCandElection) {
    selectCandElection.addEventListener('change', async () => {
      const electionId = selectCandElection.value;
      selectCandCategory.innerHTML = '<option value="">Selecione primeiro a eleição</option>';
      selectCandCategory.disabled = true;
      if (electionId) {
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
      } else {
        candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione ou filtre por eleição para listar candidatos.</td></tr>';
      }
    });
  }
}

// Navegar entre painéis de abas
function switchTab(tabId) {
  currentTab = tabId;

  // Atualizar botões laterais
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Mostrar painel correspondente
  tabPanels.forEach(panel => {
    if (panel.id === tabId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Chamar carregador específico de dados da aba
  if (tabId === 'tab-moderacao') loadNominations();
  if (tabId === 'tab-mesclagem') initMergeTab();
  if (tabId === 'tab-crm') initCrmTab();
  if (tabId === 'tab-eleicoes') loadElections();
  if (tabId === 'tab-estrutura') loadStructureSubTabData(currentSubTab);
  if (tabId === 'tab-logs') loadLogsAndAudits();
}

// ============================================================================
// ABA 1: MODERAÇÃO DE INDICAÇÕES
// ============================================================================

async function loadNominations() {
  try {
    nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando fila de moderação...</td></tr>';
    
    // Buscar indicações pendentes ordenadas por data
    const { data, error } = await supabase
      .from('nominations')
      .select('*, categories(name), elections(year, cities(name))')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const officialNominations = data.filter(nomination => isOfficialCity(nomination.elections?.cities));
    statPendingNominations.textContent = officialNominations.length;
    nominationsTableBody.innerHTML = '';

    if (officialNominations.length === 0) {
      nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.3); padding: 24px 0;">Fila limpa! Nenhuma indicação pendente de moderação.</td></tr>';
      return;
    }

    officialNominations.forEach(nom => {
      const row = document.createElement('tr');
      const categoryName = nom.categories ? nom.categories.name : 'N/A';
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
      row.querySelector('.btn-approve').addEventListener('click', () => approveNomination(nom));
      // Evento Rejeitar
      row.querySelector('.btn-reject').addEventListener('click', () => rejectNomination(nom.id));

      nominationsTableBody.appendChild(row);
    });
  } catch (err) {
    console.error('Erro ao buscar indicações:', err);
    nominationsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter indicações pendentes.</td></tr>';
  }
}

// Processar aprovação
async function approveNomination(nom) {
  const confirmed = await showConfirm({
    eyebrow: 'Moderacao',
    title: 'Aprovar indicacao',
    message: `Deseja aprovar e cadastrar "${nom.name}" como candidato oficial?`,
    confirmText: 'Aprovar candidato'
  });
  if (!confirmed) return;

  try {
    const { error } = await supabase.rpc('approve_nomination', {
      p_nomination_id: nom.id
    });

    if (error) throw error;

    showToast('Indicação aprovada e convertida em candidato oficial com sucesso!', 'success');
    await loadNominations();
  } catch (err) {
    console.error('Erro ao aprovar indicação:', err);
    showToast('Erro ao aprovar indicação: ' + err.message, 'error');
  }
}

// Processar rejeição
async function rejectNomination(id) {
  const confirmed = await showConfirm({
    eyebrow: 'Moderacao',
    title: 'Rejeitar indicacao',
    message: 'Esta indicacao sera retirada da fila de moderacao.',
    confirmText: 'Rejeitar',
    variant: 'danger'
  });
  if (!confirmed) return;

  try {
    const { error } = await supabase.rpc('reject_nomination', {
      p_nomination_id: id
    });

    if (error) throw error;

    await loadNominations();
  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    showToast('Erro ao processar ação comercial.', 'error');
  }
}

// ============================================================================
// ABA 2: MESCLAGEM DE CONCORRENTES DUPLICADOS
// ============================================================================

async function initMergeTab() {
  mergeForm.reset();
  mergeCity.innerHTML = `<option value="">Carregando ${OFFICIAL_CITY.displayName}...</option>`;
  mergeCity.disabled = false;
  mergeCategory.innerHTML = '<option value="">Aguardando a localidade oficial</option>';
  mergeCategory.disabled = true;
  resetMergeCandidatesFields();

  try {
    const { data, error } = await supabase.from('cities').select('*').order('name');
    if (error) throw error;

    const officialCity = findOfficialCity(data);
    if (!officialCity) throw new Error(`${OFFICIAL_CITY.displayName} não está cadastrada.`);
    mergeCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
    mergeCity.value = officialCity.id;
    mergeCity.disabled = true;
    await loadMergeCategories(officialCity.id);
  } catch (err) {
    console.error(err);
  }
}

async function loadMergeCategories(cityId) {
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

    adminState.selectedElectionId = election.id;

    const { data, error } = await supabase
      .from('city_categories')
      .select('category_id, categories(id, name)')
      .eq('election_id', election.id);

    if (error) throw error;

    mergeCategory.innerHTML = '<option value="">Selecione a Categoria</option>';
    data.forEach(row => {
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

function resetMergeCandidatesFields() {
  mergeTarget.innerHTML = '<option value="">Selecione primeiro a categoria</option>';
  mergeTarget.disabled = true;
  mergeDuplicate.innerHTML = '<option value="">Selecione primeiro a categoria</option>';
  mergeDuplicate.disabled = true;
  btnExecuteMerge.disabled = true;
}

// Carregar candidatos para preencher seletores de mesclagem
async function loadMergeCandidates(categoryId) {
  try {
    const { data, error } = await supabase
      .from('public_candidates')
      .select('*')
      .eq('election_id', adminState.selectedElectionId)
      .eq('category_id', categoryId);

    if (error) throw error;

    if (data.length < 2) {
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
    btnExecuteMerge.disabled = false;
  } catch (err) {
    console.error(err);
  }
}

// Fluxo de Mesclagem
async function executeMergeFlow(e) {
  e.preventDefault();
  const targetId = mergeTarget.value;
  const duplicateId = mergeDuplicate.value;

  if (!targetId || !duplicateId) return;
  if (targetId === duplicateId) {
    showToast('Erro: O candidato oficial e o duplicado não podem ser o mesmo.', 'error');
    return;
  }

  const confirmed = await showConfirm({
    eyebrow: 'Acao irreversivel',
    title: 'Confirmar mesclagem segura',
    message: 'A mesclagem migrara todos os votos validos e aliases do concorrente duplicado para o oficial. O duplicado sera inativado permanentemente.',
    confirmText: 'Executar mesclagem',
    variant: 'danger'
  });
  if (!confirmed) return;

  btnExecuteMerge.disabled = true;
  btnExecuteMerge.textContent = 'Processando mesclagem...';

  try {
    // Invocar a RPC segura de mesclagem (que resolve internamente auth.uid() e logs)
    const { error } = await supabase.rpc('merge_candidates', {
      p_target_id: targetId,
      p_duplicate_id: duplicateId
    });

    if (error) throw error;

    showToast('Mesclagem transacional executada com absoluto sucesso no servidor!', 'success');
    initMergeTab();
  } catch (err) {
    console.error('Erro na mesclagem:', err);
    showToast('Erro ao executar mesclagem: ' + err.message, 'error');
    btnExecuteMerge.disabled = false;
    btnExecuteMerge.textContent = 'Executar Mesclagem Segura';
  }
}

// ============================================================================
// ABA 3: CRM COMERCIAL
// ============================================================================

async function initCrmTab() {
  crmSelectCity.innerHTML = `<option value="">Carregando ${OFFICIAL_CITY.displayName}...</option>`;
  crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione uma cidade para carregar o CRM comercial.</td></tr>';

  try {
    const { data, error } = await supabase.from('cities').select('*').order('name');
    if (error) throw error;

    const officialCity = findOfficialCity(data);
    if (!officialCity) throw new Error(`${OFFICIAL_CITY.displayName} não está cadastrada.`);
    crmSelectCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
    crmSelectCity.value = officialCity.id;
    crmSelectCity.disabled = true;
    await loadCrmData(officialCity.id);
  } catch (err) {
    console.error(err);
  }
}

// Carregar leads do CRM
async function loadCrmData(cityId) {
  try {
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando leads comerciales...</td></tr>';

    // 1. Obter a eleição mais recente desta cidade
    const { data: election, error: electErr } = await supabase
      .from('elections')
      .select('id')
      .eq('city_id', cityId)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (electErr || !election) {
      crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhuma eleição registrada nesta cidade.</td></tr>';
      return;
    }

    // 2. Chamar a RPC segura de listagem comercial (bypassa RLS bloqueado na tabela base)
    const { data, error } = await supabase.rpc('get_crm_candidates_v2', {
      p_election_id: election.id
    });

    if (error) throw error;

    crmTableBody.innerHTML = '';

    if (data.length === 0) {
      crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Nenhum concorrente cadastrado nesta edição.</td></tr>';
      return;
    }

    data.forEach(lead => {
      const row = document.createElement('tr');
      row.dataset.id = lead.id;

      const contactInfo = `WA: ${escapeHtml(lead.whatsapp || 'N/A')}<br/>Email: ${escapeHtml(lead.email || 'N/A')}<br/>Resp.: ${escapeHtml(lead.commercial_owner_name || 'Sem responsavel')}`;
      const selectedStage = lead.commercial_status || 'não contatado';
      const followUpDate = formatDateInput(lead.commercial_follow_up_date);
      const valueEstimate = formatCurrencyInput(lead.commercial_value_estimate);

      row.innerHTML = `
        <td style="font-weight: 600; color: #ffffff;">${escapeHtml(lead.name)}</td>
        <td><span style="font-size:0.8rem; color: rgba(255,255,255,0.5);">${escapeHtml(lead.category_name)}</span></td>
        <td style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">${contactInfo}</td>
        <td>
          <select class="form-control select-crm-stage" style="padding: 6px; font-size: 0.8rem; width: 150px;">
            <option value="não contatado" ${selectedStage === 'não contatado' ? 'selected' : ''}>Não Contatado</option>
            <option value="chamou no WhatsApp" ${selectedStage === 'chamou no WhatsApp' ? 'selected' : ''}>Chamou no WhatsApp</option>
            <option value="interessado" ${selectedStage === 'interessado' ? 'selected' : ''}>Interessado</option>
            <option value="comprou" ${selectedStage === 'comprou' ? 'selected' : ''}>Comprou</option>
            <option value="recusou" ${selectedStage === 'recusou' ? 'selected' : ''}>Recusou</option>
          </select>
          <select class="form-control select-crm-package" style="padding: 6px; font-size: 0.8rem; width: 150px; margin-top: 6px;">
            ${renderCrmPackageOptions(lead.commercial_package)}
          </select>
          <input type="number" class="form-control input-crm-value" value="${valueEstimate}" placeholder="Valor estimado" min="0" step="0.01" style="padding: 6px; font-size: 0.8rem; width: 150px; margin-top: 6px;">
        </td>
        <td>
          <input type="date" class="form-control input-crm-followup" value="${followUpDate}" style="padding: 6px; font-size: 0.8rem; min-width: 150px; margin-bottom: 6px;">
          <input type="text" class="form-control input-crm-next-action" value="${escapeHtml(lead.commercial_next_action || '')}" placeholder="Próxima ação..." style="padding: 6px; font-size: 0.8rem; min-width: 150px; margin-bottom: 6px;">
          <input type="text" class="form-control input-crm-notes" value="${escapeHtml(lead.commercial_notes || '')}" placeholder="Observações..." style="padding: 6px; font-size: 0.8rem; min-width: 150px;">
        </td>
        <td>
          <button class="btn btn-save-crm" style="font-size:0.75rem; padding: 6px 12px;">Salvar</button>
        </td>
      `;

      // Evento salvar CRM
      row.querySelector('.btn-save-crm').addEventListener('click', async () => {
        const stage = row.querySelector('.select-crm-stage').value;
        const commercialPackage = row.querySelector('.select-crm-package').value;
        const nextAction = row.querySelector('.input-crm-next-action').value.trim();
        const followUpDate = row.querySelector('.input-crm-followup').value || null;
        const valueRaw = row.querySelector('.input-crm-value').value.trim();
        const valueEstimate = valueRaw ? Number(valueRaw) : null;
        const notes = row.querySelector('.input-crm-notes').value.trim();
        const btn = row.querySelector('.btn-save-crm');

        if (valueEstimate !== null && (!Number.isFinite(valueEstimate) || valueEstimate < 0)) {
          showToast('Informe um valor estimado válido.', 'error');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Salvar...';

        try {
          // RPC segura para atualizar funil e auditar
          const { error } = await supabase.rpc('update_candidate_commercial_status_v2', {
            p_candidate_id: lead.id,
            p_commercial_status: stage,
            p_commercial_notes: notes || null,
            p_commercial_package: commercialPackage,
            p_commercial_next_action: nextAction || null,
            p_commercial_follow_up_date: followUpDate,
            p_commercial_value_estimate: valueEstimate
          });

          if (error) throw error;
          
          showToast('Funil comercial atualizado com sucesso!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Erro ao atualizar: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Salvar';
        }
      });

      crmTableBody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ff5555;">Erro ao obter funil CRM.</td></tr>';
  }
}

// ============================================================================
// ABA 4: CONFIGURAÇÕES E APURAÇÃO DE ELEIÇÕES
// ============================================================================

async function loadElections() {
  try {
    electionsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando edições...</td></tr>';

    const { data, error } = await supabase
      .from('elections')
      .select('*, cities(name)')
      .order('year', { ascending: false });

    if (error) throw error;

    const officialElections = data.filter(election => isOfficialCity(election.cities));
    electionsTableBody.innerHTML = '';
    populateTieElectionOptions(officialElections);
    
    officialElections.forEach(el => {
      const row = document.createElement('tr');
      const start = new Date(el.start_date).toLocaleDateString('pt-BR');
      const end = new Date(el.end_date).toLocaleDateString('pt-BR');

      let actionsHtml = '';
      if (el.status === 'rascunho') {
        actionsHtml = `<button class="btn btn-open-election" data-id="${el.id}" style="font-size: 0.75rem; padding: 6px 12px;">Abrir Votacao</button>`;
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

// Gerenciar Ação na Eleição
async function handleElectionAction(election) {
  if (election.status === 'rascunho') {
    const confirmed = await showConfirm({
      eyebrow: 'Abertura',
      title: 'Abrir votacao',
      message: `Deseja abrir a votacao do premio "${election.year}"? A pagina publica passara a aceitar votos dentro do periodo configurado.`,
      confirmText: 'Abrir votacao'
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc('open_election', {
        p_election_id: election.id
      });

      if (error) throw error;

      showToast('Votacao aberta com sucesso!', 'success');
      await loadElections();
    } catch (err) {
      console.error(err);
      showToast('Erro ao abrir votacao: ' + err.message, 'error');
    }
  } else if (election.status === 'aberta') {
    const confirmed = await showConfirm({
      eyebrow: 'Encerramento',
      title: 'Encerrar votacao',
      message: `Deseja encerrar definitivamente a votacao do premio "${election.year}"? Ninguem mais podera votar.`,
      confirmText: 'Encerrar votacao',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.rpc('close_election', {
        p_election_id: election.id
      });

      if (error) throw error;
      
      showToast('Votação encerrada com sucesso!', 'success');
      await loadElections();
    } catch (err) {
      showToast('Erro ao fechar: ' + err.message, 'error');
    }
  } else if (election.status === 'encerrada' || election.status === 'apuracao') {
    const confirmed = await showConfirm({
      eyebrow: 'Publicacao',
      title: 'Apurar e publicar resultados',
      message: 'O sistema verificara empates, calculara os rankings oficiais e publicara a lista final no site.',
      confirmText: 'Publicar resultados'
    });
    if (!confirmed) return;

    try {
      // Chamar RPC de publicação
      const { error } = await supabase.rpc('publish_results', {
        p_election_id: election.id
      });

      if (error) throw error;

      showToast('Resultados consolidados e publicados com sucesso no website público!', 'success');
      await loadElections();
    } catch (err) {
      console.error(err);
      showToast('Erro na publicação/empate: ' + err.message, 'error');
    }
  }
}

function populateTieElectionOptions(elections) {
  if (!tieElection) return;

  const currentValue = tieElection.value;
  tieElection.innerHTML = '<option value="">Selecione...</option>';
  elections
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

async function loadTieCandidates(electionId, categoryId) {
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
    data.forEach(candidate => {
      const option = document.createElement('option');
      option.value = candidate.id;
      option.textContent = candidate.name + (candidate.instagram ? ` (${candidate.instagram})` : '');
      tieCandidate.appendChild(option);
    });
    tieCandidate.disabled = data.length === 0;
  } catch (err) {
    console.error(err);
    tieCandidate.innerHTML = '<option value="">Erro ao carregar candidatos</option>';
  }
}

async function handleResolveTie(e) {
  e.preventDefault();
  if (!tieElection.value || !tieCategory.value || !tieCandidate.value) return;

  const confirmed = await showConfirm({
    eyebrow: 'Desempate',
    title: 'Registrar desempate auditado',
    message: 'Esta ação registra uma decisão administrativa separada, sem alterar a quantidade real de votos.',
    confirmText: 'Registrar desempate',
    variant: 'danger'
  });
  if (!confirmed) return;

  btnResolveTie.disabled = true;
  btnResolveTie.textContent = 'Registrando...';

  try {
    const { error } = await supabase.rpc('resolve_first_place_tie', {
      p_election_id: tieElection.value,
      p_category_id: tieCategory.value,
      p_winner_candidate_id: tieCandidate.value
    });

    if (error) throw error;

    showToast('Desempate registrado com sucesso. Agora tente publicar novamente.', 'success');
    formResolveTie.reset();
    tieCategory.disabled = true;
    tieCandidate.disabled = true;
    await loadElections();
  } catch (err) {
    console.error(err);
    showToast('Erro ao registrar desempate: ' + err.message, 'error');
  } finally {
    btnResolveTie.disabled = false;
    btnResolveTie.textContent = 'Registrar Desempate';
  }
}

// ============================================================================
// ABA 5: LOGS DE AUDITORIA E VOTOS SUSPEITOS
// ============================================================================

async function loadLogsAndAudits() {
  try {
    adminActionLogsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando logs...</td></tr>';
    suspiciousVotesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando votos suspeitos...</td></tr>';

    // 1. Carregar logs
    const { data: logs, error: logsErr } = await supabase
      .from('admin_action_logs')
      .select('*, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (logsErr) throw logsErr;
    
    adminActionLogsTableBody.innerHTML = '';
    logs.forEach(log => {
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

    // 2. Carregar votos sinalizados como suspeitos
    const { data: flags, error: flagsErr } = await supabase
      .from('suspicious_vote_flags')
      .select('*, votes(voter_name, ip_address, candidate:candidates(name))')
      .order('created_at', { ascending: false })
      .limit(30);

    if (flagsErr) throw flagsErr;

    suspiciousVotesTableBody.innerHTML = '';

    if (flags.length === 0) {
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

  } catch (err) {
    console.error(err);
    adminActionLogsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff5555;">Erro ao obter logs.</td></tr>';
    suspiciousVotesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff5555;">Erro ao obter votos suspeitos.</td></tr>';
  }
}

// ============================================================================
// ABA 6: GERENCIAR ESTRUTURA
// ============================================================================

async function loadStructureSubTabData(subtabId) {
  if (subtabId === 'subtab-cidades') await loadCitiesList();
  if (subtabId === 'subtab-categorias') await loadCategoriesList();
  if (subtabId === 'subtab-eleicoes') await loadElectionsDropdowns();
  if (subtabId === 'subtab-candidatos') await loadCandidatesDropdowns();
}

// 1. Cidades CRUD
async function loadCitiesList() {
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

async function handleAddCity(e) {
  e.preventDefault();
  const name = OFFICIAL_CITY.displayName;

  try {
    const { error } = await supabase.rpc('admin_create_city', { p_name: name });
    if (error) throw error;

    showToast(`${OFFICIAL_CITY.displayName} está configurada como localidade oficial.`, 'success');
    inputCityName.value = OFFICIAL_CITY.displayName;
    await loadCitiesList();
  } catch (err) {
    console.error(err);
    showToast('Erro ao cadastrar cidade: ' + err.message, 'error');
  }
}

async function handleDeleteCity(cityId, cityName) {
  const confirmed = await showConfirm({
    eyebrow: 'Remocao de Cidade',
    title: 'Excluir cidade permanentemente?',
    message: `Deseja excluir a cidade "${cityName}"? Isso pode afetar eleições e candidatos vinculados.`,
    confirmText: 'Remover',
    variant: 'danger'
  });
  if (!confirmed) return;

  try {
    const { error } = await supabase.rpc('admin_delete_city', { p_city_id: cityId });
    if (error) throw error;

    showToast('Cidade removida com sucesso!', 'success');
    await loadCitiesList();
  } catch (err) {
    console.error(err);
    showToast('Erro ao remover: ' + err.message, 'error');
  }
}

// 2. Categorias CRUD
async function loadCategoriesList() {
  try {
    categoriesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando categorias...</td></tr>';
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;

    categoriesTableBody.innerHTML = '';
    if (data.length === 0) {
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
      row.querySelector('.btn-delete-cat').addEventListener('click', () => handleDeleteCategory(cat.id, cat.name));
      categoriesTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    categoriesTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #ff5555;">Erro ao obter categorias.</td></tr>';
  }
}

async function handleAddCategory(e) {
  e.preventDefault();
  const name = inputCategoryName.value.trim();
  if (!name) return;

  try {
    const { error } = await supabase.rpc('admin_create_category', { p_name: name });
    if (error) throw error;

    showToast('Categoria cadastrada com sucesso!', 'success');
    formAddCategory.reset();
    await loadCategoriesList();
  } catch (err) {
    console.error(err);
    showToast('Erro ao cadastrar categoria: ' + err.message, 'error');
  }
}

async function handleDeleteCategory(catId, catName) {
  const confirmed = await showConfirm({
    eyebrow: 'Remocao de Categoria',
    title: 'Excluir categoria permanentemente?',
    message: `Deseja excluir a categoria "${catName}"? Isso removerá a categoria de todas as eleições vinculadas.`,
    confirmText: 'Remover',
    variant: 'danger'
  });
  if (!confirmed) return;

  try {
    const { error } = await supabase.rpc('admin_delete_category', { p_category_id: catId });
    if (error) throw error;

    showToast('Categoria removida com sucesso!', 'success');
    await loadCategoriesList();
  } catch (err) {
    console.error(err);
    showToast('Erro ao remover: ' + err.message, 'error');
  }
}

// 3. Eleições CRUD & Vínculos
async function loadElectionsDropdowns() {
  try {
    // Carregar Cidades para Select de criação
    const { data: cities, error: citiesErr } = await supabase.from('cities').select('*').order('name');
    if (citiesErr) throw citiesErr;

    const officialCity = findOfficialCity(cities);
    if (!officialCity) throw new Error(`${OFFICIAL_CITY.displayName} não está cadastrada.`);
    selectElectionCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
    selectElectionCity.value = officialCity.id;
    selectElectionCity.disabled = true;

    // Carregar Eleições para Vínculo
    const { data: elections, error: electErr } = await supabase.from('elections').select('*, cities(name)').eq('city_id', officialCity.id).order('year', { ascending: false });
    if (electErr) throw electErr;

    selectLinkElection.innerHTML = '<option value="">Selecione uma eleição...</option>';
    elections.forEach(el => {
      const opt = document.createElement('option');
      opt.value = el.id;
      opt.textContent = `${el.cities ? el.cities.name : 'N/A'} (${el.year}) - ${el.status}`;
      selectLinkElection.appendChild(opt);
    });

  } catch (err) {
    console.error(err);
  }
}

async function handleAddElection(e) {
  e.preventDefault();
  const city_id = selectElectionCity.value;
  const year = parseInt(inputElectionYear.value);
  const start_date = inputElectionStart.value;
  const end_date = inputElectionEnd.value;

  if (!city_id || !year || !start_date || !end_date) return;

  try {
    const { error } = await supabase.rpc('admin_create_election', {
      p_city_id: city_id,
      p_year: year,
      p_start_date: start_date,
      p_end_date: end_date
    });

    if (error) throw error;

    showToast('Eleição/Edição criada em rascunho com sucesso!', 'success');
    formAddElection.reset();
    await loadElectionsDropdowns();
  } catch (err) {
    console.error(err);
    showToast('Erro ao criar eleição: ' + err.message, 'error');
  }
}

async function loadLinkedCategoriesCheckboxList() {
  const electionId = selectLinkElection.value;
  linkCategoriesCheckboxes.innerHTML = '';
  btnSaveCategoryLinks.disabled = true;

  if (!electionId) {
    linkCategoriesCheckboxes.innerHTML = '<span style="color: rgba(255,255,255,0.3); font-size: 0.85rem;">Selecione primeiro uma eleição...</span>';
    return;
  }

  try {
    // 1. Pegar todas as categorias
    const { data: allCategories, error: catErr } = await supabase.from('categories').select('*').order('name');
    if (catErr) throw catErr;

    // 2. Pegar as categorias já vinculadas a esta eleição
    const { data: linkedCategories, error: linkErr } = await supabase.from('city_categories').select('category_id').eq('election_id', electionId);
    if (linkErr) throw linkErr;

    const linkedIds = new Set(linkedCategories.map(lc => lc.category_id));

    if (allCategories.length === 0) {
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

    btnSaveCategoryLinks.disabled = false;
  } catch (err) {
    console.error(err);
    linkCategoriesCheckboxes.innerHTML = '<span style="color: #ff5555; font-size: 0.85rem;">Erro ao carregar vínculos.</span>';
  }
}

async function handleSaveCategoryLinks(e) {
  e.preventDefault();
  const electionId = selectLinkElection.value;
  if (!electionId) return;

  const checkedCheckboxes = linkCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
  const selectedCategoryIds = Array.from(checkedCheckboxes).map(cb => cb.value);

  btnSaveCategoryLinks.disabled = true;
  btnSaveCategoryLinks.textContent = 'Salvando...';

  try {
    // 1. Remover vínculos anteriores
    const { error } = await supabase.rpc('admin_save_election_categories', {
      p_election_id: electionId,
      p_category_ids: selectedCategoryIds
    });
    if (error) throw error;

    // 2. Inserir novos vínculos
    showToast('Vínculos de categoria salvos com sucesso!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar vínculos: ' + err.message, 'error');
  } finally {
    btnSaveCategoryLinks.disabled = false;
    btnSaveCategoryLinks.textContent = 'Salvar Vínculos de Categoria';
  }
}

// 4. Candidatos CRUD
async function loadCandidatesDropdowns() {
  try {
    const { data: elections, error } = await supabase.from('elections').select('*, cities(name)').order('year', { ascending: false });
    if (error) throw error;
    const officialElections = elections.filter(election => isOfficialCity(election.cities));

    // Preencher dropdown de cadastro
    selectCandElection.innerHTML = '<option value="">Selecione a eleição...</option>';
    // Preencher dropdown de filtro de lista
    filterListElection.innerHTML = '<option value="">Filtrar por Eleição...</option>';

    officialElections.forEach(el => {
      const label = `${el.cities ? el.cities.name : 'N/A'} (${el.year}) - ${el.status}`;
      
      const opt1 = document.createElement('option');
      opt1.value = el.id;
      opt1.textContent = label;
      selectCandElection.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = el.id;
      opt2.textContent = label;
      filterListElection.appendChild(opt2);
    });

  } catch (err) {
    console.error(err);
  }
}

async function loadCategoriesForElectionSelect(electionId, selectElement) {
  try {
    const { data, error } = await supabase
      .from('city_categories')
      .select('category_id, categories(id, name)')
      .eq('election_id', electionId);

    if (error) throw error;

    selectElement.innerHTML = '<option value="">Selecione...</option>';
    data.forEach(row => {
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

async function loadCandidatesForStructureList(electionId) {
  try {
    candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.4);">Carregando concorrentes...</td></tr>';

    const { data, error } = await supabase
      .from('candidates')
      .select('*, categories(name), elections(year, cities(name))')
      .eq('election_id', electionId)
      .order('name');

    if (error) throw error;

    candidatesTableBody.innerHTML = '';
    if (data.length === 0) {
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

      row.querySelector('.btn-edit-cand').addEventListener('click', () => handleEditCandidate(cand));
      row.querySelector('.btn-delete-cand').addEventListener('click', () => handleDeleteCandidate(cand.id, cand.name));
      candidatesTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    candidatesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ff5555;">Erro ao obter concorrentes.</td></tr>';
  }
}

function handleEditCandidate(candidate) {
  inputCandidateId.value = candidate.id;
  selectCandElection.value = candidate.election_id;
  
  // Forçar recarga de categorias e depois selecionar a categoria correspondente
  loadCategoriesForElectionSelect(candidate.election_id, selectCandCategory).then(() => {
    selectCandCategory.value = candidate.category_id;
  });

  inputCandName.value = candidate.name;
  selectCandType.value = candidate.type;
  inputCandInstagram.value = candidate.instagram ? candidate.instagram.replace(/^@+/, '') : '';
  inputCandWhatsapp.value = candidate.whatsapp || '';
  inputCandEmail.value = candidate.email || '';
  inputCandLogo.value = candidate.logo_url || '';
  inputCandDesc.value = candidate.description || '';

  lblCandidateForm.textContent = 'Editar Concorrente';
  btnCancelCandEdit.style.display = 'inline-flex';
  
  // Rolar suave até o formulário
  formAddCandidate.scrollIntoView({ behavior: 'smooth' });
}

function resetCandidateForm() {
  inputCandidateId.value = '';
  formAddCandidate.reset();
  selectCandCategory.innerHTML = '<option value="">Selecione primeiro a eleição</option>';
  selectCandCategory.disabled = true;

  lblCandidateForm.textContent = 'Adicionar Candidato Oficial';
  btnCancelCandEdit.style.display = 'none';
}

async function handleAddOrUpdateCandidate(e) {
  e.preventDefault();
  const id = inputCandidateId.value;
  const election_id = selectCandElection.value;
  const category_id = selectCandCategory.value;
  const name = inputCandName.value.trim();
  const type = selectCandType.value;
  
  let instagram = inputCandInstagram.value.trim();
  if (instagram) instagram = '@' + instagram.replace(/^@+/, '');

  const whatsapp = inputCandWhatsapp.value.trim() || null;
  const email = inputCandEmail.value.trim() || null;
  const logo_url = inputCandLogo.value.trim() || null;
  const description = inputCandDesc.value.trim() || null;

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
    showToast(id ? 'Informacoes do concorrente atualizadas!' : 'Concorrente cadastrado com sucesso!', 'success');

    resetCandidateForm();

    if (filterListElection.value === election_id) {
      await loadCandidatesForStructureList(election_id);
    } else {
      filterListElection.value = election_id;
      await loadCandidatesForStructureList(election_id);
    }
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar concorrente: ' + err.message, 'error');
  }
}

async function handleDeleteCandidate(candidateId, name) {
  const confirmed = await showConfirm({
    eyebrow: 'Remocao de Concorrente',
    title: 'Excluir concorrente permanentemente?',
    message: `Deseja excluir "${name}"? Isso apagará seus dados e histórico de votos associados.`,
    confirmText: 'Remover',
    variant: 'danger'
  });
  if (!confirmed) return;

  try {
    const { error } = await supabase.rpc('admin_archive_candidate', { p_candidate_id: candidateId });
    if (error) throw error;

    showToast('Concorrente excluído com sucesso!', 'success');
    
    const activeElection = filterListElection.value;
    if (activeElection) {
      await loadCandidatesForStructureList(activeElection);
    }
  } catch (err) {
    console.error(err);
    showToast('Erro ao remover: ' + err.message, 'error');
  }
}
