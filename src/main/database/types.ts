export type ServerStatus = 'running' | 'stopped'

/** Servidor local descoberto (e persistido) pelo scan de portas. */
export interface Server {
  id: string
  /** Nome amigável (derivado do comando/pasta; editável). */
  name: string
  /** Linha de comando p/ relançar (editável). */
  command: string
  /** Diretório de trabalho p/ relançar (editável; não detectável de fora). */
  cwd: string | null
  /** Chave de identidade = comando normalizado, p/ casar scan ↔ registro. */
  matchKey: string
  /** Nome do executável detectado (ex.: python.exe). */
  exeName: string | null
  /** Porta principal vista por último. */
  port: number | null
  createdAt: string
  lastSeenAt: string | null

  // ---- runtime (não persistido como verdade; vem do scan) ----
  status: ServerStatus
  pid: number | null
  /** Todas as portas em escuta detectadas agora. */
  ports: number[]
  /** Heurística: parece servidor web de app (não serviço do sistema). */
  isDevServer: boolean
}

/** Linha bruta do scanner de portas (1 processo). */
export interface ScannedProcess {
  pid: number
  ports: number[]
  proc: string | null
  exePath: string | null
  cmd: string | null
}

export interface UpdateServerInput {
  name?: string
  command?: string
  cwd?: string | null
}
