import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const enableMocks = import.meta.env.VITE_ENABLE_MOCKS === 'true';

const hasValidSupabaseConfig = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('sua-url-aqui') &&
  !supabaseAnonKey.includes('sua-anon-key-aqui') &&
  !supabaseUrl.includes('gtdrnjxjcwfmekgfvjek') // bypass the dead Supabase URL
);

let useMock = enableMocks || !hasValidSupabaseConfig;

let supabaseInstance;

if (useMock) {
  console.warn('⚠️ [SISTEMA] Inicializando em MODO MOCK/OFFLINE. Nenhuma conexão real com o Supabase será feita.');
  
  // Banco de dados fictício em memória para simulação
  const mockDatabase = {
    cities: [
      { id: '11111111-1111-1111-1111-111111111111', name: 'São Paulo' },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Rio de Janeiro' }
    ],
    categories: [
      { id: '33333333-3333-3333-3333-333333333331', name: 'Melhor Restaurante' },
      { id: '33333333-3333-3333-3333-333333333332', name: 'Melhor Confeitaria' },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Melhor Pizzaria' }
    ],
    elections: [
      { id: 'e_sp_2026', city_id: '11111111-1111-1111-1111-111111111111', year: 2026, status: 'aberta', start_date: '2026-01-01', end_date: '2026-12-31' },
      { id: 'e_rj_2026', city_id: '22222222-2222-2222-2222-222222222222', year: 2026, status: 'aberta', start_date: '2026-01-01', end_date: '2026-12-31' }
    ],
    city_categories: [
      { election_id: 'e_sp_2026', category_id: '33333333-3333-3333-3333-333333333331' },
      { election_id: 'e_sp_2026', category_id: '33333333-3333-3333-3333-333333333332' },
      { election_id: 'e_rj_2026', category_id: '33333333-3333-3333-3333-333333333331' },
      { election_id: 'e_rj_2026', category_id: '33333333-3333-3333-3333-333333333333' }
    ],
    candidates: [
      { 
        id: 'cand_sabor_imperial', 
        election_id: 'e_sp_2026', 
        category_id: '33333333-3333-3333-3333-333333333331', 
        name: 'Restaurante Sabor Imperial', 
        type: 'empresa', 
        instagram: 'saborimperial', 
        whatsapp: '11999999991', 
        email: 'contato@saborimperial.com.br', 
        status: 'aprovado', 
        commercial_status: 'chamou no WhatsApp', 
        commercial_package: 'kit_premium',
        commercial_owner_id: 'mock-comercial-id',
        commercial_owner_name: 'Comercial Teste',
        profile_id: 'mock-candidate-id',
        description: 'Melhor restaurante tradicional da cidade.',
        logo_url: '/assets/images/default-logo.webp'
      },
      { 
        id: 'cand_doce_encanto', 
        election_id: 'e_sp_2026', 
        category_id: '33333333-3333-3333-3333-333333333332', 
        name: 'Doce Encanto Confeitaria', 
        type: 'empresa', 
        instagram: 'doceencanto', 
        whatsapp: '11999999993', 
        email: 'contato@doceencanto.com.br', 
        status: 'aprovado', 
        commercial_status: 'não contatado', 
        commercial_package: 'nao_definido',
        profile_id: null,
        description: 'Bolos e doces finos para festas e eventos.',
        logo_url: null
      }
    ],
    nominations: [
      {
        id: 'nom_pizzaria_mock',
        election_id: 'e_sp_2026',
        category_id: '33333333-3333-3333-3333-333333333333',
        name: 'Pizzaria Bella Italia',
        type: 'empresa',
        instagram: 'bellaitalia',
        whatsapp: '11977777777',
        email: 'contato@bellaitalia.com.br',
        voter_name: 'Gabriel',
        status: 'pendente',
        created_at: new Date().toISOString()
      }
    ],
    profiles: {
      'mock-admin-id': { id: 'mock-admin-id', name: 'Admin Teste', role: 'super_admin' },
      'mock-comercial-id': { id: 'mock-comercial-id', name: 'Comercial Teste', role: 'comercial' },
      'mock-candidate-id': { id: 'mock-candidate-id', name: 'Candidato Teste 1', role: 'candidato' }
    },
    admin_action_logs: [],
    winners: []
  };

  const mockProfiles = {
    'admin@teste.com': { name: 'Admin Teste', role: 'super_admin', id: 'mock-admin-id' },
    'comercial@teste.com': { name: 'Comercial Teste', role: 'comercial', id: 'mock-comercial-id' },
    'candidato@teste.com': { name: 'Candidato Teste 1', role: 'candidato', id: 'mock-candidate-id' }
  };

  let currentSession = null;
  let authCallbacks = [];

  class MockQueryBuilder {
    constructor(data, error = null) {
      this._data = data;
      this._error = error;
    }
    select(fields = '*') {
      // Basic support for join emulation if queries cities(name) or similar
      if (Array.isArray(this._data)) {
        this._data = this._data.map(item => {
          const newItem = { ...item };
          // Emulate join with cities for elections table
          if (newItem.city_id && !newItem.cities) {
            const city = mockDatabase.cities.find(c => c.id === newItem.city_id);
            if (city) newItem.cities = { name: city.name };
          }
          // Emulate join with categories for city_categories
          if (newItem.category_id && !newItem.categories) {
            const cat = mockDatabase.categories.find(c => c.id === newItem.category_id);
            if (cat) newItem.categories = { id: cat.id, name: cat.name };
          }
          return newItem;
        });
      }
      return this;
    }
    eq(field, value) {
      if (this._error) return this;
      if (Array.isArray(this._data)) {
        this._data = this._data.filter(item => {
          if (field.includes('.')) return true; // generic match bypass for complex fields
          return item[field] === value;
        });
      }
      return this;
    }
    neq(field, value) {
      if (this._error) return this;
      if (Array.isArray(this._data)) {
        this._data = this._data.filter(item => item[field] !== value);
      }
      return this;
    }
    order(field, { ascending = true } = {}) {
      if (Array.isArray(this._data)) {
        this._data.sort((a, b) => {
          if (a[field] < b[field]) return ascending ? -1 : 1;
          if (a[field] > b[field]) return ascending ? 1 : -1;
          return 0;
        });
      }
      return this;
    }
    limit(n) {
      if (Array.isArray(this._data)) {
        this._data = this._data.slice(0, n);
      }
      return this;
    }
    single() {
      if (Array.isArray(this._data)) {
        this._data = this._data[0] || null;
      }
      return this;
    }
    then(onfulfilled, onrejected) {
      return Promise.resolve({ data: this._data, error: this._error }).then(onfulfilled, onrejected);
    }
  }

  supabaseInstance = {
    auth: {
      async getSession() {
        return { data: { session: currentSession }, error: null };
      },
      async getUser() {
        return { data: { user: currentSession ? currentSession.user : null }, error: null };
      },
      onAuthStateChange(callback) {
        authCallbacks.push(callback);
        setTimeout(() => {
          callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authCallbacks = authCallbacks.filter(c => c !== callback);
              }
            }
          }
        };
      },
      async signInWithPassword({ email, password }) {
        if (password === '123456') {
          const profile = mockProfiles[email] || { name: 'Candidato Teste', role: 'candidato', id: 'mock-candidate-id' };
          currentSession = {
            access_token: 'mock-token-session',
            user: {
              id: profile.id,
              email: email,
              user_metadata: {}
            }
          };
          authCallbacks.forEach(cb => cb('SIGNED_IN', currentSession));
          return { data: { session: currentSession, user: currentSession.user }, error: null };
        } else {
          return { data: { session: null, user: null }, error: new Error('Credenciais de teste inválidas. Use a senha "123456" com e-mails definidos (admin@teste.com, comercial@teste.com ou candidato@teste.com).') };
        }
      },
      async signOut() {
        currentSession = null;
        authCallbacks.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      }
    },
    
    from(table) {
      let actualTable = table;
      if (table === 'public_candidates') actualTable = 'candidates';
      if (table === 'public_winners') actualTable = 'winners';
      const data = mockDatabase[actualTable] || [];
      const cloned = JSON.parse(JSON.stringify(data));
      return new MockQueryBuilder(cloned);
    },

    rpc(name, params = {}) {
      console.log(`[MOCK RPC] Chamando RPC "${name}" com parâmetros:`, params);
      let data = null;
      let error = null;

      try {
        switch (name) {
          case 'get_my_candidate_profile': {
            const userId = currentSession ? currentSession.user.id : null;
            data = mockDatabase.candidates.filter(c => c.profile_id === userId);
            break;
          }
          case 'update_candidate_profile': {
            const { p_candidate_id, p_instagram, p_whatsapp, p_email, p_logo_url, p_description } = params;
            const cand = mockDatabase.candidates.find(c => c.id === p_candidate_id);
            if (cand) {
              if (p_instagram !== undefined) cand.instagram = p_instagram;
              if (p_whatsapp !== undefined) cand.whatsapp = p_whatsapp;
              if (p_email !== undefined) cand.email = p_email;
              if (p_logo_url !== undefined) cand.logo_url = p_logo_url;
              if (p_description !== undefined) cand.description = p_description;
            }
            data = true;
            break;
          }
          case 'get_crm_candidates_v2': {
            data = mockDatabase.candidates.map(c => {
              const cat = mockDatabase.categories.find(cat => cat.id === c.category_id);
              return {
                id: c.id,
                name: c.name,
                category_name: cat ? cat.name : 'N/A',
                whatsapp: c.whatsapp,
                email: c.email,
                commercial_status: c.commercial_status,
                commercial_package: c.commercial_package,
                commercial_next_action: c.commercial_next_action || '',
                commercial_follow_up_date: c.commercial_follow_up_date || null,
                commercial_value_estimate: c.commercial_value_estimate || 0,
                commercial_owner_name: c.commercial_owner_name || 'Sem responsável'
              };
            });
            break;
          }
          case 'update_candidate_commercial_status_v2': {
            const { p_candidate_id, p_commercial_status, p_commercial_notes, p_commercial_package, p_commercial_next_action, p_commercial_follow_up_date, p_commercial_value_estimate } = params;
            const cand = mockDatabase.candidates.find(c => c.id === p_candidate_id);
            if (cand) {
              if (p_commercial_status !== undefined) cand.commercial_status = p_commercial_status;
              if (p_commercial_notes !== undefined) cand.commercial_notes = p_commercial_notes;
              if (p_commercial_package !== undefined) cand.commercial_package = p_commercial_package;
              if (p_commercial_next_action !== undefined) cand.commercial_next_action = p_commercial_next_action;
              if (p_commercial_follow_up_date !== undefined) cand.commercial_follow_up_date = p_commercial_follow_up_date;
              if (p_commercial_value_estimate !== undefined) cand.commercial_value_estimate = p_commercial_value_estimate;
            }
            data = true;
            break;
          }
          case 'approve_nomination': {
            const { p_nomination_id } = params;
            const nom = mockDatabase.nominations.find(n => n.id === p_nomination_id);
            if (nom) {
              nom.status = 'aprovado';
              // Criar candidato a partir da indicação
              const newCand = {
                id: `cand_${Date.now()}`,
                election_id: nom.election_id,
                category_id: nom.category_id,
                name: nom.name,
                type: nom.type,
                instagram: nom.instagram,
                whatsapp: nom.whatsapp || 'N/A',
                email: nom.email || 'N/A',
                status: 'aprovado',
                commercial_status: 'não contatado',
                commercial_package: 'nao_definido',
                profile_id: null,
                description: 'Candidato indicado pelo público.'
              };
              mockDatabase.candidates.push(newCand);
              nom.candidate_id = newCand.id;
            }
            data = true;
            break;
          }
          case 'reject_nomination': {
            const { p_nomination_id } = params;
            const nom = mockDatabase.nominations.find(n => n.id === p_nomination_id);
            if (nom) nom.status = 'rejeitado';
            data = true;
            break;
          }
          case 'merge_candidates': {
            const { p_target_candidate_id, p_duplicate_candidate_id } = params;
            const target = mockDatabase.candidates.find(c => c.id === p_target_candidate_id);
            const duplicate = mockDatabase.candidates.find(c => c.id === p_duplicate_candidate_id);
            if (target && duplicate) {
              duplicate.status = 'mesclado';
              duplicate.merged_into_candidate_id = target.id;
            }
            data = true;
            break;
          }
          case 'close_election': {
            const { p_election_id } = params;
            const elect = mockDatabase.elections.find(e => e.id === p_election_id);
            if (elect) elect.status = 'encerrada';
            data = true;
            break;
          }
          case 'publish_results': {
            const { p_election_id } = params;
            const elect = mockDatabase.elections.find(e => e.id === p_election_id);
            if (elect) {
              elect.status = 'publicada';
              // Gerar alguns vencedores fictícios
              mockDatabase.candidates.forEach((cand, idx) => {
                if (cand.election_id === p_election_id) {
                  mockDatabase.winners.push({
                    id: `win_${idx}_${Date.now()}`,
                    election_id: p_election_id,
                    category_id: cand.category_id,
                    candidate_id: cand.id,
                    vote_count_snapshot: 150 - idx * 20,
                    position: idx === 0 ? 1 : 2,
                    is_public: true,
                    published_at: new Date().toISOString(),
                    candidates: {
                      name: cand.name,
                      instagram: cand.instagram,
                      logo_url: cand.logo_url
                    }
                  });
                }
              });
            }
            data = true;
            break;
          }
          case 'admin_create_city': {
            const { p_name } = params;
            const newCity = { id: `city_${Date.now()}`, name: p_name };
            mockDatabase.cities.push(newCity);
            data = true;
            break;
          }
          case 'admin_delete_city': {
            const { p_city_id } = params;
            mockDatabase.cities = mockDatabase.cities.filter(c => c.id !== p_city_id);
            data = true;
            break;
          }
          case 'admin_create_category': {
            const { p_name } = params;
            const newCat = { id: `cat_${Date.now()}`, name: p_name };
            mockDatabase.categories.push(newCat);
            data = true;
            break;
          }
          case 'admin_delete_category': {
            const { p_category_id } = params;
            mockDatabase.categories = mockDatabase.categories.filter(c => c.id !== p_category_id);
            data = true;
            break;
          }
          case 'admin_create_election': {
            const { p_city_id, p_year, p_start_date, p_end_date } = params;
            const newElect = {
              id: `elect_${Date.now()}`,
              city_id: p_city_id,
              year: parseInt(p_year),
              status: 'rascunho',
              start_date: p_start_date,
              end_date: p_end_date
            };
            mockDatabase.elections.push(newElect);
            data = true;
            break;
          }
          case 'admin_save_election_categories': {
            const { p_election_id, p_category_ids } = params;
            mockDatabase.city_categories = mockDatabase.city_categories.filter(cc => cc.election_id !== p_election_id);
            p_category_ids.forEach(catId => {
              mockDatabase.city_categories.push({
                election_id: p_election_id,
                category_id: catId
              });
            });
            data = true;
            break;
          }
          case 'admin_upsert_candidate': {
            const { p_id, p_election_id, p_category_id, p_name, p_type, p_instagram, p_whatsapp, p_email, p_logo_url, p_description } = params;
            if (p_id) {
              const cand = mockDatabase.candidates.find(c => c.id === p_id);
              if (cand) {
                cand.name = p_name;
                cand.type = p_type;
                cand.instagram = p_instagram;
                cand.whatsapp = p_whatsapp;
                cand.email = p_email;
                cand.logo_url = p_logo_url;
                cand.description = p_description;
              }
            } else {
              mockDatabase.candidates.push({
                id: `cand_${Date.now()}`,
                election_id: p_election_id,
                category_id: p_category_id,
                name: p_name,
                type: p_type,
                instagram: p_instagram,
                whatsapp: p_whatsapp,
                email: p_email,
                logo_url: p_logo_url,
                description: p_description,
                status: 'aprovado',
                commercial_status: 'não contatado',
                commercial_package: 'nao_definido'
              });
            }
            data = true;
            break;
          }
          case 'admin_archive_candidate': {
            const { p_candidate_id } = params;
            const cand = mockDatabase.candidates.find(c => c.id === p_candidate_id);
            if (cand) cand.status = 'mesclado';
            data = true;
            break;
          }
          default:
            console.warn(`RPC "${name}" não implementada no mock. Retornando padrão.`);
            data = true;
        }
      } catch (err) {
        error = err;
      }

      return Promise.resolve({ data, error });
    }
  };
} else {
  // Inicialização real do Supabase
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export const supabase = supabaseInstance;

// --- GLOBAL TOAST SYSTEM FOR DASHBOARDS ---
window.showToast = function (message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.setAttribute('aria-hidden', 'true');

  const messageEl = document.createElement('div');
  messageEl.style.flex = '1';
  messageEl.style.lineHeight = '1.4';
  messageEl.style.fontWeight = '500';
  messageEl.textContent = String(message || '');

  toast.append(iconEl, messageEl);
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('active'), 50);

  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 450);
  }, 4000);
};

