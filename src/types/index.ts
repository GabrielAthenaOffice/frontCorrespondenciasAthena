export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Company {
  id: number;
  nome: string;
  remetente: string;
  foto?: string;
  createdAt: Date;
}

export interface Correspondence {
  id: number;
  dataRecebimento: Date;
  dataAvisoConexa?: Date;
  fotoCorrespondencia?: string;
  nomeEmpresaConexa: string;
  remetente: string;
  statusCorresp: 'RECEBIDA' | 'NOTIFICADA' | 'RETIRADA' | 'DEVOLVIDA';
}

export interface AuditLog {
  id: number;
  dataHora: Date;
  entidadeId: number;
  acaoRealizada: string;
  detalhe?: string;
  entidade: 'CORRESPONDENCE' | 'COMPANY';
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}