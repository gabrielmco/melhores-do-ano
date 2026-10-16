/* ============================================================================
   PROJETOS MELHORES DO ANO - NAVEGAÇÃO SEGURA E INTELIGENTE DE RETORNO
   Garante retorno à seção/aba anterior do usuário sem jogá-lo na hero do topo.
   ============================================================================ */

function recordCurrentSection() {
  try {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html' || path === '') {
      const hash = window.location.hash;
      if (hash && hash !== '#' && hash !== '#top') {
        sessionStorage.setItem('mda_last_section', hash);
      }
    }
  } catch (err) {
    // Silently ignore storage exceptions
  }
}

export function handleSafeBack(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  let referrer;
  try {
    referrer = document.referrer ? new URL(document.referrer) : null;
  } catch {
    referrer = null;
  }

  // Se houver histórico anterior no mesmo domínio e não for a mesma página:
  if (referrer?.origin === window.location.origin && referrer.pathname !== window.location.pathname && window.history.length > 1) {
    window.history.back();
    return;
  }

  // Caso contrário, verificar se há uma seção salva ou fallback inteligente para #categorias
  let lastSection = '#categorias';
  try {
    lastSection = sessionStorage.getItem('mda_last_section') || '#categorias';
  } catch {
    lastSection = '#categorias';
  }

  window.location.href = `/${lastSection.replace(/^#*/, '#')}`;
}

export function setupSafeBackNavigation() {
  recordCurrentSection();

  // Rastrear âncoras na página principal
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html' || path === '') {
    window.addEventListener('hashchange', recordCurrentSection);
    
    // Observar cliques em links com âncoras
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', () => {
        const hash = anchor.getAttribute('href');
        if (hash && hash.length > 1) {
          try {
            sessionStorage.setItem('mda_last_section', hash);
          } catch {}
        }
      });
    });
  }

  // Anexar aos botões de voltar
  document.querySelectorAll('[data-safe-back], .btn-back-floating, .btn-back-clean, .btn-back').forEach((btn) => {
    // Não sobrescrever botões de wizards internos com type="button" que controlam steps
    if (btn.classList.contains('btn-back') && btn.id && (btn.id.includes('Step') || btn.id.includes('Modal'))) {
      return;
    }

    btn.addEventListener('click', (e) => {
      handleSafeBack(e);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSafeBackNavigation, { once: true });
} else {
  setupSafeBackNavigation();
}
