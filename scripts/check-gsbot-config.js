#!/usr/bin/env node

const { gsbotDeploymentMode } = require('../src/gsbot/config');

function checkGsbotConfig(environment = process.env, output = console) {
  try {
    const mode = gsbotDeploymentMode(environment);
    output.log(mode);
    return 0;
  } catch (error) {
    output.error(`GSbot configuration invalid: ${error.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = checkGsbotConfig();

module.exports = { checkGsbotConfig };
