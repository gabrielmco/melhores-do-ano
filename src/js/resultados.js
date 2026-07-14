import { supabase } from './supabaseClient.js';
import { OFFICIAL_CITY, findOfficialCity } from './siteConfig.js';

// Elements
const selectCity = document.getElementById('selectCity');
const selectElection = document.getElementById('selectElection');
const resultsList = document.getElementById('resultsList');
let statusMessage = document.getElementById('statusMessage');

// State
let state = {
  selectedCityId: '',
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

function safeInstagramUser(value) {
  return String(value || '').replace('@', '').replace(/[^a-zA-Z0-9._]/g, '');
}

window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadCities();
});

function setupEventListeners() {
  // Mudança de cidade
  selectCity.addEventListener('change', async () => {
    state.selectedCityId = selectCity.value;
    selectElection.innerHTML = '<option value="">Carregando edições...</option>';
    selectElection.disabled = true;
    clearResults();

    if (state.selectedCityId) {
      await loadElections(state.selectedCityId);
    } else {
      selectElection.innerHTML = '<option value="">Aguardando a localidade oficial</option>';
    }
  });

  // Mudança de eleição
  selectElection.addEventListener('change', async () => {
    state.selectedElectionId = selectElection.value;
    if (state.selectedElectionId) {
      await loadResults(state.selectedElectionId);
    } else {
      clearResults();
    }
  });
}

// Carregar Cidades
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
      return;
    }

    selectCity.innerHTML = `<option value="${officialCity.id}">${OFFICIAL_CITY.displayName}</option>`;
    selectCity.value = officialCity.id;
    selectCity.disabled = true;
    state.selectedCityId = officialCity.id;
    await loadElections(officialCity.id);
  } catch (err) {
    console.error('Erro ao buscar a localidade oficial:', err);
    selectCity.innerHTML = `<option value="">Erro ao carregar ${OFFICIAL_CITY.displayName}</option>`;
  }
}

// Carregar eleições publicadas da cidade
async function loadElections(cityId) {
  try {
    const { data, error } = await supabase
      .from('elections')
      .select('*')
      .eq('city_id', cityId)
      .eq('status', 'publicada')
      .order('year', { ascending: false });

    if (error) throw error;

    if (data.length === 0) {
      selectElection.innerHTML = `<option value="">Nenhuma edição publicada em ${OFFICIAL_CITY.displayName}</option>`;
      statusMessage.textContent = `Ainda não há resultados publicados para ${OFFICIAL_CITY.displayName}.`;
      statusMessage.style.display = 'block';
      return;
    }

    selectElection.innerHTML = '<option value="">Selecione a Edição</option>';
    data.forEach(election => {
      const option = document.createElement('option');
      option.value = election.id;
      option.textContent = `Melhores do Ano ${election.year}`;
      selectElection.appendChild(option);
    });

    selectElection.disabled = false;
    selectElection.value = data[0].id;
    state.selectedElectionId = data[0].id;
    await loadResults(data[0].id);
  } catch (err) {
    console.error('Erro ao buscar edições:', err);
    selectElection.innerHTML = '<option value="">Erro ao carregar edições</option>';
  }
}

// Limpar tela de resultados
function clearResults() {
  resultsList.innerHTML = `<div class="status-msg" id="statusMessage">Selecione a edição de ${OFFICIAL_CITY.displayName} para conferir os resultados.</div>`;
  statusMessage = document.getElementById('statusMessage');
}

