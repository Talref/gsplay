#!/usr/bin/env node

const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const processes = [
  {
    name: 'api', color: '\x1b[36m', cwd: root,
    args: [path.join(root, 'node_modules/nodemon/bin/nodemon.js'), '--watch', 'src/v2', '--ext', 'js', 'src/v2/server.js']
  },
  {
    name: 'worker', color: '\x1b[35m', cwd: root,
    args: [path.join(root, 'node_modules/nodemon/bin/nodemon.js'), '--watch', 'src/v2', '--ext', 'js', 'src/v2/worker.js']
  },
  {
    name: 'web', color: '\x1b[32m', cwd: path.join(root, 'gsplay-frontend'),
    args: [path.join(root, 'gsplay-frontend/node_modules/vite/bin/vite.js'), '--strictPort']
  }
];
const reset = '\x1b[0m';
const children = new Map();
let stopping = false;
let exitCode = 0;

function writePrefixed(name, color, chunk, stream) {
  const prefix = `${color}[${name}]${reset} `;
  const text = chunk.toString();
  stream.write(text.split(/(?<=\n)/).filter(Boolean).map((line) => `${prefix}${line}`).join(''));
}

function terminate(child, signal) {
  try {
    child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(`[dev] Could not send ${signal} to ${child.pid}: ${error.message}`);
  }
}

function allChildrenClosed() {
  return [...children.values()].every(({ closed }) => closed);
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const { child } of children.values()) terminate(child, 'SIGTERM');
  setTimeout(() => {
    for (const { child, closed } of children.values()) if (!closed) terminate(child, 'SIGKILL');
  }, 5_000).unref();
}

for (const definition of processes) {
  const child = spawn(process.execPath, definition.args, {
    cwd: definition.cwd,
    env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? '1' : '0' },
    // Keep every service in npm's foreground process group. Ctrl+C is then
    // delivered by the terminal to npm, this launcher, and every service at
    // the same time. stdin remains closed so no child can alter TTY state.
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.set(definition.name, { child, closed: false });
  child.stdout.on('data', (chunk) => writePrefixed(definition.name, definition.color, chunk, process.stdout));
  child.stderr.on('data', (chunk) => writePrefixed(definition.name, definition.color, chunk, process.stderr));
  child.once('error', (error) => {
    console.error(`[dev] Could not start ${definition.name}: ${error.message}`);
    stopAll(1);
  });
  child.once('close', (code, signal) => {
    children.get(definition.name).closed = true;
    if (!stopping) {
      console.error(`[dev] ${definition.name} exited unexpectedly (${signal || code}); stopping the development stack.`);
      stopAll(code || 1);
    }
    if (stopping && allChildrenClosed()) process.exit(exitCode);
  });
}

process.once('SIGINT', () => stopAll(0));
process.once('SIGTERM', () => stopAll(0));