// Centraliza a base da API para evitar URLs hardcoded
export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || 'https://correspondencias-backend-production.up.railway.app';

// Debug log para verificar a URL da API
console.log('🔗 API_BASE configurado para:', API_BASE);
console.log('🔧 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);

// Helper opcional para montar URLs com segurança
export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}
