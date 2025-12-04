import React, { useEffect, useState, useRef } from 'react';
import {
  Edit,
  Eye,
  User,
  Building,
  Image as ImageIcon,
  Trash
} from 'lucide-react';
import { apagarCorrespondencia, buscarCorrespondencias, atualizarStatusCorrespondencia } from '../service/correspondencia';
import { API_BASE } from '../service/api';
import { apiFetch } from '../service/api';


// Tipos do novo schema - ADICIONANDO RECEBIDO
export type StatusCorresp = 'AVISADA' | 'DEVOLVIDA' | 'USO_INDEVIDO' | 'ANALISE' | 'RECEBIDO';
export interface CorrespondenciaDTO {
  id: number;
  remetente: string;
  nomeEmpresaConexa: string;
  statusCorresp: StatusCorresp;
  dataRecebimento: string;
  dataAvisoConexa: string | null;
  fotoCorrespondencia: string | null;
  anexos?: string[];
}

export const CorrespondenceManager: React.FC = () => {
  const [lista, setLista] = useState<CorrespondenciaDTO[]>([]);
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(0);
  const [pageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CorrespondenciaDTO | null>(null);

  const [formData, setFormData] = useState<{
    arquivos?: File[];
    fotoCorrespondencia: string | null;
    nomeEmpresaConexa: string;
    remetente: string;
    situacao?: string;
    mensagem?: string;
  }>({
    arquivos: [],
    fotoCorrespondencia: null,
    nomeEmpresaConexa: '',
    remetente: '',
    situacao: '',
    mensagem: '',
  });

  // NOVO ESTADO PARA MODAL DE ALTERAR STATUS
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<CorrespondenciaDTO | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusCorresp>('ANALISE');
  const [motivo, setMotivo] = useState<string>('');
  const [alteradoPor, setAlteradoPor] = useState<string>('');
  const [enviarEmail, setEnviarEmail] = useState<boolean>(false); // NOVO: Estado para checkbox

  const [arquivosParaEnvio, setArquivosParaEnvio] = useState<File[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | StatusCorresp>('');

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const requestIdRef = useRef(0);

  const [showActionModal, setShowActionModal] = useState(false);
  const [createdData, setCreatedData] = useState<any>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);

    const currentRequestId = ++requestIdRef.current; // id dessa requisição

    try {
      const termoBusca = debouncedSearchTerm.trim() || undefined;
      const resp = await buscarCorrespondencias(pageNumber, pageSize, termoBusca);

      // se outra requisição já foi disparada depois dessa, ignora o resultado
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // ordena por data mais recente
      const listaOrdenada = [...(resp?.content ?? [])].sort(
        (a: CorrespondenciaDTO, b: CorrespondenciaDTO) => {
          const da = new Date(a.dataRecebimento).getTime();
          const db = new Date(b.dataRecebimento).getTime();
          if (isNaN(da) || isNaN(db)) return 0;
          return db - da; // mais novo em cima
        }
      );

      setLista(listaOrdenada);
      setTotalPages(resp?.totalPages ?? 0);
    } catch (e: any) {
      if (currentRequestId !== requestIdRef.current) {
        // erro de request antiga, ignora
        return;
      }
      setErro(e?.message ?? 'Falha ao buscar correspondências');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setCarregando(false);
      }
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);

      setPageNumber(0);
    }, 1000); // 1s sem digitar

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // useEffect 2: Carrega as correspondências (ESTE ESTAVA FALTANDO!)
  useEffect(() => {
    console.log('[useEffect] Trigger carregar');
    carregar();
  }, [pageNumber, debouncedSearchTerm]);


  const resetForm = () => {
    setFormData({
      arquivos: [],
      fotoCorrespondencia: null,
      nomeEmpresaConexa: '',
      remetente: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let created: any = null;

      const respCriar = await apiFetch('/api/correspondencias/processar-correspondencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeEmpresaConexa: formData.nomeEmpresaConexa,
          remetente: formData.remetente,
          situacao: formData.situacao,
          mensagem: formData.mensagem,
        }),
      });

      if (respCriar.ok) {
        try {
          created = await respCriar.json();
        } catch {
          /* ignore */
        }
      } else {
        const errorText = await respCriar.text().catch(() => 'Unknown error');
        console.error(`[CorrespondenceManager] Error creating correspondence - HTTP ${respCriar.status}: ${errorText}`);
        throw new Error(`Erro ao processar correspondência (${respCriar.status})`);
      }

      try {
        const resp = await apiFetch(`/api/empresas/conexa/buscar-por-nome?nome=${encodeURIComponent(created.nomeEmpresaConexa)}`);
        if (resp.ok) {
          const empresas = await resp.json();
          if (empresas && empresas.length > 0) {
            const empresa = empresas[0];
            setCreatedData({
              ...created,
              email: Array.isArray(empresa.email) ? empresa.email[0] : empresa.email || '',
              nomeEmpresaConexa: created.nomeEmpresaConexa || empresa.nomeEmpresa || '',
            });
          } else {
            console.warn('Nenhuma empresa encontrada pelo nome informado');
            setCreatedData(created);
          }
        } else {
          console.error('Falha ao buscar empresa:', resp.status);
          setCreatedData(created);
        }
      } catch (err) {
        console.error('Erro ao buscar empresa por nome:', err);
        setCreatedData(created);
      }

      if (!created.nomeEmpresaConexa) {
        console.warn("⚠️ Backend não retornou nomeEmpresaConexa no created. Verifique resposta de /processar-correspondencia");
      }
      setShowActionModal(true);
    } catch (error: any) {
      setErro(error?.message || 'Erro ao cadastrar correspondência');
    }
  };

  // NOVA FUNÇÃO PARA ABRIR MODAL DE ALTERAR STATUS
  const handleAlterarStatus = (corresp: CorrespondenciaDTO) => {
    setSelectedCorrespondence(corresp);
    setNovoStatus(corresp.statusCorresp);
    setMotivo('');
    setAlteradoPor('');
    setArquivosParaEnvio([]); // Limpa arquivos ao abrir modal
    setEnviarEmail(false); // Reset checkbox
    setShowStatusModal(true);
  };

  // NOVA FUNÇÃO PARA SALVAR ALTERAÇÃO DE STATUS
  const handleSalvarStatus = async () => {
    if (!selectedCorrespondence) return;

    try {
      console.log('[handleSalvarStatus] Iniciando atualização de status');
      console.log('[handleSalvarStatus] Arquivos:', arquivosParaEnvio.length);

      await atualizarStatusCorrespondencia(
        selectedCorrespondence.id,
        novoStatus,
        motivo,
        alteradoPor,
        arquivosParaEnvio, // Passa os arquivos para o serviço
        enviarEmail // Passa a flag de envio de email
      );

      console.log('[handleSalvarStatus] Status atualizado com sucesso');

      // Feedback visual
      if (arquivosParaEnvio.length > 0 || enviarEmail) {
        alert('Status alterado e email enviado ao cliente com sucesso!');
      } else {
        alert('Status alterado com sucesso!');
      }

      setShowStatusModal(false);
      await carregar(); // Recarrega a lista

      // Limpa os estados
      setSelectedCorrespondence(null);
      setNovoStatus('ANALISE');
      setMotivo('');
      setAlteradoPor('');
      setArquivosParaEnvio([]); // Limpa arquivos

    } catch (error: any) {
      console.error('[handleSalvarStatus] Erro:', error);
      alert(error?.message || 'Erro ao alterar status da correspondência');
    }
  };

  // REMOVER FUNÇÃO DE EDITAR ANTIGA
  // const handleEdit = (corresp: CorrespondenciaDTO) => { ... }

  const apagarCorrespondenciaHandle = async (id: string) => {
    try {
      await apagarCorrespondencia(id);
      setLista(prev => prev.filter(c => String(c.id) !== id));
      console.debug('[CorrespondenceManager] dispatch empresaAtualizada após exclusão');
      window.dispatchEvent(new CustomEvent('empresaAtualizada', { detail: { entidade: 'Correspondencia', acao: 'EXCLUIR', id } }));
    } catch (error) {
      console.error(error);
    }
  }

  const filtered = lista.filter(c => {
    const matchesStatus = !statusFilter || c.statusCorresp === statusFilter;
    return matchesStatus;
  });


  const getStatusColor = (status: StatusCorresp) => {
    switch (status) {
      case 'ANALISE': return 'bg-blue-100 text-blue-800';
      case 'AVISADA': return 'bg-yellow-100 text-yellow-800';
      case 'DEVOLVIDA': return 'bg-red-100 text-red-800';
      case 'USO_INDEVIDO': return 'bg-purple-100 text-purple-800';
      case 'RECEBIDO': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink-900">Correspondências</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            className="flex-1 sm:w-64 px-3 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 placeholder-ink-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="Buscar por remetente/empresa"
            value={searchTerm}
            onChange={e =>
              setSearchTerm(e.target.value)
            }
          />
          <select
            className="px-3 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="">Todos</option>
            <option value="ANALISE">ANALISE</option>
            <option value="AVISADA">AVISADA</option>
            <option value="DEVOLVIDA">DEVOLVIDA</option>
            <option value="USO_INDEVIDO">USO INDEVIDO</option>
            <option value="RECEBIDO">RECEBIDO</option>
          </select>
          <button
            onClick={() => {
              setShowForm(true);
              setEditing(null);
              resetForm();
            }}
            className="btn-primary flex items-center gap-2"
          >
            <span className="text-lg font-bold">+</span> Nova Correspondência
          </button>
        </div>
      </div>

      {/* Form Modal (MANTIDO PARA CRIAÇÃO) */}
      {showForm && (
        <div className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-panel-200">
            <div className="p-6 border-b border-panel-100">
              <h3 className="text-lg font-semibold text-ink-900">{editing ? 'Editar' : 'Nova'} Correspondência</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Nome da Empresa *</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    id="primeiroId"
                    type="text"
                    value={formData.nomeEmpresaConexa}
                    onChange={e => setFormData({ ...formData, nomeEmpresaConexa: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 placeholder-ink-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Nome da empresa"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Remetente *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    id="segundoId"
                    type="text"
                    value={formData.remetente}
                    onChange={e => setFormData({ ...formData, remetente: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 placeholder-ink-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Nome do remetente"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Anexos (imagens ou PDFs)</label>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center cursor-pointer gap-2 w-fit">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => {
                        const files = e.target.files;
                        if (files) {
                          setFormData(prev => ({
                            ...prev,
                            arquivos: [...(prev.arquivos || []), ...Array.from(files)],
                          }));
                        }
                      }}
                    />
                    <ImageIcon className="w-4 h-4 text-ink-400" />
                    <span className="px-3 py-2 bg-panel-100 text-ink-700 rounded-lg hover:bg-panel-200 transition-colors text-sm border border-panel-200">
                      Anexar
                    </span>
                  </label>

                  {formData.arquivos && formData.arquivos.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {formData.arquivos.map((file, index) => {
                        const isImage = file.type.startsWith('image/');
                        const fileURL = URL.createObjectURL(file);
                        return (
                          <div
                            key={index}
                            className="relative border border-panel-200 rounded-lg p-2 flex flex-col items-center justify-center text-center text-xs bg-panel-50"
                          >
                            {isImage ? (
                              <img
                                src={fileURL}
                                alt={file.name}
                                className="w-20 h-20 object-cover rounded-md mb-1"
                              />
                            ) : (
                              <div className="w-20 h-20 flex items-center justify-center bg-white border border-panel-200 rounded-md text-ink-500">
                                PDF
                              </div>
                            )}
                            <span className="truncate max-w-[80px] text-ink-700">{file.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData(prev => ({
                                  ...prev,
                                  arquivos: (prev.arquivos || []).filter((_, i) => i !== index),
                                }))
                              }
                              className="absolute top-1 right-1 text-red-400 hover:text-red-300 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditing(null); }}
                  className="px-4 py-2 border border-panel-200 text-ink-700 rounded-lg hover:bg-panel-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editing ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOVO MODAL PARA ALTERAR STATUS */}
      {showStatusModal && selectedCorrespondence && (
        <div className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-panel-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-panel-100 flex-shrink-0">
              <h3 className="text-lg font-semibold text-ink-900">Alterar Status da Correspondência</h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Correspondência</label>
                <div className="bg-panel-50 p-3 rounded-lg text-ink-700 border border-panel-200">
                  <div><strong>Empresa:</strong> {selectedCorrespondence.nomeEmpresaConexa}</div>
                  <div><strong>Remetente:</strong> {selectedCorrespondence.remetente}</div>
                  <div><strong>Status atual:</strong>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedCorrespondence.statusCorresp)}`}>
                      {selectedCorrespondence.statusCorresp}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Novo Status *</label>
                <select
                  value={novoStatus}
                  onChange={e => setNovoStatus(e.target.value as StatusCorresp)}
                  className="w-full px-3 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                >
                  <option value="ANALISE">ANALISE</option>
                  <option value="AVISADA">AVISADA</option>
                  <option value="DEVOLVIDA">DEVOLVIDA</option>
                  <option value="USO_INDEVIDO">USO INDEVIDO</option>
                  <option value="RECEBIDO">RECEBIDO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Motivo da Alteração</label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 placeholder-ink-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Descreva o motivo da alteração de status..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">Alterado por *</label>
                <input
                  type="text"
                  value={alteradoPor}
                  onChange={e => setAlteradoPor(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-panel-200 rounded-lg text-ink-900 placeholder-ink-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nome de quem está alterando o status"
                  required
                />
              </div>

              {/* NOVO: Seção de upload de arquivos */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Anexar PDFs para envio por email (opcional)
                </label>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center cursor-pointer gap-2 w-fit">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => {
                        const files = e.target.files;
                        if (files) {
                          setArquivosParaEnvio(prev => [...prev, ...Array.from(files)]);
                        }
                      }}
                    />
                    <ImageIcon className="w-4 h-4 text-ink-400" />
                    <span className="px-3 py-2 bg-panel-100 text-ink-700 rounded-lg hover:bg-panel-200 transition-colors text-sm border border-panel-200">
                      Anexar arquivo
                    </span>
                  </label>

                  {arquivosParaEnvio.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-blue-400">
                        ℹ️ Com anexos, um email será enviado ao cliente automaticamente
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {arquivosParaEnvio.map((file, index) => {
                          const isImage = file.type.startsWith('image/');
                          const fileURL = URL.createObjectURL(file);
                          return (
                            <div
                              key={index}
                              className="relative border border-panel-200 rounded-lg p-2 flex flex-col items-center justify-center text-center text-xs bg-panel-50"
                            >
                              {isImage ? (
                                <img
                                  src={fileURL}
                                  alt={file.name}
                                  className="w-16 h-16 object-cover rounded-md mb-1"
                                />
                              ) : (
                                <div className="w-16 h-16 flex items-center justify-center bg-white border border-panel-200 rounded-md text-ink-500">
                                  PDF
                                </div>
                              )}
                              <span className="truncate max-w-[100px] text-ink-700">{file.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setArquivosParaEnvio(prev => prev.filter((_, i) => i !== index))
                                }
                                className="absolute top-1 right-1 text-red-400 hover:text-red-300 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setArquivosParaEnvio([]); // Limpa arquivos ao cancelar
                  }}
                  className="px-4 py-2 border border-panel-200 text-ink-700 rounded-lg hover:bg-panel-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarStatus}
                  className="btn-primary"
                >
                  {(arquivosParaEnvio.length > 0 || enviarEmail) ? 'Salvar e Enviar Email' : 'Salvar Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ações (MANTIDO) */}
      {showActionModal && createdData && (
        <div className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 space-y-4 border border-panel-200">
            <h3 className="text-lg font-semibold text-ink-900 text-center">O que deseja fazer?</h3>

            <button
              onClick={async () => {
                console.log('Enviando para backend:', {
                  emailDestino: createdData?.email,
                  nomeEmpresaConexa: createdData?.nomeEmpresaConexa,
                });

                await apiFetch('/api/correspondencias/enviar-aviso-resend', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    nomeEmpresaConexa: createdData?.nomeEmpresaConexa || '',
                    anexos: false,
                    anexosUrls: [],
                  }),
                });
                setShowActionModal(false);
                await carregar();
                resetForm();
                setShowForm(false);
              }}
              className="w-full btn-primary"
            >
              Enviar aviso (sem anexo)
            </button>

            <button
              onClick={() => {
                setShowActionModal(false);
                carregar();
                resetForm();
                setShowForm(false);
              }}
              className="w-full px-3 py-2 rounded-lg font-medium transition-colors duration-200 bg-panel-100 text-ink-700 hover:bg-panel-200"
            >
              Salvar correspondência
            </button>

            <button
              onClick={async () => {
                try {
                  const form = new FormData();

                  if (formData.arquivos && formData.arquivos.length > 0) {
                    formData.arquivos.forEach(file => {
                      console.log('📎 Adicionando arquivo:', file.name);
                      form.append('arquivos', file);
                    });
                  }

                  for (let [key, val] of form.entries()) {
                    console.log('🧩', key, val);
                  }

                  const resp = await apiFetch(`/api/correspondencias/${createdData.id}/enviar-aviso-resend-upload`, {
                    method: 'POST',
                    body: form,
                  });

                  if (!resp.ok) {
                    const msg = await resp.text();
                    console.error('❌ Falha ao enviar aviso com anexo:', msg);
                    alert(`Erro: ${msg}`);
                  } else {
                    console.log('✅ Aviso enviado com sucesso (com anexos)');
                  }

                  setShowActionModal(false);
                  await carregar();
                  resetForm();
                  setShowForm(false);
                } catch (err) {
                  console.error('💥 Erro no envio com anexo:', err);
                }
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
            >
              Enviar aviso (com anexo)
            </button>
          </div>
        </div>
      )}

      {/* Lista - Inbox Style */}
      <div className="card divide-y divide-panel-100 overflow-hidden">
        {carregando ? (
          <div className="px-6 py-12 text-center text-gray-500">Carregando...</div>
        ) : erro ? (
          <div className="px-6 py-12 text-center text-red-500">{erro}</div>
        ) : filtered.length > 0 ? (
          filtered.map((c) => (
            <div
              key={c.id}
              className="px-6 py-4 hover:bg-panel-50 transition-colors duration-150 cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.statusCorresp === 'RECEBIDO' ? 'bg-green-100' :
                    c.statusCorresp === 'AVISADA' ? 'bg-yellow-100' :
                      c.statusCorresp === 'DEVOLVIDA' ? 'bg-red-100' :
                        c.statusCorresp === 'USO_INDEVIDO' ? 'bg-purple-100' :
                          'bg-blue-100'
                    }`}>
                    <Building className={`w-5 h-5 ${c.statusCorresp === 'RECEBIDO' ? 'text-green-600' :
                      c.statusCorresp === 'AVISADA' ? 'text-yellow-600' :
                        c.statusCorresp === 'DEVOLVIDA' ? 'text-red-600' :
                          c.statusCorresp === 'USO_INDEVIDO' ? 'text-purple-600' :
                            'text-blue-600'
                      }`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Line 1: Company name */}
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <h3 className="text-base font-semibold text-ink-900 truncate">
                      {c.nomeEmpresaConexa}
                    </h3>
                    {/* Action buttons - visible on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleAlterarStatus(c)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Alterar Status"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => apagarCorrespondenciaHandle(String(c.id))}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                      {c.fotoCorrespondencia && (
                        <a
                          href={`${API_BASE}/api/correspondencias/arquivo/${encodeURIComponent(c.fotoCorrespondencia)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                          title="Ver foto"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Line 2: Sender, date, status */}
                  <div className="flex items-center gap-4 text-sm text-ink-500">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-ink-400" />
                      <span>{c.remetente}</span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <span>
                      {(() => {
                        try {
                          const d = new Date(c.dataRecebimento);
                          return isNaN(d.getTime()) ? c.dataRecebimento : d.toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } catch {
                          return c.dataRecebimento;
                        }
                      })()}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(c.statusCorresp)}`}>
                      {c.statusCorresp}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-12 text-center text-gray-500">Nenhuma correspondência encontrada</div>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">Página {pageNumber + 1} de {totalPages || 1}</div>
        <div className="flex gap-2">
          <button
            onClick={() => setPageNumber(p => Math.max(0, p - 1))}
            disabled={pageNumber <= 0}
            className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
          >Anterior</button>
          <button
            onClick={() => setPageNumber(p => (totalPages ? Math.min(totalPages - 1, p + 1) : p + 1))}
            disabled={totalPages ? pageNumber >= totalPages - 1 : false}
            className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50"
          >Próxima</button>
        </div>
      </div>
    </div>
  );
};