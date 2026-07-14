import { supabase, isUsingMock } from './supabaseClient.js';
import { OFFICIAL_CITY, findOfficialCity } from './siteConfig.js';

// --- CONFIGURAÇÃO E ESTADO GLOBAL ---
let state = {
  cookieId: '',
  selectedCityId: '',
  selectedElectionId: '',
  selectedCategoryId: '',
  selectedCandidateId: '', // Vazio se for indicação
  nominatedName: '',
  candidates: [],
  currentStep: 1,
  turnstileToken: '',
  turnstileWidgetId: null
};

function getPublicFunctionHeaders() {
  const apiKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers.apikey = apiKey;

    // As chaves anon antigas são JWTs. As novas sb_publishable_ não são e
    // devem ser enviadas somente como apikey para funções públicas.
    if (apiKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
  }

  return headers;
}

// Obter ou criar Cookie ID único para identificar o navegador
function getOrCreateCookieId() {
  let cookieId = localStorage.getItem('voter_cookie_id');
  if (!cookieId) {
    cookieId = crypto.randomUUID ? crypto.randomUUID() : 'c_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('voter_cookie_id', cookieId);
  }
  return cookieId;
}

// Inicializar
window.addEventListener('DOMContentLoaded', async () => {
  state.cookieId = getOrCreateCookieId();
  setupEventListeners();
  await loadCities();
  initTurnstile();
});

