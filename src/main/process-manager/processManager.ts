import { execFile, spawn } from 'child_process'
import { basename } from 'path'
import { shell } from 'electron'
import * as repo from '../database/serversRepository'
import { normalizeCommand } from '../database/serversRepository'
import { scanListeningProcesses } from './portScanner'
import type { ScannedProcess, Server } from '../database/types'

const SYSTEM_EXE = /^(svchost|lsass|system|wininit|services|spoolsv|jhi_service|sqlservr|sqlwriter|mysqld|postgres|nginx|nginxsvc|nx\w*|teamviewer\w*|sunshine|googledrivefs|msmpeng|searchindexer|dllhost|conhost|wmiprvse)\.?(exe|bin)?$/i
const RUNTIME_EXE = /^(python\d*|pythonw|node|php|ruby|dotnet|java|deno|bun|gunicorn|uvicorn|waitress-serve|caddy)\.exe$/i
const CMD_HINTS = /(uvicorn|gunicorn|hypercorn|waitress|flask|fastapi|manage\.py|http\.server|runserver|vite|next(\s+dev|-server|\sstart)|nodemon|ng\s+serve|rails\s+server|artisan\s+serve|spring-boot|http-server|live-server|webpack|nest\s+start)/i

/** Heurística: este processo parece um servidor web de aplicação (não serviço do SO)? */
function isDevServer(proc: ScannedProcess): boolean {
  const exe = (proc.proc || '').toLowerCase()
  if (SYSTEM_EXE.test(exe)) return false
  const cmd = proc.cmd || ''
  return RUNTIME_EXE.test(exe) || CMD_HINTS.test(cmd)
}

const GENERIC_DIRS = new Set([
  'scripts',
  'bin',
  'venv',
  '.venv',
  'env',
  'node_modules',
  'dist',
  'build',
  'src',
  'app',
  'site-packages'
])

/** Deriva um nome amigável a partir do exe/comando. Cosmético e editável depois. */
function deriveName(proc: ScannedProcess, primaryPort: number | null): string {
  // 1) Primeiro diretório "significativo" subindo a partir do exe.
  if (proc.exePath) {
    const parts = proc.exePath.split(/[\\/]/).filter(Boolean)
    parts.pop() // remove o arquivo .exe
    for (let i = parts.length - 1; i >= 0; i--) {
      const dir = parts[i].toLowerCase()
      if (!GENERIC_DIRS.has(dir) && !/^[a-z]:$/i.test(parts[i])) return parts[i]
    }
  }
  // 2) Caminho de script/módulo no comando (ex.: manage.py, main.py).
  const scriptMatch = (proc.cmd || '').match(/([\w.-]+\.(py|js|ts|rb|php))/i)
  if (scriptMatch) return basename(scriptMatch[1])
  // 3) Fallback: processo:porta.
  const exe = proc.proc ? proc.proc.replace(/\.exe$/i, '') : 'server'
  return primaryPort ? `${exe}:${primaryPort}` : exe
}

function primaryPort(ports: number[]): number | null {
  return ports.length ? Math.min(...ports) : null
}

/**
 * Lista servidores: faz scan das portas, persiste/atualiza os dev servers,
 * e mescla com os registros salvos (incluindo os parados).
 */
export async function list(nowIso: string): Promise<Server[]> {
  const scanned = await scanListeningProcesses()

  // Indexa o scan por chave de comando p/ casar com registros salvos.
  const liveByKey = new Map<string, ScannedProcess>()
  for (const p of scanned) {
    if (p.cmd) liveByKey.set(normalizeCommand(p.cmd), p)
  }

  // Persiste/atualiza dev servers detectados.
  for (const p of scanned) {
    if (!isDevServer(p) || !p.cmd) continue
    repo.upsertFromScan({
      name: deriveName(p, primaryPort(p.ports)),
      command: p.cmd,
      cwd: null,
      exeName: p.proc,
      port: primaryPort(p.ports),
      nowIso
    })
  }

  const result: Server[] = []

  // a) Registros salvos (dev) → running se a chave aparece no scan agora.
  for (const s of repo.listStored()) {
    const live = liveByKey.get(s.matchKey)
    result.push({
      ...s,
      status: live ? 'running' : 'stopped',
      pid: live ? live.pid : null,
      ports: live ? live.ports : [],
      port: live ? primaryPort(live.ports) : s.port,
      isDevServer: true
    })
  }

  // b) Processos vivos NÃO-dev (transientes, não persistidos) p/ o modo "mostrar todos".
  const storedKeys = new Set(repo.listStored().map((s) => s.matchKey))
  for (const p of scanned) {
    if (isDevServer(p)) continue
    const key = p.cmd ? normalizeCommand(p.cmd) : `live:${p.pid}`
    if (storedKeys.has(key)) continue
    result.push({
      id: `live:${p.pid}`,
      name: deriveName(p, primaryPort(p.ports)),
      command: p.cmd || '',
      cwd: null,
      matchKey: key,
      exeName: p.proc,
      port: primaryPort(p.ports),
      createdAt: nowIso,
      lastSeenAt: nowIso,
      status: 'running',
      pid: p.pid,
      ports: p.ports,
      isDevServer: false
    })
  }

  return result
}

/** Start = roda o comando salvo numa nova janela de console, no cwd salvo. */
export function start(id: string): { ok: boolean; error?: string } {
  const s = repo.getById(id)
  if (!s) return { ok: false, error: 'Servidor não encontrado.' }
  if (!s.command) return { ok: false, error: 'Sem comando salvo.' }

  try {
    const child = spawn(s.command, {
      cwd: s.cwd || undefined,
      shell: true,
      detached: true,
      windowsHide: false,
      stdio: 'ignore'
    })
    child.unref()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Stop = mata SOMENTE o PID do servidor (árvore), nunca global.
 * Re-scaneia p/ achar o PID vivo correspondente à chave do registro.
 */
export async function stop(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = repo.getById(id)
  // Permite parar também transientes (live:<pid>) vindos do modo "mostrar todos".
  let pid: number | null = null

  if (s) {
    const scanned = await scanListeningProcesses()
    const live = scanned.find((p) => p.cmd && normalizeCommand(p.cmd) === s.matchKey)
    pid = live ? live.pid : null
  } else if (id.startsWith('live:')) {
    pid = Number(id.slice('live:'.length)) || null
  }

  if (!pid) return { ok: false, error: 'Processo não está em execução.' }
  return killTree(pid)
}

function killTree(pid: number): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], (err, _out, stderr) => {
      if (err) resolve({ ok: false, error: stderr || err.message })
      else resolve({ ok: true })
    })
  })
}

/** Abre a URL local do servidor no navegador padrão. */
export async function open(port: number): Promise<void> {
  await shell.openExternal(`http://localhost:${port}`)
}
