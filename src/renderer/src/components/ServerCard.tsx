import { useState } from 'react'
import type { Server } from '../../../main/database/types'
import styles from './ServerCard.module.css'

interface Props {
  server: Server
  onStart: (id: string) => void
  onStop: (id: string) => void
  onOpen: (port: number) => void
  onSave: (id: string, patch: { name: string; command: string; cwd: string | null }) => void
  onRemove: (id: string) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function ServerCard({ server, onStart, onStop, onOpen, onSave, onRemove }: Props): React.JSX.Element {
  const running = server.status === 'running'
  const port = server.port
  const editable = server.isDevServer // transientes (não persistidos) não editam

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(server.name)
  const [command, setCommand] = useState(server.command)
  const [cwd, setCwd] = useState(server.cwd ?? '')

  function save(): void {
    onSave(server.id, { name: name.trim(), command: command.trim(), cwd: cwd.trim() || null })
    setEditing(false)
  }

  function cancel(): void {
    setName(server.name)
    setCommand(server.command)
    setCwd(server.cwd ?? '')
    setEditing(false)
  }

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.name} title={server.name}>
          {server.name}
        </span>
        <span className={`${styles.badge} ${running ? styles.running : styles.stopped}`}>
          {running ? 'rodando' : 'parado'}
        </span>
      </div>

      {port != null ? (
        <button className={styles.url} onClick={() => onOpen(port)} disabled={!running}>
          http://localhost:{port}
        </button>
      ) : (
        <span className={styles.noport}>sem porta</span>
      )}

      <div className={styles.meta}>
        <span>Processo: {server.exeName ?? '—'}</span>
        <span>PID: {server.pid ?? '—'}</span>
        {server.ports.length > 1 && <span>Portas: {server.ports.join(', ')}</span>}
        <span>Visto: {formatDate(server.lastSeenAt)}</span>
      </div>

      {editing ? (
        <div className={styles.editor}>
          <label className={styles.field}>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.field}>
            Comando (p/ Start)
            <textarea rows={2} value={command} onChange={(e) => setCommand(e.target.value)} />
          </label>
          <label className={styles.field}>
            Pasta de trabalho (cwd)
            <input
              value={cwd}
              placeholder="ex.: C:\dev\loja-api"
              onChange={(e) => setCwd(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.save}`} onClick={save}>
              Salvar
            </button>
            <button className={styles.btn} onClick={cancel}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <code className={styles.cmd} title={server.command}>
            {server.command || '—'}
          </code>
          <div className={styles.actions}>
            {running ? (
              <button className={`${styles.btn} ${styles.stop}`} onClick={() => onStop(server.id)}>
                Stop
              </button>
            ) : (
              editable && (
                <button
                  className={`${styles.btn} ${styles.start}`}
                  onClick={() => onStart(server.id)}
                >
                  Start
                </button>
              )
            )}
            {editable && (
              <button className={styles.btn} onClick={() => setEditing(true)}>
                Editar
              </button>
            )}
            {editable && (
              <button
                className={`${styles.btn} ${styles.remove}`}
                onClick={() => onRemove(server.id)}
                title="Esquecer este servidor"
              >
                Remover
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ServerCard
