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
  selectedElectionId: '',
  elections: [] // Armazena as edições carregadas
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

// Carregar eleições da cidade (abertas ou publicadas)
async function loadElections(cityId) {
  try {
    const { data, error } = await supabase
      .from('elections')
      .select('*')
      .eq('city_id', cityId)
      .in('status', ['aberta', 'publicada'])
      .order('year', { ascending: false });

    if (error) throw error;

    if (data.length === 0) {
      selectElection.innerHTML = `<option value="">Nenhuma edição ativa em ${OFFICIAL_CITY.displayName}</option>`;
      statusMessage.textContent = `Ainda não há edições de votação configuradas para ${OFFICIAL_CITY.displayName}.`;
      statusMessage.style.display = 'block';
      return;
    }

    state.elections = data; // guardar no estado

    selectElection.innerHTML = '<option value="">Selecione a Edição</option>';
    data.forEach(election => {
      const option = document.createElement('option');
      option.value = election.id;
      const label = election.status === 'aberta' ? ' (Votação em Andamento)' : ' (Encerrada - Oficial)';
      option.textContent = `Melhores do Ano ${election.year}${label}`;
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

// Carregar e agrupar resultados da eleição selecionada (pode ser apuração ou final)
async function loadResults(electionId) {
  const currentElection = state.elections.find(e => e.id === electionId);
  if (!currentElection) return;

  try {
    if (currentElection.status === 'publicada') {
      // -------------------------------------------------------------
      // EXIBIÇÃO DE RESULTADOS FINAIS OFICIAIS (ELEIÇÃO FECHADA)
      // -------------------------------------------------------------
      resultsList.innerHTML = '<div class="status-msg">Buscando resultados oficiais...</div>';

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

      const grouped = {};
      data.forEach(row => {
        const categoryId = row.category_id;
        const categoryName = row.category ? row.category.name : 'Categoria Geral';
        
        if (!grouped[categoryId]) {
          grouped[categoryId] = { name: categoryName, items: [] };
        }
        grouped[categoryId].items.push(row);
      });

      resultsList.innerHTML = '';
      
      Object.keys(grouped).forEach(catId => {
        const group = grouped[catId];
        const section = document.createElement('div');
        section.className = 'category-results-group';
        section.innerHTML = `<h2 class="category-title"><span>${escapeHtml(group.name)}</span></h2>`;

        const grid = document.createElement('div');
        grid.className = 'winners-grid';

        const winner = group.items.find(i => i.position === 1);
        const finalists = group.items.filter(i => i.position > 1);

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

        const finalistsColumn = document.createElement('div');
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

    } else {
      // -------------------------------------------------------------
      // APURAÇÃO EM TEMPO REAL OU PERÍODO DE REGISTROS (ELEIÇÃO ABERTA)
      // -------------------------------------------------------------
      resultsList.innerHTML = '<div class="status-msg">Carregando dados da apuração em tempo real...</div>';

      // 1. Obter a fase do evento
      const { data: configData, error: configErr } = await supabase
        .from('event_config')
        .select('value')
        .eq('key', 'current_phase')
        .single();

      const currentPhase = (!configErr && configData) ? configData.value : 'voting';

      // 2. Obter candidatos confirmados (com status aprovado)
      // Nota: Consultamos via .from('candidates') onde election_id = electionId e status = 'aprovado'
      const { data: candidates, error: candErr } = await supabase
        .from('candidates')
        .select('*, category:categories(name)')
        .eq('election_id', electionId)
        .eq('status', 'aprovado')
        .order('name');

      if (candErr) throw candErr;

      if (!candidates || candidates.length === 0) {
        resultsList.innerHTML = '<div class="status-msg">Ainda não há candidatos confirmados para esta edição.</div>';
        return;
      }

      // 3. Se for a fase de VOTAÇÃO, buscar a contagem agregada de votos da view segura
      let votesMap = {};
      if (currentPhase === 'voting') {
        const { data: voteSummaries, error: votesErr } = await supabase
          .from('candidate_votes_summary')
          .select('*')
          .eq('election_id', electionId);

        if (!votesErr && voteSummaries) {
          voteSummaries.forEach(row => {
            votesMap[row.candidate_id] = row.vote_count;
          });
        }
      }

      // 4. Agrupar e estruturar candidatos por categoria
      const grouped = {};
      candidates.forEach(cand => {
        const categoryId = cand.category_id;
        const categoryName = cand.category ? cand.category.name : 'Categoria Geral';
        const candidateVotes = votesMap[cand.id] || 0;

        if (!grouped[categoryId]) {
          grouped[categoryId] = {
            name: categoryName,
            candidates: [],
            totalVotes: 0
          };
        }

        grouped[categoryId].candidates.push({
          ...cand,
          votes: candidateVotes
        });
        grouped[categoryId].totalVotes += candidateVotes;
      });

      resultsList.innerHTML = '';

      // Título informativo de acordo com a fase do evento
      const infoBanner = document.createElement('div');
      infoBanner.style.background = 'rgba(212, 175, 55, 0.08)';
      infoBanner.style.border = '1px solid rgba(212, 175, 55, 0.2)';
      infoBanner.style.borderRadius = '8px';
      infoBanner.style.padding = '18px';
      infoBanner.style.marginBottom = '32px';
      infoBanner.style.fontSize = '0.92rem';
      infoBanner.style.lineHeight = '1.6';
      infoBanner.style.color = '#f5d788';

      if (currentPhase === 'registration') {
        infoBanner.innerHTML = `
          <strong>Fase de Cadastros e Indicações Ativa:</strong> 
          Nesta primeira fase, as empresas e concorrentes estão registrando seus perfis. A votação oficial ainda não começou, 
          portanto a contagem de votos está suspensa. Veja abaixo quem já está confirmado para esta edição!
        `;
      } else {
        infoBanner.innerHTML = `
          🔥 <strong>Apuração em Tempo Real:</strong> A votação oficial do Melhores do Ano está aberta! 
          Os resultados abaixo são atualizados dinamicamente a cada voto computado. Participe divulgando o site e ajude o seu favorito a liderar!
        `;
      }
      resultsList.appendChild(infoBanner);

      // Renderizar as categorias e candidatos
      Object.keys(grouped).forEach(catId => {
        const group = grouped[catId];
        const section = document.createElement('div');
        section.className = 'category-results-group';
        section.innerHTML = `<h2 class="category-title"><span>${escapeHtml(group.name)}</span></h2>`;

        const listContainer = document.createElement('div');
        listContainer.style.background = 'rgba(255, 255, 255, 0.02)';
        listContainer.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        listContainer.style.borderRadius = '12px';
        listContainer.style.padding = '24px';
        listContainer.style.display = 'flex';
        listContainer.style.flexDirection = 'column';
        listContainer.style.gap = '20px';

        // Ordenar candidatos:
        // Na fase de cadastro: ordem alfabética (nome)
        // Na fase de votação: quantidade de votos decrescente
        if (currentPhase === 'voting') {
          group.candidates.sort((a, b) => b.votes - a.votes);
        } else {
          group.candidates.sort((a, b) => a.name.localeCompare(b.name));
        }

        group.candidates.forEach(cand => {
          const logoUrl = safeImageUrl(cand.logo_url);
          const instagramUser = safeInstagramUser(cand.instagram);
          
          let percentage = 0;
          if (group.totalVotes > 0) {
            percentage = Math.round((cand.votes / group.totalVotes) * 100);
          }

          const rowHtml = `
            <div style="display: flex; align-items: center; gap: 16px;">
              <div class="avatar" style="background-image: url('${logoUrl}'); width: 48px; height: 48px;"></div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.95rem;">
                  <span style="font-weight: 600;">
                    ${escapeHtml(cand.name)} 
                    ${cand.instagram ? `<a href="https://instagram.com/${instagramUser}" target="_blank" rel="noopener noreferrer" style="color: rgba(255,255,255,0.4); text-decoration: none; font-size: 0.8rem; margin-left: 6px;">${escapeHtml(cand.instagram)}</a>` : ''}
                  </span>
                  ${currentPhase === 'voting' ? `
                    <span style="color: #d4af37; font-weight: 700;">${percentage}% (${cand.votes} votos)</span>
                  ` : `
                    <span style="color: rgba(255,255,255,0.4); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Confirmado</span>
                  `}
                </div>
                ${currentPhase === 'voting' ? `
                  <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #f5d788 0%, #d4af37 100%); border-radius: 4px; transition: width 0.8s ease-out;"></div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
          const rowDiv = document.createElement('div');
          rowDiv.innerHTML = rowHtml;
          listContainer.appendChild(rowDiv);
        });

        section.appendChild(listContainer);
        resultsList.appendChild(section);
      });
    }

  } catch (err) {
    console.error('Erro ao carregar apuração:', err);
    resultsList.innerHTML = '<div class="status-msg" style="color: #ff5555;">Erro ao obter dados da apuração no banco.</div>';
  }
}
