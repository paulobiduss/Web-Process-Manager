import { ElectronAPI } from '@electron-toolkit/preload'
import type { WpmApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: WpmApi
  }
}
