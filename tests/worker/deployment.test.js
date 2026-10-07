const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

describe('worker deployment wiring', () => {
  test('allows the configured production backup directory without weakening the sandbox', () => {
    const unit = fs.readFileSync(
      path.join(root, 'deploy/systemd/gsplay-v2-worker.service'),
      'utf8'
    );

    expect(unit).toContain('ProtectSystem=strict');
    expect(unit).toContain('ReadWritePaths=/srv/gsplay -/media/backup/gsplay/db');
    expect(unit).not.toContain('/media/backups/gsplay/db');
  });
});
