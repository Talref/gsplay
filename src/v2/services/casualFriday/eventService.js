const CanonicalGame = require('../../models/CanonicalGame');
const Event = require('../../models/CasualFridayEvent');
const Playlist = require('../../models/CasualFridayPlaylist');
const Response = require('../../models/CasualFridayResponse');
const Rotation = require('../../models/CasualFridayRotationGame');
const User = require('../../models/User');
const { AppError } = require('../../http/errors');
const { audit } = require('./common');
const { nextFridayWindow } = require('./scheduling');

const MAX_VOTES = 5;

function eventIsOpen(event, now = new Date()) {
  return event?.status === 'open' && event.votingClosesAt > now;
}

function candidateDto(candidate) {
  return {
    rotationGameId: String(candidate.rotationGameId),
    canonicalGameId: String(candidate.canonicalGameId),
    displayTitle: candidate.displayTitle,
    artwork: candidate.artwork,
    playerCountMin: candidate.playerCountMin,
    playerCountMax: candidate.playerCountMax,
    playerCountLabel: candidate.playerCountLabel
  };
}

async function memberEventDto(event, userId, now = new Date()) {
  if (!event) return null;
  const response = await Response.findOne({ eventId: event._id, userId });
  return {
    id: String(event._id),
    weekKey: event.weekKey,
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    votingClosesAt: event.votingClosesAt,
    open: eventIsOpen(event, now),
    maxVotes: MAX_VOTES,
    candidates: event.candidates.map(candidateDto),
    response: {
      rsvp: response?.rsvp || null,
      voteRotationGameIds: (response?.voteRotationGameIds || []).map(String)
    },
    cancellationReason: event.status === 'cancelled' ? event.cancellationReason : null
  };
}

async function manageEventDto(event, now = new Date()) {
  if (!event) return null;
  const responses = await Response.find({ eventId: event._id });
  const users = await User.find({ _id: { $in: responses.map((response) => response.userId) } }).select(
    'usernameDisplay'
  );
  const names = new Map(users.map((user) => [String(user._id), user.usernameDisplay]));
  const rsvps = { yes: [], maybe: [], no: [] };
  const voteCounts = new Map(event.candidates.map((candidate) => [String(candidate.rotationGameId), 0]));
  responses.forEach((response) => {
    if (response.rsvp) {
      rsvps[response.rsvp].push({
        userId: String(response.userId),
        username: names.get(String(response.userId)) || 'Deleted user'
      });
    }
    response.voteRotationGameIds.forEach((rotationId) => {
      const key = String(rotationId);
      if (voteCounts.has(key)) voteCounts.set(key, voteCounts.get(key) + 1);
    });
  });
  Object.values(rsvps).forEach((items) => items.sort((a, b) => a.username.localeCompare(b.username)));
  return {
    ...(await memberEventDto(event, null, now)),
    version: event.version,
    playlistId: event.playlistId ? String(event.playlistId) : null,
    rsvps: {
      totals: Object.fromEntries(Object.entries(rsvps).map(([key, items]) => [key, items.length])),
      names: rsvps
    },
    votingResults: event.candidates
      .map((candidate) => ({ ...candidateDto(candidate), votes: voteCounts.get(String(candidate.rotationGameId)) }))
      .sort((a, b) => b.votes - a.votes || a.displayTitle.localeCompare(b.displayTitle))
  };
}

async function upcomingEvent() {
  return Event.findOne({ weekKey: nextFridayWindow().weekKey });
}

async function startEvent(actor, now = new Date()) {
  const window = nextFridayWindow(now);
  if (window.votingClosesAt <= now)
    throw new AppError(409, 'voting_window_closed', 'Voting has already closed for this Friday');
  if (await Event.exists({ weekKey: window.weekKey }))
    throw new AppError(409, 'casual_friday_exists', 'A Casual Friday process already exists for this week');
  if (await Playlist.exists({ weekKey: window.weekKey }))
    throw new AppError(
      409,
      'legacy_playlist_exists',
      'A playlist already exists for this week and must use the existing workflow'
    );
  const rotations = await Rotation.find({ status: 'active', votingEnabled: { $ne: false } }).sort({ displayTitle: 1 });
  if (!rotations.length)
    throw new AppError(400, 'empty_voting_pool', 'Enable at least one rotation game before starting');
  const games = await CanonicalGame.find({ _id: { $in: rotations.map((rotation) => rotation.canonicalGameId) } });
  const gameMap = new Map(games.map((game) => [String(game._id), game]));
  const event = await Event.create({
    ...window,
    candidates: rotations.map((rotation) => ({
      rotationGameId: rotation._id,
      canonicalGameId: rotation.canonicalGameId,
      displayTitle: rotation.displayTitle,
      artwork: rotation.artworkOverride || gameMap.get(String(rotation.canonicalGameId))?.artwork || null,
      playerCountMin: rotation.playerCountMin,
      playerCountMax: rotation.playerCountMax,
      playerCountLabel: rotation.playerCountLabel || ''
    })),
    createdBy: actor._id,
    updatedBy: actor._id
  });
  await audit(actor, 'event_started', { eventId: event._id, details: { candidateCount: rotations.length } });
  return manageEventDto(event, now);
}

