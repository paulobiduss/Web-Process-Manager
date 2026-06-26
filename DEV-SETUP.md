# Dev Setup — Web Process Manager

Notas de ambiente (Windows). O scaffold é padrão electron-vite; o que segue são
**armadilhas específicas desta máquina** descobertas no setup inicial.

## 1. NÃO rodar dentro do Google Drive (G:\)

`node_modules` **não funciona** em `G:\Meu Drive\…` (Google Drive File Stream):

- Extração de tarballs falha com `EBADF: bad file descriptor, write` / `EPERM` / `ENOTEMPTY`.
- Junction (`mklink /J`) também é impossível: o link precisa morar em volume NTFS, e G:\ não é.

➡️ O projeto vive em **`C:\dev\web-process-manager`** (disco local NTFS). A fonte pode ser
versionada/copiada para o Drive via Git, mas `node_modules` fica só no local.

## 2. Rodar npm pelo PowerShell com node no PATH

Scripts de lifecycle do npm chamam `cmd /c node …`. Em alguns shells o `cmd` não acha
o `node` (PATH em formato POSIX vindo do Git Bash, ou PATH truncado). Sempre rode:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location 'C:\dev\web-process-manager'
npm install   # ou npm run dev / build
```

## 3. npm 11 — allow-scripts

O npm 11 bloqueia install scripts de dependências por padrão. Já estão aprovados em
`package.json` → `allowScripts`. Após um `npm install` limpo, se vir o aviso
`packages have install scripts not yet covered by allowScripts`:

```powershell
npm approve-scripts --all
npm install        # roda os scripts aprovados (download do Electron, rebuild nativo)
```

`electron-builder install-app-deps` (nosso `postinstall`) recompila `better-sqlite3`
para o ABI do Electron — necessário, senão dá crash `NODE_MODULE_VERSION`.

## 4. Electron binary não extraído (extract-zip falha em silêncio)

Se após o install `node_modules\electron\dist\electron.exe` **não existir** (o
`extract-zip` do instalador do Electron falha mudo nesta máquina, extrai só `locales`),
extraia o zip cacheado manualmente:

```powershell
$zip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache" -Recurse -Filter *.zip | Select-Object -First 1 -ExpandProperty FullName
$out = 'C:\dev\web-process-manager\node_modules\electron\dist'
if (Test-Path $out) { cmd /c "rmdir /s /q `"$out`"" }
New-Item -ItemType Directory $out | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $out)
[System.IO.File]::WriteAllText("$out\..\path.txt", "electron.exe")
```

Verificar: `node_modules\electron\dist\electron.exe --version` → `v39.8.10`.

## Comandos

```powershell
npm run dev        # dashboard em dev (HMR)
npm run typecheck  # tsc main + web
npm run build:win  # gera o .exe (NSIS) em dist/
```

## Onde fica o banco

SQLite em `%APPDATA%\web-process-manager\wpm.db` (criado na 1ª execução).