// --- FLUXO DE NAVEGAÇÃO ---
function goToStep(step) {
  state.currentStep = step;
  
  // Atualizar painéis
  document.querySelectorAll('.step-panel').forEach((panel, idx) => {
    if (idx + 1 === step) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Atualizar indicadores de etapa
  document.querySelectorAll('.step-dot').forEach((dot, idx) => {
    const dotStep = idx + 1;
    dot.className = 'step-dot';
    if (dotStep === step) {
      dot.classList.add('active');
    } else if (dotStep < step) {
      dot.classList.add('completed');
    }
  });
}

// --- ASSINATURA E SELEÇÃO DE ELEMENTOS ---
const selectCity = document.getElementById('selectCity');
const selectCategory = document.getElementById('selectCategory');
const btnGoToStep2 = document.getElementById('btnGoToStep2');
const btnGoToStep3 = document.getElementById('btnGoToStep3');
const btnSubmitVote = document.getElementById('btnSubmitVote');
const btnBackToStep2 = document.getElementById('btnBackToStep2');
const btnBackToStep1 = document.getElementById('btnBackToStep1');
const btnResetVoteFlow = document.getElementById('btnResetVoteFlow');
const candidatesList = document.getElementById('candidatesList');
const inputSearchCandidate = document.getElementById('inputSearchCandidate');
const searchFeedback = document.getElementById('searchFeedback');
const btnNominate = document.getElementById('btnNominate');
const selectedCandidateSummary = document.getElementById('selectedCandidateSummary');
const nominationFields = document.getElementById('nominationFields');

// Modal Elements
const nominationModal = document.getElementById('nominationModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnConfirmModal = document.getElementById('btnConfirmModal');
const modalNomName = document.getElementById('modalNomName');
const modalError = document.getElementById('modalError');
const voterName = document.getElementById('voterName');
const voterType = document.getElementById('voterType');
const voterIdentifier = document.getElementById('voterIdentifier');
const lblVoterIdentifier = document.getElementById('lblVoterIdentifier');
const privacyConsent = document.getElementById('privacyConsent');
const validationConsent = document.getElementById('validationConsent');
const btnCopyShareLink = document.getElementById('btnCopyShareLink');

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Mudança de cidade
  selectCity.addEventListener('change', async () => {
    state.selectedCityId = selectCity.value;
    selectCategory.innerHTML = '<option value="">Carregando categorias...</option>';
    selectCategory.disabled = true;
    btnGoToStep2.disabled = true;
    
    if (state.selectedCityId) {
      await loadCategoriesForCity(state.selectedCityId);
    } else {
      selectCategory.innerHTML = '<option value="">Aguardando a localidade oficial</option>';
    }
  });

  // Mudança de categoria
  selectCategory.addEventListener('change', () => {
    state.selectedCategoryId = selectCategory.value;
    btnGoToStep2.disabled = !state.selectedCategoryId;
  });

  // Avançar para Etapa 2
  btnGoToStep2.addEventListener('click', async () => {
    if (state.selectedCategoryId) {
      goToStep(2);
      await loadCandidates();
    }
  });

  // Filtro de Busca de Candidatos
  inputSearchCandidate.addEventListener('input', filterCandidates);

  // Funções do Modal de Indicação
  function openNominationModal() {
    if (modalNomName) modalNomName.value = '';
    if (modalError) modalError.style.display = 'none';
    if (modalNomName) modalNomName.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    if (nominationModal) nominationModal.classList.add('active');
    setTimeout(() => {
      if (modalNomName) modalNomName.focus();
    }, 100);
  }

  function closeNominationModal() {
    if (nominationModal) nominationModal.classList.remove('active');
  }

  // Botão de Indicação
  btnNominate.addEventListener('click', () => {
    let query = inputSearchCandidate.value.trim();
    if (!query) {
      openNominationModal();
    } else {
      state.selectedCandidateId = ''; // Sem ID, indica novo
      state.nominatedName = query;
      goToStep(3);
      showConfirmationScreen(true);
    }
  });

  // Ouvintes de Eventos do Modal
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeNominationModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeNominationModal);
  
  if (nominationModal) {
    nominationModal.addEventListener('click', (e) => {
      if (e.target === nominationModal) {
        closeNominationModal();
      }
    });
  }

  if (btnConfirmModal) {
    btnConfirmModal.addEventListener('click', () => {
      const name = modalNomName.value.trim();
      if (name.length < 2) {
        if (modalError) modalError.style.display = 'block';
        if (modalNomName) modalNomName.style.borderColor = '#ff5555';
        return;
      }
      if (modalError) modalError.style.display = 'none';
      if (modalNomName) modalNomName.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      closeNominationModal();
      
      state.selectedCandidateId = '';
      state.nominatedName = name;
      goToStep(3);
      showConfirmationScreen(true);
    });
  }

  if (modalNomName) {
    modalNomName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnConfirmModal) btnConfirmModal.click();
      }
    });

    modalNomName.addEventListener('input', () => {
      if (modalNomName.value.trim().length >= 2) {
        if (modalError) modalError.style.display = 'none';
        modalNomName.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nominationModal && nominationModal.classList.contains('active')) {
      closeNominationModal();
    }
  });

  // Atualizar nome da indicação em tempo real
  const nomNameEl = document.getElementById('nomName');
  if (nomNameEl) {
    nomNameEl.addEventListener('input', () => {
      state.nominatedName = nomNameEl.value.trim();
      const summaryNameEl = document.getElementById('nominationSummaryName');
      if (summaryNameEl) {
        summaryNameEl.textContent = state.nominatedName;
      }
      validateStep3Form();
    });
  }

  // Avançar para Etapa 3
  btnGoToStep3.addEventListener('click', () => {
    if (state.selectedCandidateId) {
      goToStep(3);
      showConfirmationScreen(false);
    }
  });

  // Alteração do tipo de contato
  voterType.addEventListener('change', () => {
    if (voterType.value === 'whatsapp') {
      lblVoterIdentifier.textContent = 'Seu Número de WhatsApp';
      voterIdentifier.placeholder = '(00) 00000-0000';
      voterIdentifier.type = 'text';
    } else {
      lblVoterIdentifier.textContent = 'Seu E-mail';
      voterIdentifier.placeholder = 'email@exemplo.com';
      voterIdentifier.type = 'email';
    }
    validateStep3Form();
  });

  // Validação em tempo real dos campos de contato e consentimento
  voterName.addEventListener('input', validateStep3Form);
  voterIdentifier.addEventListener('input', validateStep3Form);
  privacyConsent.addEventListener('change', validateStep3Form);
  validationConsent.addEventListener('change', validateStep3Form);

  // Voltar da Etapa 3 para a 2
  btnBackToStep2.addEventListener('click', () => {
    goToStep(2);
  });

  btnBackToStep1.addEventListener('click', () => {
    goToStep(1);
  });

  btnResetVoteFlow.addEventListener('click', resetVoteFlow);

  // Enviar Voto
  btnSubmitVote.addEventListener('click', submitVoteFlow);

  // Copiar link de compartilhamento
  btnCopyShareLink.addEventListener('click', () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url).then(() => {
      const btnText = btnCopyShareLink.querySelector('span');
      btnText.textContent = 'Copiado!';
      setTimeout(() => {
        btnText.textContent = 'Copiar Link de Votação';
      }, 2000);
    });
  });
}

