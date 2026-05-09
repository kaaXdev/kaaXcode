⌘ kaaXcode
A lightweight, portable code editor for Windows built with Electron.
Features

File Explorer — Browse, open, create, rename and delete files and folders
Multi-tab Editor — Open multiple files at once with unsaved change indicators
Run Code — Execute Python (.py) and JavaScript (.js) files directly in the built-in terminal
HTML Preview — Live preview for .html files in a separate window
Search — Search across all open tabs
Terminal — Built-in output panel with stdin support
Portable — Single .exe, no installation required

Project Structure
kaaXcode/
  main.js          # Electron main process
  preload.js       # Context bridge (IPC)
  index.html       # UI + editor logic
  build/
    icon.ico       # App icon
  package.json
Keyboard Shortcuts
ShortcutActionCtrl+OOpen folderCtrl+SSave fileCtrl+RRun codeCtrl+PHTML previewCtrl+WClose tabCtrl+``  ``Focus terminal input
Supported Languages
LanguageRunPython .py✅ (requires python3)JavaScript .js✅ (requires node)HTML .htmlPreview onlyOthersEdit only
Requirements

Windows 10 or later
To run Python files: Python 3 installed
To run JavaScript files: Node.js installed
