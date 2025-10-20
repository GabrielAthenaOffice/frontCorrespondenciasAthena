import React, { useEffect, useState } from 'react';
import {
  Edit,
  Eye,
  User,
  Building,
  Image as ImageIcon,
  Trash
} from 'lucide-react';
import { apagarCorrespondencia, buscarCorrespondencias, atualizarCorrespondencia } from '../service/correspondencia';
import { API_BASE } from '../service/api';
import { apiFetch } from '../service/api';


// Tipos do novo schema
export type StatusCorresp = 'AVISADA' | 'DEVOLVIDA' | 'USO_INDEVIDO' | 'ANALISE';
export interface CorrespondenciaDTO {
  id: number;
  remetente: string;
  nomeEmpresaConexa: string;
  statusCorresp: StatusCorresp;
  dataRecebimento: string; // "YYYY-MM-DD" (string)
  dataAvisoConexa: string | null; // "YYYY-MM-DD" ou null
  fotoCorrespondencia: string | null; // base64 ou url, ou null
  anexos?: string[];
}


export const CorrespondenceManager: React.FC = () => {
  // Estado local baseado na API real
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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | StatusCorresp>('');
  // Remover estados de edição inline de situação/mensagem

  const [showActionModal, setShowActionModal] = useState(false);
  const [createdData, setCreatedData] = useState<any>(null);



  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await buscarCorrespondencias(pageNumber, pageSize);
      // Assumindo resp.content no formato do DTO
      setLista(resp?.content ?? []);
      setTotalPages(resp?.totalPages ?? 0);
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao buscar correspondências');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [pageNumber]);

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

      // Criação sem arquivos
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

      // 🔍 Buscar empresa pelo nome para obter email
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


  const handleEdit = (corresp: CorrespondenciaDTO) => {
  setEditing(corresp);
  setShowForm(true);
  setFormData({
    arquivos: [], // Não traz arquivos antigos, pois não é possível reanexar arquivos já enviados
    fotoCorrespondencia: corresp.fotoCorrespondencia || null,
    nomeEmpresaConexa: corresp.nomeEmpresaConexa || '',
    remetente: corresp.remetente || '',
    situacao: '', // ou corresp.situacao se existir no DTO
    mensagem: '', // ou corresp.mensagem se existir no DTO
  });
};

  // Remover funções de edição inline de situação/mensagem

  const apagarCorrespondenciaHandle = async (id: string) => {
    try {
  await apagarCorrespondencia(id);
  // Atualiza lista local e dispara evento
  setLista(prev => prev.filter(c => String(c.id) !== id));
  console.debug('[CorrespondenceManager] dispatch empresaAtualizada após exclusão');
  window.dispatchEvent(new CustomEvent('empresaAtualizada', { detail: { entidade: 'Correspondencia', acao: 'EXCLUIR', id } }));
    } catch (error) {
      console.error(error);
    }
  }

  const filtered = lista.filter(c => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      (c.remetente?.toLowerCase() ?? '').includes(s) ||
      (c.nomeEmpresaConexa?.toLowerCase() ?? '').includes(s);
    const matchesStatus = !statusFilter || c.statusCorresp === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: StatusCorresp) => {
    switch (status) {
      case 'ANALISE': return 'bg-blue-100 text-blue-800';
      case 'AVISADA': return 'bg-yellow-100 text-yellow-800';
      case 'DEVOLVIDA': return 'bg-red-100 text-red-800';
      case 'USO_INDEVIDO': return 'bg-purple-100 text-purple-800';
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
            onChange={e => setSearchTerm(e.target.value)}
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
            <option value="USO_INDEVIDO">USO_INDEVIDO</option>
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

      {/* Form Modal */}
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


              {/* === NOVO BLOCO DE ANEXOS === */}
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
              {/* ============================= */}
              
              

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
            credentials: 'include', // <== adiciona isso
            body: JSON.stringify({
             // emailDestino: createdData?.email || '',
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

              // Adiciona cada arquivo com o nome que o backend espera
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
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(c.statusCorresp)}`}>{c.statusCorresp}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => apagarCorrespondenciaHandle(String(c.id))}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
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
