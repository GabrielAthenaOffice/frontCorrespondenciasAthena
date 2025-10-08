// src/service/api.ts
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://correspondencias-backend-production.up.railway.app';

console.log('🔗 API_BASE configurado para:', API_BASE);
console.log('🔧 Variáveis carregadas:', {
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});

export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}