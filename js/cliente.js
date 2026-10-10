// cliente.js — fluxo de agendamento do cliente
const usuario = Sessao.exigirLogin('cliente');
if (usuario) document.getElementById('nomeUsuario').textContent = usuario.nome;

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

let estado = {
  prestadorId: null,
  servicoId: null,
  dataEscolhida: null,
  horaEscolhida: null,
};

// Remarcação: guarda o agendamento que será trocado pelo novo horário
let remarcando = null;
let meusAgendamentos = [];

function sair() { Sessao.limpar(); window.location.href = 'index.html'; }

function erroGlobal(msg) {
  document.getElementById('mensagemGlobal').innerHTML = `<div class="erro">${msg}</div>`;
  setTimeout(() => document.getElementById('mensagemGlobal').innerHTML = '', 4000);
}
function sucessoGlobal(msg) {
  document.getElementById('mensagemGlobal').innerHTML = `<div class="sucesso">${msg}</div>`;
  setTimeout(() => document.getElementById('mensagemGlobal').innerHTML = '', 4000);
}

async function carregarPrestadores() {
  const prestadores = await api('/prestadores');
  const box = document.getElementById('listaPrestadores');
  box.innerHTML = '';
  if (prestadores.length === 0) {
    box.innerHTML = '<p style="color:#8a7576;font-size:13px">Nenhum prestador cadastrado ainda.</p>';
    return;
  }
  prestadores.forEach(p => {
    const div = document.createElement('div');
    div.className = 'servico-item';
    div.style.marginBottom = '10px';
    div.innerHTML = `<h3>${p.nomeNegocio || p.nome}</h3><p>${p.especialidade || ''} ${p.descricao ? '· ' + p.descricao : ''}</p>`;
    div.onclick = () => escolherPrestador(p.id, div);
    box.appendChild(div);
  });
}

function escolherPrestador(id, elClicado) {
  estado = { prestadorId: id, servicoId: null, dataEscolhida: null, horaEscolhida: null };
  document.querySelectorAll('#listaPrestadores .servico-item').forEach(el => el.classList.remove('selecionado'));
  elClicado.classList.add('selecionado');
  document.getElementById('cardServicos').classList.remove('oculto');
  document.getElementById('cardHorarios').classList.add('oculto');
  carregarServicos(id);
}

async function carregarServicos(idPrestador) {
  const servicos = await api(`/prestadores/${idPrestador}/servicos`);
  const box = document.getElementById('listaServicos');
  box.innerHTML = '';
  if (servicos.length === 0) {
    box.innerHTML = '<p style="color:#8a7576;font-size:13px">Este prestador ainda não cadastrou serviços.</p>';
    return;
  }
  servicos.forEach(s => {
    const div = document.createElement('div');
    div.className = 'servico-item';
    div.innerHTML = `<h3>${s.nome}</h3><p>${s.duracaoMin} min</p><div class="preco">R$ ${s.preco.toFixed(2)}</div>`;
    div.onclick = () => escolherServico(s.id, div);
    box.appendChild(div);
  });
}

function escolherServico(id, elClicado) {
  estado.servicoId = id;
  estado.dataEscolhida = null;
  estado.horaEscolhida = null;
  document.querySelectorAll('#listaServicos .servico-item').forEach(el => el.classList.remove('selecionado'));
  elClicado.classList.add('selecionado');
  document.getElementById('cardHorarios').classList.remove('oculto');
  document.getElementById('btnConfirmar').classList.add('oculto');
  montarDias();
}

function montarDias() {
  const box = document.getElementById('listaDias');
  box.innerHTML = '';
  const hoje = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const btn = document.createElement('div');
    btn.className = 'dia-btn';
    btn.innerHTML = `${DIAS_SEMANA[d.getDay()]}<span class="n">${d.getDate()}</span>`;
    btn.onclick = () => escolherData(iso, btn);
    box.appendChild(btn);
  }
}

async function escolherData(iso, elClicado) {
  estado.dataEscolhida = iso;
  estado.horaEscolhida = null;
  document.querySelectorAll('.dia-btn').forEach(el => el.classList.remove('ativo'));
  elClicado.classList.add('ativo');
  document.getElementById('btnConfirmar').classList.add('oculto');

  const box = document.getElementById('listaSlots');
  box.innerHTML = '<p style="grid-column:1/-1;font-size:13px;color:#8a7576">Carregando horários...</p>';

  try {
    const resp = await api(`/agendamentos/horarios-disponiveis?idPrestador=${estado.prestadorId}&idServico=${estado.servicoId}&data=${iso}`);
    box.innerHTML = '';
    if (resp.slots.length === 0) {
      box.innerHTML = '<div class="slot-vazio">Sem horários disponíveis neste dia.</div>';
      return;
    }
    resp.slots.forEach(hora => {
      const btn = document.createElement('div');
      btn.className = 'slot-btn';
      btn.textContent = hora;
      btn.onclick = () => {
        document.querySelectorAll('.slot-btn').forEach(el => el.classList.remove('ativo'));
        btn.classList.add('ativo');
        estado.horaEscolhida = hora;
        document.getElementById('btnConfirmar').classList.remove('oculto');
      };
      box.appendChild(btn);
    });
  } catch (err) {
    box.innerHTML = '';
    erroGlobal(err.message);
  }
}

