import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach token from localStorage as Bearer fallback (mobile Safari cookies)
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("roteira_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
