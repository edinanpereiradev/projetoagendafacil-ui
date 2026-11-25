// http.js — instância base do Axios com as configurações compartilhadas (UI-10)
// Todas as chamadas à API passam por aqui, pelas camadas de serviço (js/services/).

// Erro padronizado da API: { erro, campo? } vira ErroApi com message, status e campo.
class ErroApi extends Error {
  constructor(mensagem, { status = 0, campo = null } = {}) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.campo = campo; // nome do campo inválido, quando a API informa
  }
}

const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// Anexa o token JWT em toda requisição
http.interceptors.request.use((config) => {
  const token = Sessao.token();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Traduz qualquer falha (4xx, 5xx, rede, timeout) em um ErroApi com mensagem pronta para o usuário
http.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const resposta = erro.response;
    let erroApi;

    if (resposta) {
      const corpo = resposta.data || {};
      erroApi = new ErroApi(corpo.erro || 'Erro inesperado no servidor.', {
        status: resposta.status,
        campo: corpo.campo || null
      });
      // Sessão expirada: volta para o login (login e cadastro devolvem 401/409 normalmente)
      const ehAuth = String((erro.config && erro.config.url) || '').startsWith('/auth/');
      if (resposta.status === 401 && !ehAuth && Sessao.token()) {
        Sessao.limpar();
        window.location.href = 'index.html';
      }
    } else if (erro.code === 'ECONNABORTED') {
      erroApi = new ErroApi('A requisição demorou demais. Tente novamente.');
    } else {
      erroApi = new ErroApi('Não foi possível conectar ao servidor. Verifique se a API está no ar.');
    }
    return Promise.reject(erroApi);
  }
);

// Os serviços devolvem só o corpo da resposta
const corpo = (resposta) => resposta.data;
