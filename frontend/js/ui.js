// ui.js — ciclo de vida da requisição, validação síncrona e mensagens (UI-12, UI-13, UI-14)

function esc(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function moeda(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }
function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function formatarDataHora(iso) {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}
function sair() { Sessao.limpar(); window.location.href = 'index.html'; }

function mostrarMensagemGlobal(tipo, texto) {
  const el = document.getElementById('mensagemGlobal');
  if (!el) return;
  el.innerHTML = `<div class="${tipo}">${esc(texto)}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}
const erroGlobal = (texto) => mostrarMensagemGlobal('erro', texto);
const sucessoGlobal = (texto) => mostrarMensagemGlobal('sucesso', texto);

/**
 * Ciclo de vida de uma requisição:
 *  1. ocioso   - (a validação síncrona acontece ANTES de chamar esta função)
 *  2. carregando - desabilita o botão e mostra o texto de carregamento (impede duplo clique)
 *  3. sucesso  - aoSucesso(resultado)
 *  4. erro     - aoErro(erro), com o ErroApi padronizado
 *  finally: o botão volta ao normal, sempre.
 */
async function executar({ botao, textoCarregando = 'Enviando...', tarefa, aoSucesso, aoErro }) {
  if (botao && botao.dataset.enviando === 'true') return undefined; // já há uma requisição em andamento
  const textoOriginal = botao ? botao.textContent : '';
  if (botao) {
    botao.dataset.enviando = 'true';
    botao.disabled = true;
    botao.textContent = textoCarregando;
  }
  try {
    const resultado = await tarefa();
    if (aoSucesso) await aoSucesso(resultado);
    return resultado;
  } catch (erro) {
    if (aoErro) aoErro(erro); else console.error(erro);
    return undefined;
  } finally {
    if (botao) {
      botao.disabled = false;
      // só restaura o texto se ninguém o trocou durante a requisição
      if (botao.textContent === textoCarregando) botao.textContent = textoOriginal;
      delete botao.dataset.enviando;
    }
  }
}

// Carrega uma lista mostrando "carregando" e tratando erro sem deixar a tela vazia
async function carregarLista(box, textoCarregando, buscar, renderizar) {
  box.innerHTML = `<p class="carregando">${esc(textoCarregando)}</p>`;
  try {
    const dados = await buscar();
    box.innerHTML = '';
    renderizar(dados, box);
  } catch (erro) {
    box.innerHTML = `<div class="erro">${esc(erro.message)}</div>`;
  }
}

// Validação síncrona local + destaque de campos
const Validar = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()),

  limpar(form) {
    form.querySelectorAll('.invalido').forEach((el) => el.classList.remove('invalido'));
    form.querySelectorAll('.msg-campo').forEach((el) => el.remove());
  },

  marcar(idCampo, mensagem) {
    const el = document.getElementById(idCampo);
    if (!el) return;
    el.classList.add('invalido');
    const aviso = document.createElement('small');
    aviso.className = 'msg-campo';
    aviso.textContent = mensagem;
    el.insertAdjacentElement('afterend', aviso);
    el.addEventListener('input', () => { el.classList.remove('invalido'); aviso.remove(); }, { once: true });
  },

  // regras: [{ id, ok: (valor) => boolean, msg }]. Devolve true se todas passarem.
  formulario(form, regras) {
    this.limpar(form);
    let valido = true;
    let primeiro = null;
    for (const regra of regras) {
      const el = document.getElementById(regra.id);
      if (!el || el.classList.contains('invalido')) continue;
      if (!regra.ok(el.value)) {
        this.marcar(regra.id, regra.msg);
        valido = false;
        primeiro = primeiro || el;
      }
    }
    if (primeiro) primeiro.focus();
    return valido;
  },

  // Usa o campo informado pela API ({ erro, campo }) para destacar o input certo.
  // Devolve true se conseguiu destacar; senão o chamador mostra a mensagem geral.
  erroDaApi(form, erro, mapaCampos) {
    const id = erro && erro.campo && mapaCampos ? mapaCampos[erro.campo] : null;
    if (!id) return false;
    this.limpar(form);
    this.marcar(id, erro.message);
    const el = document.getElementById(id);
    if (el) el.focus();
    return true;
  }
};
