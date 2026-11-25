// Serviço de disponibilidade do prestador (US04)
const DisponibilidadeService = {
  listar: (idPrestador) => http.get(`/disponibilidade/${idPrestador}`).then(corpo),
  criar: (dados) => http.post('/disponibilidade', dados).then(corpo),
  remover: (id) => http.delete(`/disponibilidade/${id}`).then(corpo)
};
