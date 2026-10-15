// ============================================================================
// PROJETOS MELHORES DO ANO - MONITOR GLOBAL DE CONECTIVIDADE DE REDE
// Notificações instantâneas de perda e restabelecimento de internet
// ============================================================================

let isOnline = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true;
let offlineToastEl = null;

export function initNetworkMonitor({
  onOnline = null,
  onOffline = null
} = {}) {
  if (typeof window === 'undefined') return;

  window.addEventListener('offline', () => {
    isOnline = false;
    showOfflineBanner();
    if (typeof onOffline === 'function') onOffline();
  });

  window.addEventListener('online', () => {
    isOnline = true;
    hideOfflineBanner();
    if (typeof window.showToast === 'function') {
      window.showToast('Conexão restabelecida com a internet!', 'success');
    }
    if (typeof onOnline === 'function') onOnline();
  });
}

export function checkIsOnline() {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return Boolean(isOnline);
}

function showOfflineBanner() {
  if (typeof document === 'undefined') return;
  if (!offlineToastEl) {
    offlineToastEl = document.createElement('div');
    offlineToastEl.id = 'networkOfflineBanner';
    offlineToastEl.style.position = 'fixed';
    offlineToastEl.style.top = '0';
    offlineToastEl.style.left = '0';
    offlineToastEl.style.right = '0';
    offlineToastEl.style.background = '#e74c3c';
    offlineToastEl.style.color = '#ffffff';
    offlineToastEl.style.textAlign = 'center';
    offlineToastEl.style.padding = '8px 16px';
    offlineToastEl.style.fontSize = '0.85rem';
    offlineToastEl.style.fontWeight = '600';
    offlineToastEl.style.zIndex = '99999';
    offlineToastEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
    offlineToastEl.innerHTML = '⚠️ Você está sem conexão com a internet. Aguardando sinal para continuar...';
    document.body.appendChild(offlineToastEl);
  } else {
    offlineToastEl.style.display = 'block';
  }
}

function hideOfflineBanner() {
  if (offlineToastEl) {
    offlineToastEl.style.display = 'none';
  }
}