// --- INTEGRAÇÃO COM SUPABASE E BACKEND ---

// Carregar cidades
async function loadCities() {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('name');
      
    if (error) throw error;
    
    const officialCity = findOfficialCity(data);
    if (!officialCity) {
      selectCity.innerHTML = `<option value="">${OFFICIAL_CITY.displayName} ainda não foi configurada</option>`;
      selectCity.disabled = true;
      selectCategory.innerHTML = '<option value="">Votação ainda não configurada</option>';
      return;
    }

    selectCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
    selectCity.value = officialCity.id;
    selectCity.disabled = true;
    state.selectedCityId = officialCity.id;
    await loadCategoriesForCity(officialCity.id);
  } catch (err) {
    console.error('Erro ao carregar a localidade oficial:', err);
    selectCity.innerHTML = `<option value="">Erro ao carregar ${OFFICIAL_CITY.displayName}</option>`;
  }
}

// Carregar categorias ativas baseadas na eleição aberta da cidade
async function loadCategoriesForCity(cityId) {
  try {
    // 1. Obter a eleição aberta desta cidade
    const { data: electionData, error: electionErr } = await supabase
      .from('elections')
      .select('id')
      .eq('city_id', cityId)
      .eq('status', 'aberta')
      .limit(1)
      .single();
      
    if (electionErr || !electionData) {
      selectCategory.innerHTML = `<option value="">Nenhuma votação aberta em ${OFFICIAL_CITY.displayName}</option>`;
      return;
    }
    
    state.selectedElectionId = electionData.id;

    // 2. Obter as categorias ativas desta eleição
    const { data: catData, error: catErr } = await supabase
      .from('city_categories')
      .select('category_id, categories(id, name)')
      .eq('election_id', state.selectedElectionId);

    if (catErr) throw catErr;

    selectCategory.innerHTML = '<option value="">Selecione uma Categoria</option>';
    catData.forEach(row => {
      if (row.categories) {
        const option = document.createElement('option');
        option.value = row.categories.id;
        option.textContent = row.categories.name;
        selectCategory.appendChild(option);
      }
    });
    
    selectCategory.disabled = false;
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
    selectCategory.innerHTML = '<option value="">Erro ao carregar categorias</option>';
  }
}

// Carregar candidatos para a categoria selecionada usando a VIEW pública
async function loadCandidates() {
  try {
    candidatesList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.4);">Carregando candidatos...</p>';
    btnGoToStep3.disabled = true;

    // Buscar da View Pública
    const { data, error } = await supabase
      .from('public_candidates')
      .select('*')
      .eq('election_id', state.selectedElectionId)
      .eq('category_id', state.selectedCategoryId);

    if (error) throw error;

    state.candidates = data || [];
    renderCandidates(state.candidates);
  } catch (err) {
    console.error('Erro ao carregar candidatos:', err);
    candidatesList.innerHTML = '<p style="text-align: center; color: #ff5555;">Erro ao carregar candidatos.</p>';
  }
}

