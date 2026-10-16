import { supabase } from './supabaseClient.js';
import { downloadStoryCard } from './modules/storyCardGenerator.js';
import {
  translateAuthError,
  isEmailInCooldown,
  markEmailCooldown,
  setupForgotPasswordButton
} from './modules/authHelpers.js';

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
let categoryMap = new Map();

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

  // Carregar categorias no formulário de cadastro
  await loadCategoriesForRegister();
  
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

async function loadCategoriesForRegister() {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (error) throw error;

    registerCategory.innerHTML = '<option value="">Selecione a categoria...</option>';
    categoryMap.clear();
    categories.forEach(cat => {
      categoryMap.set(cat.id, cat.name);
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      registerCategory.appendChild(option);
    });
  } catch (err) {
    console.error('Erro ao carregar categorias no select:', err);
  }
}

async function submitPublicNominationFallback({ electionId, categoryId, name, instagram }) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;

    await fetch(`${supabaseUrl}/functions/v1/nominate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        election_id: electionId,
        category_id: categoryId,
        name,
        instagram,
        type: 'empresa'
      })
    });
  } catch (err) {
    console.warn('Fallback de pré-indicação via Edge Function:', err);
  }
}

function setupEventListeners() {
  setupForgotPasswordButton({
    buttonId: 'btnForgotPasswordCandidato',
    emailInputId: 'loginEmail',
    supabase
  });

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
      window.showToast(translateAuthError(err), 'error');
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Entrar';
    }
  });

  // Enviar Cadastro (Autocadastro de Candidato)
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = registerName.value.trim();
    const rawInstagram = registerInstagram.value.trim();
    const categoryId = registerCategory.value;
    const email = registerEmail.value.trim();
    const password = registerPassword.value;

    // Verificar cooldown de 55s por e-mail para evitar erro "after 50 seconds" do Supabase
    const waitSecs = isEmailInCooldown(email);
    if (waitSecs > 0) {
      window.showToast(`Já enviamos um cadastro para ${email}. Aguarde ${waitSecs}s ou verifique sua caixa de entrada (e Spam) para confirmar seu e-mail.`, 'info');
      registerScreen.style.display = 'none';
      loginScreen.style.display = 'block';
      loginEmail.value = email;
      return;
    }

    // Normalizar Instagram
    let instagram = rawInstagram.toLowerCase().replace(/[\s@]/g, '');
    if (!instagram) {
      window.showToast('Instagram oficial é obrigatório.', 'error');
      return;
    }
    instagram = `@${instagram}`;

    btnRegisterSubmit.disabled = true;
    btnRegisterSubmit.textContent = 'Cadastrando...';

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
          throw new Error('Este Instagram já possui um perfil vinculado no sistema. Faça login na tela anterior.');
        }
      }

      // 3. Cadastrar usuário no Auth do Supabase (com metadados da empresa)
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/candidato.html`,
          data: {
            name,
            instagram,
            category_id: categoryId,
            election_id: electionId,
            role: 'candidato'
          }
        }
      });

      if (signUpErr) {
        const lowerErr = String(signUpErr.message || '').toLowerCase();
        if (lowerErr.includes('already registered') || lowerErr.includes('already been registered')) {
          window.showToast('Este e-mail já possui conta! Faça login abaixo ou clique em "Esqueci minha senha".', 'info');
          registerScreen.style.display = 'none';
          loginScreen.style.display = 'block';
          loginEmail.value = email;
          return;
        }
        throw signUpErr;
      }

      markEmailCooldown(email);

      const authUserId = authData.user?.id;
      if (!authUserId) {
        throw new Error('Falha ao obter o ID do usuário cadastrado.');
      }

      // Se o Supabase retornou identities vazio, o e-mail já existia no Auth
      if (Array.isArray(authData.user?.identities) && authData.user.identities.length === 0) {
        window.showToast('Este e-mail já está registrado! Faça login abaixo ou use "Esqueci minha senha".', 'info');
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'block';
        loginEmail.value = email;
        return;
      }

      // Caso o Supabase exija confirmação de e-mail (session === null):
      // Registramos a indicação via Edge Function pública e redirecionamos para a tela de login!
      if (!authData.session) {
        if (!candidateToBind) {
          await submitPublicNominationFallback({ electionId, categoryId, name, instagram });
        }
        window.showToast(`Conta criada com sucesso! Enviamos um link de confirmação para ${email}. Confirme no seu e-mail e depois faça login abaixo.`, 'success');
        registerForm.reset();
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'block';
        loginEmail.value = email;
        return;
      }

      // 4. Se a sessão já veio ativa (autoconfirm ligado), salvar perfil e candidato
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: authUserId,
          name: name,
          role: 'candidato'
        }, { onConflict: 'id' });
      
      if (profileErr) {
        console.warn('Aviso ao salvar perfil do candidato:', profileErr);
      }

      // 5. Vincular candidato ou criar novo
      if (candidateToBind) {
        const { error: updateErr } = await supabase
          .from('candidates')
          .update({
            profile_id: authUserId,
            email: email,
            name: name,
            status: 'aprovado'
          })
          .eq('id', candidateToBind.id);

        if (updateErr) {
          await submitPublicNominationFallback({ electionId, categoryId, name, instagram });
        }
        window.showToast('Empresa oficializada e vinculada à sua conta com sucesso!', 'success');
      } else {
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

        if (insertErr) {
          await submitPublicNominationFallback({ electionId, categoryId, name, instagram });
        }
        window.showToast('Sua empresa foi cadastrada com sucesso e está concorrendo!', 'success');
      }

      // Recarregar painel
      await initDashboard();

    } catch (err) {
      console.error('Erro de cadastro:', err);
      window.showToast(translateAuthError(err), 'error');
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

      if (error) {
        // Fallback direto para super_admin/admin editando candidato
        const { error: directUpdateErr } = await supabase
          .from('candidates')
          .update({
            instagram,
            logo_url: logoUrl,
            description
          })
          .eq('id', currentCandidate.id);

        if (directUpdateErr) throw error;
      }

      currentCandidate.instagram = instagram;
      currentCandidate.logo_url = logoUrl;
      currentCandidate.description = description;

      window.showToast('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      window.showToast('Erro ao salvar as informações: ' + translateAuthError(err), 'error');
    } finally {
      btnUpdateProfile.disabled = false;
      btnUpdateProfile.textContent = 'Salvar Informações';
    }
  });

  // Botão Sair
  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // Gerar Card para Instagram Stories
  const btnGenerateStoryCard = document.getElementById('btnGenerateStoryCard');
  if (btnGenerateStoryCard) {
    btnGenerateStoryCard.addEventListener('click', async () => {
      if (!currentCandidate) {
        window.showToast('Perfil do candidato não identificado.', 'error');
        return;
      }
      btnGenerateStoryCard.disabled = true;
      btnGenerateStoryCard.textContent = 'Gerando...';
      try {
        const catName = currentCandidate.category_name || categoryMap.get(currentCandidate.category_id) || 'Categoria Oficial';
        await downloadStoryCard({
          candidateName: currentCandidate.name,
          categoryName: catName,
          cityName: 'Bom Jardim – MG',
          year: '2026'
        });
        window.showToast('Card para Instagram Stories baixado com sucesso!', 'success');
      } catch (err) {
        console.error('Erro ao gerar card de Stories:', err);
        window.showToast('Não foi possível gerar a arte: ' + (err.message || err), 'error');
      } finally {
        btnGenerateStoryCard.disabled = false;
        btnGenerateStoryCard.textContent = 'Gerar Card';
      }
    });
  }
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

