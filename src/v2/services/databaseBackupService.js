const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');
const { EVENT_TIME_ZONE, zonedParts } = require('./casualFriday/scheduling');

const BACKUP_CHECK_MS = 60 * 60 * 1000;
const BACKUP_TIMEOUT_MS = 30 * 60 * 1000;
const BACKUP_NAME_PATTERN = /^gsplay-db-(\d{4})-(\d{2})-(\d{2})\.archive\.gz$/;

function backupDateKey(now = new Date()) {
  const { year, month, day } = zonedParts(now, EVENT_TIME_ZONE);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function backupPaths(directory, now = new Date()) {
  const finalPath = path.join(directory, `gsplay-db-${backupDateKey(now)}.archive.gz`);
  return { finalPath, temporaryPath: `${finalPath}.tmp` };
}

async function exists(filePath, fileSystem = fsPromises) {
  try {
    await fileSystem.stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function safeFailureReason(error) {
  if (error?.code === 'MONGODUMP_NOT_FOUND')
    return 'mongodump is not installed or not available to the worker';
  if (error?.code === 'ABORT_ERR') return 'backup execution was cancelled';
  if (error?.code === 'BACKUP_TIMEOUT') return 'mongodump exceeded the 30 minute timeout';
  if (error?.code === 'MONGODUMP_FAILED')
    return `mongodump exited unsuccessfully${error.exitCode === null ? '' : ` (code ${error.exitCode})`}`;
  return error?.message || 'unknown backup failure';
}

function runMongodump({ mongoUri, archivePath, signal, spawnProcess = spawn }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let forceKillTimer;
    let timeout;
    let stderr = '';
    let child;
    try {
      child = spawnProcess(
        'mongodump',
        [`--uri=${mongoUri}`, `--archive=${archivePath}`, '--gzip'],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );
    } catch (error) {
      reject(error);
      return;
    }
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => {
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 5_000);
    };
    timeout = setTimeout(() => {
      timedOut = true;
      abort();
    }, BACKUP_TIMEOUT_MS);
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4096);
    });
    child.once('error', (error) => {
      if (error.code === 'ENOENT') error.code = 'MONGODUMP_NOT_FOUND';
      finish(reject, error);
    });
    child.once('close', (code) => {
      if (timedOut) {
        const error = new Error('mongodump timed out');
        error.code = 'BACKUP_TIMEOUT';
        return finish(reject, error);
      }
      if (signal?.aborted) {
        const error = new Error('mongodump cancelled');
        error.code = 'ABORT_ERR';
        return finish(reject, error);
      }
      if (code === 0) return finish(resolve);
      const error = new Error(stderr.trim() || 'mongodump failed');
      error.code = 'MONGODUMP_FAILED';
      error.exitCode = code;
      return finish(reject, error);
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

async function validateGzipArchive(filePath, fileSystem = fsPromises) {
  const stats = await fileSystem.stat(filePath);
  if (!stats.isFile() || stats.size === 0) throw new Error('mongodump produced an empty archive');
  await pipeline(
    fs.createReadStream(filePath),
    createGunzip(),
    new Writable({ write: (_chunk, _encoding, callback) => callback() })
  );
}

function backupFileDate(name) {
  const match = name.match(BACKUP_NAME_PATTERN);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() + 1 !== month ||
    value.getUTCDate() !== day
  )
    return null;
  return value;
}

async function removeExpiredBackups({ directory, retentionDays, now, fileSystem = fsPromises }) {
  const current = backupFileDate(`gsplay-db-${backupDateKey(now)}.archive.gz`);
  const cutoff = new Date(current.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const entries = await fileSystem.readdir(directory, { withFileTypes: true });
  let deleted = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const date = backupFileDate(entry.name);
    if (!date || date >= cutoff) continue;
    await fileSystem.unlink(path.join(directory, entry.name));
    deleted += 1;
  }
  return deleted;
}

async function validateDirectory(directory, fileSystem) {
  try {
    const stats = await fileSystem.stat(directory);
    if (!stats.isDirectory()) throw new Error('the configured path is not a directory');
    await fileSystem.access(directory, fs.constants.R_OK | fs.constants.W_OK);
  } catch (cause) {
    const error = new Error(`DB_BACKUP_DIR is unavailable: ${cause.message}`);
    error.code = 'BACKUP_DIRECTORY_INVALID';
    throw error;
  }
}

async function runDatabaseBackup({
  mongoUri,
  backupConfig,
  now = new Date(),
  fileSystem = fsPromises,
  executeDump = runMongodump,
  validateArchive = validateGzipArchive,
  log = console,
  signal
}) {
  if (!backupConfig.directory) return { status: 'unconfigured' };
  const { finalPath, temporaryPath } = backupPaths(backupConfig.directory, now);
  try {
    await validateDirectory(backupConfig.directory, fileSystem);
    if (await exists(finalPath, fileSystem))
      return { status: 'already_completed', path: finalPath };
    await fileSystem.unlink(temporaryPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    log.info(`DB backup started: ${finalPath}`);
    await executeDump({ mongoUri, archivePath: temporaryPath, signal });
    await validateArchive(temporaryPath, fileSystem);
    if (await exists(finalPath, fileSystem)) {
      await fileSystem.unlink(temporaryPath);
      return { status: 'already_completed', path: finalPath };
    }
    await fileSystem.rename(temporaryPath, finalPath);
    log.info(`DB backup completed: ${finalPath}`);
    let retentionDeleted = 0;
    try {
      retentionDeleted = await removeExpiredBackups({
        directory: backupConfig.directory,
        retentionDays: backupConfig.retentionDays,
        now,
        fileSystem
      });
      log.info(
        `DB backup retention removed ${retentionDeleted} archive${retentionDeleted === 1 ? '' : 's'}`
      );
    } catch (error) {
      log.warn(`DB backup retention failed: ${safeFailureReason(error)}`);
    }
    return { status: 'completed', path: finalPath, retentionDeleted };
  } catch (error) {
    await fileSystem.unlink(temporaryPath).catch(() => {});
    log.error(`DB backup failed: ${safeFailureReason(error)}`);
    return { status: 'failed', error };
  }
}

async function runScheduledDatabaseBackup(options) {
  const { backupConfig, now = new Date() } = options;
  if (!backupConfig.enabled) return { status: 'disabled' };
  if (!backupConfig.directory) return { status: 'unconfigured' };
  if (zonedParts(now, EVENT_TIME_ZONE).hour < backupConfig.hour) return { status: 'not_due' };
  return runDatabaseBackup({ ...options, now });
}

module.exports = {
  BACKUP_CHECK_MS,
  BACKUP_NAME_PATTERN,
  backupDateKey,
  backupPaths,
  removeExpiredBackups,
  runDatabaseBackup,
  runMongodump,
  runScheduledDatabaseBackup,
  validateGzipArchive
};
