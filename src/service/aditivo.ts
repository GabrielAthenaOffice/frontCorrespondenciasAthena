import { API_BASE } from './api';

export interface ContractAddendumRequest {
  unidadeNome: string;
  unidadeCnpj: string;
  unidadeEndereco: string;
  pessoaFisicaNome: string;
  pessoaFisicaCpf: string;
  pessoaFisicaEndereco: string;
  dataInicioContrato: string;
  pessoaJuridicaNome: string;
  pessoaJuridicaCnpj: string;
  pessoaJuridicaEndereco: string;
}

export interface ContractAddendumResponse {
  id: string;
  status: string;
  mensagem: string;
  zapSignDocumentId?: string;
  zapSignDocumentUrl?: string;
  nomeArquivo?: string;
  urlDownload?: string; // ABSOLUTA, vinda do backend
}

/** util: extrai filename do header */
function extractFilename(disposition?: string | null, fallback = 'aditivo.docx') {
  if (!disposition) return fallback;
  // tenta filename* (UTF-8) primeiro
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
  if (star?.[1]) return decodeURIComponent(star[1].replace(/"/g, ''));
  // depois filename=
  const simple = /filename\s*=\s*"?(.*?)"?(\s*;|$)/i.exec(disposition);
  if (simple?.[1]) return simple[1].replace(/"/g, '');
  return fallback;
}

/** cria o aditivo e devolve dados + urlDownload já correta */
export async function criarAditivo(
  request: ContractAddendumRequest,
  empresaId?: number
): Promise<ContractAddendumResponse> {
  try {
    const aditivoRequest = {
      pessoaFisicaCpf: request.pessoaFisicaCpf,
      pessoaJuridicaNome: request.pessoaJuridicaNome,
      pessoaJuridicaCnpj: request.pessoaJuridicaCnpj,
      pessoaJuridicaEndereco: request.pessoaJuridicaEndereco,
      dataInicioContrato: request.dataInicioContrato,
    };

    const finalEmpresaId = empresaId || 1;
    const url = `${API_BASE}/api/correspondencias/criar-aditivo?nomeUnidade=${encodeURIComponent(
      request.unidadeNome
    )}&empresaId=${finalEmpresaId}`;

    // POST criar aditivo (Correspondências)
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aditivoRequest),
      // credentials: 'include', // só se usar sessão/cookie MESMO e CORS allowCredentials=true
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Erro ao criar aditivo: ${errorText || response.status}`);
    }

    const result = await response.json();

    // usa a url absoluta enviada pelo backend; fallback monta /download (NUNCA /baixar)
    const id = result.aditivoId || result.id || '';
    const urlDownload = ensureAbsoluteDownloadUrl(
    result.urlDownload || result.url || result.download_url,
    id
    );

    /*const urlDownload: string =
      result.urlDownload ||
      (id
        ? `https://api-aditivo-production-ed80.up.railway.app/aditivos/${id}/download`
        : '');*/

    return {
    id,
    status: result.status || '',
    mensagem: result.mensagem || '',
    nomeArquivo: result.caminhoDocumentoDocx || result.nomeArquivo || '',
    urlDownload, // sempre absoluta daqui pra frente
    };

  } catch (err) {
    console.error('[criarAditivo] Error:', err);
    throw err instanceof Error ? err : new Error('Erro ao criar aditivo');
  }
}

/** busca (se sua API realmente expõe /api/addendums/:id; ajuste se a rota for outra) */
export async function buscarAditivoPorId(id: string): Promise<ContractAddendumResponse | null> {
  const response = await fetch(`${API_BASE}/api/addendums/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Erro ao buscar aditivo (${response.status}): ${errorText}`);
  }
  return response.json();
}

// GET download (Aditivo) – usa URL absoluta já normalizada
export async function baixarDocumentoAditivo(documentUrl: string, nomeArquivo = 'aditivo.docx') {
  console.log('[baixarDocumentoAditivo] URL:', documentUrl);
  const res = await fetch(documentUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    const txt = await res.text().catch(() => '');
    throw new Error(`Download falhou (${res.status}). CT=${ct}. Resp: ${txt.slice(0,200)}`);
  }
  const blob = await res.blob();
  const disp = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disp);
  const filename = m?.[1] ? decodeURIComponent(m[1].replace(/"/g,'')) : nomeArquivo;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}



/** baixa por id usando a urlDownload do objeto */
export async function baixarDocumentoPorId(id: string): Promise<void> {
  const aditivo = await buscarAditivoPorId(id);
  if (!aditivo) throw new Error('Aditivo não encontrado');
  if (!aditivo.urlDownload) throw new Error('URL de download não disponível');
  await baixarDocumentoAditivo(
    aditivo.urlDownload,
    aditivo.nomeArquivo || `aditivo-${id}.docx`
  );
}

/** Converte /aditivos/{id}/download em URL absoluta da API do Aditivo */
function ensureAbsoluteDownloadUrl(u?: string, id?: string) {
  const BASE = (import.meta as any).env?.VITE_ADITIVO_API || '';
  if (!u && id) u = `/aditivos/${id}/download`;
  if (!u) {
    console.warn('[ensureAbsoluteDownloadUrl] urlDownload vazia');
    return '';
  }
  // já absoluta
  if (/^https?:\/\//i.test(u)) return u;

  if (!BASE) {
    console.warn('[ensureAbsoluteDownloadUrl] VITE_ADITIVO_API não definido; retornando URL como veio:', u);
    return u; // evita exception; você vê no console se tá errado
  }
  const full = (u.startsWith('/') ? `${BASE.replace(/\/$/,'')}${u}` : `${BASE.replace(/\/$/,'')}/${u}`);
  console.log('[ensureAbsoluteDownloadUrl] normalizada:', full);
  return full;
}

