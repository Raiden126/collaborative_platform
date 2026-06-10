import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * Central axios instance.
 * - Access token is held in memory (set via setAccessToken) — never localStorage.
 * - On 401 we attempt a single refresh (httpOnly cookie) then replay the request.
 */
export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setAuthLostHandler(fn: () => void) {
  onAuthLost = fn;
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post<{ accessToken: string }>(
      '/api/auth/refresh',
      {},
      { withCredentials: true },
    );
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return http(original);
      }
      onAuthLost?.();
    }
    return Promise.reject(error);
  },
);
