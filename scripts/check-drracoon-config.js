#!/usr/bin/env node
const { loadDrracoonEnvironment } = require('../src/drracoon/config');
const { compilePrompt } = require('../src/drracoon/prompts');
const { buildMessages } = require('../src/drracoon/inference');

async function checkDrracoonConfig(
  environment = process.env,
  output = console,
  { checkPrompts = false, compiler = compilePrompt } = {}
) {
  try {
    const config = loadDrracoonEnvironment(environment);
    if (config.enabled && checkPrompts) {
      const variants = ['user'];
      if (config.staffRoleIds.length && config.staffChannelIds.length) variants.push('staff');
      for (const variant of variants) {
        buildMessages(await compiler(variant), '', [], config);
      }
    }
    output.log(config.enabled ? 'enabled' : 'disabled');
    return 0;
  } catch (error) {
    output.error(`Dr. Racoon preflight failed: ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--prompts')) {
    console.error('Usage: node scripts/check-drracoon-config.js [--prompts]');
    process.exitCode = 1;
  } else {
    checkDrracoonConfig(process.env, console, { checkPrompts: args.includes('--prompts') }).then(
      (code) => {
        process.exitCode = code;
      }
    );
  }
}

module.exports = { checkDrracoonConfig };
