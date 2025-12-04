// Base da API centralizada
import { API_BASE } from './api';
import { apiFetch } from '../service/api';


type RawCompanyPayload = Record<string, unknown>;

export interface Company extends Record<string, unknown> {
    id: number | null;
    customerId: number | null;
    nomeEmpresa: string | null;
    cnpj: string | null;
    email: string | string[] | null;
    telefone: string | null;
    statusEmpresa: string | null;
    situacao: string | null;
    mensagem: string | null;
    __raw: RawCompanyPayload;
}

export interface CompanyPage {
    content: Company[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    lastPage: boolean;
}

interface AthenaPagePayload {
    content: RawCompanyPayload[];
    pageNumber?: number;
    pageSize?: number;
    totalElements?: number;
    totalPages?: number;
    lastPage?: boolean;
}

interface ConexaPagePayload {
    data?: RawCompanyPayload[];
    pageNumber?: number;
    pageSize?: number;
    totalElements?: number;
    totalPages?: number;
    lastPage?: boolean;
}

const getNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const getString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const isRecord = (value: unknown): value is RawCompanyPayload => typeof value === 'object' && value !== null;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

const computeTotalPages = (totalElements: number, pageSize: number): number => {
    if (pageSize <= 0) {
        return totalElements > 0 ? 1 : 0;
    }
    const calculated = Math.ceil(totalElements / pageSize);
    return calculated > 0 ? calculated : totalElements > 0 ? 1 : 0;
};

const resolveEmail = (raw: RawCompanyPayload): string | string[] | null => {
    const direct = getString(raw['email']);
    if (direct) return direct;

    const emails = raw['emails'];
    if (isStringArray(emails)) return emails;

    const emailsMessage = getString(raw['emailsMessage']);
    if (emailsMessage) return emailsMessage;

    return null;
};

const resolveCnpj = (raw: RawCompanyPayload): string | null => {
    const direct = getString(raw['cnpj']);
    if (direct) return direct;

    const legalPerson = raw['legalPerson'];
    if (isRecord(legalPerson)) {
        const nested = getString(legalPerson['cnpj']);
        if (nested) return nested;
    }

    return null;
};

// Formata CPF: 000.000.000-00
export function formatCpf(cpf: string | null | undefined): string {
    if (!cpf) return '';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return cpf;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Formata CNPJ: 00.000.000/0000-00
export function formatCnpj(cnpj: string | null | undefined): string {
    if (!cnpj) return '';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function mapCustomerToCompany(customer: RawCompanyPayload | undefined): Company {
    const raw = customer ?? {};
    const id = getNumber(raw['id']) ?? getNumber(raw['customerId']) ?? null;
    const customerId = getNumber(raw['customerId']) ?? getNumber(raw['id']) ?? null;
    const nomeEmpresa =
        getString(raw['nomeEmpresa']) ?? getString(raw['name']) ?? getString(raw['nome']) ?? null;

    // Email: pega string direta, ou primeiro da lista, ou null
    let email: string | null = null;
    if (typeof raw.email === 'string') {
        email = raw.email;
    } else if (Array.isArray(raw.email) && raw.email.length > 0) {
        email = raw.email[0];
    } else if (Array.isArray(raw.emails) && raw.emails.length > 0) {
        email = raw.emails[0];
    }

    // Telefone: pega string direta, ou primeiro da lista, ou null
    let telefone: string | null = null;
    if (typeof raw['telefone'] === 'string') {
        telefone = raw['telefone'];
    } else if (Array.isArray(raw['telefone']) && raw['telefone'].length > 0 && typeof raw['telefone'][0] === 'string') {
        telefone = raw['telefone'][0];
    } else if (typeof raw['phone'] === 'string') {
        telefone = raw['phone'];
    } else if (Array.isArray(raw['phone']) && raw['phone'].length > 0 && typeof raw['phone'][0] === 'string') {
        telefone = raw['phone'][0];
    }

    const statusEmpresa = getString(raw['statusEmpresa']);
    const situacao = getString(raw['situacao']);
    const mensagem = getString(raw['mensagem']);

    return {
        ...raw,
        id,
        customerId,
        nomeEmpresa,
        cnpj: resolveCnpj(raw),
        email,
        telefone,
        statusEmpresa,
        situacao,
        mensagem,
        __raw: raw,
    };
}

export function formatTelefone(telefone: string | null): string {
    if (!telefone) return '-';
    // Remove tudo que não é número
    const digits = telefone.replace(/\D/g, '');
    if (digits.length === 11) {
        // Celular: (XX) XXXXX-XXXX
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
        // Fixo: (XX) XXXX-XXXX
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return telefone; // Retorna como está se não bater com os padrões
}

const createCompanyPage = (
    content: RawCompanyPayload[],
    defaultPageSize: number,
    meta: {
        pageNumber?: number;
        pageSize?: number;
        totalElements?: number;
        totalPages?: number;
        lastPage?: boolean;
    } = {},
): CompanyPage => {
    const companies = content.map(mapCustomerToCompany);
    const pageSize = meta.pageSize ?? defaultPageSize;
    const totalElements = meta.totalElements ?? companies.length;

    return {
        content: companies,
        pageNumber: meta.pageNumber ?? 0,
        pageSize,
        totalElements,
        totalPages: meta.totalPages ?? computeTotalPages(totalElements, pageSize),
        lastPage: meta.lastPage ?? true,
    };
};

const createAggregatedCompanyPage = (companies: Company[], pageSize: number): CompanyPage => ({
    content: companies,
    pageNumber: 0,
    pageSize,
    totalElements: companies.length,
    totalPages: computeTotalPages(companies.length, pageSize),
    lastPage: true,
});

const emptyCompanyPage = (pageSize: number): CompanyPage => ({
    content: [],
    pageNumber: 0,
    pageSize,
    totalElements: 0,
    totalPages: 0,
    lastPage: true,
});

const isAthenaPage = (value: unknown): value is AthenaPagePayload => {
    if (!isRecord(value)) return false;
    const content = value['content'];
    if (!Array.isArray(content) || !content.every(isRecord)) return false;

    const pageNumber = value['pageNumber'];
    if (pageNumber !== undefined && typeof pageNumber !== 'number') return false;

    const pageSize = value['pageSize'];
    if (pageSize !== undefined && typeof pageSize !== 'number') return false;

    const totalElements = value['totalElements'];
    if (totalElements !== undefined && typeof totalElements !== 'number') return false;

    const totalPages = value['totalPages'];
    if (totalPages !== undefined && typeof totalPages !== 'number') return false;

    const lastPage = value['lastPage'];
    if (lastPage !== undefined && typeof lastPage !== 'boolean') return false;

    return true;
};

const isConexaPage = (value: unknown): value is ConexaPagePayload => {
    if (!isRecord(value)) return false;
    const data = value['data'];
    if (data !== undefined && (!Array.isArray(data) || !data.every(isRecord))) return false;

    const pageNumber = value['pageNumber'];
    if (pageNumber !== undefined && typeof pageNumber !== 'number') return false;

    const pageSize = value['pageSize'];
    if (pageSize !== undefined && typeof pageSize !== 'number') return false;

    const totalElements = value['totalElements'];
    if (totalElements !== undefined && typeof totalElements !== 'number') return false;

    const totalPages = value['totalPages'];
    if (totalPages !== undefined && typeof totalPages !== 'number') return false;

    const lastPage = value['lastPage'];
    if (lastPage !== undefined && typeof lastPage !== 'boolean') return false;

    return true;
};

export async function buscarEmpresas(pageNumber: number = 0, pageSize: number = 50): Promise<CompanyPage> {
    try {
        const athenaUrl = `/api/empresas/athena/buscar-todos-registros?pageNumber=${pageNumber}&pageSize=${pageSize}`;
        const resp = await apiFetch(athenaUrl);
        if (!resp.ok) {
            const errorText = await resp.text().catch(() => 'Unknown error');
            console.warn(`[buscarEmpresas] ATHENA HTTP ${resp.status}: ${errorText}`);
        } else {
            const json = await resp.json();
            if (isAthenaPage(json) && json.content.length > 0) {
                return createCompanyPage(json.content, pageSize, {
                    pageNumber: json.pageNumber,
                    pageSize: json.pageSize,
                    totalElements: json.totalElements,
                    totalPages: json.totalPages,
                    lastPage: json.lastPage,
                });
            }
        }

        const conexaUrl = `/api/empresas/conexa/buscar-todos-registros?pageNumber=${pageNumber}&pageSize=${pageSize}`;
        const resp2 = await apiFetch(conexaUrl);
        if (!resp2.ok) {
            const errorText = await resp2.text().catch(() => 'Unknown error');
            console.error(`[buscarEmpresas] CONEXA HTTP ${resp2.status}: ${errorText}`);
            throw new Error(`Erro ao buscar empresas CONEXA (${resp2.status})`);
        }

        const json2 = await resp2.json();
        if (isConexaPage(json2)) {
            return createCompanyPage(json2.data ?? [], pageSize, {
                pageNumber: json2.pageNumber,
                pageSize: json2.pageSize,
                totalElements: json2.totalElements,
                totalPages: json2.totalPages,
                lastPage: json2.lastPage,
            });
        }

        return emptyCompanyPage(pageSize);
    } catch (error) {
        console.error('[buscarEmpresas] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao buscar empresas');
    }
}

export async function alterarSituacaoEmpresa(
    id: number,
    novaSituacao: string,
    novaMensagem?: string,
    novoStatus?: string,
): Promise<unknown> {
    try {
        const params: string[] = [];
        if (novoStatus) params.push(`novoStatus=${novoStatus}`);
        if (novaSituacao) params.push(`novaSituacao=${novaSituacao}`);
        if (novaMensagem !== undefined) params.push(`novaMensagem=${encodeURIComponent(novaMensagem)}`);
        const query = params.length ? `?${params.join('&')}` : '';
        const url = `/api/empresas/athena/alterar-empresa/modelo-athena/${id}${query}`;
        const response = await apiFetch(url, {
            method: 'PUT',
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`[alterarSituacaoEmpresa] HTTP ${response.status}: ${errorText}`);
            throw new Error(`Erro ao alterar situação (${response.status})`);
        }
        return response.json();
    } catch (error) {
        console.error('[alterarSituacaoEmpresa] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao alterar situação');
    }
}

const fetchTodasEmpresasConexa = async (pageSize: number): Promise<CompanyPage> => {
    const companies: Company[] = [];
    let page = 0;

    while (true) {
        const url = `/api/empresas/conexa/buscar-todos-registros?pageNumber=${page}&pageSize=${pageSize}`;
        const resp = await apiFetch(url);
        if (!resp.ok) {
            const errorText = await resp.text().catch(() => 'Unknown error');
            console.warn(`[fetchTodasEmpresasConexa] HTTP ${resp.status} on page ${page}: ${errorText}`);
            break;
        }
        const json = await resp.json();
        if (!isConexaPage(json)) {
            console.warn(`[fetchTodasEmpresasConexa] Invalid page structure on page ${page}`);
            break;
        }

        const data = json.data ?? [];
        if (data.length === 0) break;

        companies.push(...data.map((item) => mapCustomerToCompany(item)));

        const reachedEnd =
            json.lastPage === true ||
            data.length < pageSize ||
            (typeof json.totalPages === 'number' && page + 1 >= json.totalPages);

        if (reachedEnd) break;

        page += 1;
    }

    if (companies.length === 0) {
        return emptyCompanyPage(pageSize);
    }

    return createAggregatedCompanyPage(companies, pageSize);
};

// Ajuda: lida com Optional do Spring no JSON
function unwrapOptionalPayload<T = any>(payload: any): T | null {
    if (payload == null) return null;
    if (typeof payload === 'object') {
        if ('value' in payload) return (payload as any).value ?? null;      // { value: {...} }
        if ('present' in payload && payload.present === false) return null;  // { present:false }
        if ('empty' in payload && payload.empty === true) return null;       // { empty:true }
    }
    return payload as T; // já é o objeto
}

export async function buscarTodasEmpresas(pageSize: number = 50): Promise<CompanyPage> {
    try {
        const companies: Company[] = [];
        let page = 0;

        while (true) {
            const url = `/api/empresas/athena/buscar-todos-registros?pageNumber=${page}&pageSize=${pageSize}`;
            const resp = await apiFetch(url);
            if (!resp.ok) {
                const errorText = await resp.text().catch(() => 'Unknown error');
                console.warn(`[buscarTodasEmpresas] ATHENA HTTP ${resp.status} on page ${page}: ${errorText}`);
                break;
            }
            const json = await resp.json();
            if (!isAthenaPage(json)) {
                console.warn(`[buscarTodasEmpresas] Invalid ATHENA page structure on page ${page}`);
                break;
            }

            const items = json.content;
            if (items.length === 0) {
                if (page === 0) {
                    return fetchTodasEmpresasConexa(pageSize);
                }
                break;
            }

            companies.push(...items.map((item) => mapCustomerToCompany(item)));

            const reachedEnd =
                json.lastPage === true ||
                items.length < pageSize ||
                (typeof json.totalPages === 'number' && page + 1 >= json.totalPages);

            if (reachedEnd) break;

            page += 1;
        }

        if (companies.length === 0) {
            return emptyCompanyPage(pageSize);
        }

        return createAggregatedCompanyPage(companies, pageSize);
    } catch (error) {
        console.error('[buscarTodasEmpresas] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao buscar todas as empresas');
    }
}


export async function criarEmpresaPorNome(nomeEmpresa: string): Promise<any> {
    try {
        const response = await apiFetch('/api/empresas/criar-por-nome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nomeEmpresa }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`[criarEmpresaPorNome] HTTP ${response.status}: ${errorText}`);

            // Tratamento específico para códigos de status
            if (response.status === 409) {
                throw new Error('Empresa já cadastrada no sistema');
            } else if (response.status === 404) {
                throw new Error('Nenhuma empresa encontrada com esse nome');
            } else {
                throw new Error(`Erro ao criar empresa (${response.status})`);
            }
        }

        return response.json();
    } catch (error) {
        console.error('[criarEmpresaPorNome] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao criar empresa');
    }
}

// service/empresa.ts - ADICIONAR ESTAS FUNÇÕES

// Buscar empresa por ID (para detalhes)
export async function buscarEmpresaPorId(id: number): Promise<Company | null> {
    try {
        const response = await apiFetch(`/api/empresas/athena/buscar-por-id/${id}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Erro ao buscar empresa (${response.status}): ${errorText}`);
        }
        const raw = await response.json().catch(() => null);
        const unwrapped = unwrapOptionalPayload(raw);
        return unwrapped ? mapCustomerToCompany(unwrapped) : null;
    } catch (error) {
        console.error('[buscarEmpresaPorId] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao buscar empresa');
    }
}

// Buscar empresa por nome (para detalhes)
export async function buscarEmpresaPorNome(nome: string): Promise<Company | null> {
    try {
        const response = await apiFetch(`/api/empresas/athena/buscar-por-nome?nome=${encodeURIComponent(nome)}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Erro ao buscar empresa (${response.status}): ${errorText}`);
        }
        const raw = await response.json().catch(() => null);
        const unwrapped = unwrapOptionalPayload(raw);
        return unwrapped ? mapCustomerToCompany(unwrapped) : null;
    } catch (error) {
        console.error('[buscarEmpresaPorNome] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao buscar empresa');
    }
}

export async function buscarEmpresaPorNomeModeloAthena(nome: string): Promise<Company[]> {
    try {
        const response = await apiFetch(`/api/empresas/athena/buscar-por-nome?nome=${encodeURIComponent(nome)}`);

        if (response.status === 404) {
            return [];
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Erro ao buscar empresas por nome (${response.status}): ${errorText}`);
        }

        const rawList = await response.json();
        if (!Array.isArray(rawList)) {
            return [];
        }

        return rawList.map(mapCustomerToCompany);
    } catch (error) {
        console.error('[buscarEmpresaPorNomeModeloAthena] Error:', error);
        throw error instanceof Error ? error : new Error('Erro ao buscar empresas por nome');
    }
}
