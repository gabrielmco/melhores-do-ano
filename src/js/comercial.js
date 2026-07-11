import { supabase } from './supabaseClient.js';

// DOM Elements
const comercialLoginScreen = document.getElementById('comercialLoginScreen');
const comercialDashboardLayout = document.getElementById('comercialDashboardLayout');
const comercialLoginForm = document.getElementById('comercialLoginForm');
const comercialEmail = document.getElementById('comercialEmail');
const comercialPassword = document.getElementById('comercialPassword');
const btnComercialLoginSubmit = document.getElementById('btnComercialLoginSubmit');

const txtComercialUser = document.getElementById('txtComercialUser');
const txtComercialRole = document.getElementById('txtComercialRole');
const btnComercialLogout = document.getElementById('btnComercialLogout');

const crmSelectCity = document.getElementById('crmSelectCity');
const crmTableBody = document.getElementById('crmTableBody');

// State
let currentAgent = null;

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

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Verificar estado da sessão atual
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await initAgentDashboard();
  } else {
    showLogin();
  }

  // Monitorar alterações no estado da sessão
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await initAgentDashboard();
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
});

function showLogin() {
  comercialLoginScreen.style.display = 'block';
  comercialDashboardLayout.style.display = 'none';
  comercialLoginForm.reset();

  currentAgent = null;
}

async function initAgentDashboard() {
  try {
    txtComercialUser.textContent = 'Carregando...';
    
    // Obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Nenhum usuário ativo na sessão.');

    // Buscar perfil correspondente no banco
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single();

    if (error || !profile) throw new Error('Perfil não encontrado no sistema.');

    // Verificar se possui acesso comercial/vendas ou admin
    const allowedRoles = ['super_admin', 'admin', 'comercial'];
    if (!allowedRoles.includes(profile.role)) {
      window.showToast('Acesso negado: Este portal é restrito aos agentes comerciais.', 'error');
      await supabase.auth.signOut();
      return;
    }

    currentAgent = {
      id: user.id,
      name: profile.name,
      role: profile.role
    };

    txtComercialUser.textContent = currentAgent.name;
    txtComercialRole.textContent = currentAgent.role.replace('_', ' ');

    comercialLoginScreen.style.display = 'none';
    comercialDashboardLayout.style.display = 'flex';

    await initCrmDropdown();
  } catch (err) {
    console.error('Erro ao inicializar portal comercial:', err);
    window.showToast('Erro ao carregar dados do comercial: ' + err.message, 'error');
    await supabase.auth.signOut();
  }
}

function setupEventListeners() {
  // Login Form submit
  comercialLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = comercialEmail.value.trim();
    const password = comercialPassword.value;

    btnComercialLoginSubmit.disabled = true;
    btnComercialLoginSubmit.textContent = 'Entrando...';

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      window.showToast('Falha na autenticação. Verifique os dados fornecidos.', 'error');
      console.error(err);
    } finally {
      btnComercialLoginSubmit.disabled = false;
      btnComercialLoginSubmit.textContent = 'Entrar no CRM';
    }
  });

  // Logout Button
  btnComercialLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // Dropdown City change
  crmSelectCity.addEventListener('change', async () => {
    const cityId = crmSelectCity.value;
    crmTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.3);">Selecione uma cidade.</td></tr>';
    
    if (cityId) {
      await loadCrmData(cityId);
    }
  });
}

async function initCrmDropdown() {
  crmSelectCity.innerHTML = '<option value="">Carregando cidades...</option>';
  try {
    const { data, error } = await supabase.from('cities').select('*').order('name');
    if (error) throw error;

    crmSelectCity.innerHTML = '<option value="">Selecione uma Cidade</option>';
    data.forEach(city => {
      const option = document.createElement('option');
      option.value = city.id;
      option.textContent = city.name;
      crmSelectCity.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

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

    // 2. Chamar a RPC de listagem comercial
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
          window.showToast('Informe um valor estimado válido.', 'error');
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Salvar...';

        try {
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
          
          window.showToast('Funil comercial atualizado com sucesso!', 'success');
        } catch (err) {
          console.error(err);
          window.showToast('Erro ao atualizar: ' + err.message, 'error');
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
