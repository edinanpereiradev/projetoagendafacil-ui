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

// ---------- Relatório de atendimentos ----------
let ultimoRelatorio = null;

function esc(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function moeda(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }

// Função pura: recebe a lista de agendamentos e o período (YYYY-MM-DD) e devolve os totais.
function calcularRelatorio(lista, de, ate) {
  const itens = lista
    .filter(a => a.data >= de && a.data <= ate)
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

  const ativos = itens.filter(a => a.status !== 'cancelado');
  const cancelados = itens.length - ativos.length;
  const porServico = {};
  itens.forEach(a => {
    const s = porServico[a.servico] || (porServico[a.servico] = { atendimentos: 0, cancelados: 0, receita: 0 });
    if (a.status === 'cancelado') { s.cancelados++; return; }
    s.atendimentos++;
    s.receita += Number(a.preco) || 0;
  });

  return {
    de, ate, itens, porServico,
    total: itens.length,
    atendimentos: ativos.length,
    cancelados,
    taxaCancelamento: itens.length ? (cancelados / itens.length) * 100 : 0,
    receita: ativos.reduce((soma, a) => soma + (Number(a.preco) || 0), 0)
  };
}

async function gerarRelatorio() {
  const de = document.getElementById('relDe').value;
  const ate = document.getElementById('relAte').value;
  if (de > ate) { erroGlobal('A data inicial não pode ser depois da final.'); return; }

  try {
    const lista = await api('/agendamentos/meus');
    ultimoRelatorio = calcularRelatorio(lista, de, ate);
  } catch (err) { erroGlobal(err.message); return; }
  const r = ultimoRelatorio;

  document.getElementById('relResumo').innerHTML = `
    <div class="stat-card"><div class="valor">${r.atendimentos}</div><div class="rotulo">Atendimentos no período</div></div>
    <div class="stat-card"><div class="valor">${r.cancelados}</div><div class="rotulo">Cancelados (${r.taxaCancelamento.toFixed(0)}%)</div></div>
    <div class="stat-card"><div class="valor">${moeda(r.receita)}</div><div class="rotulo">Receita prevista</div></div>
    <div class="stat-card"><div class="valor">${r.atendimentos ? moeda(r.receita / r.atendimentos) : '—'}</div><div class="rotulo">Valor médio por atendimento</div></div>`;

  const servicos = Object.entries(r.porServico).sort((a, b) => b[1].receita - a[1].receita);
  document.getElementById('relPorServico').innerHTML = r.total === 0
    ? '<p style="color:#8a7576;font-size:13px">Nenhum agendamento neste período.</p>'
    : `<h4 style="margin:18px 0 6px;font-size:14px">Por serviço</h4>
       <table class="tabela-rel">
         <thead><tr><th>Serviço</th><th>Atend.</th><th>Cancel.</th><th>Receita</th></tr></thead>
         <tbody>${servicos.map(([nome, s]) =>
           `<tr><td>${esc(nome)}</td><td>${s.atendimentos}</td><td>${s.cancelados}</td><td>${moeda(s.receita)}</td></tr>`).join('')}</tbody>
       </table>`;

  document.getElementById('relDetalhe').innerHTML = r.total === 0 ? '' : `
    <h4 style="margin:18px 0 6px;font-size:14px">Detalhe</h4>
    <table class="tabela-rel">
      <thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Status</th><th>Valor</th></tr></thead>
      <tbody>${r.itens.map(a =>
        `<tr><td>${formatarData(a.data)} ${esc(a.hora)}</td><td>${esc(a.clienteNome)}</td><td>${esc(a.servico)}</td>
         <td><span class="badge ${esc(a.status)}">${esc(a.status)}</span></td><td>${moeda(Number(a.preco) || 0)}</td></tr>`).join('')}</tbody>
    </table>`;

  document.getElementById('btnCsv').classList.toggle('oculto', r.total === 0);
}

function exportarRelatorioCsv() {
  if (!ultimoRelatorio) return;
  const campo = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Hora', 'Cliente', 'Serviço', 'Status', 'Valor'].map(campo).join(';')];
  ultimoRelatorio.itens.forEach(a => {
    linhas.push([formatarData(a.data), a.hora, a.clienteNome, a.servico, a.status,
      (Number(a.preco) || 0).toFixed(2).replace('.', ',')].map(campo).join(';'));
  });
  // BOM para o Excel abrir os acentos corretamente
  const blob = new Blob(['\ufeff' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_${ultimoRelatorio.de}_a_${ultimoRelatorio.ate}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.getElementById('formRelatorio').addEventListener('submit', (e) => {
  e.preventDefault();
  gerarRelatorio();
});

// Período padrão: mês atual
(function definirPeriodoPadrao() {
  const hoje = new Date();
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  document.getElementById('relDe').value = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  document.getElementById('relAte').value = fmt(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
})();

carregarStats();
carregarAgenda();
carregarServicos();
carregarDisponibilidade();
carregarNotificacoes();
gerarRelatorio();
