#!/usr/bin/env node

const { spawn } = require('node:child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  { name: 'api', color: '\x1b[36m', command: npmCommand, args: ['run', 'dev:api'] },
  { name: 'worker', color: '\x1b[35m', command: npmCommand, args: ['run', 'dev:worker'] },
  { name: 'web', color: '\x1b[32m', command: npmCommand, args: ['run', 'dev:frontend'] }
];
const reset = '\x1b[0m';
const children = new Map();
let stopping = false;

function writePrefixed(name, color, chunk, stream) {
  const prefix = `${color}[${name}]${reset} `;
  const text = chunk.toString();
  stream.write(text.split(/(?<=\n)/).filter(Boolean).map((line) => `${prefix}${line}`).join(''));
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) {
    if (!child.killed) {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    }
  }
  setTimeout(() => {
    for (const child of children.values()) {
      if (!child.killed) {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 5_000).unref();
}

for (const processDefinition of processes) {
  const child = spawn(processDefinition.command, processDefinition.args, { cwd: process.cwd(), env: process.env, detached: process.platform !== 'win32', stdio: ['inherit', 'pipe', 'pipe'] });
  children.set(processDefinition.name, child);
  child.stdout.on('data', (chunk) => writePrefixed(processDefinition.name, processDefinition.color, chunk, process.stdout));
  child.stderr.on('data', (chunk) => writePrefixed(processDefinition.name, processDefinition.color, chunk, process.stderr));
  child.once('error', (error) => { console.error(`[dev] Could not start ${processDefinition.name}: ${error.message}`); stopAll(1); });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[dev] ${processDefinition.name} exited unexpectedly (${signal || code}); stopping the development stack.`);
      stopAll(code || 1);
    }
  });
}

process.once('SIGINT', () => stopAll(0));
process.once('SIGTERM', () => stopAll(0));