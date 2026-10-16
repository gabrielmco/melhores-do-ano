// ============================================================================
// PROJETOS MELHORES DO ANO - UTILITÁRIOS DE AUTENTICAÇÃO E RECUPERAÇÃO DE SENHA
// Tradução humanizada de erros do Supabase Auth, Cooldown Anti-Rate-Limit (60s)
// e Fluxo Universal de "Esqueci Minha Senha" -> /definir-senha.html
// ============================================================================

const cooldownMap = new Map();

export function translateAuthError(err) {
  const raw = String(err?.message || err?.error_description || err || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return 'Não foi possível concluir a operação. Tente novamente.';
  }

  // Rate limit de 50-60 segundos do Supabase GoTrue
  const secMatch = raw.match(/after\s+(\d+)\s+seconds/i);
  if (secMatch || lower.includes('for security purposes') || lower.includes('only request this after')) {
    const secs = secMatch ? secMatch[1] : '50';
    return `Por segurança, já enviamos uma solicitação para este e-mail há poucos instantes. Aguarde ${secs} segundos antes de tentar novamente ou verifique sua caixa de entrada (e Spam).`;
  }

  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send_rate_limit')) {
    return 'Limite de envios temporariamente atingido por segurança. Verifique sua caixa de entrada (e Spam) ou aguarde alguns instantes.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Verifique os dados informados ou clique em "Esqueci minha senha".';
  }

  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado! Acesse sua caixa de entrada (ou pasta de Spam) e clique no link de confirmação que enviamos.';
  }

  if (lower.includes('token has expired') || lower.includes('token is expired')) {
    return 'O link ou código de confirmação expirou. Solicite um novo e-mail pelo botão de reenvio abaixo.';
  }

  if (lower.includes('invalid token') || lower.includes('otp expired') || lower.includes('invalid otp') || lower.includes('token not found')) {
    return 'Código de confirmação incorreto ou expirado. Verifique os 6 dígitos do e-mail mais recente.';
  }

  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Este e-mail já possui uma conta cadastrada! Faça login na tela de entrada ou clique em "Esqueci minha senha".';
  }

  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return 'A senha escolhida é muito curta. Digite uma senha com no mínimo 6 caracteres.';
  }

  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'O formato do e-mail informado é inválido. Digite um e-mail válido (ex: contato@empresa.com.br).';
  }

  if (lower.includes('row-level security') || lower.includes('violates row-level security')) {
    return 'Sua conta foi criada no sistema! Confirme seu e-mail na caixa de entrada (ou faça login) para liberar o vínculo completo do perfil.';
  }

  return raw;
}

export function isEmailInCooldown(email, cooldownMs = 55000) {
  if (!email) return 0;
  const key = email.trim().toLowerCase();
  const lastAt = cooldownMap.get(key) || 0;
  const elapsed = Date.now() - lastAt;
  if (elapsed < cooldownMs) {
    return Math.ceil((cooldownMs - elapsed) / 1000);
  }
  return 0;
}

export function markEmailCooldown(email) {
  if (!email) return;
  cooldownMap.set(email.trim().toLowerCase(), Date.now());
}

export function setupForgotPasswordButton({
  buttonId,
  emailInputId,
  supabase
}) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById(buttonId);
  const emailInput = document.getElementById(emailInputId);
  if (!btn || !emailInput || !supabase) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();

    if (!email || !email.includes('@')) {
      emailInput.focus();
      if (typeof window.showToast === 'function') {
        window.showToast('Digite seu e-mail no campo acima primeiro e depois clique em "Esqueci minha senha".', 'warning');
      }
      return;
    }

    const waitSecs = isEmailInCooldown(email);
    if (waitSecs > 0) {
      if (typeof window.showToast === 'function') {
        window.showToast(`Já enviamos o link para ${email}. Aguarde ${waitSecs}s ou verifique sua caixa de entrada e Spam.`, 'info');
      }
      return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando link...';

    try {
      const redirectTo = `${window.location.origin}/definir-senha.html`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) throw error;

      markEmailCooldown(email);
      if (typeof window.showToast === 'function') {
        window.showToast(`Link de redefinição enviado para ${email}! Verifique sua caixa de entrada e a pasta de Spam.`, 'success');
      }

      let remaining = 55;
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.textContent = originalText;
        } else {
          btn.textContent = `Reenviar em ${remaining}s`;
        }
      }, 1000);
    } catch (err) {
      console.error('Erro ao solicitar recuperação de senha:', err);
      btn.disabled = false;
      btn.textContent = originalText;
      if (typeof window.showToast === 'function') {
        window.showToast(translateAuthError(err), 'error');
      }
    }
  });
}

export const EYE_OPEN_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

export const EYE_OFF_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

/**
 * Vincula um botão de alternância de visibilidade de senha a um campo de input.
 * Altera visualmente o botão (ícone de olho aberto/cortado e texto 'Ver'/'Ocultar')
 * e alterna o tipo do input entre 'password' e 'text'.
 */
export function setupPasswordToggle(buttonOrId, inputOrId) {
  if (typeof document === 'undefined') return;
  const btn = typeof buttonOrId === 'string' ? document.getElementById(buttonOrId) : buttonOrId;
  const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;

  if (!btn || !input) return;

  const updateUI = (isVisible) => {
    btn.setAttribute('aria-label', isVisible ? 'Ocultar senha' : 'Ver senha');
    btn.setAttribute('title', isVisible ? 'Ocultar senha' : 'Ver senha');
    btn.innerHTML = `${isVisible ? EYE_OFF_SVG : EYE_OPEN_SVG}<span>${isVisible ? 'Ocultar' : 'Ver'}</span>`;
    if (isVisible) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  };

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    updateUI(!isVisible);
    try {
      input.focus({ preventScroll: true });
      const len = input.value.length;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(len, len);
      }
    } catch (_) {}
  });

  // Garante estado inicial consistente
  updateUI(input.type === 'text');
}

/**
 * Inicializa automaticamente todos os botões com atributo [data-toggle-password]
 */
export function autoInitPasswordToggles() {
  if (typeof document === 'undefined') return;
  const buttons = document.querySelectorAll('[data-toggle-password]');
  buttons.forEach(btn => {
    const targetId = btn.getAttribute('data-toggle-password');
    if (targetId) {
      setupPasswordToggle(btn, targetId);
    }
  });
}
