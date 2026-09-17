const path = require('node:path');
const { EventEmitter } = require('node:events');
const {
  backupPaths,
  runMongodump,
  runScheduledDatabaseBackup
} = require('../../src/core/services/databaseBackupService');

const directory = '/media/backups/gsplay/db';
const now = new Date('2026-09-17T03:00:00.000Z');
const backupConfig = { enabled: true, directory, hour: 4, retentionDays: 30 };

function missingError() {
  const error = new Error('missing');
  error.code = 'ENOENT';
  return error;
}

function createFakeFileSystem({ directoryValid = true, accessError, files = [] } = {}) {
  const stored = new Map(files.map((name) => [path.join(directory, name), { size: 100 }]));
  const deleted = [];
  const fileSystem = {
    stat: jest.fn(async (target) => {
      if (target === directory)
        return { isDirectory: () => directoryValid, isFile: () => false, size: 0 };
      const value = stored.get(target);
      if (!value) throw missingError();
      return { isDirectory: () => false, isFile: () => true, size: value.size };
    }),
    access: jest.fn(async () => {
      if (accessError) throw accessError;
    }),
    unlink: jest.fn(async (target) => {
      if (!stored.has(target)) throw missingError();
      stored.delete(target);
      deleted.push(target);
    }),
    rename: jest.fn(async (source, destination) => {
      const value = stored.get(source);
      if (!value) throw missingError();
      stored.delete(source);
      stored.set(destination, value);
    }),
    readdir: jest.fn(async () =>
      [...stored.keys()]
        .filter((target) => path.dirname(target) === directory)
        .map((target) => ({ name: path.basename(target), isFile: () => true }))
    )
  };
  return {
    fileSystem,
    deleted,
    has: (target) => stored.has(target),
    write: (target, size = 100) => stored.set(target, { size })
  };
}

