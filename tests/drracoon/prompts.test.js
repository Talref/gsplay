const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { compilePrompt } = require('../../src/drracoon/prompts');
const { main } = require('../../scripts/drracoon-prompt');
let root, options;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'raccoon-prompts-'));
  options = {
    templateRoot: path.join(root, 'templates'),
    includeRoot: path.join(root, 'includes')
  };
  await fs.mkdir(options.templateRoot);
  await fs.mkdir(options.includeRoot);
});
afterEach(async () => fs.rm(root, { recursive: true, force: true }));
const template = (text) => fs.writeFile(path.join(options.templateRoot, 'PROMPTUSER.md'), text);
const include = (text) => fs.writeFile(path.join(options.includeRoot, 'DOC.md'), text);

test('inspection CLI compiles without credentials or Discord', async () => {
  await template('CLI {{DOC.md}}');
  await include('fixture');
  const output = { write: jest.fn() };
  await main(['user'], output, options);
  expect(output.write).toHaveBeenCalledWith('CLI fixture');
  await expect(main([], output, options)).rejects.toThrow('Usage');
});

test('ordered repeated includes, external symlink and changes without restart', async () => {
  await template('before\n{{DOC.md}}\nmiddle {{DOC.md}} after');
  const external = path.join(root, 'external.md');
  await fs.writeFile(external, 'hello');
  await fs.symlink(external, path.join(options.includeRoot, 'DOC.md'));
  expect(await compilePrompt('user', options)).toBe('before\nhello\nmiddle hello after');
  await fs.writeFile(external, 'updated');
  expect(await compilePrompt('user', options)).toContain('updated');
});

test.each(['../DOC.md', '/DOC.md', 'dir/DOC.md', 'DOC.txt', '$(command).md', 'DOC.md }} {{'])(
  'rejects invalid include %s',
  async (name) => {
    await template(`{{${name}}}`);
    await expect(compilePrompt('user', options)).rejects.toThrow();
  }
);

test('rejects missing, nested, malformed, oversized and non-file includes', async () => {
  await template('{{DOC.md}}');
  await expect(compilePrompt('user', options)).rejects.toThrow('Cannot read');
  await include('{{NESTED.md}}');
  await expect(compilePrompt('user', options)).rejects.toThrow('Nested');
  await include('x'.repeat(30));
  await expect(compilePrompt('user', { ...options, maxBytes: 20 })).rejects.toThrow();
  await include('x'.repeat(12));
  await template('{{DOC.md}}{{DOC.md}}');
  await expect(compilePrompt('user', { ...options, maxBytes: 22 })).rejects.toThrow('size');
  await template('broken {{DOC.md');
  await expect(compilePrompt('user', options)).rejects.toThrow('syntax');
  await expect(compilePrompt('other', options)).rejects.toThrow('variant');
  await fs.unlink(path.join(options.includeRoot, 'DOC.md'));
  await fs.mkdir(path.join(options.includeRoot, 'DOC.md'));
  await template('{{DOC.md}}');
  await expect(compilePrompt('user', options)).rejects.toThrow('Cannot read');
});
