import { execFile } from 'child_process'
import type { ScannedProcess } from '../database/types'

// Enumera processos com portas TCP em escuta + sua linha de comando.
// Usa PowerShell (Get-NetTCPConnection + Win32_Process) e devolve JSON.
const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$conns = Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalAddress -in '0.0.0.0','127.0.0.1','::','::1' }
$byPid = @{}
foreach ($c in $conns) {
  $procId = [int]$c.OwningProcess
  if ($procId -le 0) { continue }
  if (-not $byPid.ContainsKey($procId)) { $byPid[$procId] = New-Object System.Collections.Generic.List[int] }
  if (-not $byPid[$procId].Contains([int]$c.LocalPort)) { $byPid[$procId].Add([int]$c.LocalPort) }
}
$out = foreach ($procId in $byPid.Keys) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
  if ($p) {
    [PSCustomObject]@{
      pid     = $procId
      ports   = ($byPid[$procId] | Sort-Object)
      proc    = $p.Name
      exePath = $p.ExecutablePath
      cmd     = $p.CommandLine
    }
  }
}
ConvertTo-Json -InputObject @($out) -Depth 4 -Compress
`

export function scanListeningProcesses(): Promise<ScannedProcess[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout?.trim()) {
          resolve([])
          return
        }
        try {
          const parsed = JSON.parse(stdout) as ScannedProcess[]
          resolve(Array.isArray(parsed) ? parsed : [parsed])
        } catch {
          resolve([])
        }
      }
    )
  })
}
