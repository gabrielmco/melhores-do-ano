import { supabase } from './supabaseClient.js';
import { translateAuthError, setupPasswordToggle } from './modules/authHelpers.js';

const form = document.getElementById('passwordForm');
const input = document.getElementById('newPassword');
const confirmInput = document.getElementById('confirmPassword');
const btnSave = document.getElementById('btnSavePassword');
const msg = document.getElementById('statusMessage');

// Inicializar alternadores de visibilidade ("Ver" / "Ocultar" + Ícone de Olho)
setupPasswordToggle('btnToggleNewPassword', 'newPassword');
setupPasswordToggle('btnToggleConfirmPassword', 'confirmPassword');

function showMsg(text, type) {
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!form) return;

  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
      form.style.display = 'block';
      if (msg) msg.style.display = 'none';
    }
  });

  const { data: { session } } = await supabase.auth.getSession();
  const hasRecoveryParams = window.location.hash.includes('access_token') || window.location.search.includes('code=');

  if (!session && !hasRecoveryParams) {
    showMsg('Nenhuma sessão de recuperação ativa encontrada. Caso o link tenha expirado, solicite um novo link clicando em "Esqueci minha senha" na tela de login.', 'error');
    form.style.display = 'none';
  }
});

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) msg.style.display = 'none';
    
    const newPassword = input.value.trim();
    const confirmPassword = confirmInput ? confirmInput.value.trim() : newPassword;

    if (newPassword.length < 6) {
      showMsg('A senha precisa ter no mínimo 6 caracteres.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMsg('As senhas digitadas não conferem. Digite a mesma senha nos dois campos.', 'error');
      return;
    }

    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showMsg(translateAuthError(error), 'error');
      } else {
        showMsg('Nova senha salva com sucesso! Utilize um dos links abaixo para acessar seu painel.', 'success');
        input.value = '';
        if (confirmInput) confirmInput.value = '';
        form.style.display = 'none';
      }
    } catch (err) {
      showMsg('Erro ao atualizar a senha: ' + translateAuthError(err), 'error');
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Salvar Nova Senha';
      }
    }
  });
}