async function requireOpenEvent(eventId, now) {
  const event = await Event.findById(eventId);
  if (!event) throw new AppError(404, 'not_found', 'Casual Friday event was not found');
  if (!eventIsOpen(event, now))
    throw new AppError(409, 'voting_closed', 'RSVPs and voting are closed for this event');
  return event;
}

async function setRsvp(actor, eventId, rsvp, now = new Date()) {
  const event = await requireOpenEvent(eventId, now);
  await Response.findOneAndUpdate(
    { eventId: event._id, userId: actor._id },
    { $set: { rsvp }, $setOnInsert: { voteRotationGameIds: [] } },
    { upsert: true, runValidators: true }
  );
  return memberEventDto(event, actor._id, now);
}

async function setVotes(actor, eventId, rotationGameIds, now = new Date()) {
  const event = await requireOpenEvent(eventId, now);
  if (rotationGameIds.length > MAX_VOTES || new Set(rotationGameIds).size !== rotationGameIds.length)
    throw new AppError(400, 'invalid_votes', `Select no more than ${MAX_VOTES} unique games`);
  const candidates = new Set(event.candidates.map((candidate) => String(candidate.rotationGameId)));
  if (rotationGameIds.some((rotationId) => !candidates.has(rotationId)))
    throw new AppError(400, 'invalid_votes', 'Votes must belong to the locked candidate list');
  await Response.findOneAndUpdate(
    { eventId: event._id, userId: actor._id },
    { $set: { voteRotationGameIds: rotationGameIds } },
    { upsert: true, runValidators: true }
  );
  return memberEventDto(event, actor._id, now);
}

async function createDraft(actor, id, version, now = new Date()) {
  const event = await Event.findOne({ _id: id, status: 'open', version });
  if (!event) throw new AppError(409, 'event_not_open', 'Only the current open event can become a draft');
  if (event.votingClosesAt > now)
    throw new AppError(409, 'voting_still_open', 'The draft can be created after voting closes Friday at 15:00');
  if (event.endsAt <= now)
    throw new AppError(409, 'event_ended', 'This Casual Friday event has already ended');
  const playlist =
    (await Playlist.findOne({ weekKey: event.weekKey })) ||
    (await Playlist.create({
      weekKey: event.weekKey,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      createdBy: actor._id,
      updatedBy: actor._id
    }));
  event.status = 'draft';
  event.playlistId = playlist._id;
  event.version += 1;
  event.updatedBy = actor._id;
  await event.save();
  await audit(actor, 'event_draft_created', { eventId: event._id, playlistId: playlist._id });
  return manageEventDto(event, now);
}

async function cancelEvent(actor, id, version, reason, now = new Date()) {
  const event = await Event.findOne({ _id: id, status: { $ne: 'cancelled' }, version });
  if (!event) throw new AppError(409, 'event_not_cancellable', 'This event cannot be cancelled or has changed');
  event.status = 'cancelled';
  event.version += 1;
  event.cancelledBy = actor._id;
  event.cancelledAt = now;
  event.cancellationReason = reason;
  event.updatedBy = actor._id;
  await event.save();
  if (event.playlistId) {
    await Playlist.updateOne(
      { _id: event.playlistId, status: { $in: ['draft', 'published', 'completed'] } },
      { $set: { status: 'cancelled', cancellationReason: reason, cancelledBy: actor._id, cancelledAt: now, updatedBy: actor._id }, $inc: { version: 1 } }
    );
  }
  await audit(actor, 'event_cancelled', { eventId: event._id, playlistId: event.playlistId, details: { reason } });
  return manageEventDto(event, now);
}

async function completeEvent(actor, id, version, now = new Date()) {
  const event = await Event.findOne({ _id: id, status: 'published', version });
  if (!event) throw new AppError(409, 'event_not_completable', 'Only a published event can be completed');
  event.status = 'completed';
  event.version += 1;
  event.completedBy = actor._id;
  event.completedAt = now;
  event.updatedBy = actor._id;
  await event.save();
  await Playlist.updateOne(
    { _id: event.playlistId, status: 'published' },
    { $set: { status: 'completed', completedAt: now, updatedBy: actor._id }, $inc: { version: 1 } }
  );
  await audit(actor, 'event_completed', { eventId: event._id, playlistId: event.playlistId });
  return manageEventDto(event, now);
}

module.exports = {
  MAX_VOTES,
  cancelEvent,
  completeEvent,
  createDraft,
  eventIsOpen,
  manageEventDto,
  memberEventDto,
  setRsvp,
  setVotes,
  startEvent,
  upcomingEvent
};
