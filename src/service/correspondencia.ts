import { StatusCorresp } from '../components/CorrespondenceManager';
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

// service/correspondencia.ts - ATUALIZAR ESTA FUNÇÃO
export async function atualizarStatusCorrespondencia(
  id: number | string, 
  status: StatusCorresp, 
  motivo: string, 
  alteradoPor: string
) {
  try {
    console.log(`[atualizarStatusCorrespondencia] Enviando PATCH para /api/correspondencias/${id}/status`);
    console.log(`[atualizarStatusCorrespondencia] Payload:`, { status, motivo, alteradoPor });

    const response = await apiFetch(`/api/correspondencias/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        motivo,
        alteradoPor
      }),
    });
    
    console.log(`[atualizarStatusCorrespondencia] Response status:`, response.status);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[atualizarStatusCorrespondencia] HTTP ${response.status}: ${errorText}`);
      throw new Error(`Erro ao atualizar status (${response.status})`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[atualizarStatusCorrespondencia] Error:', error);
    throw error instanceof Error ? error : new Error('Erro ao atualizar status da correspondência');
  }
}