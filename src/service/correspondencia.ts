import { apiFetch } from './api';

export async function buscarCorrespondencias(pageNumber: number = 0, pageSize: number = 50) {
  try {
    const response = await apiFetch(`/api/correspondencias/listar-correspondencia?pageNumber=${pageNumber}&pageSize=${pageSize}`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[buscarCorrespondencias] HTTP ${response.status}: ${errorText}`);
      throw new Error(`Erro ao buscar correspondências (${response.status})`);
    }

    return response.json();
  } catch (error) {
    console.error('[buscarCorrespondencias] Error:', error);
    throw error instanceof Error ? error : new Error('Erro ao buscar correspondências');
  }
}

export async function apagarCorrespondencia(id: string | number) {
  try {
    const response = await apiFetch(`/api/correspondencias/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[apagarCorrespondencia] HTTP ${response.status}: ${errorText}`);
      throw new Error(`Erro ao apagar correspondência (${response.status})`);
    }
    return true;
  } catch (error) {
    console.error('[apagarCorrespondencia] Error:', error);
    throw error instanceof Error ? error : new Error('Erro ao apagar a correspondência');
  }
}

export async function atualizarCorrespondencia(id: number | string, updates: any) {
  try {
    const response = await apiFetch(`/api/correspondencias/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[atualizarCorrespondencia] HTTP ${response.status}: ${errorText}`);
      throw new Error(`Erro ao atualizar correspondência (${response.status})`);
    }
    return response.json();
  } catch (error) {
    console.error('[atualizarCorrespondencia] Error:', error);
    throw error instanceof Error ? error : new Error('Erro ao atualizar correspondência');
  }
}
