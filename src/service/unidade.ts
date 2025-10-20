import { apiFetch } from './api';

export interface UnidadeInfo {
  unidadeNome: string;
  unidadeCnpj: string;
  unidadeEndereco: string;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export async function listarUnidades(): Promise<string[]> {
  const response = await apiFetch('/unidades');
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[listarUnidades] HTTP ${response.status}: ${text}`);
    throw new Error('Não foi possível carregar as unidades');
  }

  const json = await response.json();
  if (isStringArray(json)) {
    return json;
  }

  console.warn('[listarUnidades] Resposta inesperada da API de unidades:', json);
  return [];
}

export async function buscarUnidade(nome: string): Promise<UnidadeInfo | null> {
  if (!nome) return null;

  const response = await apiFetch(`/unidades/${encodeURIComponent(nome)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[buscarUnidade] HTTP ${response.status}: ${text}`);
    throw new Error('Erro ao buscar detalhes da unidade');
  }

  const data = await response.json();

  return {
    unidadeNome: typeof data?.unidadeNome === 'string' ? data.unidadeNome : nome,
    unidadeCnpj: typeof data?.unidadeCnpj === 'string' ? data.unidadeCnpj : '',
    unidadeEndereco: typeof data?.unidadeEndereco === 'string' ? data.unidadeEndereco : '',
  };
}
