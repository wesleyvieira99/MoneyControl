const { app, BrowserWindow, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');

let splashWindow = null;
let mainWindow = null;
let backendProcess = null;

const BACKEND_PORT = 8081;
const BACKEND_HEALTH_PATH = '/actuator/health';
const ELECTRON_LOG_FILE = '/tmp/moneycontrol-electron.log';

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true } }]);

function runCommand(command, args, cwd, timeout = 120000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0'
    }
  });

  return {
    ok: result.status === 0,
    status: result.status,
    output: ((result.stdout || '') + (result.stderr || '')).trim()
  };
}

function logElectron(message) {
  try {
    fs.appendFileSync(ELECTRON_LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {
    console.error('Falha ao escrever log do Electron:', e);
  }
}

function pullLatestFromGithub() {
  const repoRoot = getRepoRoot();
  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    logElectron('pullLatestFromGithub: sem .git, ignorando pull');
    return { updated: false, output: '' };
  }

  logElectron('pullLatestFromGithub: iniciando git pull');
  const pull = runCommand('git', ['-c', 'credential.interactive=never', 'pull', '--ff-only', 'origin', 'main'], repoRoot, 25000);
  if (!pull.ok) {
    console.warn('Falha ao executar git pull no startup:', pull.output);
    logElectron(`pullLatestFromGithub: falha status=${pull.status} output=${pull.output}`);
    return { updated: false, output: pull.output };
  }

  const updated = !/Already up to date\.|Ja esta atualizado\./i.test(pull.output);
  logElectron(`pullLatestFromGithub: sucesso updated=${updated}`);
  return { updated, output: pull.output };
}

function ensureBuildArtifacts(pullUpdated) {
  if (app.isPackaged) {
    logElectron('ensureBuildArtifacts: app empacotado, sem prepare local');
    return;
  }

  const repoRoot = getRepoRoot();
  const frontendDist1 = path.join(repoRoot, 'frontend', 'dist', 'frontend', 'browser', 'index.html');
  const frontendDist2 = path.join(repoRoot, 'frontend', 'dist', 'frontend', 'index.html');
  const backendJar = path.join(repoRoot, 'backend', 'target', 'moneycontrol-backend-0.0.1-SNAPSHOT.jar');

  const missingFrontend = !fs.existsSync(frontendDist1) && !fs.existsSync(frontendDist2);
  const missingBackend = !fs.existsSync(backendJar);

  if (!pullUpdated && !missingFrontend && !missingBackend) {
    logElectron('ensureBuildArtifacts: artefatos ok, sem rebuild');
    return;
  }

  logElectron(`ensureBuildArtifacts: rebuild iniciado pullUpdated=${pullUpdated} missingFrontend=${missingFrontend} missingBackend=${missingBackend}`);
  const prepare = runCommand('npm', ['run', 'desktop:prepare'], repoRoot, 0);
  if (!prepare.ok) {
    logElectron(`ensureBuildArtifacts: falha ${prepare.output}`);
    throw new Error('Falha ao preparar frontend/backend: ' + (prepare.output || 'sem detalhes'));
  }
  logElectron('ensureBuildArtifacts: rebuild concluido');
}

function getRepoRoot() {
  return app.isPackaged ? process.env.MONEYCONTROL_REPO_ROOT || process.cwd() : path.resolve(__dirname, '..');
}

function resolveBackendJar() {
  const repoRoot = getRepoRoot();
  const unpacked = path.join(process.resourcesPath || '', 'backend', 'target', 'moneycontrol-backend-0.0.1-SNAPSHOT.jar');
  const local = path.join(repoRoot, 'backend', 'target', 'moneycontrol-backend-0.0.1-SNAPSHOT.jar');
  if (app.isPackaged && fs.existsSync(unpacked)) return unpacked;
  return local;
}

function resolveFrontendIndex() {
  const repoRoot = getRepoRoot();
  const localCandidates = [
    path.join(repoRoot, 'frontend', 'dist', 'frontend', 'browser', 'index.html'),
    path.join(repoRoot, 'frontend', 'dist', 'frontend', 'index.html')
  ];
  const packagedCandidates = [
    path.join(process.resourcesPath || '', 'frontend', 'dist', 'frontend', 'browser', 'index.html'),
    path.join(process.resourcesPath || '', 'frontend', 'dist', 'frontend', 'index.html')
  ];

  const candidates = app.isPackaged ? [...packagedCandidates, ...localCandidates] : localCandidates;
  return candidates.find((f) => fs.existsSync(f));
}

function waitForBackend(timeoutMs = 120000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port: BACKEND_PORT,
          path: BACKEND_HEALTH_PATH,
          timeout: 3000
        },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            resolve();
            return;
          }
          retryOrFail();
        }
      );

      req.on('error', retryOrFail);
      req.on('timeout', () => {
        req.destroy();
        retryOrFail();
      });
    };

    const retryOrFail = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Backend nao respondeu dentro do tempo limite.'));
        return;
      }
      setTimeout(ping, 1500);
    };

    ping();
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 620,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    center: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow && splashWindow.show());
}

