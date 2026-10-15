// ============================================================================
// PROJETOS MELHORES DO ANO - MÓDULO DE ENGAJAMENTO & COMPROVANTE DO ELEITOR
// Progresso por categorias, contagem regressiva e certificado auditável.
// ============================================================================

export function getVoterStorageKey(electionId) {
  return `voted_categories_${electionId || 'bjd_2026'}`;
}

export function getVotedCategories(electionId) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getVoterStorageKey(electionId)) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveVotedCategory(electionId, categoryInfo) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const list = getVotedCategories(electionId);
    const existingIndex = list.findIndex(c => c.categoryId === categoryInfo.categoryId);
    const entry = {
      ...categoryInfo,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry };
    } else {
      list.push(entry);
    }

    localStorage.setItem(getVoterStorageKey(electionId), JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Erro ao salvar categoria votada localmente:', e);
    return [];
  }
}

export function generateAuthHash(seed) {
  const str = String(seed || 'melhores_do_ano_2026_bom_jardim');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const clean = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(-6);
  return `BJD-2026-${clean}`;
}

export function updateVoterProgressUI({
  categoriesList = [],
  selectedCategoryId = '',
  electionId = '',
  onSelectCategory = null
}) {
  const votedList = getVotedCategories(electionId);
  const votedIds = new Set(votedList.map(v => v.categoryId));
  const total = categoriesList ? categoriesList.length : 0;
  const votedCount = votedList.length;
  const percent = total > 0 ? Math.min(100, Math.round((votedCount / total) * 100)) : 0;

  if (typeof document === 'undefined') {
    return { percent, votedCount, total };
  }

  const card = document.getElementById('voterProgressCard');
  const percentEl = document.getElementById('voterProgressPercent');
  const fillEl = document.getElementById('voterProgressFill');
  const textEl = document.getElementById('voterProgressText');
  const chipsList = document.getElementById('categoryChipsList');

  if (!card || !categoriesList || categoriesList.length === 0) {
    if (card) card.style.display = 'none';
    return { percent, votedCount, total };
  }

  card.style.display = 'block';
  if (percentEl) percentEl.textContent = `${percent}%`;
  if (fillEl) fillEl.style.width = `${percent}%`;
  if (textEl) {
    textEl.textContent = `Você votou em ${votedCount} de ${total} categoria${total > 1 ? 's' : ''}`;
  }

  if (chipsList) {
    chipsList.innerHTML = '';
    categoriesList.forEach(cat => {
      const isVoted = votedIds.has(cat.id);
      const isSelected = cat.id === selectedCategoryId;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `category-chip ${isVoted ? 'voted' : ''} ${isSelected ? 'active' : ''}`;
      chip.innerHTML = `${isVoted ? '✓ ' : ''}${cat.name}`;
      chip.title = isVoted ? 'Você já votou nesta categoria (clique para alterar voto)' : 'Categoria ainda pendente de voto';

      chip.addEventListener('click', () => {
        if (typeof onSelectCategory === 'function') {
          onSelectCategory(cat);
        }
      });

      chipsList.appendChild(chip);
    });
  }

  return { percent, votedCount, total };
}

let countdownTimerInterval = null;

export function initCountdownTimer(endDateStr) {
  if (typeof document === 'undefined') return null;

  const banner = document.getElementById('electionCountdownBanner');
  const daysEl = document.getElementById('countDays');
  const hoursEl = document.getElementById('countHours');
  const minsEl = document.getElementById('countMins');
  const secsEl = document.getElementById('countSecs');

  if (!banner) return null;

  // Data limite oficial (ou fallback de dezembro de 2026)
  const targetDate = endDateStr ? new Date(endDateStr) : new Date('2026-12-31T23:59:59');

  if (countdownTimerInterval) {
    clearInterval(countdownTimerInterval);
  }

  function tick() {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance <= 0) {
      if (countdownTimerInterval) clearInterval(countdownTimerInterval);
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(minutes).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(seconds).padStart(2, '0');
  }

  tick();
  countdownTimerInterval = setInterval(tick, 1000);
  return countdownTimerInterval;
}

export function openReceiptModal({
  electionId = '',
  voterName = 'Eleitor Oficial',
  voterMasked = '***',
  sessionToken = ''
}) {
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('receiptModal');
  const nameEl = document.getElementById('receiptVoterName');
  const maskedEl = document.getElementById('receiptVoterMasked');
  const dateEl = document.getElementById('receiptDateTime');
  const hashEl = document.getElementById('receiptAuthHash');
  const listEl = document.getElementById('receiptVotedList');

  const votedList = getVotedCategories(electionId);
  const now = new Date();
  const authHash = generateAuthHash(sessionToken || voterName + voterMasked);

  if (nameEl) nameEl.textContent = voterName;
  if (maskedEl) maskedEl.textContent = voterMasked;
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (hashEl) hashEl.textContent = authHash;

  if (listEl) {
    listEl.innerHTML = '';
    if (votedList.length === 0) {
      listEl.innerHTML = '<div style="color: rgba(255,255,255,0.4); text-align: center; padding: 12px; font-size: 0.85rem;">Nenhum voto registrado ainda.</div>';
    } else {
      votedList.forEach(v => {
        const item = document.createElement('div');
        item.className = 'receipt-item';
        item.innerHTML = `
          <span class="item-cat">${v.categoryName || 'Categoria'}</span>
          <span class="item-cand">${v.candidateName || 'Candidato'}</span>
        `;
        listEl.appendChild(item);
      });
    }
  }

  if (modal) modal.classList.add('active');
}

export function closeReceiptModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('active');
}

export function getShareMessage(electionId) {
  const votedList = getVotedCategories(electionId);
  const count = votedList.length;
  const baseUrl = 'https://melhores-do-ano-chi.vercel.app/votar.html';

  let msg = `🏆 *Melhores do Ano 2026 – Bom Jardim/MG*\n\n`;
  msg += `Acabei de registrar meu voto auditado nas empresas e profissionais de destaque da nossa cidade!`;
  if (count > 0) {
    msg += ` Já votei em *${count} categoria${count > 1 ? 's' : ''}*.\n\n`;
  } else {
    msg += `\n\n`;
  }
  msg += `Participe você também e apoie a excelência local:\n👉 ${baseUrl}`;
  return msg;
}

export function shareOnWhatsApp(electionId) {
  if (typeof window === 'undefined') return;
  const msg = getShareMessage(electionId);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

export function copyReceiptText(electionId, voterName, authHash) {
  const votedList = getVotedCategories(electionId);
  let text = `========================================\n`;
  text += `COMPROVANTE OFICIAL DE VOTO AUDITADO\n`;
  text += `MELHORES DO ANO 2026 - BOM JARDIM / MG\n`;
  text += `========================================\n`;
  text += `Eleitor: ${voterName || 'Participante'}\n`;
  text += `Autenticidade: ${authHash || 'BJD-2026-OFICIAL'}\n`;
  text += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
  text += `----------------------------------------\n`;
  text += `Votos Computados (${votedList.length}):\n`;
  votedList.forEach(v => {
    text += `• ${v.categoryName}: ${v.candidateName}\n`;
  });
  text += `----------------------------------------\n`;
  text += `Validação: https://melhores-do-ano-chi.vercel.app/votar.html\n`;
  text += `========================================\n`;
  return text;
}
