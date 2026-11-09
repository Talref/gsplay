const { AuditLogEvent } = require('discord.js');
const { recordDiscordEvent } = require('../../core/services/moderationService');

function normalizeAuditEntry(entry, guildId) {
  if (!entry.targetId || !entry.id) return null;
  const actions = [];
  const simple = {
    [AuditLogEvent.MemberKick]: 'kick',
    [AuditLogEvent.MemberBanAdd]: 'ban',
    [AuditLogEvent.MemberBanRemove]: 'unban'
  };
  if (simple[entry.action]) actions.push({ type: simple[entry.action] });
  if (entry.action === AuditLogEvent.MemberUpdate) {
    for (const change of entry.changes || []) {
      if (change.old === change.new) continue;
      if (change.key === 'mute' && typeof change.new === 'boolean') {
        actions.push({ type: change.new ? 'voice_mute' : 'voice_unmute' });
      }
      if (change.key === 'communication_disabled_until') {
        const previousUntil = change.old ? new Date(change.old) : null;
        const until = change.new ? new Date(change.new) : null;
        if (until && !Number.isNaN(until.getTime()) && until.getTime() > entry.createdTimestamp) {
          actions.push({ type: 'timeout', previousUntil, until });
        } else if (previousUntil && previousUntil.getTime() > entry.createdTimestamp && !until) {
          actions.push({ type: 'timeout_removed', previousUntil, until: null });
        }
      }
    }
  }
  if (!actions.length) return null;
  return {
    guildId,
    targetId: entry.targetId,
    moderatorId: entry.executorId || null,
    type: 'discord',
    source: 'discord',
    reason: entry.reason ?? null,
    occurredAt: new Date(entry.createdTimestamp),
    discordAuditId: entry.id,
    actions,
    annotations: []
  };
}

async function ingestAuditEntry(entry, guildId, persist = recordDiscordEvent) {
  const event = normalizeAuditEntry(entry, guildId);
  if (!event) return 'skipped';
  return (await persist(event)) ? 'inserted' : 'skipped';
}

async function syncModerationAudit(
  guild,
  { now = Date.now(), ingest = ingestAuditEntry, log = console } = {}
) {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const counts = { scanned: 0, inserted: 0, skipped: 0, failed: 0, incomplete: false };
  let before;
  while (true) {
    let entries;
    try {
      const result = await guild.fetchAuditLogs({ limit: 100, ...(before ? { before } : {}) });
      entries = [...result.entries.values()];
    } catch (error) {
      log.error(`GSbot moderation sync fetch failed · guild=${guild.id}: ${error.message}`);
      counts.failed++;
      counts.incomplete = true;
      break;
    }
    if (!entries.length) break;
    // Select the oldest snowflake explicitly; do not depend on collection insertion order.
    const oldest = entries.reduce((a, b) => (BigInt(a.id) < BigInt(b.id) ? a : b));
    for (const entry of entries) {
      if (entry.createdTimestamp < cutoff || entry.createdTimestamp > now) continue;
      counts.scanned++;
      try {
        counts[await ingest(entry, guild.id)]++;
      } catch (error) {
        counts.failed++;
        log.error(
          `GSbot moderation sync insert failed · guild=${guild.id} · audit=${entry.id}: ${error.message}`
        );
      }
    }
    if (oldest.createdTimestamp < cutoff) break;
    if (before && BigInt(oldest.id) >= BigInt(before)) {
      counts.failed++;
      counts.incomplete = true;
      break;
    }
    before = oldest.id;
  }
  return counts;
}

module.exports = { normalizeAuditEntry, ingestAuditEntry, syncModerationAudit };
