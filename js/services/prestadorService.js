// Serviço de prestadores (US05, US06)
const PrestadorService = {
  listar: () => http.get('/prestadores').then(corpo),
  servicos: (idPrestador) => http.get(`/prestadores/${idPrestador}/servicos`).then(corpo)
};
