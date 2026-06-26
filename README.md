# Web Process Manager

> Painel desktop para **descobrir, abrir e controlar servidores web locais** rodando na sua máquina — sem cadastrar URL na mão.

Aplicativo Windows (Electron) que varre as portas TCP em escuta, identifica automaticamente os servidores de aplicação que você subiu (uvicorn, Flask, Node, Vite, etc.) e mostra cada um como um card com status, porta, PID e botões de **Start / Stop / Abrir**.


> A imagem acima é uma prévia da interface. Para usar uma captura real, rode `npm run dev`, tire um print da janela e salve em `docs/screenshot.png` (e troque o link acima).

---

## Para que serve

Quem trabalha com vários projetos web locais (APIs, dashboards internos) acaba com **vários terminais PowerShell abertos**, cada um rodando um `uvicorn`/`flask`/`npm run dev`. Fica difícil lembrar:

- o que está no ar e em qual porta;
- qual processo derrubar quando precisa reiniciar;
- como subir de novo um servidor que você parou.

O **Web Process Manager** centraliza isso num painel só:

- **Vê tudo que está rodando** — detecção automática, zero cadastro de URL.
- **Abre** o app no navegador com um clique.
- **Para** um servidor matando só o PID dele (nunca processos globais).
- **Reinicia** rodando o mesmo comando que você usou.

Pensado para **uso interno / desenvolvimento local**.

---

## Como funciona

1. **Scan de portas** — a cada atualização o app roda `Get-NetTCPConnection` + `Win32_Process` (via PowerShell) e lista os processos com porta TCP em escuta, junto da linha de comando de cada um.
2. **Heurística de "dev server"** — filtra o ruído do sistema (svchost, lsass, serviços) e mostra por padrão só runtimes de aplicação (`python`, `node`, `php`, `ruby`, `dotnet`, `java`…) ou comandos com cara de servidor (`uvicorn`, `flask`, `vite`, `gunicorn`…). Um toggle **"Mostrar todos"** revela o resto.
3. **Memória** — cada servidor detectado é salvo em SQLite local (nome, comando, porta). Quando o processo some, o card continua lá como **"parado"**, pronto para reiniciar.
4. **Ações por PID**
   - **Stop** → `taskkill /PID <pid> /T /F` (só o processo daquele card).
   - **Start** → roda o comando salvo numa nova janela de console, no diretório de trabalho configurado.
   - **Abrir** → abre `http://localhost:<porta>` no navegador padrão.

### Sobre o diretório de trabalho (cwd)

O Windows **não expõe o diretório atual de um processo alheio**. Então, para servidores que você subiu fora do app, o **Start** só funciona depois de você informar a pasta uma vez: clique em **Editar** no card, ajuste **comando** e **pasta de trabalho**, e salve. Isso fica guardado no SQLite.

---

## Stack

- **Electron** + **electron-vite** (main / preload / renderer isolados)
- **React** + **TypeScript**
- **better-sqlite3** (persistência local, síncrona)
- **electron-builder** (empacotamento `.exe`)

Arquitetura em camadas no processo main:

```
src/main/
  database/         # SQLite: schema + repositório de servidores
  process-manager/  # scan de portas, Start/Stop/Open, heurística dev-server
  ipc.ts            # canais IPC servers:*
src/preload/        # API tipada exposta ao renderer (contextBridge)
src/renderer/       # dashboard React (cards, toggle, auto-refresh)
```

---

## Rodando localmente

> ⚠️ **Não rode dentro do Google Drive / OneDrive.** `node_modules` quebra em drives virtuais. Use disco local (ex.: `C:\dev`). Detalhes e armadilhas de setup em [`DEV-SETUP.md`](DEV-SETUP.md).

```powershell
npm install        # baixa Electron + compila better-sqlite3 p/ o ABI do Electron
npm run dev        # painel em desenvolvimento (hot reload)
npm run typecheck  # checagem de tipos (main + renderer)
npm run build:win  # gera o instalador .exe (NSIS) em dist/
```

O banco fica em `%APPDATA%\web-process-manager\wpm.db`.

---

## Limitações / próximos passos

- PID é best-effort para servidores detectados de fora; confiável para os que o app inicia.
- Sem monitoramento de CPU/RAM ainda (planejado).
- Sem agrupamento de apps / "abrir grupo" ainda (planejado).
- Sem tray icon ainda (planejado).
- Detecção é específica de Windows (usa PowerShell).

---

## Feito com ajuda de IA

Este projeto foi desenvolvido com auxílio de **IA** (Claude / Claude Code) na escrita do código, arquitetura e documentação. As decisões de produto e a validação foram do autor.

## Licença

[MIT](LICENSE) — uso livre.
