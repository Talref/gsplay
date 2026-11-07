const fs = require('node:fs/promises');
const path = require('node:path');

const TEMPLATE_ROOT = path.join(__dirname, 'prompts');
const INCLUDE_ROOT = '/etc/gsplay/prompts';
const MAX_PROMPT_BYTES = 128 * 1024;

async function readBounded(file, ceiling) {
  const handle = await fs.open(file, 'r');
  try {
    if (!(await handle.stat()).isFile()) throw new Error('not a regular file');
    const buffer = Buffer.alloc(ceiling + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > ceiling) throw new Error('expanded prompt size limit exceeded');
    return buffer.subarray(0, size).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function compilePrompt(
  variant,
  { templateRoot = TEMPLATE_ROOT, includeRoot = INCLUDE_ROOT, maxBytes = MAX_PROMPT_BYTES } = {}
) {
  if (!['user', 'staff'].includes(variant)) throw new Error('Prompt variant must be user or staff');
  const source = await readBounded(
    path.join(templateRoot, `PROMPT${variant.toUpperCase()}.md`),
    maxBytes
  );
  const includes = source.matchAll(/\{\{([\s\S]*?)\}\}/g);
  let result = '',
    end = 0;
  for (const match of includes) {
    const name = match[1];
    if (!/^[A-Za-z0-9_-]+\.md$/.test(name)) throw new Error(`Invalid prompt include: ${name}`);
    let content;
    try {
      content = await readBounded(path.join(includeRoot, name), maxBytes);
    } catch {
      throw new Error(`Cannot read prompt include ${name} (missing, unreadable, or too large)`);
    }
    if (/\{\{|\}\}/.test(content)) throw new Error(`Nested prompt include is forbidden: ${name}`);
    result += source.slice(end, match.index) + content;
    end = match.index + match[0].length;
    if (Buffer.byteLength(result) > maxBytes)
      throw new Error('Expanded prompt size limit exceeded');
  }
  result += source.slice(end);
  if (/\{\{|\}\}/.test(result)) throw new Error('Invalid prompt include syntax');
  if (Buffer.byteLength(result) > maxBytes) throw new Error('Expanded prompt size limit exceeded');
  return result;
}

module.exports = { compilePrompt, INCLUDE_ROOT, TEMPLATE_ROOT };
