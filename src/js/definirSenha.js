import { supabase } from './supabaseClient.js';

const form = document.getElementById('passwordForm');
const input = document.getElementById('newPassword');
const msg = document.getElementById('statusMessage');

function showMsg(text, type) {
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!form) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showMsg('Atenção: Nenhuma sessão de autenticação ativa encontrada. O link que você usou pode ter expirado. Por favor, envie um novo e-mail de recuperação de senha pelo painel do Supabase.', 'error');
    form.style.display = 'none';
  }
});

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msg) msg.style.display = 'none';
    
    const newPassword = input.value.trim();
    if (newPassword.length < 6) {
      showMsg('A senha precisa ter no mínimo 6 caracteres.', 'error');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showMsg(error.message, 'error');
      } else {
        showMsg('Senha salva com sucesso! Você pode fechar esta página e entrar no painel (/admin.html).', 'success');
        input.value = '';
        form.style.display = 'none';
      }
    } catch (err) {
      showMsg('Erro ao atualizar a senha: ' + err.message, 'error');
    }
  });
}
