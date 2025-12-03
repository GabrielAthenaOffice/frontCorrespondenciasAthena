import { StatusCorresp } from '../components/CorrespondenceManager';
import { apiFetch } from './api';

export async function buscarCorrespondencias(
  pageNumber: number = 0,
  pageSize: number = 50,
  termo?: string
) {
  try {
    // Se houver termo de busca, usa o endpoint de busca
    if (termo && termo.trim()) {
      const response = await apiFetch(
        `/api/correspondencias/buscar-por-nome?termo=${encodeURIComponent(termo.trim())}&pageNumber=${pageNumber}&pageSize=${pageSize}`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[buscarCorrespondencias] HTTP ${response.status}: ${errorText}`);
        throw new Error(`Erro ao buscar correspondências (${response.status})`);
      }

      return response.json();
    }

    // Caso contrário, usa o endpoint padrão para listar todas
    const response = await apiFetch(
      `/api/correspondencias/listar-correspondencia?pageNumber=${pageNumber}&pageSize=${pageSize}`
    );

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


export async function atualizarStatusCorrespondencia(
  id: number | string,
  status: StatusCorresp,
  motivo: string,
  alteradoPor: string,
  arquivos?: File[], // NOVO: parâmetro opcional para arquivos
  enviarEmail: boolean = false // NOVO: flag para forçar envio de email
) {
  try {
    console.log(`[atualizarStatusCorrespondencia] ID: ${id}, Status: ${status}, Arquivos: ${arquivos?.length || 0}, EnviarEmail: ${enviarEmail}`);

    // SEMPRE usar FormData, pois o backend espera @RequestPart
    console.log('[atualizarStatusCorrespondencia] Modo: MULTIPART (sempre)');

    const formData = new FormData();

    // Adiciona os dados como JSON na parte "dados"
    const dados = {
      status,
      motivo,
      alteradoPor,
      enviar: enviarEmail || (arquivos && arquivos.length > 0) // Envia se flag true OU se tiver arquivos
    };

    formData.append('dados', new Blob([JSON.stringify(dados)], {
      type: 'application/json'
    }));

    // Adiciona os arquivos se houver
    if (arquivos && arquivos.length > 0) {
      arquivos.forEach((arquivo, index) => {
        console.log(`[atualizarStatusCorrespondencia] Anexando arquivo ${index + 1}: ${arquivo.name}`);
        formData.append('arquivos', arquivo);
      });
    }

    // Log do FormData (debug)
    for (let [key, value] of formData.entries()) {
      console.log(`[FormData] ${key}:`, value);
    }

    const response = await apiFetch(`/api/correspondencias/${id}/status`, {
      method: 'PATCH',
      // NÃO definir Content-Type - o navegador define automaticamente com boundary
      body: formData,
    });

    console.log(`[atualizarStatusCorrespondencia] Response status: ${response.status}`);

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