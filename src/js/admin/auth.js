/* ============================================================================
   PROJETOS MELHORES DO ANO - MÓDULO DE AUTENTICAÇÃO E RBAC DO ADMIN
   Gerenciamento de sessão, perfil de equipe, logout e controle por cargo.
   ============================================================================ */

import { supabase } from '../supabaseClient.js';
import { translateAuthError, setupForgotPasswordButton } from '../modules/authHelpers.js';

let currentStaff = null;

export function getCurrentStaff() {
  return currentStaff;
}

export function showLogin() {
  const adminLoginScreen = document.getElementById('adminLoginScreen');
  const adminDashboardLayout = document.getElementById('adminDashboardLayout');
  const adminLoginForm = document.getElementById('adminLoginForm');

  if (adminLoginScreen) adminLoginScreen.style.display = 'block';
  if (adminDashboardLayout) adminDashboardLayout.style.display = 'none';
  if (adminLoginForm) adminLoginForm.reset();

  currentStaff = null;
}

export function applyRolePermissions(role, switchTab) {
  const isCrmOnly = role === 'comercial';
  const hasFullAdmin = role === 'admin' || role === 'super_admin';
  const canUseCrm = hasFullAdmin || isCrmOnly;

  const navModeracao = document.getElementById('navModeracao');
  const navMesclagem = document.getElementById('navMesclagem');
  const navCrm = document.getElementById('navCrm');
  const navEleicoes = document.getElementById('navEleicoes');
  const navLogs = document.getElementById('navLogs');
  const navEstrutura = document.getElementById('navEstrutura');

  if (navModeracao) navModeracao.style.display = isCrmOnly ? 'none' : 'flex';
  if (navMesclagem) navMesclagem.style.display = isCrmOnly ? 'none' : 'flex';
  if (navCrm) navCrm.style.display = canUseCrm ? 'flex' : 'none';
  if (navEleicoes) navEleicoes.style.display = hasFullAdmin ? 'flex' : 'none';
  if (navLogs) navLogs.style.display = hasFullAdmin ? 'flex' : 'none';
  if (navEstrutura) navEstrutura.style.display = hasFullAdmin ? 'flex' : 'none';

  if (typeof switchTab === 'function') {
    if (isCrmOnly) {
      switchTab('tab-crm');
    } else {
      switchTab('tab-moderacao');
    }
  }
}

export async function initStaffDashboard({ switchTab, onPhaseLoad } = {}) {
  const txtAdminUser = document.getElementById('txtAdminUser');
  const txtAdminRole = document.getElementById('txtAdminRole');
  const adminLoginScreen = document.getElementById('adminLoginScreen');
  const adminDashboardLayout = document.getElementById('adminDashboardLayout');

  try {
    if (txtAdminUser) txtAdminUser.textContent = 'Carregando...';

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
      if (typeof window.showToast === 'function') {
        window.showToast('Acesso negado: Este perfil não possui permissões administrativas.', 'error');
      }
      await supabase.auth.signOut();
      return;
    }

    currentStaff = {
      id: user.id,
      name: profile.name,
      role: profile.role
    };

    if (txtAdminUser) txtAdminUser.textContent = currentStaff.name;
    if (txtAdminRole) txtAdminRole.textContent = currentStaff.role;

    if (adminLoginScreen) adminLoginScreen.style.display = 'none';
    if (adminDashboardLayout) adminDashboardLayout.style.display = 'flex';

    // 2. Aplicar controle RBAC no painel de abas
    applyRolePermissions(currentStaff.role, switchTab);

    // 3. Carregar a fase atual do evento se callback informada
    if (typeof onPhaseLoad === 'function') {
      await onPhaseLoad();
    }

  } catch (err) {
    console.error('Falha ao inicializar o painel:', err);
    if (typeof window.showToast === 'function') {
      window.showToast('Erro ao carregar painel corporativo: ' + err.message, 'error');
    }
    await supabase.auth.signOut();
  }
}

export function setupAuthListeners({ switchTab, onPhaseLoad } = {}) {
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  const btnAdminLoginSubmit = document.getElementById('btnAdminLoginSubmit');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const btnToggleAdminPassword = document.getElementById('btnToggleAdminPassword');

  if (btnToggleAdminPassword && adminPassword) {
    btnToggleAdminPassword.addEventListener('click', () => {
      const isPassword = adminPassword.type === 'password';
      adminPassword.type = isPassword ? 'text' : 'password';
      btnToggleAdminPassword.style.color = isPassword ? '#d4af37' : 'rgba(255,255,255,0.4)';
    });
  }

  setupForgotPasswordButton({
    buttonId: 'btnForgotPasswordAdmin',
    emailInputId: 'adminEmail',
    supabase
  });

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawEmail = adminEmail ? adminEmail.value.trim() : '';
      const email = (rawEmail.includes('@') ? rawEmail : `${rawEmail}@gmail.com`).toLowerCase();
      let rawPassword = adminPassword ? adminPassword.value : '';
      const trimmedPassword = rawPassword.trim();

      if (btnAdminLoginSubmit) {
        btnAdminLoginSubmit.disabled = true;
        btnAdminLoginSubmit.textContent = 'Autenticando...';
      }

      try {
        // Tentar primeiro com a senha limpa de espaços acidentais
        let { error } = await supabase.auth.signInWithPassword({
          email,
          password: trimmedPassword
        });

        // Se falhou e havia espaço antes/depois, tentar com a senha original sem trim
        if (error && rawPassword !== trimmedPassword) {
          const retry = await supabase.auth.signInWithPassword({
            email,
            password: rawPassword
          });
          if (!retry.error) {
            error = null;
          }
        }

        if (error) {
          const lowerMsg = String(error.message || '').toLowerCase();
          if (lowerMsg.includes('invalid login credentials') || lowerMsg.includes('invalid_credentials')) {
            throw new Error('E-mail ou senha incorretos. Dica: A senha contém letras maiúsculas e caracteres especiais. Caso prefira, clique em "Esqueci minha senha" para criar uma nova senha.');
          }
          throw error;
        }
      } catch (err) {
        if (typeof window.showToast === 'function') {
          window.showToast(translateAuthError(err), 'error');
        }
        console.error(err);
      } finally {
        if (btnAdminLoginSubmit) {
          btnAdminLoginSubmit.disabled = false;
          btnAdminLoginSubmit.textContent = 'Entrar no Painel';
        }
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
  }

  // Escutar alterações de autenticação
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await initStaffDashboard({ switchTab, onPhaseLoad });
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
}
