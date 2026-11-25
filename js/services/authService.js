// Serviço de autenticação (US01, US02, US03)
const AuthService = {
  login: (dados) => http.post('/auth/login', dados).then(corpo),
  registrar: (dados) => http.post('/auth/registrar', dados).then(corpo)
};
