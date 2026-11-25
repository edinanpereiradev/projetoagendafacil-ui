// Serviço de serviços do prestador (US05)
const ServicoService = {
  criar: (dados) => http.post('/servicos', dados).then(corpo),
  remover: (id) => http.delete(`/servicos/${id}`).then(corpo)
};
