import { supabase } from './supabaseClient.js';

// Elements
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const dashboardScreen = document.getElementById('dashboardScreen');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');

const registerForm = document.getElementById('registerForm');
const registerName = document.getElementById('registerName');
const registerInstagram = document.getElementById('registerInstagram');
const registerCategory = document.getElementById('registerCategory');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const btnRegisterSubmit = document.getElementById('btnRegisterSubmit');

const linkGoToRegister = document.getElementById('linkGoToRegister');
const linkGoToLogin = document.getElementById('linkGoToLogin');

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

  // Carregar categorias no formulário de cadastro
  loadCategoriesForRegister();
});

async function loadCategoriesForRegister() {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (error) throw error;

    registerCategory.innerHTML = '<option value="">Selecione a categoria...</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      registerCategory.appendChild(option);
    });
  } catch (err) {
    console.error('Erro ao carregar categorias no select:', err);
  }
}

function setupEventListeners() {
  // Navegação entre Telas
  linkGoToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginScreen.style.display = 'none';
    registerScreen.style.display = 'block';
    registerForm.reset();
  });

  linkGoToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerScreen.style.display = 'none';
    loginScreen.style.display = 'block';
    loginForm.reset();
  });

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
      window.showToast('Falha na autenticação: E-mail ou senha incorretos.', 'error');
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Entrar';
    }
  });

  // Enviar Cadastro (Autocadastro de Candidato)
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnRegisterSubmit.disabled = true;
    btnRegisterSubmit.textContent = 'Cadastrando...';

    const name = registerName.value.trim();
    const rawInstagram = registerInstagram.value.trim();
    const categoryId = registerCategory.value;
    const email = registerEmail.value.trim();
    const password = registerPassword.value;

    // Normalizar Instagram
    let instagram = rawInstagram.toLowerCase().replace(/[\s@]/g, '');
    if (!instagram) {
      window.showToast('Instagram oficial é obrigatório.', 'error');
      btnRegisterSubmit.disabled = false;
      btnRegisterSubmit.textContent = 'Criar Conta e Entrar';
      return;
    }
    instagram = `@${instagram}`;

    try {
      // 1. Obter a eleição aberta em Bom Jardim - MG
      const { data: elections, error: electErr } = await supabase
        .from('elections')
        .select('id')
        .eq('status', 'aberta')
        .limit(1);

      if (electErr || !elections || elections.length === 0) {
        throw new Error('Não há edições abertas para cadastro no momento.');
      }
      const electionId = elections[0].id;

      // 2. Verificar se o Instagram já existe na eleição corrente
      const { data: existingCandidates, error: candCheckErr } = await supabase
        .from('candidates')
        .select('id, profile_id')
        .eq('election_id', electionId)
        .eq('instagram', instagram)
        .limit(1);

      let candidateToBind = null;

      if (!candCheckErr && existingCandidates && existingCandidates.length > 0) {
        candidateToBind = existingCandidates[0];
        if (candidateToBind.profile_id) {
          throw new Error('Este Instagram já possui um perfil cadastrado no sistema.');
        }
      }

      // 3. Cadastrar usuário no Auth do Supabase
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (signUpErr) throw signUpErr;

      const authUserId = authData.user?.id;
      if (!authUserId) {
        throw new Error('Falha ao obter o ID do usuário cadastrado.');
      }

      // 4. Salvar na tabela de Perfis do Supabase
      const { error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: authUserId,
          name: name,
          role: 'candidato'
        });
      
      if (profileErr && !profileErr.message.includes('unique')) {
        console.warn('Erro ao inserir perfil do candidato:', profileErr);
      }

      // 5. Vincular candidato ou criar novo
      if (candidateToBind) {
        // Reivindicar candidato pré-existente (indicação do público sem e-mail/dono)
        const { error: updateErr } = await supabase
          .from('candidates')
          .update({
            profile_id: authUserId,
            email: email,
            name: name,
            status: 'aprovado'
          })
          .eq('id', candidateToBind.id);

        if (updateErr) throw updateErr;
        window.showToast('Empresa oficializada e vinculada à sua conta com sucesso!', 'success');
      } else {
        // Criar novo candidato
        const { error: insertErr } = await supabase
          .from('candidates')
          .insert({
            election_id: electionId,
            category_id: categoryId,
            name: name,
            normalized_name: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
            type: 'empresa',
            instagram: instagram,
            email: email,
            whatsapp: 'N/A',
            status: 'aprovado',
            profile_id: authUserId
          });

        if (insertErr) throw insertErr;
        window.showToast('Sua empresa foi cadastrada com sucesso e está concorrendo!', 'success');
      }

      // Recarregar painel
      await initDashboard();

    } catch (err) {
      console.error('Erro de cadastro:', err);
      window.showToast(err.message || 'Falha ao registrar a empresa. Verifique os dados.', 'error');
    } finally {
      btnRegisterSubmit.disabled = false;
      btnRegisterSubmit.textContent = 'Criar Conta e Entrar';
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
      // Chamar RPC segura de atualização
      const { error } = await supabase.rpc('update_candidate_profile', {
        p_candidate_id: currentCandidate.id,
        p_instagram: instagram,
        p_whatsapp: txtWhatsapp.textContent,
        p_email: txtEmail.textContent,
        p_logo_url: logoUrl,
        p_description: description
      });

      if (error) throw error;

      window.showToast('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      window.showToast('Erro ao salvar as informações: ' + err.message, 'error');
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
  registerScreen.style.display = 'none';
  dashboardScreen.style.display = 'none';
  btnLoginSubmit.disabled = false;
  btnLoginSubmit.textContent = 'Entrar';
  loginForm.reset();

  currentCandidate = null;
}

// Inicializar painel após login de sucesso
async function initDashboard() {
  loginScreen.style.display = 'none';
  registerScreen.style.display = 'none';
  dashboardScreen.style.display = 'block';
  
  try {
    txtCandidateName.textContent = 'Carregando perfil...';
    
    // 1. Chamar RPC para buscar dados privados do candidato logado
    const { data: candidates, error } = await supabase.rpc('get_my_candidate_profile');
    
    if (error) throw error;

    if (!candidates || candidates.length === 0) {
      txtCandidateName.textContent = 'Perfil não vinculado';
      txtEditionInfo.textContent = 'Entre em contato com a administração para vincular esta conta a um candidato.';
      profileUpdateForm.style.display = 'none';
      return;
    }

    const candidate = candidates[0];
    currentCandidate = candidate;

    // 2. Preencher dados na interface
    txtCandidateName.textContent = candidate.name;
    txtWhatsapp.textContent = candidate.whatsapp || 'N/A';
    txtEmail.textContent = candidate.email || 'N/A';
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