function createLog() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('scheduled MongoDB backups', () => {
  test('does nothing when disabled, unconfigured, or before the configured local hour', async () => {
    const executeDump = jest.fn();
    expect(
      await runScheduledDatabaseBackup({
        mongoUri: 'mongodb://example/gsplay',
        backupConfig: { ...backupConfig, enabled: false },
        now,
        executeDump
      })
    ).toEqual({ status: 'disabled' });
    expect(
      await runScheduledDatabaseBackup({
        mongoUri: 'mongodb://example/gsplay',
        backupConfig: { ...backupConfig, directory: null },
        now,
        executeDump
      })
    ).toEqual({ status: 'unconfigured' });
    expect(
      await runScheduledDatabaseBackup({
        mongoUri: 'mongodb://example/gsplay',
        backupConfig,
        now: new Date('2026-09-17T01:59:00.000Z'),
        executeDump
      })
    ).toEqual({ status: 'not_due' });
    expect(executeDump).not.toHaveBeenCalled();
  });

  test('promotes a validated temporary dump and does not run twice on the same day', async () => {
    const fake = createFakeFileSystem();
    const log = createLog();
    const paths = backupPaths(directory, now);
    const executeDump = jest.fn(async ({ archivePath }) => fake.write(archivePath));
    const validateArchive = jest.fn(async (archivePath) => {
      expect(fake.has(archivePath)).toBe(true);
    });
    const options = {
      mongoUri: 'mongodb://example/gsplay',
      backupConfig,
      now,
      fileSystem: fake.fileSystem,
      executeDump,
      validateArchive,
      log
    };

    await expect(runScheduledDatabaseBackup(options)).resolves.toMatchObject({
      status: 'completed',
      path: paths.finalPath
    });
    expect(executeDump).toHaveBeenCalledWith(
      expect.objectContaining({
        mongoUri: 'mongodb://example/gsplay',
        archivePath: paths.temporaryPath
      })
    );
    expect(fake.has(paths.temporaryPath)).toBe(false);
    expect(fake.has(paths.finalPath)).toBe(true);
    await expect(runScheduledDatabaseBackup(options)).resolves.toMatchObject({
      status: 'already_completed'
    });
    expect(executeDump).toHaveBeenCalledTimes(1);
  });

  test('keeps previous archives and skips retention when mongodump fails', async () => {
    const oldName = 'gsplay-db-2026-08-01.archive.gz';
    const fake = createFakeFileSystem({ files: [oldName] });
    const paths = backupPaths(directory, now);
    const log = createLog();
    const executeDump = jest.fn(async () => {
      throw new Error('database unavailable');
    });

    await expect(
      runScheduledDatabaseBackup({
        mongoUri: 'mongodb://example/gsplay',
        backupConfig,
        now,
        fileSystem: fake.fileSystem,
        executeDump,
        validateArchive: jest.fn(),
        log
      })
    ).resolves.toMatchObject({ status: 'failed' });
    expect(fake.has(path.join(directory, oldName))).toBe(true);
    expect(fake.has(paths.finalPath)).toBe(false);
    expect(fake.fileSystem.readdir).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('DB backup failed: database unavailable');
  });

  test('removes an invalid temporary archive without publishing it', async () => {
    const fake = createFakeFileSystem();
    const paths = backupPaths(directory, now);
    const executeDump = jest.fn(async ({ archivePath }) => fake.write(archivePath));

    await expect(
      runScheduledDatabaseBackup({
        mongoUri: 'mongodb://example/gsplay',
        backupConfig,
        now,
        fileSystem: fake.fileSystem,
        executeDump,
        validateArchive: jest.fn(async () => {
          throw new Error('invalid gzip archive');
        }),
        log: createLog()
      })
    ).resolves.toMatchObject({ status: 'failed' });
    expect(fake.has(paths.temporaryPath)).toBe(false);
    expect(fake.has(paths.finalPath)).toBe(false);
  });

  test('runs retention only after success and deletes only matching expired files', async () => {
    const expired = 'gsplay-db-2026-08-01.archive.gz';
    const recent = 'gsplay-db-2026-09-01.archive.gz';
    const unrelated = 'family-photos-2020-01-01.archive.gz';
    const malformed = 'gsplay-db-2026-99-99.archive.gz';
    const fake = createFakeFileSystem({ files: [expired, recent, unrelated, malformed] });

    const result = await runScheduledDatabaseBackup({
      mongoUri: 'mongodb://example/gsplay',
      backupConfig,
      now,
      fileSystem: fake.fileSystem,
      executeDump: async ({ archivePath }) => fake.write(archivePath),
      validateArchive: jest.fn(),
      log: createLog()
    });

    expect(result).toMatchObject({ status: 'completed', retentionDeleted: 1 });
    expect(fake.has(path.join(directory, expired))).toBe(false);
    expect(fake.has(path.join(directory, recent))).toBe(true);
    expect(fake.has(path.join(directory, unrelated))).toBe(true);
    expect(fake.has(path.join(directory, malformed))).toBe(true);
  });

  test('handles an invalid or unwritable backup directory without throwing', async () => {
    const executeDump = jest.fn();
    const invalid = createFakeFileSystem({ directoryValid: false });
    const denied = new Error('permission denied');
    denied.code = 'EACCES';
    const unwritable = createFakeFileSystem({ accessError: denied });

    for (const fake of [invalid, unwritable]) {
      await expect(
        runScheduledDatabaseBackup({
          mongoUri: 'mongodb://example/gsplay',
          backupConfig,
          now,
          fileSystem: fake.fileSystem,
          executeDump,
          validateArchive: jest.fn(),
          log: createLog()
        })
      ).resolves.toMatchObject({ status: 'failed' });
    }
    expect(executeDump).not.toHaveBeenCalled();
  });

  test('invokes mongodump without a shell and writes a compressed archive', async () => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn();
    const spawnProcess = jest.fn(() => {
      process.nextTick(() => child.emit('close', 0));
      return child;
    });

    await expect(
      runMongodump({
        mongoUri: 'mongodb://user:secret@example/gsplay',
        archivePath: '/backups/today.tmp',
        spawnProcess
      })
    ).resolves.toBeUndefined();
    expect(spawnProcess).toHaveBeenCalledWith(
      'mongodump',
      ['--uri=mongodb://user:secret@example/gsplay', '--archive=/backups/today.tmp', '--gzip'],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
  });
});
