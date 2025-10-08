import React, { useEffect, useState } from 'react';
import { Search, Building } from 'lucide-react';
import { listarUnidades, buscarUnidade } from '../service/unidade';
import { buscarTodasEmpresas, alterarSituacaoEmpresa } from '../service/empresa';
import { criarAditivo, baixarDocumentoAditivo } from '../service/aditivo';
import { formatTelefone } from '../service/empresa';
import { formatCpf, formatCnpj } from '../service/empresa';



export const CompanyManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [empresas, setEmpresas] = useState<any[]>([]);
  // carregar todas as empresas (sem paginação na UI para mostrar tudo cadastrado via correspondência)
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



  const filteredEmpresas = Array.isArray(empresas)
    ? empresas.filter((company: any) => {
        if (!searchTerm) return true;
        // Athena: nomeEmpresa
        return (company.nomeEmpresa || '').toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  // Removido filteredCompanies, usar apenas filteredEmpresas

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
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow"
          onClick={buscarEmpresasList}
        >
          Atualizar
        </button>
      </div>

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

  {/* Modais removidos, mantendo apenas listagem e edição */}

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmpresas.length > 0 ? (
          filteredEmpresas.map((company: any) => {
            console.log('Renderizando empresa:', company);
            const isAthena = company.id !== undefined;
            return (
              <div key={company.customerId || company.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {company.nomeEmpresa || '-'}
                  </h3>
                  <p className="text-sm text-gray-600 truncate">CNPJ: {company.cnpj || '-'}</p>
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
                    <div className="mt-2">
                      <button
                        className="px-3 py-1.5 bg-purple-600 text-white rounded"
                        onClick={() => abrirModalAditivo(company)}
                      >
                        Aditivo Contratual
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
  {/* mostramos todas as empresas; sem paginação */}
      {aditivoEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Aditivo Contratual</h3>
                <p className="text-sm text-gray-500">Empresa: {aditivoEmpresa?.nomeEmpresa}</p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={fecharModalAditivo}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitAditivo} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <section>
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Unidade</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <select
                      value={aditivoForm.unidadeNome}
                      onChange={(e) => handleUnidadeSelect(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Selecione uma unidade</option>
                      {carregandoUnidades && <option value="" disabled>Carregando unidades...</option>}
                      {unidades.map((nome) => (
                        <option key={nome} value={nome}>
                          {nome}
                        </option>
                      ))}
                    </select>
                    {erroUnidades && (
                      <p className="mt-1 text-xs text-red-600">{erroUnidades}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ</label>
                    <input
                      value={aditivoForm.unidadeCnpj}
                      onChange={e => handleAditivoChange('unidadeCnpj', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
                    <input
                      value={aditivoForm.unidadeEndereco}
                      onChange={e => handleAditivoChange('unidadeEndereco', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Rua, número, bairro, cidade"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Pessoa Física</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <input
                      value={aditivoForm.pessoaFisicaNome}
                      onChange={e => handleAditivoChange('pessoaFisicaNome', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Nome completo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CPF</label>
                    <input
                      value={formatCpf(aditivoForm.pessoaFisicaCpf)}
                      onChange={e => {const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                        handleAditivoChange('pessoaFisicaCpf', digits)}}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="000.000.000-00"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
                    <input
                      value={aditivoForm.pessoaFisicaEndereco}
                      onChange={e => handleAditivoChange('pessoaFisicaEndereco', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Endereço completo"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Dados do Contrato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Data de Início</label>
                    <input
                      type="date"
                      value={aditivoForm.dataInicioContrato}
                      onChange={e => handleAditivoChange('dataInicioContrato', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      required
                    />
                  </div>

                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-2">Pessoa Jurídica (Destino)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Razão Social</label>
                    <input
                      value={aditivoForm.pessoaJuridicaNome}
                      onChange={e => handleAditivoChange('pessoaJuridicaNome', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Nova empresa (CNPJ)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ</label>
                    <input
                      value={formatCnpj(aditivoForm.pessoaJuridicaCnpj)}
                      onChange={e => {const digits = e.target.value.replace(/\D/g, '').slice(0, 14); 
                        handleAditivoChange('pessoaJuridicaCnpj', digits)}}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Endereço</label>
                    <input
                      value={aditivoForm.pessoaJuridicaEndereco}
                      onChange={e => handleAditivoChange('pessoaJuridicaEndereco', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Endereço da futura PJ"
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModalAditivo}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoAditivo}
                  className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                    criandoAditivo 
                      ? 'bg-purple-400 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {criandoAditivo && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {criandoAditivo ? (statusAditivo || 'Processando...') : 'Salvar Dados'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};