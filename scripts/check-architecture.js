#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coreRoot = path.join(root, 'src/core');
const forbiddenRoots = [path.join(root, 'src/api'), path.join(root, 'src/worker')];
const violations = [];

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
  });
}

for (const file of javascriptFiles(coreRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = source.matchAll(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g);
  for (const match of imports) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (
      forbiddenRoots.some(
        (forbidden) => target === forbidden || target.startsWith(`${forbidden}${path.sep}`)
      )
    ) {
      violations.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

if (violations.length) {
  console.error('Core must not import API or worker modules:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('Architecture boundaries are valid.');
}