async function resolveCandidateForSession() {
  // 1. Tentar RPC oficial do candidato vinculado por profile_id
  const { data: rpcCandidates, error: rpcErr } = await supabase.rpc('get_my_candidate_profile');
  if (!rpcErr && Array.isArray(rpcCandidates) && rpcCandidates.length > 0) {
    return rpcCandidates[0];
  }

  // 2. Obter usuário autenticado e metadados
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata || {};

  // 3. Se o usuário tem instagram nos metadados (recém-confirmou o e-mail), tentar buscar o candidato
  if (meta.instagram) {
    const { data: byInsta } = await supabase
      .from('candidates')
      .select('*')
      .eq('instagram', meta.instagram)
      .order('created_at', { ascending: false })
      .limit(1);

    if (byInsta && byInsta.length > 0) {
      return byInsta[0];
    }
  }

  // 4. Verificar se o usuário logado é super_admin / admin (Modo Visualização Master)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && (profile.role === 'super_admin' || profile.role === 'admin')) {
    const { data: adminCandidates } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (adminCandidates && adminCandidates.length > 0) {
      return {
        ...adminCandidates[0],
        _isAdminPreview: true
      };
    }
  }

  return null;
}

// Inicializar painel após login de sucesso
async function initDashboard() {
  loginScreen.style.display = 'none';
  registerScreen.style.display = 'none';
  dashboardScreen.style.display = 'block';
  
  try {
    txtCandidateName.textContent = 'Carregando perfil...';
    
    const candidate = await resolveCandidateForSession();

    if (!candidate) {
      txtCandidateName.textContent = 'Perfil em Análise / Não Vinculado';
      txtEditionInfo.textContent = 'Sua conta está ativa! Caso tenha acabado de indicar sua empresa, aguarde a aprovação ou solicite o vínculo à administração.';
      profileUpdateForm.style.display = 'none';
      return;
    }

    currentCandidate = candidate;

    // 2. Preencher dados na interface
    txtCandidateName.textContent = candidate._isAdminPreview
      ? `${candidate.name} (Modo Admin)`
      : candidate.name;
    txtWhatsapp.textContent = candidate.whatsapp || 'N/A';
    txtEmail.textContent = candidate.email || 'N/A';
    inputInstagram.value = candidate.instagram || '';
    inputLogoUrl.value = candidate.logo_url || '';
    inputDescription.value = candidate.description || '';

    // Renderizar badge de status
    const statusText = candidate.status || 'aprovado';
    badgeStatus.textContent = statusText;
    badgeStatus.className = `status-badge status-${statusText.toLowerCase()}`;

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
