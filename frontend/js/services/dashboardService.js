// Serviço do painel do prestador (US12)
const DashboardService = {
  prestador: () => http.get('/dashboard/prestador').then(corpo)
};
