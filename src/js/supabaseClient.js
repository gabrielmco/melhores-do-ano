import { createClient } from '@supabase/supabase-js';
import { OFFICIAL_CITY } from './siteConfig.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const supabaseUrl = String(env.VITE_SUPABASE_URL || 'https://xjgkjkmxuhbhkdhaxxey.supabase.co').trim();
const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZ2tqa214dWhiaGtkaGF4eGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDMyNTQsImV4cCI6MjEwNjg3OTI1NH0.LK61XYNcY5PEKt7kQmXGzenSoUFz763-B3tAqqTUHDA').trim();

export const isUsingMock = false;

// Inicialização exclusiva em modo produção com cliente real do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// --- GLOBAL TOAST SYSTEM FOR DASHBOARDS ---
if (typeof window !== 'undefined') {
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
}

