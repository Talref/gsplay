const request = require('supertest');
const mongoose = require('mongoose');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const Game = require('../../src/v2/models/CanonicalGame');
const Event = require('../../src/v2/models/CasualFridayEvent');
const Playlist = require('../../src/v2/models/CasualFridayPlaylist');
const PlaylistEntry = require('../../src/v2/models/CasualFridayPlaylistEntry');
const Response = require('../../src/v2/models/CasualFridayResponse');
const Rotation = require('../../src/v2/models/CasualFridayRotationGame');
const Audit = require('../../src/v2/models/CasualFridayAudit');
const service = require('../../src/v2/services/casualFridayService');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const app = createApp(config, {
  itadClient: { lookupTitle: jest.fn(), bestOffers: jest.fn().mockResolvedValue(new Map()) }
});
const password = 'correct-horse-battery-staple';

async function createUser(username, role = 'member') {
  return User.create({
    usernameNormalized: username.toLowerCase(),
    usernameDisplay: username,
    role,
    passwordHash: await User.hashPassword(password)
  });
}

async function agentFor(user) {
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username: user.usernameDisplay, password }).expect(200);
  return agent;
}

async function createRotation(actor, index, votingEnabled = true) {
  const game = await Game.create({ canonicalTitle: `Vote Game ${index}`, normalizedTitle: `vote game ${index}` });
  return Rotation.create({
    canonicalGameId: game._id,
    displayTitle: game.canonicalTitle,
    votingEnabled,
    playerCountMin: 2,
    playerCountMax: 8,
    hostMode: 'none',
    acquisitionKind: 'owned_store',
    itadStatus: 'pending',
    addedBy: actor._id,
    updatedBy: actor._id
  });
}

