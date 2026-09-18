const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

describe('GSbot deployment wiring', () => {
  test('package scripts and systemd use the GSbot runtime entry point', () => {
    const packageJson = require('../../package.json');
    const unit = fs.readFileSync(path.join(root, 'deploy/systemd/gsplay-gsbot.service'), 'utf8');

    expect(packageJson.scripts.gsbot).toBe('node src/gsbot/gsbot.js');
    expect(packageJson.scripts['dev:gsbot']).toContain('src/gsbot/gsbot.js');
    expect(unit).toContain('EnvironmentFile=/etc/gsplay/v2.env');
    expect(unit).toContain('ExecStart=/usr/bin/node /srv/gsplay/src/gsbot/gsbot.js');
  });

  test('deployment handles configured, absent, and partial GSbot configuration explicitly', () => {
    const deploy = fs.readFileSync(path.join(root, 'scripts/deploy.sh'), 'utf8');
    expect(deploy).toContain("gsbot_configuration='enabled'");
    expect(deploy).toContain("gsbot_configuration='disabled'");
    expect(deploy).toContain('GSbot configuration is incomplete');
    expect(deploy).toContain('systemctl enable "$GSBOT_SERVICE"');
    expect(deploy).toContain('systemctl disable --now "$GSBOT_SERVICE"');
  });
});
