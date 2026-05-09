const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

let mainWindow;
let previewWindow = null;
let runningProcess = null;

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    show: false,
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (runningProcess) runningProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── FS roots (drives / home) ──────────────────────────────────────────────────

ipcMain.handle('fs:roots', async () => {
  const roots = [];

  if (process.platform === 'win32') {
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      try { fs.accessSync(drive); roots.push({ name: drive, path: drive, isDir: true, children: [], ext: null }); }
      catch {}
    }
  } else {
    roots.push({ name: os.homedir(), path: os.homedir(), isDir: true, children: [], ext: null });
    roots.push({ name: '/', path: '/', isDir: true, children: [], ext: null });
    if (process.platform === 'darwin') {
      try {
        const vols = fs.readdirSync('/Volumes', { withFileTypes: true });
        for (const v of vols) {
          if (v.isDirectory())
            roots.push({ name: '/Volumes/' + v.name, path: '/Volumes/' + v.name, isDir: true, children: [], ext: null });
        }
      } catch {}
    }
  }
  return roots;
});

// ── Shallow readDir ───────────────────────────────────────────────────────────

const IGNORE = new Set([
  'node_modules', '.git', '__pycache__', '.DS_Store', 'venv', '.venv',
  '$Recycle.Bin', 'System Volume Information', 'pagefile.sys',
  'hiberfil.sys', 'swapfile.sys', 'DumpStack.log.tmp',
]);

ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
    catch { return []; }

    const items = [];
    for (const e of entries) {
      if (IGNORE.has(e.name)) continue;
      if (process.platform !== 'win32' && e.name.startsWith('.')) continue;
      let isDir = false;
      try {
        if (e.isSymbolicLink()) continue;
        isDir = e.isDirectory();
      } catch { continue; }

      items.push({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDir,
        children: isDir ? [] : null,
        ext: isDir ? null : path.extname(e.name).slice(1).toLowerCase(),
      });
    }

    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return items;
  } catch { return []; }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 10 * 1024 * 1024) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch { return null; }
});

ipcMain.handle('fs:writeFile', async (_, { filePath, content }) => {
  try { fs.writeFileSync(filePath, content, 'utf8'); return true; }
  catch { return false; }
});

ipcMain.handle('fs:newFile', async (_, { dirPath, name }) => {
  const full = path.join(dirPath, name);
  fs.writeFileSync(full, '', 'utf8');
  return full;
});

ipcMain.handle('fs:newFolder', async (_, { dirPath, name }) => {
  const full = path.join(dirPath, name);
  fs.mkdirSync(full, { recursive: true });
  return full;
});

ipcMain.handle('fs:delete', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true });
    else fs.unlinkSync(filePath);
    return true;
  } catch { return false; }
});

// ── Runner ────────────────────────────────────────────────────────────────────

ipcMain.handle('run:start', async (_, { filePath, content }) => {
  if (runningProcess) { runningProcess.kill(); runningProcess = null; }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  fs.writeFileSync(filePath, content, 'utf8');

  let cmd, args;
  if (ext === 'py') { cmd = process.platform === 'win32' ? 'python' : 'python3'; args = [filePath]; }
  else if (['js','mjs','cjs'].includes(ext)) { cmd = 'node'; args = [filePath]; }
  else return { error: 'Unsupported file type.' };

  return new Promise((resolve) => {
    runningProcess = spawn(cmd, args, { cwd: path.dirname(filePath) });
    runningProcess.stdout.on('data', d => mainWindow.webContents.send('run:stdout', d.toString()));
    runningProcess.stderr.on('data', d => mainWindow.webContents.send('run:stderr', d.toString()));
    runningProcess.on('close', code => { runningProcess = null; mainWindow.webContents.send('run:done', { code }); });
    runningProcess.on('error', err => { mainWindow.webContents.send('run:error', err.message); resolve({ error: err.message }); });
    resolve({ started: true });
  });
});

ipcMain.handle('run:stop', () => {
  if (runningProcess) {
    runningProcess.kill(); runningProcess = null;
    mainWindow.webContents.send('run:done', { code: -1, killed: true });
    return true;
  }
  return false;
});

ipcMain.handle('run:stdin', (_, data) => {
  if (runningProcess && runningProcess.stdin) runningProcess.stdin.write(data + '\n');
});

// ── HTML Preview ──────────────────────────────────────────────────────────────

ipcMain.handle('preview:open', async (_, { filePath, content }) => {
  fs.writeFileSync(filePath, content, 'utf8');
  if (previewWindow && !previewWindow.isDestroyed()) { previewWindow.loadFile(filePath); previewWindow.focus(); return; }
  previewWindow = new BrowserWindow({
    width: 1000, height: 750, title: 'kaaXcode – Preview',
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  previewWindow.loadFile(filePath);
  previewWindow.on('closed', () => { previewWindow = null; });
});

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => mainWindow.minimize());
ipcMain.on('win:maximize', () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on('win:close', () => mainWindow.close());