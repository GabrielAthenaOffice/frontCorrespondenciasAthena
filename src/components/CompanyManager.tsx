// CompanyManager.tsx - VERSÃO COM TABELA E CORREÇÃO DO CPF
import React, { useEffect, useState } from 'react';
import { Search, Building, Plus, ChevronLeft, ChevronRight, Eye, Trash2, FileText, Edit3 } from 'lucide-react';
import { listarUnidades, buscarUnidade } from '../service/unidade';
import { buscarEmpresas, alterarSituacaoEmpresa, criarEmpresaPorNome, buscarEmpresaPorId, buscarEmpresaPorNomeModeloAthena } from '../service/empresa';
import { criarAditivo, baixarDocumentoAditivo } from '../service/aditivo';
import { formatTelefone, formatCpf, formatCnpj } from '../service/empresa';
import { apiFetch } from '../service/api';

export const CompanyManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [empresas, setEmpresas] = useState<any[]>([]);

  // ESTADOS DE PAGINAÇÃO
  const [pageNumber, setPageNumber] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [carregando, setCarregando] = useState<boolean>(false);


  const [aditivoEmpresa, setAditivoEmpresa] = useState<any | null>(null);
  const [aditivoForm, setAditivoForm] = useState({
    unidadeNome: '',
    unidadeCnpj: '',
    unidadeEndereco: '',
    pessoaFisicaNome: '',
    pessoaFisicaCpf: '',
    pessoaFisicaEndereco: '',
    dataInicioContrato: '',
    pessoaJuridicaNome: '',
    pessoaJuridicaCnpj: '',
    pessoaJuridicaEndereco: '',
  });
  const [unidades, setUnidades] = useState<string[]>([]);
  const [carregandoUnidades, setCarregandoUnidades] = useState(false);
  const [erroUnidades, setErroUnidades] = useState<string | null>(null);
  const [criandoAditivo, setCriandoAditivo] = useState(false);
  const [statusAditivo, setStatusAditivo] = useState<string | null>(null);

  // ESTADOS PARA MODAL DE NOVA EMPRESA
  const [showNovaEmpresaModal, setShowNovaEmpresaModal] = useState(false);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);

  // NOVOS ESTADOS PARA MODAL DE DETALHES
  const [empresaDetalhes, setEmpresaDetalhes] = useState<any | null>(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  const carregarUnidades = async () => {
    setCarregandoUnidades(true);
    try {
      const lista = await listarUnidades();
      setUnidades(lista.sort());
      setErroUnidades(null);
    } catch (error) {
      console.error('[CompanyManager] Erro ao listar unidades', error);
      setErroUnidades('Não foi possível carregar as unidades.');
    } finally {
      setCarregandoUnidades(false);
    }
  };

  const buscarEmpresasList = async (page: number = pageNumber, size: number = pageSize) => {
    setCarregando(true);
    try {
      // Se houver termo de busca, usa a busca por nome
      if (searchTerm.trim()) {
        const empresasEncontradas = await buscarEmpresaPorNomeModeloAthena(searchTerm.trim());
        setEmpresas(empresasEncontradas);
        setTotalElements(empresasEncontradas.length);
        setTotalPages(1);
        setPageNumber(0);
      } else {
        // Caso contrário, usa a paginação padrão
        const response = await buscarEmpresas(page, size);
        console.log('Resposta paginada:', response);

        setEmpresas(response.content || []);
        setTotalPages(response.totalPages || 0);
        setTotalElements(response.totalElements || 0);
        setPageNumber(response.pageNumber || 0);
        setPageSize(response.pageSize || size);
      }
    } catch (error) {
      console.error('[CompanyManager] Erro ao buscar empresas:', error);
      // Se der erro na busca por nome (ex: 404), limpa a lista
      if (searchTerm.trim()) {
        setEmpresas([]);
        setTotalElements(0);
        setTotalPages(0);
      }
    } finally {
      setCarregando(false);
    }
  };

  // Efeito para debouncing da busca
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      buscarEmpresasList(0);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // NOVA FUNÇÃO PARA VISUALIZAR DETALHES
  const visualizarDetalhes = async (empresa: any) => {
    setShowDetalhesModal(true);
    setCarregandoDetalhes(true);

    try {
      // Busca os detalhes completos da empresa
      const detalhes = await buscarEmpresaPorId(empresa.id);
      setEmpresaDetalhes(detalhes);
    } catch (error) {
      console.error('[CompanyManager] Erro ao buscar detalhes:', error);
      setEmpresaDetalhes(empresa); // Usa dados básicos se falhar
    } finally {
      setCarregandoDetalhes(false);
    }
  };

  const fecharDetalhesModal = () => {
    setShowDetalhesModal(false);
    setEmpresaDetalhes(null);
  };

  const handleCriarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaEmpresaNome.trim()) {
      setErroCriacao('Por favor, informe o nome da empresa');
      return;
    }

    setCriandoEmpresa(true);
    setErroCriacao(null);

    try {
      await criarEmpresaPorNome(novaEmpresaNome.trim());

      setShowNovaEmpresaModal(false);
      setNovaEmpresaNome('');
      await buscarEmpresasList(0);

      window.dispatchEvent(new CustomEvent('empresaAtualizada', {
        detail: { entidade: 'Empresa', acao: 'CRIAR' }
      }));

    } catch (error: any) {
      console.error('[CompanyManager] Erro ao criar empresa:', error);
      setErroCriacao(error?.message || 'Erro ao criar empresa');
    } finally {
      setCriandoEmpresa(false);
    }
  };

  const handleProximaPagina = () => {
    if (pageNumber < totalPages - 1) {
      const nextPage = pageNumber + 1;
      setPageNumber(nextPage);
      buscarEmpresasList(nextPage);
    }
  };

  const handlePaginaAnterior = () => {
    if (pageNumber > 0) {
      const prevPage = pageNumber - 1;
      setPageNumber(prevPage);
      buscarEmpresasList(prevPage);
    }
  };

  const handleMudarPageSize = (novoSize: number) => {
    setPageSize(novoSize);
    setPageNumber(0);
    buscarEmpresasList(0, novoSize);
  };

  const handleUnidadeSelect = async (nome: string) => {
    if (!nome) {
      setAditivoForm((prev) => ({
        ...prev,
        unidadeNome: '',
        unidadeCnpj: '',
        unidadeEndereco: '',
      }));
      return;
    }

    setAditivoForm((prev) => ({ ...prev, unidadeNome: nome }));

    try {
      const unidade = await buscarUnidade(nome);
      setAditivoForm((prev) => ({
        ...prev,
        unidadeNome: nome,
        unidadeCnpj: unidade?.unidadeCnpj ?? '',
        unidadeEndereco: unidade?.unidadeEndereco ?? '',
        pessoaJuridicaEndereco: unidade?.unidadeEndereco ?? prev.pessoaJuridicaEndereco,
      }));
    } catch (error) {
      console.error('[CompanyManager] Erro ao buscar detalhes da unidade', error);
    }
  };

  const resetAditivoForm = () => {
    setAditivoForm({
      unidadeNome: '',
      unidadeCnpj: '',
      unidadeEndereco: '',
      pessoaFisicaNome: '',
      pessoaFisicaCpf: '',
      pessoaFisicaEndereco: '',
      dataInicioContrato: '',
      pessoaJuridicaNome: '',
      pessoaJuridicaCnpj: '',
      pessoaJuridicaEndereco: '',
    });
  };

  const abrirModalAditivo = (company: any) => {
    setAditivoEmpresa(company);

    // CORREÇÃO: Agora puxa o CPF da empresa do banco de dados
    const cpfEmpresa = company.cnpj ? formatCpf(company.cnpj) : '';

    const unidadeInicial = company.unidade ?? '';
    setAditivoForm({
      unidadeNome: unidadeInicial,
      unidadeCnpj: '',
      unidadeEndereco: company.endereco ? [
        company.endereco.logradouro ?? company.endereco.rua,
        company.endereco.numero,
        company.endereco.bairro,
        company.endereco.cidade,
        company.endereco.estado,
      ].filter(Boolean).join(', ') : '',
      pessoaFisicaNome: company.nomeEmpresa ?? '',
      pessoaFisicaCpf: cpfEmpresa, // CORREÇÃO: CPF preenchido automaticamente
      pessoaFisicaEndereco: company.endereco ? [
        company.endereco.logradouro ?? company.endereco.rua,
        company.endereco.numero,
        company.endereco.bairro,
        company.endereco.cidade,
        company.endereco.estado,
      ].filter(Boolean).join(', ') : '',
      dataInicioContrato: '',
      pessoaJuridicaNome: '',
      pessoaJuridicaCnpj: '',
      pessoaJuridicaEndereco: '',
    });

    if (unidadeInicial) {
      handleUnidadeSelect(unidadeInicial);
    }
  };

  const fecharModalAditivo = () => {
    setAditivoEmpresa(null);
    resetAditivoForm();
  };

  const handleAditivoChange = (campo: string, valor: string) => {
    setAditivoForm(prev => ({ ...prev, [campo]: valor }));
  };

  function formatCpfOuCnpj(valor: string | null | undefined): string {
    if (!valor) return '-';
    const digits = valor.replace(/\D/g, '');
    if (digits.length === 11) return formatCpf(digits);
    if (digits.length === 14) return formatCnpj(digits);
    return valor;
  }

  const handleSubmitAditivo = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!aditivoEmpresa || criandoAditivo) return;

    const obrig = [
      { k: 'unidadeNome', rot: 'Nome da Unidade' },
      { k: 'dataInicioContrato', rot: 'Data de Início do Contrato' },
    ];
    const faltando = obrig.filter(({ k }) => !aditivoForm[k as keyof typeof aditivoForm]);
    if (faltando.length) {
      alert(`Por favor, preencha: ${faltando.map(f => f.rot).join(', ')}`);
      return;
    }

    setCriandoAditivo(true);
    setStatusAditivo('Criando aditivo...');

    try {
      const aditivoRequest = {
        ...aditivoForm,
        pessoaFisicaCpf: formatCpf(aditivoForm.pessoaFisicaCpf),
        pessoaJuridicaCnpj: formatCnpj(aditivoForm.pessoaJuridicaCnpj),
      };

      const resp = await criarAditivo(aditivoRequest, aditivoEmpresa.id);

      setStatusAditivo('Preparando download...');

      const downloadUrl = import.meta.env.DEV
        ? (resp.urlDownload ?? '').replace(/^https?:\/\/[^/]+/, '/api-aditivo')
        : resp.urlDownload ?? '';

      if (!downloadUrl) {
        alert(`Aditivo criado (ID: ${resp.id}), mas sem URL de download.`);
        return;
      }

      await baixarDocumentoAditivo(
        downloadUrl,
        resp.nomeArquivo || `aditivo-${resp.id}.docx`
      );

      alert(
        `Aditivo criado com sucesso!\nID: ${resp.id}\nArquivo: ${resp.nomeArquivo || `aditivo-${resp.id}.docx`}`
      );
      fecharModalAditivo();
    } catch (err) {
      console.error('[handleSubmitAditivo] erro:', err);
      alert(
        `Erro ao criar aditivo contratual: ${err instanceof Error ? err.message : 'Erro desconhecido'
        }`
      );
    } finally {
      setCriandoAditivo(false);
      setStatusAditivo(null);
    }
  };

  const deletarEmpresa = async (id: number) => {
    try {
      const response = await apiFetch(`/api/empresas/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[deletarEmpresa] HTTP ${response.status}: ${errorText}`);
        throw new Error(`Erro ao deletar empresa (${response.status})`);
      }
      await buscarEmpresasList(pageNumber);
    } catch (err) {
      console.error('[deletarEmpresa] Error:', err);
      alert('Erro ao deletar empresa');
    }
  };

  const filteredEmpresas = empresas; // A filtragem agora é feita no backend

  useEffect(() => {
    carregarUnidades();

    const handler = () => {
      console.debug('[CompanyManager] evento empresaAtualizada recebido - atualizando lista');
      buscarEmpresasList(pageNumber);
    };

    console.debug('[CompanyManager] registrando listener empresaAtualizada');
    window.addEventListener('empresaAtualizada', handler as EventListener);
    return () => {
      console.debug('[CompanyManager] removendo listener empresaAtualizada');
      window.removeEventListener('empresaAtualizada', handler as EventListener);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink-900">Empresas</h2>
          <p className="text-gray-600">
            {carregando ? 'Carregando...' : `${totalElements} empresa(s) encontrada(s)`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center gap-2"
            onClick={() => setShowNovaEmpresaModal(true)}
          >
            <Plus className="w-4 h-4" />
            Nova Empresa
          </button>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow"
            onClick={() => buscarEmpresasList()}
            disabled={carregando}
          >
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* MODAL NOVA EMPRESA */}
      {showNovaEmpresaModal && (
        <div className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-panel-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nova Empresa</h3>
            </div>
            <form onSubmit={handleCriarEmpresa} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  value={novaEmpresaNome}
                  onChange={(e) => setNovaEmpresaNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite o nome da empresa..."
                  required
                  disabled={criandoEmpresa}
                />
                {erroCriacao && (
                  <p className="mt-2 text-sm text-red-600">{erroCriacao}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNovaEmpresaModal(false);
                    setNovaEmpresaNome('');
                    setErroCriacao(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={criandoEmpresa}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  disabled={criandoEmpresa || !novaEmpresaNome.trim()}
                >
                  {criandoEmpresa ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Criar Empresa
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES */}
      {showDetalhesModal && (
        <div className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8 border border-panel-200">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Detalhes da Empresa</h3>
              <button
                onClick={fecharDetalhesModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {carregandoDetalhes ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : empresaDetalhes ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <p className="text-gray-900">{empresaDetalhes.nomeEmpresa || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ/CPF</label>
                      <p className="text-gray-900">{formatCpfOuCnpj(empresaDetalhes.cnpj)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-gray-900">{Array.isArray(empresaDetalhes.email) ? empresaDetalhes.email[0] : (empresaDetalhes.email || '-')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                      <p className="text-gray-900">{formatTelefone(empresaDetalhes.telefone)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <p className="text-gray-900">{empresaDetalhes.statusEmpresa || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
                      <p className="text-gray-900">{empresaDetalhes.situacao || '-'}</p>
                    </div>
                  </div>

                  {empresaDetalhes.endereco && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                      <p className="text-gray-900">
                        {[
                          empresaDetalhes.endereco.logradouro ?? empresaDetalhes.endereco.rua,
                          empresaDetalhes.endereco.numero,
                          empresaDetalhes.endereco.bairro,
                          empresaDetalhes.endereco.cidade,
                          empresaDetalhes.endereco.estado,
                          empresaDetalhes.endereco.cep
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  {empresaDetalhes.mensagem && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                      <p className="text-gray-900">{empresaDetalhes.mensagem}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Não foi possível carregar os detalhes</p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={fecharDetalhesModal}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search e Controles de Paginação */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Itens por página:</label>
              <select
                value={pageSize}
                onChange={(e) => handleMudarPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={carregando}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DE EMPRESAS */}
      {carregando ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando empresas...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Situação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mensagem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmpresas.length > 0 ? (
                    filteredEmpresas.map((company: any) => (
                      <tr key={company.customerId || company.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {company.nomeEmpresa || 'Sem nome'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${company.statusEmpresa === 'ATIVO' ? 'bg-green-100 text-green-800' :
                            company.statusEmpresa === 'INATIVO' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {company.statusEmpresa || 'Sem status'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {company.situacao && (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${company.situacao === 'ADIMPLENTE' ? 'bg-blue-100 text-blue-800' :
                              company.situacao === 'INADIMPLENTE' ? 'bg-red-100 text-red-800' :
                                company.situacao === 'CPF' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {company.situacao}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-xs truncate" title={company.mensagem}>
                            {company.mensagem || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => visualizarDetalhes(company)}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs"
                              title="Ver detalhes completos"
                            >
                              <Eye className="w-3 h-3" />
                              Detalhes
                            </button>

                            {company.situacao === 'CPF' && (
                              <button
                                onClick={() => abrirModalAditivo(company)}
                                className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-xs"
                                title="Criar aditivo contratual"
                              >
                                <FileText className="w-3 h-3" />
                                Aditivo
                              </button>
                            )}

                            <button
                              onClick={() => {
                                if (window.confirm('Tem certeza que deseja deletar esta empresa?')) {
                                  deletarEmpresa(company.id);
                                }
                              }}
                              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs"
                              title="Deletar empresa"
                            >
                              <Trash2 className="w-3 h-3" />
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">
                          {searchTerm ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Controles de Paginação */}
          {totalPages > 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Página {pageNumber + 1} de {totalPages} •
                  Mostrando {empresas.length} de {totalElements} empresas
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePaginaAnterior}
                    disabled={pageNumber === 0 || carregando}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium">
                    {pageNumber + 1}
                  </span>

                  <button
                    onClick={handleProximaPagina}
                    disabled={pageNumber >= totalPages - 1 || carregando}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal do Aditivo */}
      {aditivoEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/20 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto border border-panel-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Criar Aditivo Contratual
                </h3>
                <button
                  onClick={fecharModalAditivo}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={criandoAditivo}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitAditivo} className="p-6 space-y-6">
              {/* Informações da Unidade */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-4">Informações da Unidade</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome da Unidade *
                    </label>
                    {carregandoUnidades ? (
                      <input
                        type="text"
                        value="Carregando unidades..."
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      />
                    ) : erroUnidades ? (
                      <div className="text-red-600 text-sm">{erroUnidades}</div>
                    ) : (
                      <select
                        value={aditivoForm.unidadeNome}
                        onChange={(e) => handleUnidadeSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={criandoAditivo}
                      >
                        <option value="">Selecione uma unidade</option>
                        {unidades.map((nome) => (
                          <option key={nome} value={nome}>
                            {nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CNPJ da Unidade
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.unidadeCnpj}
                      onChange={(e) => handleAditivoChange('unidadeCnpj', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={criandoAditivo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endereço da Unidade
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.unidadeEndereco}
                      onChange={(e) => handleAditivoChange('unidadeEndereco', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={criandoAditivo}
                    />
                  </div>
                </div>
              </div>

              {/* Informações da Pessoa Física */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-4">Informações da Pessoa Física</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.pessoaFisicaNome}
                      onChange={(e) => handleAditivoChange('pessoaFisicaNome', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={criandoAditivo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CPF
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.pessoaFisicaCpf}
                      onChange={(e) => handleAditivoChange('pessoaFisicaCpf', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="000.000.000-00"
                      disabled={criandoAditivo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.pessoaFisicaEndereco}
                      onChange={(e) => handleAditivoChange('pessoaFisicaEndereco', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={criandoAditivo}
                    />
                  </div>
                </div>
              </div>

              {/* Data de Início do Contrato */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-4">Data do Contrato</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Início do Contrato *
                  </label>
                  <input
                    type="date"
                    value={aditivoForm.dataInicioContrato}
                    onChange={(e) => handleAditivoChange('dataInicioContrato', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={criandoAditivo}
                  />
                </div>
              </div>

              {/* Informações da Pessoa Jurídica */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-4">Informações da Pessoa Jurídica (Opcional)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.pessoaJuridicaNome}
                      onChange={(e) => handleAditivoChange('pessoaJuridicaNome', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={criandoAditivo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.pessoaJuridicaCnpj}
                      onChange={(e) => handleAditivoChange('pessoaJuridicaCnpj', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="00.000.000/0000-00"
                      disabled={criandoAditivo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={aditivoForm.pessoaJuridicaEndereco}
                      onChange={(e) => handleAditivoChange('pessoaJuridicaEndereco', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={criandoAditivo}
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              {statusAditivo && (
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                  <p className="text-blue-800 text-center">{statusAditivo}</p>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={fecharModalAditivo}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={criandoAditivo}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={criandoAditivo}
                >
                  {criandoAditivo ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Gerando Aditivo...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Gerar Aditivo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};