window.showConfirm = function ({
  eyebrow = 'Confirmacao',
  title = 'Confirmar acao',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'primary'
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.setAttribute('role', 'presentation');

    const card = document.createElement('div');
    card.className = 'dialog-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'dialogTitle');
    card.setAttribute('aria-describedby', 'dialogMessage');

    const eyebrowEl = document.createElement('p');
    eyebrowEl.className = 'dialog-eyebrow';
    eyebrowEl.textContent = eyebrow;

    const titleEl = document.createElement('h2');
    titleEl.className = 'dialog-title';
    titleEl.id = 'dialogTitle';
    titleEl.textContent = title;

    const messageEl = document.createElement('p');
    messageEl.className = 'dialog-message';
    messageEl.id = 'dialogMessage';
    messageEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'dialog-button dialog-button-secondary';
    cancelButton.textContent = cancelText;

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = `dialog-button dialog-button-${variant === 'danger' ? 'danger' : 'primary'}`;
    confirmButton.textContent = confirmText;

    actions.append(cancelButton, confirmButton);
    card.append(eyebrowEl, titleEl, messageEl, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.classList.remove('active');
      document.removeEventListener('keydown', onKeyDown);
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 260);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter') close(true);
    };

    cancelButton.addEventListener('click', () => close(false));
    confirmButton.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeyDown);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      confirmButton.focus();
    });
  });
};
