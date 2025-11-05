import React, { useEffect, useState } from 'react';
import { Search, Building, Plus } from 'lucide-react';
import { listarUnidades, buscarUnidade } from '../service/unidade';
import { buscarTodasEmpresas, alterarSituacaoEmpresa, criarEmpresaPorNome } from '../service/empresa'; // ADICIONAR criarEmpresaPorNome
import { criarAditivo, baixarDocumentoAditivo } from '../service/aditivo';
import { formatTelefone } from '../service/empresa';
import { formatCpf, formatCnpj } from '../service/empresa';
import { Trash2 } from 'lucide-react';
import { API_BASE } from '../service/api';

export const CompanyManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [editSituacaoId, setEditSituacaoId] = useState<number | null>(null);
  const [editSituacao, setEditSituacao] = useState('');
  const [editMensagemId, setEditMensagemId] = useState<number | null>(null);
  const [editMensagem, setEditMensagem] = useState('');
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
  
  // NOVOS ESTADOS PARA MODAL DE NOVA EMPRESA
  const [showNovaEmpresaModal, setShowNovaEmpresaModal] = useState(false);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('');
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);

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

  // NOVA FUNÇÃO PARA CRIAR EMPRESA
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
      
      // Fecha o modal e limpa o formulário
      setShowNovaEmpresaModal(false);
      setNovaEmpresaNome('');
      
      // Recarrega a lista de empresas
      await buscarEmpresasList();
      
      // Dispara evento para outros componentes
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
      pessoaFisicaCpf: '',
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

    // obrigatórios
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
      // request normalizado
      const aditivoRequest = {
        ...aditivoForm,
        pessoaFisicaCpf: formatCpf(aditivoForm.pessoaFisicaCpf),
        pessoaJuridicaCnpj: formatCnpj(aditivoForm.pessoaJuridicaCnpj),
      };

      // POST -> cria e recebe urlDownload ABSOLUTA
      const resp = await criarAditivo(aditivoRequest, aditivoEmpresa.id);

      setStatusAditivo('Preparando download...');

      // Em DEV: usa proxy /api-aditivo pra evitar CORS; em PROD: usa URL absoluta
      const downloadUrl = import.meta.env.DEV
        ? (resp.urlDownload ?? '').replace(/^https?:\/\/[^/]+/, '/api-aditivo')
        : resp.urlDownload ?? '';

      if (!downloadUrl) {
        alert(`Aditivo criado (ID: ${resp.id}), mas sem URL de download.`);
        return;
      }

      // dispara download (fetch -> blob)
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
        `Erro ao criar aditivo contratual: ${
          err instanceof Error ? err.message : 'Erro desconhecido'
        }`
      );
    } finally {
      setCriandoAditivo(false);
      setStatusAditivo(null);
    }
  };

  const deletarEmpresa = async (id: number) => {
    try {
      // Chame o endpoint de deleção
      await fetch(`${API_BASE}/api/empresas/${id}`, { method: 'DELETE' });
      // Atualize a lista local
      setEmpresas(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert('Erro ao deletar empresa');
    }
  };

  const filteredEmpresas = Array.isArray(empresas)
    ? empresas.filter((company: any) => {
        if (!searchTerm) return true;
        // Athena: nomeEmpresa
        return (company.nomeEmpresa || '').toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  const buscarEmpresasList = async () => {
    try {
      const empresas = await buscarTodasEmpresas(50);
      console.log(empresas);
      // Athena: empresas vêm em empresas.content
      setEmpresas(empresas.content || []);
      // sempre mostramos tudo no UI
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    buscarEmpresasList();
    carregarUnidades();

    const handler = () => {
      console.debug('[CompanyManager] evento empresaAtualizada recebido - atualizando lista');
      buscarEmpresasList();
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
          <h2 className="text-2xl font-bold text-gray-900">Empresas</h2>
          <p className="text-gray-600">Gerencie as empresas cadastradas no sistema</p>
        </div>
        <div className="flex gap-2">
          {/* NOVO BOTÃO "NOVA EMPRESA" */}
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow flex items-center gap-2"
            onClick={() => setShowNovaEmpresaModal(true)}
          >
            <Plus className="w-4 h-4" />
            Nova Empresa
          </button>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow"
            onClick={buscarEmpresasList}
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* MODAL NOVA EMPRESA */}
      {showNovaEmpresaModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
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

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empresa ou remetente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmpresas.length > 0 ? (
          filteredEmpresas.map((company: any) => {
            console.log('Renderizando empresa:', company);
            const isAthena = company.id !== undefined;
            return (
              <div key={company.customerId || company.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
                <div className="flex flex-col gap-2">
                  {/* Cabeçalho com nome e lixeira */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 truncate">{company.nomeEmpresa || '-'}</span>
                    <button
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Deletar empresa"
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja deletar esta empresa?')) {
                          deletarEmpresa(company.id);
                        }
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  {/* Conteúdo do card */}
                  <p className="text-sm text-gray-600 truncate">CNPJ/CPF: {formatCpfOuCnpj(company.cnpj) || '-'}</p>
                  <p className="text-sm text-gray-600 truncate">Email: {Array.isArray(company.email) ? company.email[0] : (company.email || '-')}</p>
                  <p className="text-sm text-gray-600 truncate">Telefone: {formatTelefone(company.telefone)}</p>
                  <p className="text-sm text-gray-600 truncate">Status: {company.statusEmpresa ?? '-'}</p>
                  {/* Situação */}
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-sm font-medium text-gray-700">Situação:</label>
                    {isAthena ? (
                      editSituacaoId === company.id ? (
                        <div className="relative">
                          <button
                            type="button"
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded border"
                            onClick={() => setEditSituacao('OPEN')}
                          >
                            {editSituacao && editSituacao !== 'OPEN' ? editSituacao : 'Selecione'}
                          </button>
                          {editSituacao === 'OPEN' && (
                            <div className="absolute z-10 mt-2 w-40 bg-white border border-gray-300 rounded shadow-lg">
                              {['ATRASO','ADIMPLENTE','INADIMPLENTE','PROTESTADO','CPF','CNPJ'].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`block w-full text-left px-4 py-2 hover:bg-blue-100 ${editSituacao === opt ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                                  onClick={() => setEditSituacao(opt)}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                          <button className="px-2 py-1 bg-blue-600 text-white rounded ml-2" onClick={() => {
                            alterarSituacaoEmpresa(company.id, editSituacao)
                              .then(() => {
                                setEmpresas(prev => prev.map(c => c.id === company.id ? { ...c, situacao: editSituacao } : c));
                                setEditSituacaoId(null);
                              })
                              .catch(err => {
                                alert('Erro ao salvar situação: ' + err.message);
                              });
                          }}>Salvar</button>
                          <button className="px-2 py-1 bg-gray-400 text-white rounded ml-2" onClick={() => setEditSituacaoId(null)}>Cancelar</button>
                        </div>
                      ) : (
                        <>
                          <span>{company.situacao ?? '-'}</span>
                          {/* Removido botão de edição, apenas exibe o valor vindo do backend */}
                        </>
                      )
                    ) : (
                      <span>{company.situacao ?? '-'}</span>
                    )}
                  </div>
                  {/* Mensagem */}
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-sm font-medium text-gray-700">Mensagem:</label>
                    {editMensagemId === company.id ? (
                      <>
                        <input
                          type="text"
                          value={editMensagem}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditMensagem(e.target.value)}
                          className="px-2 py-1 border rounded"
                        />
                        <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={() => {
                          alterarSituacaoEmpresa(company.id, company.situacao ?? '', editMensagem)
                            .then(() => {
                              setEmpresas(prev => prev.map(c => c.id === company.id ? { ...c, mensagem: editMensagem } : c));
                              setEditMensagemId(null);
                            })
                            .catch(err => {
                              alert('Erro ao salvar mensagem: ' + err.message);
                            });
                        }}>Salvar</button>
                        <button className="px-2 py-1 bg-gray-400 text-white rounded" onClick={() => setEditMensagemId(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <span>{company.mensagem ?? '-'}</span>
                        <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={() => {
                          setEditMensagemId(company.id);
                          setEditMensagem(company.mensagem ?? '');
                        }}>Editar</button>
                      </>
                    )}
                  </div>

                  {company.situacao === 'CPF' && (
                    <div className="mt-4 text-center">
                      <button
                        className="px-3 py-1.5 bg-purple-600 text-white rounded"
                        onClick={() => abrirModalAditivo(company)}
                      >
                        Criar Aditivo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12">
            <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
            </p>
          </div>
        )}
      </div>

      {/* Resto do código permanece igual... */}
      {aditivoEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          {/* Modal do aditivo - mantido igual */}
        </div>
      )}
    </div>
  );
};