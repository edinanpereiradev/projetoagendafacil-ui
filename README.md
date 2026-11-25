# AgendaFácil — Interface (UI)

Interface web do AgendaFácil (HTML, CSS e JavaScript puro). Consome a API do repositório `projetoagendafacil-api`.

## Estrutura

| Caminho | Função |
|---|---|
| `index.html`, `cliente.html`, `prestador.html` | Telas de login/cadastro, cliente e prestador |
| `js/api.js` | URL da API (local x produção) e sessão do usuário |
| `js/http.js` | Instância base do **Axios**: URL, timeout, token Bearer em toda requisição e tradução dos erros da API em `ErroApi` |
| `js/services/*.js` | **Camada de serviço**, um arquivo por recurso (auth, prestador, serviço, disponibilidade, agendamento, notificação, dashboard). As telas nunca chamam o Axios diretamente |
| `js/ui.js` | Ciclo de vida da requisição (`executar`), validação síncrona e destaque de campos (`Validar`), mensagens |
| `js/cliente.js`, `js/prestador.js` | Lógica de cada tela, usando só os serviços |
| `test/` | Testes automatizados da camada HTTP, dos serviços e do ciclo de vida |

## Ciclo de vida da requisição

1. **Ocioso:** validação síncrona dos campos antes de acionar a rede.
2. **Carregando:** o botão fica desabilitado, com texto de carregamento (impede envios duplicados).
3. **Sucesso:** feedback visual e/ou redirecionamento.
4. **Erro:** `try / catch / finally` consome o erro padronizado da API (`{ erro, campo }`), destaca o campo com problema ou mostra a mensagem.

## Rodando

1. Suba a API (veja o README dela): `http://localhost:3000/api`.
2. Abra `index.html` no navegador (ou sirva a pasta com qualquer servidor estático). O Axios é carregado por CDN, então é preciso internet.
3. Para publicar na Vercel, troque `API_PRODUCAO` em `js/api.js` pela URL da API no Render.

Testes (Node 20+, sem instalar nada): `node --test`.

A pasta `frontend/` é uma cópia da raiz; ao alterar um arquivo, copie para lá também.