function createMainWindow(frontendIndexPath) {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1200,
    minHeight: 760,
    title: 'MoneyControl',
    show: false,
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(frontendIndexPath);
  logElectron(`Carregando frontend: ${frontendIndexPath}`);

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, validatedURL) => {
    logElectron(`did-fail-load code=${code} desc=${desc} url=${validatedURL}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logElectron(`renderer console level=${level} ${sourceId}:${line} ${message}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logElectron(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logElectron('did-finish-load ok');
    setTimeout(async () => {
      try {
        const snapshot = await mainWindow.webContents.executeJavaScript(`(() => {
          const appRoot = document.querySelector('app-root');
          const text = (document.body.innerText || '').trim();
          return {
            href: location.href,
            hash: location.hash,
            pathname: location.pathname,
            appRootChildren: appRoot ? appRoot.childElementCount : -1,
            appRootHtmlSize: appRoot ? appRoot.innerHTML.length : -1,
            bodyTextSize: text.length,
            bodyTextHead: text.slice(0, 180)
          };
        })();`, true);
        logElectron(`dom snapshot ${JSON.stringify(snapshot)}`);
      } catch (e) {
        logElectron(`dom snapshot erro: ${String(e && e.message ? e.message : e)}`);
      }
    }, 2000);
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const jarPath = resolveBackendJar();
  if (!fs.existsSync(jarPath)) {
    throw new Error('Backend JAR nao encontrado em: ' + jarPath + '. Execute: npm run desktop:prepare');
  }

  const repoRoot = getRepoRoot();
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const args = [
    '-jar',
    jarPath,
    '--server.port=8081',
    `--spring.datasource.url=jdbc:h2:file:${path.join(dataDir, 'moneycontrol')};AUTO_SERVER=TRUE`,
    '--spring.web.cors.allowed-origins=http://localhost:4200,null,app://.'
  ];

  backendProcess = spawn('java', args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      MONEYCONTROL_REPO_ROOT: repoRoot
    },
    stdio: 'ignore'
  });

  backendProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error('Backend encerrou com codigo:', code);
    }
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  backendProcess = null;
}

async function bootDesktopApp() {
  logElectron('bootDesktopApp: inicio');
  createSplashWindow();
  logElectron('bootDesktopApp: splash criada');
  const pull = pullLatestFromGithub();
  ensureBuildArtifacts(pull.updated);
  logElectron('bootDesktopApp: iniciando backend');
  startBackend();
  logElectron('bootDesktopApp: aguardando backend');
  await waitForBackend();
  logElectron('bootDesktopApp: backend pronto');

  const frontendIndex = resolveFrontendIndex();
  if (!frontendIndex) {
    throw new Error('Frontend compilado nao encontrado. Execute: npm run desktop:prepare');
  }

  createMainWindow(frontendIndex);
  logElectron('bootDesktopApp: main window criada');
}

app.whenReady().then(async () => {
  logElectron('app.whenReady start');
  try {
    await bootDesktopApp();
  } catch (err) {
    logElectron(`bootDesktopApp erro: ${String(err && err.message ? err.message : err)}`);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    dialog.showErrorBox(
      'Falha ao iniciar o MoneyControl',
      String(err && err.message ? err.message : err)
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const frontendIndex = resolveFrontendIndex();
      if (frontendIndex) {
        createMainWindow(frontendIndex);
      }
    }
  });
});

process.on('uncaughtException', (err) => {
  logElectron(`uncaughtException: ${err && err.stack ? err.stack : String(err)}`);
});

process.on('unhandledRejection', (reason) => {
  logElectron(`unhandledRejection: ${String(reason)}`);
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
