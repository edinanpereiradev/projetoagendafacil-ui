// Testa a instância base do Axios, as camadas de serviço e o ciclo de vida da requisição
// sem navegador e sem rede: scripts rodam em um contexto isolado com um Axios falso.
// Uso: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.join(__dirname, '..');
const SCRIPTS = [
  'js/api.js', 'js/http.js',
  'js/services/authService.js', 'js/services/prestadorService.js', 'js/services/servicoService.js',
  'js/services/disponibilidadeService.js', 'js/services/agendamentoService.js',
  'js/services/notificacaoService.js', 'js/services/dashboardService.js',
  'js/ui.js'
];

function criarAmbiente({ token = null } = {}) {
  const chamadas = [];
  const armazenamento = new Map(token ? [['af_token', token], ['af_usuario', '{"id":1}']] : []);
  const fake = { config: null, onRequest: null, onResponseErro: null };
  const registrar = (metodo) => (url, ...resto) => {
    chamadas.push({ metodo, url, resto });
    return Promise.resolve({ data: { ok: true } });
  };
  const contexto = vm.createContext({
    window: { location: { hostname: 'localhost', href: '' } },
    localStorage: {
      getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null),
      setItem: (k, v) => armazenamento.set(k, v),
      removeItem: (k) => armazenamento.delete(k)
    },
    axios: {
      create: (config) => {
        fake.config = config;
        return {
          get: registrar('get'), post: registrar('post'), put: registrar('put'), delete: registrar('delete'),
          interceptors: {
            request: { use: (fn) => { fake.onRequest = fn; } },
            response: { use: (ok, erro) => { fake.onResponseErro = erro; } }
          }
        };
      }
    },
    console,
    setTimeout
  });
  for (const arquivo of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8'), contexto, { filename: arquivo });
  }
  const obter = (expr) => vm.runInContext(expr, contexto);
  return { chamadas, fake, obter, contexto, armazenamento };
}

test('instância base usa a URL local e timeout configurado', () => {
  const { fake } = criarAmbiente();
  assert.equal(fake.config.baseURL, 'http://localhost:3000/api');
  assert.equal(fake.config.timeout, 15000);
});

test('interceptor de requisição anexa o token Bearer quando há sessão', () => {
  const comToken = criarAmbiente({ token: 'abc123' });
  assert.equal(comToken.fake.onRequest({ headers: {} }).headers.Authorization, 'Bearer abc123');
  const semToken = criarAmbiente();
  assert.equal(semToken.fake.onRequest({ headers: {} }).headers.Authorization, undefined);
});

test('erro 4xx da API vira ErroApi com mensagem, status e campo', async () => {
  const { fake } = criarAmbiente();
  await assert.rejects(
    () => fake.onResponseErro({ response: { status: 409, data: { erro: 'Este e-mail já está cadastrado.', campo: 'email' } }, config: { url: '/auth/registrar' } }),
    (erro) => erro.name === 'ErroApi' && erro.message === 'Este e-mail já está cadastrado.' && erro.status === 409 && erro.campo === 'email'
  );
});

test('falha de rede e timeout têm mensagens próprias', async () => {
  const { fake } = criarAmbiente();
  await assert.rejects(() => fake.onResponseErro({ config: {} }), /conectar ao servidor/);
  await assert.rejects(() => fake.onResponseErro({ code: 'ECONNABORTED', config: {} }), /demorou demais/);
});

test('401 fora do login limpa a sessão e volta ao index; no login não redireciona', async () => {
  const sessaoExpirada = criarAmbiente({ token: 'velho' });
  await assert.rejects(() => sessaoExpirada.fake.onResponseErro({ response: { status: 401, data: { erro: 'Sessão expirada.' } }, config: { url: '/agendamentos/meus' } }));
  assert.equal(sessaoExpirada.armazenamento.has('af_token'), false);
  assert.equal(sessaoExpirada.obter('window.location.href'), 'index.html');

  const loginErrado = criarAmbiente({ token: 'qualquer' });
  await assert.rejects(() => loginErrado.fake.onResponseErro({ response: { status: 401, data: { erro: 'E-mail ou senha inválidos.' } }, config: { url: '/auth/login' } }));
  assert.equal(loginErrado.obter('window.location.href'), '');
});

