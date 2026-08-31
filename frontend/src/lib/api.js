import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Nota: usamos Bearer via localStorage em vez de cookies HttpOnly porque
// o ingress público insere "Access-Control-Allow-Origin: *", que é
// incompatível com "Allow-Credentials: true". Bearer funciona de qualquer
// domínio (Netlify, Vercel, custom) sem dependência de terceiros-cookie.
export const api = axios.create({
  baseURL: API,
  withCredentials: false,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("roteira_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Se receber 401 em rota protegida, limpa token localmente para forçar re-login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // não removemos automaticamente pra não interromper /auth/me durante bootstrap
    }
    return Promise.reject(err);
  }
);
