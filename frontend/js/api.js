// api.js — comunicação com a API do AgendaFácil
const API_BASE = 'http://localhost:3000/api';

const Sessao = {
  salvar(token, usuario) {
    localStorage.setItem('af_token', token);
    localStorage.setItem('af_usuario', JSON.stringify(usuario));
  },
  token() { return localStorage.getItem('af_token'); },
  usuario() {
    const raw = localStorage.getItem('af_usuario');
    return raw ? JSON.parse(raw) : null;
  },
  limpar() {
    localStorage.removeItem('af_token');
    localStorage.removeItem('af_usuario');
  },
  exigirLogin(tipoEsperado) {
    const u = this.usuario();
    if (!u || !this.token()) { window.location.href = 'index.html'; return null; }
    if (tipoEsperado && u.tipo !== tipoEsperado) {
      window.location.href = u.tipo === 'cliente' ? 'cliente.html' : 'prestador.html';
      return null;
    }
    return u;
  }
};

async function api(caminho, opcoes = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opcoes.headers || {}) };
  if (Sessao.token()) headers['Authorization'] = `Bearer ${Sessao.token()}`;

  const resp = await fetch(`${API_BASE}${caminho}`, { ...opcoes, headers });
  let corpo = null;
  try { corpo = await resp.json(); } catch { /* sem corpo */ }

  if (!resp.ok) {
    throw new Error((corpo && corpo.erro) || 'Erro ao comunicar com o servidor.');
  }
  return corpo;
}
