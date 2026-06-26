import { randomUUID } from 'crypto'
import { getDb } from './db'
import type { Server, UpdateServerInput } from './types'

interface ServerRow {
  id: string
  name: string
  command: string
  cwd: string | null
  match_key: string
  exe_name: string | null
  port: number | null
  created_at: string
  last_seen_at: string | null
}

/** Normaliza a linha de comando p/ usar como chave de identidade estável. */
export function normalizeCommand(cmd: string): string {
  return cmd.replace(/\s+/g, ' ').trim().toLowerCase()
}

function rowToStored(row: ServerRow): Omit<Server, 'status' | 'pid' | 'ports' | 'isDevServer'> {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    cwd: row.cwd,
    matchKey: row.match_key,
    exeName: row.exe_name,
    port: row.port,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  }
}

export type StoredServer = ReturnType<typeof rowToStored>

export function listStored(): StoredServer[] {
  const rows = getDb().prepare('SELECT * FROM servers ORDER BY created_at ASC').all() as ServerRow[]
  return rows.map(rowToStored)
}

export function getById(id: string): StoredServer | null {
  const row = getDb().prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow | undefined
  return row ? rowToStored(row) : null
}

export function findByMatchKey(matchKey: string): StoredServer | null {
  const row = getDb()
    .prepare('SELECT * FROM servers WHERE match_key = ?')
    .get(matchKey) as ServerRow | undefined
  return row ? rowToStored(row) : null
}

/**
 * Insere um servidor recém-descoberto OU atualiza porta/last_seen de um já conhecido.
 * Identidade = match_key (comando normalizado).
 */
export function upsertFromScan(input: {
  name: string
  command: string
  cwd: string | null
  exeName: string | null
  port: number | null
  nowIso: string
}): StoredServer {
  const matchKey = normalizeCommand(input.command)
  const existing = findByMatchKey(matchKey)

  if (existing) {
    getDb()
      .prepare('UPDATE servers SET port = ?, exe_name = ?, last_seen_at = ? WHERE id = ?')
      .run(input.port, input.exeName, input.nowIso, existing.id)
    return getById(existing.id)!
  }

  const id = randomUUID()
  getDb()
    .prepare(
      `INSERT INTO servers (id, name, command, cwd, match_key, exe_name, port, created_at, last_seen_at)
       VALUES (@id, @name, @command, @cwd, @matchKey, @exeName, @port, @createdAt, @lastSeenAt)`
    )
    .run({
      id,
      name: input.name,
      command: input.command,
      cwd: input.cwd,
      matchKey,
      exeName: input.exeName,
      port: input.port,
      createdAt: input.nowIso,
      lastSeenAt: input.nowIso
    })
  return getById(id)!
}

/**
 * Atualiza campos editáveis pelo usuário. Se o comando muda, o match_key
 * é re-derivado p/ continuar casando com o processo que de fato será lançado.
 */
export function updateEditable(id: string, patch: UpdateServerInput): StoredServer | null {
  const current = getById(id)
  if (!current) return null

  const name = patch.name?.trim() || current.name
  const command = patch.command?.trim() || current.command
  const cwd = patch.cwd === undefined ? current.cwd : patch.cwd?.trim() || null
  const matchKey = normalizeCommand(command)

  getDb()
    .prepare('UPDATE servers SET name = ?, command = ?, cwd = ?, match_key = ? WHERE id = ?')
    .run(name, command, cwd, matchKey, id)
  return getById(id)
}

export function remove(id: string): void {
  getDb().prepare('DELETE FROM servers WHERE id = ?').run(id)
}