describe('Casual Friday RSVP and voting lifecycle', () => {
  beforeEach(() => global.testUtils.cleanupDatabase());

  test('locks the enabled pool and lets helpers and administrators manage voting eligibility', async () => {
    const admin = await createUser('VotingAdmin', 'admin');
    const helper = await createUser('VotingHelper', 'helper');
    const member = await createUser('VotingMember');
    const rotations = await Promise.all([0, 1, 2].map((index) => createRotation(admin, index)));
    const adminAgent = await agentFor(admin);
    const helperAgent = await agentFor(helper);
    const memberAgent = await agentFor(member);

    await helperAgent
      .put(`/api/v2/casual-friday/tools/rotation/${rotations[2]._id}/voting`)
      .send({ enabled: false })
      .expect(200);
    await memberAgent
      .put(`/api/v2/casual-friday/tools/rotation/${rotations[2]._id}/voting`)
      .send({ enabled: true })
      .expect(403);
    await adminAgent
      .put(`/api/v2/casual-friday/tools/rotation/${rotations[2]._id}/voting`)
      .send({ enabled: true })
      .expect(200);
    await helperAgent
      .put(`/api/v2/casual-friday/tools/rotation/${rotations[2]._id}/voting`)
      .send({ enabled: false })
      .expect(200);
    const started = await helperAgent.post('/api/v2/casual-friday/tools/event/start').send({}).expect(201);
    expect(started.body.event.candidates).toHaveLength(2);

    await adminAgent
      .put(`/api/v2/casual-friday/tools/rotation/${rotations[0]._id}/voting`)
      .send({ enabled: false })
      .expect(200);
    const current = await helperAgent.get('/api/v2/casual-friday/tools/event').expect(200);
    expect(current.body.event.candidates.map((item) => item.rotationGameId)).toContain(
      String(rotations[0]._id)
    );
  });

  test('allows RSVP changes and up to five locked-candidate votes without exposing totals to members', async () => {
    const helper = await createUser('LifecycleHelper', 'helper');
    const member = await createUser('RomanMember');
    const rotations = await Promise.all([...Array(6)].map((_, index) => createRotation(helper, index)));
    const helperAgent = await agentFor(helper);
    const memberAgent = await agentFor(member);
    const event = (await helperAgent.post('/api/v2/casual-friday/tools/event/start').send({}).expect(201)).body.event;

    const selected = rotations.slice(0, 5).map((rotation) => String(rotation._id));
    await memberAgent
      .put(`/api/v2/casual-friday/events/${event.id}/votes`)
      .send({ rotationGameIds: selected })
      .expect(200);
    await memberAgent.put(`/api/v2/casual-friday/events/${event.id}/rsvp`).send({ rsvp: 'maybe' }).expect(200);
    await memberAgent.put(`/api/v2/casual-friday/events/${event.id}/rsvp`).send({ rsvp: 'yes' }).expect(200);
    await memberAgent
      .put(`/api/v2/casual-friday/events/${event.id}/votes`)
      .send({ rotationGameIds: rotations.map((rotation) => String(rotation._id)) })
      .expect(400);
    await memberAgent
      .put(`/api/v2/casual-friday/events/${event.id}/votes`)
      .send({ rotationGameIds: [String(new mongoose.Types.ObjectId())] })
      .expect(400);

    const memberView = await memberAgent.get('/api/v2/casual-friday').expect(200);
    expect(memberView.body.event.response).toEqual({ rsvp: 'yes', voteRotationGameIds: selected });
    expect(memberView.body.event).not.toHaveProperty('rsvps');
    expect(memberView.body.event).not.toHaveProperty('votingResults');
    const manageView = await helperAgent.get('/api/v2/casual-friday/tools/event').expect(200);
    expect(manageView.body.event.rsvps.totals).toEqual({ yes: 1, maybe: 0, no: 0 });
    expect(manageView.body.event.rsvps.names.yes[0].username).toBe('RomanMember');
    expect(manageView.body.event.votingResults.filter((item) => item.votes === 1)).toHaveLength(5);
  });

  test('closes responses at Friday 15:00 and transitions through draft, publication, and completion', async () => {
    const helper = await createUser('EditorialHelper', 'helper');
    const member = await createUser('LateMember');
    const rotation = await createRotation(helper, 1);
    const started = await service.startEvent(helper, new Date('2026-08-12T10:00:00Z'));
    const closesAt = new Date(started.votingClosesAt);

    await expect(
      service.createDraft(helper, started.id, started.version, new Date(closesAt.getTime() - 1))
    ).rejects.toMatchObject({ code: 'voting_still_open' });
    await expect(service.setRsvp(member, started.id, 'yes', closesAt)).rejects.toMatchObject({
      code: 'voting_closed'
    });
    const draft = await service.createDraft(helper, started.id, started.version, closesAt);
    expect(draft.status).toBe('draft');
    const playlist = await Playlist.findById(draft.playlistId);
    await service.addToPlaylist(helper, rotation._id, { now: closesAt });
    await service.publishPlaylist(helper, playlist._id, 2, { now: closesAt });
    const publishedEvent = await Event.findById(started.id);
    expect(publishedEvent.status).toBe('published');
    const completed = await service.completeEvent(
      helper,
      publishedEvent._id,
      publishedEvent.version,
      new Date('2026-08-15T06:00:00Z')
    );
    expect(completed.status).toBe('completed');
    expect((await Playlist.findById(playlist._id)).status).toBe('completed');
  });

  test('lets Helpers explicitly end voting early when creating the playlist draft', async () => {
    const helper = await createUser('EarlyDraftHelper', 'helper');
    const member = await createUser('EarlyDraftMember');
    await createRotation(helper, 1);
    const helperAgent = await agentFor(helper);
    const memberAgent = await agentFor(member);
    const started = (
      await helperAgent.post('/api/v2/casual-friday/tools/event/start').send({}).expect(201)
    ).body.event;

    await helperAgent
      .post(`/api/v2/casual-friday/tools/event/${started.id}/draft`)
      .send({ version: started.version })
      .expect(409);
    await memberAgent
      .post(`/api/v2/casual-friday/tools/event/${started.id}/draft`)
      .send({ version: started.version, endVotingEarly: true })
      .expect(403);
    const drafted = await helperAgent
      .post(`/api/v2/casual-friday/tools/event/${started.id}/draft`)
      .send({ version: started.version, endVotingEarly: true })
      .expect(200);

    expect(drafted.body.event).toMatchObject({ status: 'draft', open: false });
    await memberAgent
      .put(`/api/v2/casual-friday/events/${started.id}/rsvp`)
      .send({ rsvp: 'yes' })
      .expect(409);
    expect(await Playlist.countDocuments({ weekKey: started.weekKey })).toBe(1);
    expect(await Audit.findOne({ kind: 'event_draft_created' })).toMatchObject({
      details: { votingEndedEarly: true }
    });
  });

  test('automatically completes a linked event when its published playlist elapses', async () => {
    const helper = await createUser('AutomaticHelper', 'helper');
    const rotation = await createRotation(helper, 1);
    const started = await service.startEvent(helper, new Date('2026-08-12T10:00:00Z'));
    await service.createDraft(helper, started.id, started.version, new Date(started.votingClosesAt));
    const event = await Event.findById(started.id);
    await service.addToPlaylist(helper, rotation._id, { now: new Date(event.votingClosesAt) });
    const playlist = await Playlist.findById(event.playlistId);
    await service.publishPlaylist(helper, playlist._id, 2, {
      now: new Date(event.votingClosesAt)
    });

    expect(await service.completeElapsedPlaylists(new Date('2026-08-15T04:00:00Z'))).toBe(1);
    expect((await Event.findById(event._id)).status).toBe('completed');
  });

  test.each(['open', 'draft', 'published', 'completed'])('can cancel an event from %s state', async (state) => {
    const helper = await createUser(`Cancel${state}`, 'helper');
    const rotation = await createRotation(helper, 1);
    const started = await service.startEvent(helper, new Date('2026-08-12T10:00:00Z'));
    let event = await Event.findById(started.id);
    if (state !== 'open') {
      await service.createDraft(helper, event._id, event.version, new Date(event.votingClosesAt));
      event = await Event.findById(event._id);
      if (['published', 'completed'].includes(state)) {
        await service.addToPlaylist(helper, rotation._id, { now: new Date(event.votingClosesAt) });
        const playlist = await Playlist.findById(event.playlistId);
        await service.publishPlaylist(helper, playlist._id, 2, {
          now: new Date(event.votingClosesAt)
        });
        event = await Event.findById(event._id);
        if (state === 'completed') {
          await service.completeEvent(
            helper,
            event._id,
            event.version,
            new Date('2026-08-15T06:00:00Z')
          );
          event = await Event.findById(event._id);
        }
      }
    }
    const cancelled = await service.cancelEvent(helper, event._id, event.version, 'No legions available');
    expect(cancelled.status).toBe('cancelled');
    if (cancelled.playlistId)
      expect((await Playlist.findById(cancelled.playlistId)).status).toBe('cancelled');
  });

  test('restarts a cancelled event from the current voting pool and clears prior work', async () => {
    const helper = await createUser('RestartHelper', 'helper');
    const member = await createUser('RestartMember');
    const originalRotation = await createRotation(helper, 1);
    const startedAt = new Date('2026-08-12T10:00:00Z');
    const started = await service.startEvent(helper, startedAt);

    await service.setRsvp(member, started.id, 'yes', new Date('2026-08-12T10:01:00Z'));
    await service.setVotes(
      member,
      started.id,
      [String(originalRotation._id)],
      new Date('2026-08-12T10:01:00Z')
    );
    const drafted = await service.createDraft(
      helper,
      started.id,
      started.version,
      new Date('2026-08-12T10:02:00Z'),
      { endVotingEarly: true }
    );
    await service.addToPlaylist(helper, originalRotation._id, {
      now: new Date('2026-08-12T10:03:00Z')
    });
    let playlist = await Playlist.findById(drafted.playlistId);
    await service.publishPlaylist(helper, playlist._id, playlist.version, {
      now: new Date('2026-08-12T10:04:00Z')
    });
    const published = await Event.findById(started.id);
    const cancelled = await service.cancelEvent(
      helper,
      published._id,
      published.version,
      'Starting over',
      new Date('2026-08-12T10:05:00Z')
    );

    await Rotation.updateOne({ _id: originalRotation._id }, { $set: { votingEnabled: false } });
    const replacementRotation = await createRotation(helper, 2);
    const restarted = await service.restartEvent(
      helper,
      cancelled.id,
      cancelled.version,
      new Date('2026-08-12T10:06:00Z')
    );

    expect(restarted).toMatchObject({
      id: started.id,
      status: 'open',
      open: true,
      restartable: false,
      playlistId: drafted.playlistId,
      rsvps: { totals: { yes: 0, maybe: 0, no: 0 } }
    });
    expect(restarted.candidates.map((candidate) => candidate.rotationGameId)).toEqual([
      String(replacementRotation._id)
    ]);
    expect(await Response.countDocuments({ eventId: started.id })).toBe(0);
    expect(await PlaylistEntry.countDocuments({ playlistId: drafted.playlistId })).toBe(0);

    playlist = await Playlist.findById(drafted.playlistId);
    expect(playlist).toMatchObject({ status: 'draft' });
    expect(playlist.cancellationReason).toBeUndefined();
    expect(playlist.cancelledAt).toBeUndefined();
    expect(playlist.publishedAt).toBeUndefined();
    const storedEvent = await Event.findById(started.id);
    expect(storedEvent.cancellationReason).toBeUndefined();
    expect(storedEvent.cancelledAt).toBeUndefined();
    expect(await Audit.findOne({ kind: 'event_restarted' })).toMatchObject({
      details: {
        candidateCount: 1,
        removedResponseCount: 1,
        removedPlaylistEntryCount: 1
      }
    });
  });

  test('does not restart a cancelled event after its voting deadline', async () => {
    const helper = await createUser('LateRestartHelper', 'helper');
    await createRotation(helper, 1);
    const started = await service.startEvent(helper, new Date('2026-08-12T10:00:00Z'));
    const cancelled = await service.cancelEvent(
      helper,
      started.id,
      started.version,
      'Too late',
      new Date('2026-08-12T10:01:00Z')
    );

    await expect(
      service.restartEvent(
        helper,
        cancelled.id,
        cancelled.version,
        new Date(cancelled.votingClosesAt)
      )
    ).rejects.toMatchObject({ code: 'restart_window_closed' });
    expect((await Event.findById(cancelled.id)).status).toBe('cancelled');
  });

  test('allows Helpers and Admins, but not Members, to restart cancelled voting', async () => {
    const helper = await createUser('RouteRestartHelper', 'helper');
    const admin = await createUser('RouteRestartAdmin', 'admin');
    const member = await createUser('RouteRestartMember');
    const rotation = await createRotation(helper, 1);
    const eventData = (weekKey, actor) => {
      const startsAt = new Date(`${weekKey}T17:00:00Z`);
      return {
        weekKey,
        status: 'cancelled',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 11 * 60 * 60 * 1000),
        votingClosesAt: new Date(startsAt.getTime() - 4 * 60 * 60 * 1000),
        candidates: [
          {
            rotationGameId: rotation._id,
            canonicalGameId: rotation.canonicalGameId,
            displayTitle: rotation.displayTitle,
            playerCountMin: 2,
            playerCountMax: 8
          }
        ],
        createdBy: actor._id,
        updatedBy: actor._id,
        cancelledBy: actor._id,
        cancelledAt: new Date(),
        cancellationReason: 'Retry route'
      };
    };
    const helperEvent = await Event.create(eventData('2099-08-14', helper));
    const adminEvent = await Event.create(eventData('2099-08-21', admin));
    const helperAgent = await agentFor(helper);
    const adminAgent = await agentFor(admin);
    const memberAgent = await agentFor(member);

    await memberAgent
      .post(`/api/v2/casual-friday/tools/event/${helperEvent._id}/restart`)
      .send({ version: helperEvent.version })
      .expect(403);
    await helperAgent
      .post(`/api/v2/casual-friday/tools/event/${helperEvent._id}/restart`)
      .send({ version: helperEvent.version })
      .expect(200);
    await adminAgent
      .post(`/api/v2/casual-friday/tools/event/${adminEvent._id}/restart`)
      .send({ version: adminEvent.version })
      .expect(200);
  });
});
