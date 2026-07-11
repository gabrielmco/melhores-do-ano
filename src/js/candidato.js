import { supabase } from './supabaseClient.js';

// Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');

const txtCandidateName = document.getElementById('txtCandidateName');
const txtEditionInfo = document.getElementById('txtEditionInfo');
const btnLogout = document.getElementById('btnLogout');

const profileUpdateForm = document.getElementById('profileUpdateForm');
const badgeStatus = document.getElementById('badgeStatus');
const txtWhatsapp = document.getElementById('txtWhatsapp');
const txtEmail = document.getElementById('txtEmail');
const inputInstagram = document.getElementById('inputInstagram');
const inputLogoUrl = document.getElementById('inputLogoUrl');
const inputDescription = document.getElementById('inputDescription');
const btnUpdateProfile = document.getElementById('btnUpdateProfile');
const winnerKitItem = document.getElementById('winnerKitItem');
const commercialRequestLink = document.getElementById('commercialRequestLink');

// State
let currentCandidate = null;

function getCommercialRequestUrl(candidate) {
  const configuredUrl = String(import.meta.env.VITE_CANDIDATE_COMMERCIAL_URL || import.meta.env.VITE_COMMERCIAL_CONTACT_URL || '').trim();
  const fallbackUrl = 'mailto:comercial@melhoresdoano.com.br';
  const baseUrl = configuredUrl || fallbackUrl;
  const message = `Olá, quero solicitar os materiais comerciais oficiais para ${candidate?.name || 'meu negócio'} no Melhores do Ano.`;
  const encodedMessage = encodeURIComponent(message);

  if (baseUrl.startsWith('mailto:')) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}subject=${encodeURIComponent('Solicitação comercial - Melhores do Ano')}&body=${encodedMessage}`;
  }

  if ((baseUrl.includes('wa.me') || baseUrl.includes('api.whatsapp.com')) && !/[?&]text=/.test(baseUrl)) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}text=${encodedMessage}`;
  }

  return baseUrl;
}

// Initialize Auth listener
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  
  // Verificar sessão atual
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await initDashboard();
  } else {
    showLogin();
  }

  // Escutar mudanças de estado de auth
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await initDashboard();
    } else if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
});

function setupEventListeners() {
  // Enviar Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnLoginSubmit.disabled = true;
    btnLoginSubmit.textContent = 'Autenticando...';

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      console.error('Erro de login:', err);
      showToast('Falha na autenticação: E-mail ou senha incorretos.', 'error');
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Entrar';
    }
  });

  // Atualizar Perfil
  profileUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentCandidate) return;

    btnUpdateProfile.disabled = true;
    btnUpdateProfile.textContent = 'Salvando...';

    const instagram = inputInstagram.value.trim();
    const logoUrl = inputLogoUrl.value.trim() || null;
    const description = inputDescription.value.trim() || null;

    try {
      // Chamar RPC segura de atualização (que valida internamente se auth.uid() é dono do profile_id)
      const { error } = await supabase.rpc('update_candidate_profile', {
        p_candidate_id: currentCandidate.id,
        p_instagram: instagram,
        p_whatsapp: txtWhatsapp.textContent, // Mantém o contato carregado
        p_email: txtEmail.textContent,       // Mantém o contato carregado
        p_logo_url: logoUrl,
        p_description: description
      });

      if (error) throw error;

      showToast('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      showToast('Erro ao salvar as informações: ' + err.message, 'error');
    } finally {
      btnUpdateProfile.disabled = false;
      btnUpdateProfile.textContent = 'Salvar Informações';
    }
  });

  // Botão Sair
  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function showLogin() {
  loginScreen.style.display = 'block';
  dashboardScreen.style.display = 'none';
  btnLoginSubmit.disabled = false;
  btnLoginSubmit.textContent = 'Entrar';
  loginForm.reset();

  currentCandidate = null;
}

// Inicializar painel após login de sucesso
async function initDashboard() {
  loginScreen.style.display = 'none';
  dashboardScreen.style.display = 'block';
  
  try {
    txtCandidateName.textContent = 'Carregando perfil...';
    
    // 1. Chamar RPC para buscar dados privados do candidato logado
    const { data: candidates, error } = await supabase.rpc('get_my_candidate_profile');
    
    if (error) throw error;

    if (!candidates || candidates.length === 0) {
      // Se não há candidato vinculado a esta conta de usuário, exibe mensagem
      txtCandidateName.textContent = 'Perfil não vinculado';
      txtEditionInfo.textContent = 'Entre em contato com a administração para vincular esta conta a um candidato.';
      profileUpdateForm.style.display = 'none';
      return;
    }

    // Como get_my_candidate_profile retorna table, pegamos o primeiro item
    const candidate = candidates[0];
    currentCandidate = candidate;

    // 2. Preencher dados na interface
    txtCandidateName.textContent = candidate.name;
    txtWhatsapp.textContent = candidate.whatsapp;
    txtEmail.textContent = candidate.email;
    inputInstagram.value = candidate.instagram || '';
    inputLogoUrl.value = candidate.logo_url || '';
    inputDescription.value = candidate.description || '';

    // Renderizar badge de status
    badgeStatus.textContent = candidate.status;
    badgeStatus.className = `status-badge status-${candidate.status.toLowerCase()}`;

    // 3. Buscar informações da eleição para exibir no cabeçalho
    const { data: election, error: electErr } = await supabase
      .from('elections')
      .select('year, cities(name)')
      .eq('id', candidate.election_id)
      .single();

    if (!electErr && election) {
      txtEditionInfo.textContent = `Edição Oficial de ${election.cities.name} — Melhores do Ano ${election.year}`;
    }

    // 4. Verificar se o candidato venceu a premiação para liberar o kit extra de vencedor
    // (Apenas se a eleição já estiver publicada e ele for o 1º lugar)
    const { data: winData, error: winErr } = await supabase
      .from('public_winners')
      .select('*')
      .eq('candidate_id', candidate.id)
      .eq('position', 1)
      .limit(1);

    if (!winErr && winData && winData.length > 0) {
      winnerKitItem.style.display = 'flex';
    } else {
      winnerKitItem.style.display = 'none';
    }

    if (commercialRequestLink) {
      commercialRequestLink.href = getCommercialRequestUrl(candidate);
    }

    profileUpdateForm.style.display = 'block';
  } catch (err) {
    console.error('Erro ao inicializar painel do candidato:', err);
    txtCandidateName.textContent = 'Erro de Carregamento';
    txtEditionInfo.textContent = 'Não foi possível carregar os dados do painel.';
  }
}
