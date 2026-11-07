#!/usr/bin/env node
const { compilePrompt } = require('../src/drracoon/prompts');

async function main(args = process.argv.slice(2), output = process.stdout, options) {
  if (args.length !== 1) throw new Error('Usage: npm run drracoon:prompt -- user|staff');
  output.write(await compilePrompt(args[0], options));
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = { main };
