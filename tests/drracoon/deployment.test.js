const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { checkDrracoonConfig } = require('../../scripts/check-drracoon-config');
const root = path.resolve(__dirname, '../..');
const base = { DRRACOON_TOKEN: 'fake-token', DRRACOON_GUILD_IDS: '123456789012345678' };

test('preflight distinguishes disabled/invalid/enabled and checks required prompt variants/budgets', async () => {
  const output = { log: jest.fn(), error: jest.fn() },
    compiler = jest.fn(async () => 'prompt');
  expect(await checkDrracoonConfig({}, output, { checkPrompts: true, compiler })).toBe(0);
  expect(output.log).toHaveBeenLastCalledWith('disabled');
  expect(compiler).not.toHaveBeenCalled();
  expect(await checkDrracoonConfig({ DRRACOON_TOKEN: 'secret' }, output)).toBe(1);
  expect(output.error.mock.calls.at(-1)[0]).not.toContain('secret');
  expect(await checkDrracoonConfig(base, output, { checkPrompts: true, compiler })).toBe(0);
  expect(compiler.mock.calls).toEqual([['user']]);
  compiler.mockClear();
  const staff = {
    ...base,
    DRRACOON_STAFF_ROLE_IDS: '234567890123456789',
    DRRACOON_STAFF_CHANNEL_IDS: '345678901234567890'
  };
  expect(await checkDrracoonConfig(staff, output, { checkPrompts: true, compiler })).toBe(0);
  expect(compiler.mock.calls).toEqual([['user'], ['staff']]);
  compiler.mockImplementation(async () => 'x'.repeat(40000));
  expect(await checkDrracoonConfig(base, output, { checkPrompts: true, compiler })).toBe(1);
  expect(output.error.mock.calls.at(-1)[0]).toContain('context_limit');
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/check-drracoon-config.js')],
    { env: {}, encoding: 'utf8' }
  );
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('disabled');
});

test('unit and commands use one independent runtime with readable external knowledge and readiness', async () => {
  const unit = await fs.readFile(path.join(root, 'deploy/systemd/gsplay-drracoon.service'), 'utf8');
  expect(unit).toContain('User=gsplay');
  expect(unit).toContain('EnvironmentFile=/etc/gsplay/v2.env');
  expect(unit).toContain('DRRACOON_READY_FILE=/run/gsplay-drracoon/ready');
  expect(unit).toContain('ProtectHome=read-only');
  expect(unit).toContain('ProtectSystem=strict');
  expect(unit).toContain('ExecStart=/usr/bin/node /srv/gsplay/src/drracoon/drracoon.js');
  const pkg = require('../../package.json');
  expect(pkg.scripts.drracoon).toBe('node src/drracoon/drracoon.js');
  expect(pkg.scripts['dev:drracoon']).toContain('--watch src/core');
  expect(spawnSync('bash', ['-n', path.join(root, 'scripts/deploy.sh')]).status).toBe(0);
});

async function simulatedDeploy({ mode, ready = true, promptFailure = false }) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'raccoon-deploy-'));
  const source = path.join(temp, 'source'),
    bin = path.join(temp, 'bin');
  await fs.mkdir(path.join(source, 'gsplay-frontend'), { recursive: true });
  await fs.mkdir(bin);
  for (const file of ['package-lock.json', 'gsplay-frontend/package-lock.json'])
    await fs.writeFile(path.join(source, file), '{}');
  const readyFile = path.join(temp, 'ready'),
    calls = path.join(temp, 'calls');
  const envFile = path.join(temp, 'env');
  await fs.writeFile(envFile, '');
  const scripts = {
    git: `case "$1" in status) ;; branch) echo master ;; rev-parse) echo revision ;; esac`,
    npm: `if [[ "$*" == *"run build"* ]]; then mkdir -p "$SOURCE_ROOT/gsplay-frontend/dist"; fi`,
    rsync: `echo "rsync $*" >> "$CALLS"; mkdir -p "${'${@: -1}'}"`,
    curl: 'exit 0',
    sleep: 'exit 0',
    install: 'exit 0',
    node: `case "$*" in
      *check-gsbot-config.js*) echo disabled ;;
      *check-drracoon-config.js*)
        if [[ "$MODE" == invalid ]]; then echo invalid >&2; exit 1; fi
        if [[ "$*" == *--prompts* && "$PROMPT_FAILURE" == true ]]; then exit 1; fi
        echo "$MODE" ;;
      *) exit 0 ;;
    esac`,
    sudo: `echo "sudo $*" >> "$CALLS"
      if [[ "$1" == -v ]]; then exit 0; fi
      if [[ "$1" == -u ]]; then shift 2; fi
      exec "$@"`,
    systemctl: `echo "systemctl $*" >> "$CALLS"
      if [[ "$1" == restart && "$*" == *gsplay-drracoon.service* && "$READY" == true ]]; then touch "$READY_FILE"; fi`
  };
  for (const [name, body] of Object.entries(scripts))
    await fs.writeFile(path.join(bin, name), `#!/usr/bin/env bash\nset -eu\n${body}\n`, {
      mode: 0o755
    });
  const original = await fs.readFile(path.join(root, 'scripts/deploy.sh'), 'utf8');
  const script = path.join(temp, 'deploy.sh');
  await fs.writeFile(
    script,
    original
      .replace('DRRACOON_READY_FILE=/run/gsplay-drracoon/ready', `DRRACOON_READY_FILE=${readyFile}`)
      .replace('for attempt in {1..60}', 'for attempt in {1..2}')
  );
  try {
    const result = spawnSync('bash', [script], {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        SOURCE_ROOT: source,
        DESTINATION: path.join(temp, 'destination'),
        ENV_FILE: envFile,
        CALLS: calls,
        MODE: mode,
        READY: String(ready),
        READY_FILE: readyFile,
        PROMPT_FAILURE: String(promptFailure)
      }
    });
    return { ...result, calls: await fs.readFile(calls, 'utf8') };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

test.each(['enabled', 'disabled'])(
  'normal deploy supports %s independently of GSbot and keeps release deletion',
  async (mode) => {
    const result = await simulatedDeploy({ mode });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.calls).toContain('rsync -a --delete');
    expect(result.calls).toContain('restart gsplay-v2-api.service gsplay-v2-worker.service');
    expect(result.calls).toContain('disable --now gsplay-gsbot.service');
    if (mode === 'enabled') {
      expect(result.calls).toContain('enable gsplay-drracoon.service');
      expect(result.calls).toContain('-u gsplay bash -c');
      expect(result.stdout).toContain('Dr. Racoon Discord ready');
    } else {
      expect(result.calls).toContain('disable --now gsplay-drracoon.service');
    }
    expect(result.calls).not.toContain('llama');
  }
);

test('configuration and prompt failures prevent publication; an unready Gateway prevents success', async () => {
  const invalid = await simulatedDeploy({ mode: 'invalid' });
  expect(invalid.status).toBe(1);
  expect(invalid.calls).not.toContain('rsync');
  const prompts = await simulatedDeploy({ mode: 'enabled', promptFailure: true });
  expect(prompts.status).toBe(1);
  expect(prompts.calls).not.toContain('systemctl restart');
  const unready = await simulatedDeploy({ mode: 'enabled', ready: false });
  expect(unready.status).toBe(1);
  expect(unready.stdout).not.toContain('deployed successfully');
  expect(unready.stderr).toContain('Readiness did not recover');
});
