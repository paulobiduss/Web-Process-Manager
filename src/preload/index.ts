import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Server, UpdateServerInput } from '../main/database/types'

const C = {
  list: 'servers:list',
  start: 'servers:start',
  stop: 'servers:stop',
  open: 'servers:open',
  update: 'servers:update',
  remove: 'servers:remove'
} as const

interface ActionResult {
  ok: boolean
  error?: string
}

// API tipada exposta ao renderer (sem acesso direto ao Node).
const api = {
  list: (): Promise<Server[]> => ipcRenderer.invoke(C.list),
  start: (id: string): Promise<ActionResult> => ipcRenderer.invoke(C.start, id),
  stop: (id: string): Promise<ActionResult> => ipcRenderer.invoke(C.stop, id),
  open: (port: number): Promise<void> => ipcRenderer.invoke(C.open, port),
  update: (id: string, patch: UpdateServerInput): Promise<Server | null> =>
    ipcRenderer.invoke(C.update, id, patch),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke(C.remove, id)
}

export type WpmApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
