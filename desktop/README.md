# MoneyControl Desktop (macOS)

Este projeto agora pode rodar como aplicativo desktop nativo via Electron.

## 1) Preparar build

Na raiz do repositório:

```bash
npm install
npm run desktop:prepare
```

Esse processo:
- compila o frontend Angular em `frontend/dist/frontend`
- empacota o backend Spring Boot JAR em `backend/target`

## 2) Rodar como app desktop (desenvolvimento)

```bash
npm run desktop:run
```

Abre a janela nativa do MoneyControl, sem terminal de backend/frontend separado.

## 2.1) Fluxo de inicializacao atual

- Ao iniciar, o app executa `git pull --ff-only origin main` automaticamente.
- Se vier alteracao nova (ou se faltar build), ele recompila frontend/backend.
- Durante esse processo, a splash screen animada permanece visivel.

## 3) Gerar aplicativo instalável para macOS

```bash
npm run desktop:build
```

O instalador `.dmg` será gerado em `desktop/dist/`.

## 4) Instalar no macOS e manter no Dock

- O app pode ser colocado em `/Applications/MoneyControl.app`.
- Depois de aberto ao menos uma vez, pode ser fixado no Dock para abrir com um clique.

## Observações

- O botão lateral "Salvar posição" cria backup em `history/` e tenta executar:
  - `git add`
  - `git commit`
  - `git push origin main`
- Para o push funcionar, o repositório precisa ter autenticação GitHub já configurada no macOS.
