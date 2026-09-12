// prestador.js — gestão de serviços, horários e agenda do prestador
const usuario = Sessao.exigirLogin('prestador');
if (usuario) document.getElementById('nomeUsuario').textContent = usuario.nome;

const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

function sair() { Sessao.limpar(); window.location.href = 'index.html'; }

function erroGlobal(msg) {
  document.getElementById('mensagemGlobal').innerHTML = `<div class="erro">${msg}</div>`;
  setTimeout(() => document.getElementById('mensagemGlobal').innerHTML = '', 4000);
}
function sucessoGlobal(msg) {
  document.getElementById('mensagemGlobal').innerHTML = `<div class="sucesso">${msg}</div>`;
  setTimeout(() => document.getElementById('mensagemGlobal').innerHTML = '', 4000);
}

async function carregarStats() {
  const s = await api('/dashboard/prestador');
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="valor">${s.totalHoje}</div><div class="rotulo">Atendimentos hoje</div></div>
    <div class="stat-card"><div class="valor">${s.totalConfirmados}</div><div class="rotulo">Confirmados</div></div>
    <div class="stat-card"><div class="valor">${s.totalCancelados}</div><div class="rotulo">Cancelados</div></div>
    <div class="stat-card"><div class="valor">R$ ${s.faturamentoPrevisto.toFixed(2)}</div><div class="rotulo">Faturamento previsto</div></div>
  `;
}

async function carregarAgenda() {
  const lista = await api('/agendamentos/meus');
  const box = document.getElementById('listaAgenda');
  box.innerHTML = '';
  if (lista.length === 0) {
    box.innerHTML = '<p style="color:#8a7576;font-size:13px">Nenhum agendamento ainda.</p>';
    return;
  }
  lista.forEach(a => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="info">
        <h4>${a.servico} — ${a.clienteNome}</h4>
        <span>${formatarData(a.data)} às ${a.hora} · ${a.clienteTelefone || 'sem telefone'}</span>
      </div>
      <div style="text-align:right">
        <span class="badge ${a.status}">${a.status}</span>
        ${a.status === 'confirmado' ? `<div><span class="tag-remove" onclick="cancelar(${a.id})">Cancelar</span></div>` : ''}
      </div>`;
    box.appendChild(div);
  });
}

async function cancelar(id) {
  if (!confirm('Cancelar este atendimento?')) return;
  try {
    await api(`/agendamentos/${id}/cancelar`, { method: 'PUT' });
    sucessoGlobal('Atendimento cancelado.');
    carregarAgenda(); carregarStats(); carregarNotificacoes();
  } catch (err) { erroGlobal(err.message); }
}

async function carregarServicos() {
  const lista = await api(`/prestadores/${usuario.id}/servicos`);
  const box = document.getElementById('listaServicos');
  box.innerHTML = lista.length === 0
    ? '<p style="color:#8a7576;font-size:13px">Nenhum serviço cadastrado ainda.</p>'
    : '';
  lista.forEach(s => {
    const div = document.createElement('div');
    div.className = 'servico-item';
    div.innerHTML = `<h3>${s.nome} <span class="tag-remove" onclick="removerServico(${s.id})">remover</span></h3><p>${s.duracaoMin} min</p><div class="preco">R$ ${s.preco.toFixed(2)}</div>`;
    box.appendChild(div);
  });
}

document.getElementById('formServico').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/servicos', {
      method: 'POST',
      body: JSON.stringify({
        nome: document.getElementById('svNome').value,
        preco: parseFloat(document.getElementById('svPreco').value),
        duracaoMin: parseInt(document.getElementById('svDuracao').value, 10)
      })
    });
    e.target.reset();
    sucessoGlobal('Serviço adicionado!');
    carregarServicos();
  } catch (err) { erroGlobal(err.message); }
});

async function removerServico(id) {
  if (!confirm('Remover este serviço?')) return;
  await api(`/servicos/${id}`, { method: 'DELETE' });
  carregarServicos();
}

async function carregarDisponibilidade() {
  const lista = await api(`/disponibilidade/${usuario.id}`);
  const box = document.getElementById('listaDisponibilidade');
  box.innerHTML = lista.length === 0
    ? '<p style="color:#8a7576;font-size:13px">Nenhum horário configurado ainda.</p>'
    : '';
  lista.forEach(d => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="info"><h4>${DIAS_SEMANA[d.diaSemana]}</h4><span>${d.horaInicio} às ${d.horaFim}</span></div>
      <span class="tag-remove" onclick="removerDisponibilidade(${d.id})">remover</span>`;
    box.appendChild(div);
  });
}

document.getElementById('formDisponibilidade').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/disponibilidade', {
      method: 'POST',
      body: JSON.stringify({
        diaSemana: parseInt(document.getElementById('dispDia').value, 10),
        horaInicio: document.getElementById('dispInicio').value,
        horaFim: document.getElementById('dispFim').value
      })
    });
    sucessoGlobal('Horário adicionado!');
    carregarDisponibilidade();
  } catch (err) { erroGlobal(err.message); }
});

async function removerDisponibilidade(id) {
  await api(`/disponibilidade/${id}`, { method: 'DELETE' });
  carregarDisponibilidade();
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

carregarStats();
carregarAgenda();
carregarServicos();
carregarDisponibilidade();
carregarNotificacoes();
