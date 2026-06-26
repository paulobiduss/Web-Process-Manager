import { useCallback, useEffect, useRef, useState } from 'react'
import type { Server } from '../../main/database/types'
import ServerCard from './components/ServerCard'
import styles from './App.module.css'

const REFRESH_MS = 5000

function App(): React.JSX.Element {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setServers(await window.api.list())
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
    timer.current = setInterval(refresh, REFRESH_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [refresh])

  async function handleStart(id: string): Promise<void> {
    setBusy(true)
    const res = await window.api.start(id)
    if (!res.ok) alert(`Falha ao iniciar: ${res.error ?? 'erro desconhecido'}`)
    // Servidor leva um instante p/ subir a porta — recarrega depois.
    setTimeout(() => refresh().finally(() => setBusy(false)), 1800)
  }

  async function handleStop(id: string): Promise<void> {
    setBusy(true)
    const res = await window.api.stop(id)
    if (!res.ok) alert(`Falha ao parar: ${res.error ?? 'erro desconhecido'}`)
    await refresh()
    setBusy(false)
  }

  async function handleOpen(port: number): Promise<void> {
    await window.api.open(port)
  }

  async function handleSave(
    id: string,
    patch: { name: string; command: string; cwd: string | null }
  ): Promise<void> {
    await window.api.update(id, patch)
    await refresh()
  }

  async function handleRemove(id: string): Promise<void> {
    await window.api.remove(id)
    await refresh()
  }

  const visible = servers.filter((s) => showAll || s.isDevServer)
  const running = servers.filter((s) => s.isDevServer && s.status === 'running').length
  const known = servers.filter((s) => s.isDevServer).length

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Web Process Manager</h1>
          <span className={styles.count}>
            {running} rodando / {known} servidor(es) conhecido(s)
          </span>
        </div>
        <div className={styles.controls}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Mostrar todos os processos
          </label>
          <button className={styles.refresh} onClick={refresh} disabled={busy}>
            Atualizar
          </button>
        </div>
      </header>

      {loading ? (
        <p className={styles.empty}>Escaneando portas…</p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>
          Nenhum servidor detectado. Suba um servidor (ex.: uvicorn) e clique em Atualizar.
        </p>
      ) : (
        <div className={styles.grid}>
          {visible.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              onStart={handleStart}
              onStop={handleStop}
              onOpen={handleOpen}
              onSave={handleSave}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default App