// Renderizar candidatos no painel
function renderCandidates(list) {
  candidatesList.innerHTML = '';
  
  if (list.length === 0) {
    candidatesList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.4); padding: 12px 0;">Nenhum candidato pré-aprovado nesta categoria.</p>';
    searchFeedback.style.display = 'block';
    return;
  }

  searchFeedback.style.display = 'none';

  list.forEach(candidate => {
    const card = document.createElement('div');
    card.className = `candidate-card ${state.selectedCandidateId === candidate.id ? 'selected' : ''}`;
    card.dataset.id = candidate.id;
    
    // Fallback de Logo
    const logoUrl = safeImageUrl(candidate.logo_url);
    
    card.innerHTML = `
      <div class="candidate-logo" style="background-image: url('${logoUrl}')"></div>
      <div class="candidate-info">
        <div class="candidate-name">${escapeHtml(candidate.name)}</div>
        ${candidate.instagram ? `<div class="candidate-instagram">${escapeHtml(candidate.instagram)}</div>` : ''}
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedCandidateId = candidate.id;
      btnGoToStep3.disabled = false;
    });

    candidatesList.appendChild(card);
  });
}

// Normalização simples de strings para busca fuzzy no cliente
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeImageUrl(value) {
  const fallback = '/assets/images/logo-emporio-excelencia.webp';
  if (!value) return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'https:' || url.pathname.startsWith('/assets/')) {
      return url.href;
    }
  } catch (err) {
    if (String(value).startsWith('/assets/')) return value;
  }
  return fallback;
}

// Filtrar candidatos em tempo real
function filterCandidates() {
  const query = normalizeText(inputSearchCandidate.value);
  if (!query) {
    renderCandidates(state.candidates);
    return;
  }

  const filtered = state.candidates.filter(c => {
    const nameMatch = normalizeText(c.name).includes(query);
    const instaMatch = c.instagram ? normalizeText(c.instagram).includes(query) : false;
    return nameMatch || instaMatch;
  });

  renderCandidates(filtered);
  
  // Se não encontrar candidatos, exibe a opção de indicar
  if (filtered.length === 0) {
    searchFeedback.style.display = 'block';
  } else {
    searchFeedback.style.display = 'none';
  }
}

// Configurar a tela de confirmação (Etapa 3)
function showConfirmationScreen(isNomination) {
  if (isNomination) {
    nominationFields.style.display = 'block';
    selectedCandidateSummary.innerHTML = `
      <div>
        <div style="font-weight: 500; font-size: 0.8rem; text-transform: uppercase; color: #d4af37;">Sua Indicação:</div>
        <div style="font-size: 1.1rem; font-weight: 600;" id="nominationSummaryName">${escapeHtml(state.nominatedName)}</div>
      </div>
    `;
    const nomNameEl = document.getElementById('nomName');
    if (nomNameEl) {
      nomNameEl.value = state.nominatedName;
    }
  } else {
    nominationFields.style.display = 'none';
    const candidate = state.candidates.find(c => c.id === state.selectedCandidateId);
    const logoUrl = safeImageUrl(candidate && candidate.logo_url);
    selectedCandidateSummary.innerHTML = `
      <div class="candidate-logo" style="background-image: url('${logoUrl}'); width: 40px; height: 40px;"></div>
      <div>
        <div style="font-weight: 500; font-size: 0.8rem; text-transform: uppercase; color: rgba(255,255,255,0.4);">Candidato Selecionado:</div>
        <div style="font-size: 1.1rem; font-weight: 600;">${candidate ? escapeHtml(candidate.name) : ''}</div>
      </div>
    `;
  }
  validateStep3Form();
}

// Validar se os campos da etapa 3 estão corretos
function validateStep3Form() {
  const name = voterName.value.trim();
  const contact = voterIdentifier.value.trim();
  const hasPrivacy = privacyConsent.checked;
  const hasValidation = validationConsent.checked;
  const isTurnstileOk = !!state.turnstileToken;

  let isContactOk = false;
  if (voterType.value === 'whatsapp') {
    // Validar WhatsApp (apenas números, mínimo 10 dígitos)
    const cleanNumbers = contact.replace(/\D/g, '');
    isContactOk = cleanNumbers.length >= 10;
  } else {
    // Validar E-mail básico
    isContactOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  }

  // Se for indicação, valida se o nome do indicado foi preenchido com pelo menos 2 caracteres
  const isNomination = !state.selectedCandidateId;
  const nomNameEl = document.getElementById('nomName');
  const finalNomName = nomNameEl ? nomNameEl.value.trim() : state.nominatedName;
  const isNominationOk = !isNomination || (finalNomName && finalNomName.length >= 2);

  btnSubmitVote.disabled = !(name.length > 3 && isContactOk && hasPrivacy && hasValidation && isTurnstileOk && isNominationOk);
}

// Inicializar widget Cloudflare Turnstile


// Inicializar widget Cloudflare Turnstile
function initTurnstile() {
  const widget = document.getElementById('turnstileWidget');
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const isTestSiteKey = siteKey.startsWith('1x000000') || siteKey.includes('turnstile-real');

  if (!widget) return;
  if (!siteKey || (import.meta.env.PROD && isTestSiteKey)) {
    widget.textContent = 'Não foi possível carregar a validação anti-bot.';
    return;
  }

  if (!window.turnstile) {
    setTimeout(initTurnstile, 250);
    return;
  }

  if (state.turnstileWidgetId !== null) {
    return;
  }

  try {
    state.turnstileWidgetId = window.turnstile.render(widget, {
      sitekey: siteKey,
      action: 'voting',
      callback: (token) => {
        state.turnstileToken = token;
        validateStep3Form();
      },
      'expired-callback': () => {
        state.turnstileToken = '';
        validateStep3Form();
      },
      'error-callback': () => {
        state.turnstileToken = '';
        widget.textContent = 'Falha ao carregar a validação anti-bot. Recarregue a página e tente novamente.';
        validateStep3Form();
      }
    });
  } catch (err) {
    console.error('Erro ao inicializar Turnstile:', err);
    state.turnstileWidgetId = null;
    widget.textContent = 'Falha ao carregar a validação anti-bot. Recarregue a página e tente novamente.';
    validateStep3Form();
  }
}

// Enviar voto ou indicação para a Edge Function
async function submitVoteFlow() {
  btnSubmitVote.disabled = true;
  btnSubmitVote.textContent = 'Enviando voto...';

  if (isUsingMock) {
    console.log("🗳️ [MOCK] Simulando registro de voto/indicação offline.");
    setTimeout(() => {
      goToStep(4);
    }, 1000);
    return;
  }

  const isNomination = !state.selectedCandidateId;

  try {
    let targetCandidateId = state.selectedCandidateId;

    // 1. Se for uma indicação, cria a indicação no banco antes de computar o voto
    if (isNomination) {
      const nomTypeEl = document.getElementById('nomType');
      const nomInstagramEl = document.getElementById('nomInstagram');
      const nomNameEl = document.getElementById('nomName');
      const finalNominatedName = nomNameEl ? nomNameEl.value.trim() : state.nominatedName;

      if (!finalNominatedName) {
        showToast('Por favor, informe o nome do candidato a ser indicado.', 'error');
        btnSubmitVote.disabled = false;
        btnSubmitVote.textContent = 'Confirmar Meu Voto';
        return;
      }
      
      const nominateFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/nominate`;
      const nominationResponse = await fetch(nominateFunctionUrl, {
        method: 'POST',
        headers: getPublicFunctionHeaders(),
        body: JSON.stringify({
          election_id: state.selectedElectionId,
          category_id: state.selectedCategoryId,
          name: finalNominatedName,
          type: nomTypeEl.value,
          instagram: nomInstagramEl.value.trim() || null,
          voter_name: voterName.value.trim(),
          voter_identifier: voterIdentifier.value.trim(),
          voter_type: voterType.value,
          cookie_id: state.cookieId,
          privacy_consent: privacyConsent.checked,
          validation_consent: validationConsent.checked,
          turnstile_token: state.turnstileToken
        })
      });

      const nominationResult = await nominationResponse.json();

      if (!nominationResponse.ok) {
        throw new Error(nominationResult.error || 'Erro ao registrar indicação.');
      }
      
      // Mostrar tela de sucesso diretamente
      goToStep(4);
      return;
    }

    // 2. Se for voto em candidato aprovado, chamar a Edge Function
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vote`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: getPublicFunctionHeaders(),
      body: JSON.stringify({
        election_id: state.selectedElectionId,
        category_id: state.selectedCategoryId,
        candidate_id: targetCandidateId,
        voter_name: voterName.value.trim(),
        voter_identifier: voterIdentifier.value.trim(),
        voter_type: voterType.value,
        cookie_id: state.cookieId,
        privacy_consent: privacyConsent.checked,
        validation_consent: validationConsent.checked,
        turnstile_token: state.turnstileToken
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao registrar voto.');
    }

    // Sucesso
    goToStep(4);
  } catch (err) {
    console.error('Erro na votação:', err);
    showToast(err.message || 'Houve um erro ao registrar seu voto. Tente novamente.', 'error');
    btnSubmitVote.disabled = false;
    btnSubmitVote.textContent = 'Confirmar Meu Voto';
    if (window.turnstile && state.turnstileWidgetId !== null) {
      window.turnstile.reset(state.turnstileWidgetId);
      state.turnstileToken = '';
      validateStep3Form();
    }
  }
}

// Resetar o fluxo para votar em outra categoria
function resetVoteFlow() {
  state.selectedCandidateId = '';
  state.nominatedName = '';
  state.turnstileToken = '';
  
  // Limpar formulário de contato
  voterName.value = '';
  voterIdentifier.value = '';
  privacyConsent.checked = false;
  validationConsent.checked = false;

  if (window.turnstile && state.turnstileWidgetId !== null) {
    window.turnstile.reset(state.turnstileWidgetId);
  }

  // Voltar para categoria
  selectCategory.value = '';
  state.selectedCategoryId = '';
  btnGoToStep2.disabled = true;

  goToStep(1);
}