// Carregar e agrupar resultados da eleição selecionada
async function loadResults(electionId) {
  try {
    resultsList.innerHTML = '<div class="status-msg">Buscando resultados oficiais...</div>';

    // Obter dados da View Pública de Vencedores com join da Categoria
    const { data, error } = await supabase
      .from('public_winners')
      .select('*, category:categories(name)')
      .eq('election_id', electionId)
      .order('category_id')
      .order('position');

    if (error) throw error;

    if (!data || data.length === 0) {
      resultsList.innerHTML = '<div class="status-msg">Resultados não consolidados para esta edição.</div>';
      return;
    }

    // Agrupar resultados por categoria
    const grouped = {};
    data.forEach(row => {
      const categoryId = row.category_id;
      const categoryName = row.category ? row.category.name : 'Categoria Geral';
      
      if (!grouped[categoryId]) {
        grouped[categoryId] = {
          name: categoryName,
          items: []
        };
      }
      grouped[categoryId].items.push(row);
    });

    // Renderizar grupos
    resultsList.innerHTML = '';
    
    Object.keys(grouped).forEach(catId => {
      const group = grouped[catId];
      const section = document.createElement('div');
      section.className = 'category-results-group';

      // Título da Categoria
      section.innerHTML = `<h2 class="category-title"><span>${escapeHtml(group.name)}</span></h2>`;

      const grid = document.createElement('div');
      grid.className = 'winners-grid';

      // Separar Vencedor (1ª Posição) e Finalistas (Demais)
      const winner = group.items.find(i => i.position === 1);
      const finalists = group.items.filter(i => i.position > 1);

      // Renderizar Card do Vencedor (Destaque principal esquerdo)
      if (winner) {
        const logoUrl = safeImageUrl(winner.candidate_logo);
        const instagramUser = safeInstagramUser(winner.candidate_instagram);
        const winnerHtml = `
          <div class="winner-card">
            <div class="avatar" style="background-image: url('${logoUrl}')"></div>
            <div class="info">
              <div class="name">${escapeHtml(winner.candidate_name)}</div>
              ${winner.candidate_instagram ? `
                <div class="instagram">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <a href="https://instagram.com/${instagramUser}" target="_blank" rel="noopener noreferrer">${escapeHtml(winner.candidate_instagram)}</a>
                </div>
              ` : ''}
              <div class="votes-badge">Consagrado em 1º Lugar com ${winner.vote_count_snapshot} votos válidos</div>
            </div>
          </div>
        `;
        
        const winnerWrapper = document.createElement('div');
        winnerWrapper.innerHTML = winnerHtml;
        grid.appendChild(winnerWrapper.firstElementChild);
      }

      // Renderizar coluna de Finalistas (Direita)
      const finalistsColumn = document.createElement('div');
      finalistsColumn.style.display = 'flex';
      finalistsColumn.style.display = 'flex';
      finalistsColumn.style.flexDirection = 'column';
      finalistsColumn.style.gap = '16px';

      finalists.forEach(finalist => {
        const logoUrl = safeImageUrl(finalist.candidate_logo);
        const instagramUser = safeInstagramUser(finalist.candidate_instagram);
        const finalistHtml = `
          <div class="finalist-card">
            <div class="avatar" style="background-image: url('${logoUrl}')"></div>
            <div class="info">
              <div class="name" style="font-size: 1.05rem;">${escapeHtml(finalist.candidate_name)}</div>
              ${finalist.candidate_instagram ? `
                <div class="instagram" style="font-size: 0.8rem;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <a href="https://instagram.com/${instagramUser}" target="_blank" rel="noopener noreferrer">${escapeHtml(finalist.candidate_instagram)}</a>
                </div>
              ` : ''}
              <div class="votes-badge" style="font-size: 0.75rem;">Finalizou em ${finalist.position}º Lugar (${finalist.vote_count_snapshot} votos)</div>
            </div>
          </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = finalistHtml;
        finalistsColumn.appendChild(div.firstElementChild);
      });

      if (finalists.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'finalist-card';
        placeholder.style.opacity = '0.5';
        placeholder.style.borderStyle = 'dashed';
        placeholder.innerHTML = `
          <div class="info" style="text-align: center; color: rgba(255,255,255,0.4);">
            Edição sem outros finalistas cadastrados nesta categoria.
          </div>
        `;
        finalistsColumn.appendChild(placeholder);
      }

      grid.appendChild(finalistsColumn);
      section.appendChild(grid);
      resultsList.appendChild(section);
    });
  } catch (err) {
    console.error('Erro ao carregar resultados:', err);
    resultsList.innerHTML = '<div class="status-msg" style="color: #ff5555;">Erro ao obter resultados da apuração no banco.</div>';
  }
}
