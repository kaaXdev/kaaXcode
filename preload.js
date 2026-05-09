const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kaa', {
  // File system
  getRoots:   ()         => ipcRenderer.invoke('fs:roots'),
  readDir:    (p)        => ipcRenderer.invoke('fs:readDir', p),
  readFile:   (p)        => ipcRenderer.invoke('fs:readFile', p),
  writeFile:  (p, c)     => ipcRenderer.invoke('fs:writeFile', { filePath: p, content: c }),
  newFile:    (dir, name)=> ipcRenderer.invoke('fs:newFile',   { dirPath: dir, name }),
  newFolder:  (dir, name)=> ipcRenderer.invoke('fs:newFolder', { dirPath: dir, name }),
  deleteItem: (p)        => ipcRenderer.invoke('fs:delete', p),

  // Runner
  runStart: (filePath, content) => ipcRenderer.invoke('run:start', { filePath, content }),
  runStop:  ()     => ipcRenderer.invoke('run:stop'),
  runStdin: (data) => ipcRenderer.invoke('run:stdin', data),

  // Listeners
  onStdout:  (cb) => { ipcRenderer.removeAllListeners('run:stdout'); ipcRenderer.on('run:stdout', (_e, d) => cb(d)); },
  onStderr:  (cb) => { ipcRenderer.removeAllListeners('run:stderr'); ipcRenderer.on('run:stderr', (_e, d) => cb(d)); },
  onRunDone: (cb) => { ipcRenderer.removeAllListeners('run:done');   ipcRenderer.on('run:done',   (_e, d) => cb(d)); },
  onRunError:(cb) => { ipcRenderer.removeAllListeners('run:error');  ipcRenderer.on('run:error',  (_e, d) => cb(d)); },

  // HTML preview
  previewOpen: (filePath, content) => ipcRenderer.invoke('preview:open', { filePath, content }),

  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close:    () => ipcRenderer.send('win:close'),
});