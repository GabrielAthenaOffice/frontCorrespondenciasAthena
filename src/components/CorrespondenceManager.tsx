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
      // se quiser garantir que toda busca comece na pág. 0:
      setPageNumber(0);
    }, 1000); // 1s sem digitar

    return () => clearTimeout(handler);
  }, [searchTerm]);


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
    setShowStatusModal(true);
  };

  // NOVA FUNÇÃO PARA SALVAR ALTERAÇÃO DE STATUS
  const handleSalvarStatus = async () => {
    if (!selectedCorrespondence) return;

    try {
      await atualizarStatusCorrespondencia(
        selectedCorrespondence.id, 
        novoStatus, 
        motivo, 
        alteradoPor
      );
      
      setShowStatusModal(false);
      await carregar(); // Recarrega a lista para mostrar o status atualizado
      
      // Limpa os estados
      setSelectedCorrespondence(null);
      setNovoStatus('ANALISE');
      setMotivo('');
      setAlteradoPor('');
      
    } catch (error: any) {
      setErro(error?.message || 'Erro ao alterar status da correspondência');
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
          <h2 className="text-2xl font-bold text-gray-100">Correspondências</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            className="flex-1 sm:w-64 px-3 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Buscar por remetente/empresa"
            value={searchTerm}
            onChange={e => 
              setSearchTerm(e.target.value)
            }
          />
          <select
            className="px-3 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <span className="text-lg font-bold">+</span> Nova Correspondência
          </button>
        </div>
      </div>

      {/* Form Modal (MANTIDO PARA CRIAÇÃO) */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#23272f] rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">{editing ? 'Editar' : 'Nova'} Correspondência</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Empresa *</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="primeiroId"
                    type="text"
                    value={formData.nomeEmpresaConexa}
                    onChange={e => setFormData({ ...formData, nomeEmpresaConexa: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nome da empresa"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Remetente *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="segundoId"
                    type="text"
                    value={formData.remetente}
                    onChange={e => setFormData({ ...formData, remetente: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <ImageIcon className="w-4 h-4 text-gray-300" />
                    <span className="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-sm">
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
                            className="relative border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center text-center text-xs bg-[#2c2f38]"
                          >
                            {isImage ? (
                              <img
                                src={fileURL}
                                alt={file.name}
                                className="w-20 h-20 object-cover rounded-md mb-1"
                              />
                            ) : (
                              <div className="w-20 h-20 flex items-center justify-center bg-gray-800 rounded-md text-gray-300">
                                PDF
                              </div>
                            )}
                            <span className="truncate max-w-[80px] text-gray-300">{file.name}</span>
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
                  className="px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
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
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#23272f] rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Alterar Status da Correspondência</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Correspondência</label>
                <div className="bg-gray-800 p-3 rounded-lg text-gray-300">
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Novo Status *</label>
                <select
                  value={novoStatus}
                  onChange={e => setNovoStatus(e.target.value as StatusCorresp)}
                  className="w-full px-3 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Motivo da Alteração</label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  className="w-full px-3 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Descreva o motivo da alteração de status..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Alterado por *</label>
                <input
                  type="text"
                  value={alteradoPor}
                  onChange={e => setAlteradoPor(e.target.value)}
                  className="w-full px-3 py-2 bg-[#23272f] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nome de quem está alterando o status"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarStatus}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Salvar Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ações (MANTIDO) */}
      {showActionModal && createdData && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#23272f] rounded-xl shadow-xl p-6 w-80 space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">O que deseja fazer?</h3>

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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
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
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg"
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

                  const resp = await apiFetch(`/api/correspondencias/${createdData.id}/enviar-aviso-resend-upload`,  {
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

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remetente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Receb.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carregando ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500">Carregando...</td></tr>
              ) : erro ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-red-500">{erro}</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{c.remetente}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{c.nomeEmpresaConexa}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {(() => {
                        try {
                          const d = new Date(c.dataRecebimento);
                          return isNaN(d.getTime()) ? c.dataRecebimento : d.toLocaleString('pt-BR', { timeZone: 'America/Recife' });
                        } catch {
                          return c.dataRecebimento;
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(c.statusCorresp)}`}>
                        {c.statusCorresp}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {/* BOTÃO ALTERADO PARA ABRIR MODAL DE STATUS */}
                        <button
                          onClick={() => handleAlterarStatus(c)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Alterar Status"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => apagarCorrespondenciaHandle(String(c.id))}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                        {c.fotoCorrespondencia && (
                          <a
                            href={`${API_BASE}/api/correspondencias/arquivo/${encodeURIComponent(c.fotoCorrespondencia)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                            title="Ver foto"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">Nenhuma correspondência encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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