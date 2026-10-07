const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkGsbotConfig } = require('../../scripts/check-gsbot-config');

const root = path.resolve(__dirname, '../..');

describe('GSbot deployment wiring', () => {
  test('package scripts and systemd use the GSbot runtime entry point', () => {
    const packageJson = require('../../package.json');
    const unit = fs.readFileSync(path.join(root, 'deploy/systemd/gsplay-gsbot.service'), 'utf8');

    expect(packageJson.scripts.gsbot).toBe('node src/gsbot/gsbot.js');
    expect(packageJson.scripts['dev:gsbot']).toContain('src/gsbot/gsbot.js');
    expect(unit).toContain('EnvironmentFile=/etc/gsplay/v2.env');
    expect(unit).toContain('Environment=GSBOT_READY_FILE=/run/gsplay-gsbot/ready');
    expect(unit).toContain('RuntimeDirectory=gsplay-gsbot');
    expect(unit).toContain('ExecStart=/usr/bin/node /srv/gsplay/src/gsbot/gsbot.js');
  });

  test('deployment validates configuration and waits for explicit GSbot readiness', () => {
    const deploy = fs.readFileSync(path.join(root, 'scripts/deploy.sh'), 'utf8');
    expect(deploy).toContain('scripts/check-gsbot-config.js');
    expect(deploy).toContain('fix the reported setting in $ENV_FILE');
    expect(deploy).toContain('[[ -f "$GSBOT_READY_FILE" ]]');
    expect(deploy).toContain('systemctl enable "$GSBOT_SERVICE"');
    expect(deploy).toContain('systemctl disable --now "$GSBOT_SERVICE"');
    expect(deploy).toContain('for attempt in {1..60}; do');
    expect(deploy.indexOf('gsbot_is_ready')).toBeLessThan(
      deploy.indexOf('GSPlay deployed successfully')
    );
  });

  test('configuration preflight exits non-zero with an actionable guild error', () => {
    const output = { log: jest.fn(), error: jest.fn() };

    expect(checkGsbotConfig({ GSBOT_TOKEN: 'discord-token' }, output)).toBe(1);
    expect(output.error).toHaveBeenCalledWith(
      'GSbot configuration invalid: GSBOT_GUILD_IDS or GSBOT_GUILD_ID is required'
    );
    expect(
      checkGsbotConfig({ GSBOT_TOKEN: 'discord-token', GSBOT_GUILD_IDS: 'not-a-guild' }, output)
    ).toBe(1);
    expect(
      checkGsbotConfig(
        {
          GSBOT_TOKEN: 'discord-token',
          GSBOT_GUILD_IDS: '123456789012345678,223456789012345678'
        },
        output
      )
    ).toBe(0);
    expect(output.log).toHaveBeenLastCalledWith('enabled');

    const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-gsbot-config.js')], {
      encoding: 'utf8',
      env: { GSBOT_TOKEN: 'discord-token' }
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('GSBOT_GUILD_IDS or GSBOT_GUILD_ID is required');
    expect(result.stdout).not.toContain('enabled');
  });
});