test('cada serviço chama o endpoint e o método corretos', async () => {
  const { chamadas, obter } = criarAmbiente();
  await obter("AuthService.login({ email: 'a@b.com', senha: '123456' })");
  await obter("AuthService.registrar({ nome: 'A' })");
  await obter('PrestadorService.listar()');
  await obter('PrestadorService.servicos(7)');
  await obter("ServicoService.criar({ nome: 'Corte' })");
  await obter('ServicoService.remover(3)');
  await obter('DisponibilidadeService.listar(7)');
  await obter("DisponibilidadeService.criar({ diaSemana: 1 })");
  await obter('DisponibilidadeService.remover(4)');
  await obter("AgendamentoService.horariosDisponiveis({ idPrestador: 7, idServico: 2, data: '2026-10-12' })");
  await obter("AgendamentoService.criar({ idPrestador: 7 })");
  await obter('AgendamentoService.meus()');
  await obter('AgendamentoService.cancelar(9)');
  await obter("AgendamentoService.remarcar(9, { data: '2026-10-13', hora: '10:00', extra: 'ignorado' })");
  await obter("AgendamentoService.atualizarStatus(9, 'concluido')");
  await obter('NotificacaoService.listar()');
  await obter('DashboardService.prestador()');

  const resumo = chamadas.map((c) => `${c.metodo} ${c.url}`);
  assert.deepEqual(resumo, [
    'post /auth/login', 'post /auth/registrar',
    'get /prestadores', 'get /prestadores/7/servicos',
    'post /servicos', 'delete /servicos/3',
    'get /disponibilidade/7', 'post /disponibilidade', 'delete /disponibilidade/4',
    'get /agendamentos/horarios-disponiveis', 'post /agendamentos', 'get /agendamentos/meus',
    'put /agendamentos/9/cancelar', 'put /agendamentos/9/remarcar', 'put /agendamentos/9/status',
    'get /notificacoes', 'get /dashboard/prestador'
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(chamadas[9].resto[0])), { params: { idPrestador: 7, idServico: 2, data: '2026-10-12' } });
  assert.deepEqual(JSON.parse(JSON.stringify(chamadas[13].resto[0])), { data: '2026-10-13', hora: '10:00' });
});

test('os serviços devolvem apenas o corpo da resposta', async () => {
  const { obter } = criarAmbiente();
  assert.deepEqual(JSON.parse(JSON.stringify(await obter('NotificacaoService.listar()'))), { ok: true });
});

test('executar: desabilita o botão durante a requisição e restaura no final (sucesso)', async () => {
  const { obter, contexto } = criarAmbiente();
  const botao = { dataset: {}, textContent: 'Entrar', disabled: false };
  contexto.botao = botao;
  const eventos = [];
  contexto.registrar = (e) => eventos.push(e);
  contexto.observar = () => eventos.push(`durante:${botao.disabled}:${botao.textContent}`);
  await obter(`executar({
    botao, textoCarregando: 'Entrando...',
    tarefa: async () => { observar(); return 42; },
    aoSucesso: (r) => registrar('sucesso:' + r),
    aoErro: () => registrar('erro')
  })`);
  assert.deepEqual(eventos, ['durante:true:Entrando...', 'sucesso:42']);
  assert.equal(botao.disabled, false);
  assert.equal(botao.textContent, 'Entrar');
  assert.equal(botao.dataset.enviando, undefined);
});

test('executar: em caso de erro chama aoErro e o finally restaura o botão', async () => {
  const { obter, contexto } = criarAmbiente();
  const botao = { dataset: {}, textContent: 'Salvar', disabled: false };
  contexto.botao = botao;
  const eventos = [];
  contexto.registrar = (e) => eventos.push(e);
  await obter(`executar({
    botao, tarefa: async () => { throw new Error('falhou'); },
    aoSucesso: () => registrar('sucesso'),
    aoErro: (e) => registrar('erro:' + e.message)
  })`);
  assert.deepEqual(eventos, ['erro:falhou']);
  assert.equal(botao.disabled, false);
  assert.equal(botao.textContent, 'Salvar');
});

test('executar: segundo clique durante a requisição é ignorado (sem requisição duplicada)', async () => {
  const { obter, contexto } = criarAmbiente();
  const botao = { dataset: {}, textContent: 'Enviar', disabled: false };
  contexto.botao = botao;
  let execucoes = 0;
  contexto.contar = () => { execucoes += 1; };
  const primeira = obter(`executar({ botao, tarefa: () => new Promise((ok) => setTimeout(() => { contar(); ok(); }, 20)) })`);
  const segunda = obter(`executar({ botao, tarefa: async () => { contar(); } })`);
  await Promise.all([primeira, segunda]);
  assert.equal(execucoes, 1);
});

test('executar: não sobrescreve o texto do botão se ele mudou durante a requisição', async () => {
  const { obter, contexto } = criarAmbiente();
  const botao = { dataset: {}, textContent: 'Confirmar remarcação', disabled: false };
  contexto.botao = botao;
  await obter(`executar({
    botao, textoCarregando: 'Remarcando...',
    tarefa: async () => 1,
    aoSucesso: () => { botao.textContent = 'Confirmar agendamento'; }
  })`);
  assert.equal(botao.textContent, 'Confirmar agendamento');
});

test('Validar.email aceita e-mails válidos e recusa inválidos', () => {
  const { obter } = criarAmbiente();
  assert.equal(obter("Validar.email('juliana@email.com')"), true);
  assert.equal(obter("Validar.email('juliana@')"), false);
  assert.equal(obter("Validar.email('sem-arroba')"), false);
});
