import { ipcMain } from 'electron'
import * as repo from './database/serversRepository'
import * as processManager from './process-manager/processManager'
import type { Server, UpdateServerInput } from './database/types'

export const CHANNELS = {
  list: 'servers:list',
  start: 'servers:start',
  stop: 'servers:stop',
  open: 'servers:open',
  update: 'servers:update',
  remove: 'servers:remove'
} as const

export function registerIpc(): void {
  ipcMain.handle(CHANNELS.list, (): Promise<Server[]> =>
    processManager.list(new Date().toISOString())
  )

  ipcMain.handle(CHANNELS.start, (_e, id: string) => processManager.start(id))

  ipcMain.handle(CHANNELS.stop, (_e, id: string) => processManager.stop(id))

  ipcMain.handle(CHANNELS.open, (_e, port: number) => processManager.open(port))

  ipcMain.handle(CHANNELS.update, (_e, id: string, patch: UpdateServerInput) =>
    repo.updateEditable(id, patch)
  )

  ipcMain.handle(CHANNELS.remove, (_e, id: string) => {
    repo.remove(id)
    return true
  })
}
