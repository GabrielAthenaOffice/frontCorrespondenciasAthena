// src/service/api.ts
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://correspondencias-backend.onrender.com'; // 🔥 precisa do http://

console.log('🔗 API_BASE configurado para:', API_BASE);
console.log('🔧 Variáveis carregadas:', {
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});


// 🔥 helper central com credenciais sempre incluídas
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const finalOptions: RequestInit = {
    ...options,
    credentials: 'include', // 🔥 garante envio do cookie
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData
        ? {} // FormData já define Content-Type
        : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(
    `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`,
    finalOptions
  );

  if (response.status === 401) {
    console.warn(`[apiFetch] Sessão expirada ou não autenticada em ${path}`);
  }

  return response;
}