async function confirmarAgendamento() {
  const antigo = remarcando;

  // US09: mesmo prestador e serviço do agendamento original -> endpoint de remarcação da API
  const remarcacaoDireta = antigo && antigo.idPrestador && antigo.idServico
    && antigo.idPrestador === estado.prestadorId && antigo.idServico === estado.servicoId;

  if (remarcacaoDireta) {
    try {
      await api(`/agendamentos/${antigo.id}/remarcar`, {
        method: 'PUT',
        body: JSON.stringify({ data: estado.dataEscolhida, hora: estado.horaEscolhida })
      });
    } catch (err) { erroGlobal(err.message); return; }
    sucessoGlobal('Agendamento remarcado! ✅');
    encerrarRemarcacao();
    document.getElementById('btnConfirmar').classList.add('oculto');
    carregarMeusAgendamentos();
    carregarNotificacoes();
    escolherData(estado.dataEscolhida, document.querySelector('.dia-btn.ativo'));
    return;
  }

  try {
    await api('/agendamentos', {
      method: 'POST',
      body: JSON.stringify({
        idPrestador: estado.prestadorId,
        idServico: estado.servicoId,
        data: estado.dataEscolhida,
        hora: estado.horaEscolhida
      })
    });
  } catch (err) { erroGlobal(err.message); return; }

  if (antigo) {
    // O novo horário já está garantido; só agora o antigo é cancelado.
    try {
      await api(`/agendamentos/${antigo.id}/cancelar`, { method: 'PUT' });
      sucessoGlobal('Agendamento remarcado! ✅');
    } catch (err) {
      erroGlobal(`Novo horário confirmado, mas o anterior não foi cancelado: ${err.message} Cancele-o manualmente.`);
    }
    encerrarRemarcacao();
  } else {
    sucessoGlobal('Agendamento confirmado! ✅');
  }

  document.getElementById('btnConfirmar').classList.add('oculto');
  carregarMeusAgendamentos();
  carregarNotificacoes();
  // Recarrega os horários para refletir o slot ocupado
  escolherData(estado.dataEscolhida, document.querySelector('.dia-btn.ativo'));
}

function iniciarRemarcacao(id) {
  const a = meusAgendamentos.find(x => x.id === id);
  if (!a) return;
  remarcando = a;
  estado = { prestadorId: null, servicoId: null, dataEscolhida: null, horaEscolhida: null };

  document.querySelectorAll('.servico-item.selecionado').forEach(el => el.classList.remove('selecionado'));
  document.getElementById('cardServicos').classList.add('oculto');
  document.getElementById('cardHorarios').classList.add('oculto');
  document.getElementById('btnConfirmar').textContent = 'Confirmar remarcação';

  const dados = `${a.servico} com ${a.prestadorNome} (${formatarData(a.data)} às ${a.hora})`;
  if (a.idPrestador && a.idServico) {
    // Mantém prestador e serviço: o cliente só escolhe a nova data e horário.
    estado.prestadorId = a.idPrestador;
    estado.servicoId = a.idServico;
    document.getElementById('listaSlots').innerHTML = '';
    document.getElementById('cardHorarios').classList.remove('oculto');
    montarDias();
    document.getElementById('textoRemarcacao').textContent =
      `Remarcando ${dados}. Escolha a nova data e o novo horário abaixo.`;
  } else {
    document.getElementById('textoRemarcacao').textContent =
      `Remarcando ${dados}. Escolha o novo prestador, serviço, data e horário. ` +
      'O agendamento atual só é cancelado depois que o novo for confirmado.';
  }
  document.getElementById('avisoRemarcacao').classList.remove('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function encerrarRemarcacao() {
  remarcando = null;
  document.getElementById('avisoRemarcacao').classList.add('oculto');
  document.getElementById('btnConfirmar').textContent = 'Confirmar agendamento';
}

async function carregarMeusAgendamentos() {
  const lista = await api('/agendamentos/meus');
  meusAgendamentos = lista;
  const box = document.getElementById('listaMeusAgendamentos');
  box.innerHTML = '';
  if (lista.length === 0) {
    box.innerHTML = '<p style="color:#8a7576;font-size:13px">Você ainda não tem agendamentos.</p>';
    return;
  }
  lista.forEach(a => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="info">
        <h4>${a.servico} — ${a.prestadorNome}</h4>
        <span>${formatarData(a.data)} às ${a.hora} · R$ ${a.preco.toFixed(2)}</span>
      </div>
      <div style="text-align:right">
        <span class="badge ${a.status}">${a.status}</span>
        ${a.status === 'confirmado' ? `<div><span class="tag-link" onclick="iniciarRemarcacao(${a.id})">Remarcar</span><span class="tag-remove" onclick="cancelar(${a.id})">Cancelar</span></div>` : ''}
      </div>`;
    box.appendChild(div);
  });
}

async function cancelar(id) {
  if (!confirm('Deseja cancelar este agendamento?')) return;
  try {
    await api(`/agendamentos/${id}/cancelar`, { method: 'PUT' });
    if (remarcando && remarcando.id === id) encerrarRemarcacao();
    sucessoGlobal('Agendamento cancelado.');
    carregarMeusAgendamentos();
    carregarNotificacoes();
  } catch (err) { erroGlobal(err.message); }
}

async function carregarNotificacoes() {
  const lista = await api('/notificacoes');
  const box = document.getElementById('listaNotificacoes');
  box.innerHTML = lista.length === 0
    ? '<p style="color:#8a7576;font-size:13px">Sem notificações.</p>'
    : lista.map(n => `<div class="notif-item">${n.mensagem}<div class="data">${formatarDataHora(n.data)}</div></div>`).join('');
}

function formatarData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function formatarDataHora(iso) {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}

carregarPrestadores();
carregarMeusAgendamentos();
carregarNotificacoes();
