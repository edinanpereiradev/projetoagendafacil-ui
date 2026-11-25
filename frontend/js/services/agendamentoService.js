// Serviço de agendamentos (US06 a US09, US13)
const AgendamentoService = {
  horariosDisponiveis: ({ idPrestador, idServico, data }) =>
    http.get('/agendamentos/horarios-disponiveis', { params: { idPrestador, idServico, data } }).then(corpo),
  criar: (dados) => http.post('/agendamentos', dados).then(corpo),
  meus: () => http.get('/agendamentos/meus').then(corpo),
  cancelar: (id) => http.put(`/agendamentos/${id}/cancelar`).then(corpo),
  remarcar: (id, { data, hora }) => http.put(`/agendamentos/${id}/remarcar`, { data, hora }).then(corpo),
  atualizarStatus: (id, status) => http.put(`/agendamentos/${id}/status`, { status }).then(corpo)
};
