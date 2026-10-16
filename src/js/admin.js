/* ============================================================================
   PROJETOS MELHORES DO ANO - ORQUESTRADOR CENTRAL DO PAINEL ADMIN
   Ponto de entrada enxuto que integra autenticação, moderação, mesclagem,
   funil CRM, edições de eleição, logs de auditoria e estrutura.
   ============================================================================ */

import { supabase } from './supabaseClient.js';
import {
  initStaffDashboard,
  setupAuthListeners,
  showLogin
} from './admin/auth.js';
import { loadNominations } from './admin/moderation.js';
import { initMergeTab, setupMergeListeners } from './admin/merge.js';
import { initCrmTab, setupCrmListeners } from './admin/crm.js';
import {
  loadElections,
  loadEventPhase,
  setupElectionsListeners
} from './admin/elections.js';
import { loadLogsAndAudits, setupLogsListeners } from './admin/logs.js';
import {
  loadStructureSubTabData,
  loadCategoriesForElectionSelect,
  setupStructureListeners
} from './admin/structure.js';

// Estado de Navegação
let currentTab = 'tab-moderacao';
let currentSubTab = 'subtab-cidades';

export function switchTab(tabId) {
  currentTab = tabId;

  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // 1. Atualizar botões laterais
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 2. Mostrar painel correspondente
  tabPanels.forEach(panel => {
    if (panel.id === tabId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // 3. Sincronizar botões do alternador rápido (Admin Geral ⇄ CRM Vendas)
  const btnQuickModeAdmin = document.getElementById('btnQuickModeAdmin');
  const btnQuickModeCrm = document.getElementById('btnQuickModeCrm');
  if (btnQuickModeAdmin && btnQuickModeCrm) {
    if (tabId === 'tab-crm') {
      btnQuickModeCrm.className = 'btn btn-primary';
      btnQuickModeAdmin.className = 'btn btn-secondary';
    } else {
      btnQuickModeAdmin.className = 'btn btn-primary';
      btnQuickModeCrm.className = 'btn btn-secondary';
    }
  }

  // 4. Acionar carregador de dados da aba correspondente
  if (tabId === 'tab-moderacao') loadNominations();
  if (tabId === 'tab-mesclagem') initMergeTab();
  if (tabId === 'tab-crm') initCrmTab();
  if (tabId === 'tab-eleicoes') loadElections();
  if (tabId === 'tab-estrutura') loadStructureSubTabData(currentSubTab);
  if (tabId === 'tab-logs') loadLogsAndAudits();
}

function setupGlobalNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      if (targetTab) switchTab(targetTab);
    });
  });

  const btnQuickModeAdmin = document.getElementById('btnQuickModeAdmin');
  const btnQuickModeCrm = document.getElementById('btnQuickModeCrm');

  if (btnQuickModeAdmin) {
    btnQuickModeAdmin.addEventListener('click', () => switchTab('tab-moderacao'));
  }
  if (btnQuickModeCrm) {
    btnQuickModeCrm.addEventListener('click', () => switchTab('tab-crm'));
  }

  // Navegação de Sub-abas da Estrutura
  const subTabBtns = document.querySelectorAll('.sub-tab-btn');
  const subTabPanels = document.querySelectorAll('.sub-tab-panel');
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      subTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetSub = btn.getAttribute('data-subtab');
      if (!targetSub) return;
      currentSubTab = targetSub;

      subTabPanels.forEach(p => {
        p.style.display = p.id === targetSub ? 'block' : 'none';
      });

      loadStructureSubTabData(targetSub);
    });
  });
}

// Inicialização Principal do Aplicativo
window.addEventListener('DOMContentLoaded', async () => {
  setupGlobalNavigation();
  setupAuthListeners({ switchTab, onPhaseLoad: loadEventPhase });
  setupMergeListeners();
  setupCrmListeners();
  setupElectionsListeners(loadCategoriesForElectionSelect);
  setupStructureListeners();
  setupLogsListeners();

  // Verificar se já possui sessão ativa ao carregar
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await initStaffDashboard({ switchTab, onPhaseLoad: loadEventPhase });
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    if (hash && document.getElementById(hash)) {
      switchTab(hash);
    }
  } else {
    showLogin();
  }
});
