// Serviço de notificações (US10, US11)
const NotificacaoService = {
  listar: () => http.get('/notificacoes').then(corpo)
};
