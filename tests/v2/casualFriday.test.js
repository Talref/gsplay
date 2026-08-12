const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const Game = require('../../src/v2/models/CanonicalGame');
const Rotation = require('../../src/v2/models/CasualFridayRotationGame');
const Playlist = require('../../src/v2/models/CasualFridayPlaylist');
const Audit = require('../../src/v2/models/CasualFridayAudit');
const {
  cleanDisplayTitle,
  completeElapsedPlaylists,
  nextFridayWindow,
  refreshRotationOffers
} = require('../../src/v2/services/casualFridayService');
const offer = {
  shop: 'Deal Shop',
  url: 'https://isthereanydeal.com/game/party/deal',
  price: 7.49,
  currency: 'EUR',
  regularPrice: 24.99,
  discountPercent: 70,
  retrievedAt: new Date()
};
const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const itadClient = {
  lookupTitle: jest
    .fn()
    .mockResolvedValue({ outcome: 'matched', game: { id: 'itad-party', title: 'Party Game' } }),
  bestOffers: jest.fn().mockImplementation(async (ids) => new Map(ids.map((id) => [id, offer])))
};
const app = createApp(config, { itadClient });
const password = 'correct-horse-battery-staple';
async function user(username, role = 'member') {
  return User.create({
    usernameNormalized: username.toLowerCase(),
    usernameDisplay: username,
    role,
    passwordHash: await User.hashPassword(password)
  });
}
async function agentFor(member) {
  const agent = request.agent(app);
  await agent
    .post('/api/v2/auth/login')
    .send({ username: member.usernameDisplay, password })
    .expect(200);
  return agent;
}
function rotationPayload(canonicalGameId) {
  return {
    canonicalGameId,
    displayTitle: 'Party Game - PartyGame.exe',
    info: 'Join the lobby.',
    playerCountMin: 2,
    playerCountMax: 8,
    playerCountLabel: '2–8 pals',
    joinInstructions: 'Join the lobby.',
    hostMode: 'host_runs',
    acquisitionKind: 'owned_store',
    acquisitionUrl: '',
    availabilityNote: ''
  };
}
function rotationUpdatePayload(overrides = {}) {
  const { canonicalGameId, ...payload } = rotationPayload();
  return { ...payload, ...overrides };
}

describe('Casual Friday core workflow', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await global.testUtils.cleanupDatabase();
  });
  test('allows Helpers to manage rotation and rejects members, duplicates, and invalid free overrides', async () => {
    const helper = await user('TrustedHelper', 'helper');
    const member = await user('PlainMember');
    const game = await Game.create({ canonicalTitle: 'Party Game', normalizedTitle: 'partygame' });
    const helperAgent = await agentFor(helper);
    const memberAgent = await agentFor(member);
    await memberAgent
      .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
      .send(rotationPayload(game._id.toString()))
      .expect(403);
    const created = await helperAgent
      .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
      .send(rotationPayload(game._id.toString()))
      .expect(201);
    expect(created.body.rotation).toMatchObject({
      displayTitle: 'Party Game',
      itad: { status: 'verified', gameId: 'itad-party', offer: { price: 7.49 } }
    });
    expect(cleanDisplayTitle('Party Animals - PartyAnimals.exe')).toBe('Party Animals');
    expect(itadClient.lookupTitle).toHaveBeenCalledWith('Party Game');
    expect(itadClient.bestOffers).toHaveBeenCalledWith(['itad-party']);
    await helperAgent
      .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
      .send(rotationPayload(game._id.toString()))
      .expect(409);
    await Game.updateOne({ _id: game._id }, { $set: { canonicalTitle: 'Recovered title' } });
    await helperAgent
      .post(`/api/v2/casual-friday/tools/rotation/${created.body.rotation.id}/retire`)
      .send({ reason: 'Needs patching' })
      .expect(204);
    const rotation = await helperAgent.get('/api/v2/casual-friday/tools/rotation').expect(200);
    expect(rotation.body.rotation[0]).toMatchObject({ status: 'retired' });
    await helperAgent
      .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
      .send(rotationPayload(game._id.toString()))
      .expect(201);
    expect(await Audit.countDocuments({ rotationGameId: created.body.rotation.id })).toBe(2);
  });
  test('enforces draft/publication lifecycle and optimistic playlist edits', async () => {
    const helper = await user('PlaylistHelper', 'helper');
    const agent = await agentFor(helper);
    const games = await Promise.all(
      [...Array(7)].map((_, index) =>
        Game.create({ canonicalTitle: `Game ${index}`, normalizedTitle: `game${index}` })
      )
    );
    const rotations = [];
    for (const game of games)
      rotations.push(
        (
          await agent
            .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
            .send({ ...rotationPayload(game._id.toString()), displayTitle: game.canonicalTitle })
            .expect(201)
        ).body.rotation
      );
    jest.clearAllMocks();
    const refresh = await refreshRotationOffers({
      itadClient,
      now: new Date('2026-07-31T10:00:00Z')
    });
    expect(refresh).toEqual({ checked: 7, offers: 7, batches: 1 });
    expect(itadClient.bestOffers).toHaveBeenCalledTimes(1);
    expect(itadClient.bestOffers.mock.calls[0][0]).toEqual(['itad-party']);
    jest.clearAllMocks();
    const draft = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/entries/${rotations[0].id}`)
        .expect(200)
    ).body.playlist;
    expect(itadClient.lookupTitle).not.toHaveBeenCalled();
    expect(itadClient.bestOffers).not.toHaveBeenCalled();
    const updatedRotation = await agent
      .put(`/api/v2/casual-friday/tools/rotation/${rotations[0].id}`)
      .send(
        rotationUpdatePayload({
          displayTitle: 'Game 0',
          info: 'Fresh playlist information.',
          hostMode: 'streamable'
        })
      )
      .expect(200);
    expect(updatedRotation.body.rotation.syncedPlaylistEntries).toBe(1);
    const syncedDraft = (await agent.get('/api/v2/casual-friday/tools/playlist').expect(200)).body
      .playlist;
    expect(syncedDraft.version).toBe(draft.version + 1);
    expect(syncedDraft.entries[0].rotation).toMatchObject({
      info: 'Fresh playlist information.',
      hostMode: 'streamable'
    });
    const second = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/entries/${rotations[1].id}`)
        .expect(200)
    ).body.playlist;
    const third = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/entries/${rotations[2].id}`)
        .expect(200)
    ).body.playlist;
    await agent
      .delete(`/api/v2/casual-friday/tools/playlist/${draft.id}/entries/${second.entries[0].id}`)
      .send({ version: draft.version })
      .expect(409);
    const removed = (
      await agent
        .delete(`/api/v2/casual-friday/tools/playlist/${draft.id}/entries/${second.entries[1].id}`)
        .send({ version: third.version })
        .expect(200)
    ).body.playlist;
    expect(removed.entries.map((entry) => entry.position)).toEqual([1, 2]);
    expect(removed.entries.map((entry) => entry.game.title)).toEqual(['Game 0', 'Game 2']);
    expect(removed.entries[0].itad.offer).toMatchObject({
      price: 7.49,
      regularPrice: 24.99,
      discountPercent: 70
    });
    expect(removed.entries[0]).toMatchObject({
      owned: false,
      free: false,
      rotation: {
        info: 'Fresh playlist information.',
        joinInstructions: 'Join the lobby.',
        hostMode: 'streamable',
        acquisitionKind: 'owned_store'
      }
    });
    expect(
      await Audit.countDocuments({ playlistId: draft.id, kind: 'playlist_entry_removed' })
    ).toBe(1);
    const betterOffer = {
      ...offer,
      price: 2.49,
      url: 'https://isthereanydeal.com/game/party/better',
      retrievedAt: new Date()
    };
    itadClient.bestOffers.mockImplementationOnce(
      async (ids) => new Map(ids.map((id) => [id, betterOffer]))
    );
    await refreshRotationOffers({ itadClient, now: new Date('2026-07-31T11:00:00Z') });
    const refreshedDraft = (await agent.get('/api/v2/casual-friday/tools/playlist').expect(200))
      .body.playlist;
    expect(refreshedDraft.entries[0].itad.offer).toMatchObject({
      price: 2.49,
      url: betterOffer.url
    });
    const restored = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/entries/${rotations[1].id}`)
        .expect(200)
    ).body.playlist;
    let filled = restored;
    for (const rotation of rotations.slice(3))
      filled = (
        await agent.post(`/api/v2/casual-friday/tools/playlist/entries/${rotation.id}`).expect(200)
      ).body.playlist;
    expect(filled.entries).toHaveLength(7);
    const reversedIds = [...filled.entries].reverse().map((entry) => entry.id);
    await agent
      .put(`/api/v2/casual-friday/tools/playlist/${draft.id}/order`)
      .send({ version: restored.version, entryIds: reversedIds })
      .expect(409);
    const reordered = (
      await agent
        .put(`/api/v2/casual-friday/tools/playlist/${draft.id}/order`)
        .send({ version: filled.version, entryIds: reversedIds })
        .expect(200)
    ).body.playlist;
    expect(reordered.entries.map((entry) => entry.game.title)).toEqual([
      'Game 6',
      'Game 5',
      'Game 4',
      'Game 3',
      'Game 1',
      'Game 2',
      'Game 0'
    ]);
    expect(reordered.entries.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await Audit.countDocuments({ playlistId: draft.id, kind: 'playlist_reordered' })).toBe(
      1
    );
    await agent
      .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/confirm`)
      .send({ version: draft.version })
      .expect(409);
    const published = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/confirm`)
        .send({ version: reordered.version })
        .expect(200)
    ).body.playlist;
    expect(published).toMatchObject({
      status: 'published',
      entries: expect.arrayContaining([
        expect.objectContaining({ game: expect.objectContaining({ title: 'Game 0' }) })
      ])
    });
    const editedPublished = (
      await agent
        .delete(
          `/api/v2/casual-friday/tools/playlist/${draft.id}/entries/${published.entries[0].id}`
        )
        .send({ version: published.version })
        .expect(200)
    ).body.playlist;
    expect(editedPublished).toMatchObject({ status: 'published', editable: true });
    await agent
      .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/cancel`)
      .send({ version: published.version, reason: 'Weather warning' })
      .expect(409);
    const cancelled = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/cancel`)
        .send({ version: editedPublished.version, reason: 'Weather warning' })
        .expect(200)
    ).body.playlist;
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      editable: false,
      cancellationReason: 'Weather warning'
    });
    await agent
      .delete(`/api/v2/casual-friday/tools/playlist/${draft.id}/entries/${cancelled.entries[0].id}`)
      .send({ version: cancelled.version })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('playlist_not_editable'));
    expect(await Audit.countDocuments({ playlistId: draft.id, kind: 'playlist_cancelled' })).toBe(
      1
    );
    await agent
      .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/restore`)
      .send({ version: editedPublished.version })
      .expect(409);
    const restoredDraft = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/restore`)
        .send({ version: cancelled.version })
        .expect(200)
    ).body.playlist;
    expect(restoredDraft).toMatchObject({ status: 'draft', editable: true });
    expect(restoredDraft.cancellationReason).toBeUndefined();
    const republished = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/confirm`)
        .send({ version: restoredDraft.version })
        .expect(200)
    ).body.playlist;
    expect(republished.status).toBe('published');
    expect(await Audit.countDocuments({ playlistId: draft.id, kind: 'playlist_restored' })).toBe(1);
    expect(await Audit.countDocuments({ playlistId: draft.id })).toBeGreaterThanOrEqual(5);
  });
  test('exposes a published playlist before kickoff and automatically completes elapsed playlists', async () => {
    const helper = await user('FinalHelper', 'helper');
    const member = await user('Viewer');
    const helperAgent = await agentFor(helper);
    const memberAgent = await agentFor(member);
    const rotation = (
      await helperAgent
        .post('/api/v2/casual-friday/tools/rotation/manual')
        .send({
          ...rotationPayload(undefined),
          title: 'Gartic Phone',
          displayTitle: 'Gartic Phone',
          acquisitionKind: 'web',
          acquisitionUrl: 'https://garticphone.com'
        })
        .expect(201)
    ).body.rotation;
    const draft = (
      await helperAgent
        .post(`/api/v2/casual-friday/tools/playlist/entries/${rotation.id}`)
        .expect(200)
    ).body.playlist;
    expect(itadClient.lookupTitle).not.toHaveBeenCalled();
    await memberAgent
      .get('/api/v2/casual-friday')
      .expect(200)
      .expect((response) => expect(response.body.playlist).toBeNull());
    await Playlist.updateOne(
      { _id: draft.id },
      {
        $set: {
          status: 'published',
          startsAt: new Date(Date.now() + 60_000),
          endsAt: new Date(Date.now() + 120_000)
        }
      }
    );
    await memberAgent
      .get('/api/v2/casual-friday')
      .expect(200)
      .expect(({ body }) =>
        expect(body.playlist.entries[0]).toMatchObject({
          free: true,
          owned: false,
          itad: { status: 'not_required', offer: null },
          rotation: {
            acquisitionKind: 'web',
            acquisitionUrl: 'https://garticphone.com',
            info: 'Join the lobby.'
          }
        })
      );
    await Playlist.updateOne(
      { _id: draft.id },
      { $set: { status: 'published', endsAt: new Date('2020-01-01') } }
    );
    await memberAgent
      .get('/api/v2/casual-friday')
      .expect(200)
      .expect(({ body }) => expect(body.playlist).toBeNull());
    expect(await completeElapsedPlaylists(new Date('2021-01-01'))).toBe(1);
    expect(await Playlist.findById(draft.id)).toMatchObject({ status: 'completed' });
  });
  test('publishes any non-empty draft, including a one-game lineup', async () => {
    const helper = await user('SoloPlaylistHelper', 'helper');
    const agent = await agentFor(helper);
    const game = await Game.create({
      canonicalTitle: 'One Round Wonder',
      normalizedTitle: 'one round wonder'
    });
    const rotation = (
      await agent
        .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
        .send({ ...rotationPayload(game._id.toString()), displayTitle: game.canonicalTitle })
        .expect(201)
    ).body.rotation;
    const draft = (
      await agent.post(`/api/v2/casual-friday/tools/playlist/entries/${rotation.id}`).expect(200)
    ).body.playlist;
    const published = (
      await agent
        .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/confirm`)
        .send({ version: draft.version })
        .expect(200)
    ).body.playlist;
    expect(published).toMatchObject({
      status: 'published',
      entries: [
        expect.objectContaining({ game: expect.objectContaining({ title: 'One Round Wonder' }) })
      ]
    });
  });
  test('lets Helpers manage a manual key offer on draft and published playlist entries', async () => {
    const helper = await user('KeyHelper', 'helper');
    const member = await user('KeyViewer');
    const helperAgent = await agentFor(helper);
    const memberAgent = await agentFor(member);
    const game = await Game.create({
      canonicalTitle: 'Human Fall Flat',
      normalizedTitle: 'human fall flat'
    });
    const rotation = (
      await helperAgent
        .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
        .send({ ...rotationPayload(game._id.toString()), displayTitle: game.canonicalTitle })
        .expect(201)
    ).body.rotation;
    const draft = (
      await helperAgent
        .post(`/api/v2/casual-friday/tools/playlist/entries/${rotation.id}`)
        .expect(200)
    ).body.playlist;
    const path = `/api/v2/casual-friday/tools/playlist/${draft.id}/entries/${draft.entries[0].id}/key-offer`;
    await memberAgent
      .put(path)
      .send({ version: draft.version, price: 0.65, url: 'https://www.cdkeyit.it/human-fall-flat/' })
      .expect(403);
    await helperAgent
      .put(path)
      .send({
        version: draft.version,
        price: 0.651,
        url: 'https://www.cdkeyit.it/human-fall-flat/'
      })
      .expect(400);
    await helperAgent
      .put(path)
      .send({ version: draft.version, price: 0.65, url: 'http://www.cdkeyit.it/human-fall-flat/' })
      .expect(400);
    const keyedDraft = (
      await helperAgent
        .put(path)
        .send({
          version: draft.version,
          price: 0.65,
          url: 'https://www.cdkeyit.it/human-fall-flat/'
        })
        .expect(200)
    ).body.playlist;
    expect(keyedDraft.version).toBe(draft.version + 1);
    expect(keyedDraft.entries[0].keyOffer).toMatchObject({
      price: 0.65,
      currency: 'EUR',
      url: 'https://www.cdkeyit.it/human-fall-flat/'
    });
    const published = (
      await helperAgent
        .post(`/api/v2/casual-friday/tools/playlist/${draft.id}/confirm`)
        .send({ version: keyedDraft.version })
        .expect(200)
    ).body.playlist;
    const edited = (
      await helperAgent
        .put(path)
        .send({
          version: published.version,
          price: 0.75,
          url: 'https://www.cdkeyit.it/human-fall-flat/deal/'
        })
        .expect(200)
    ).body.playlist;
    expect(edited).toMatchObject({
      status: 'published',
      editable: true,
      entries: [expect.objectContaining({ keyOffer: expect.objectContaining({ price: 0.75 }) })]
    });
    await memberAgent
      .get('/api/v2/casual-friday')
      .expect(200)
      .expect(({ body }) =>
        expect(body.playlist.entries[0].keyOffer).toMatchObject({
          price: 0.75,
          currency: 'EUR',
          url: 'https://www.cdkeyit.it/human-fall-flat/deal/'
        })
      );
    await helperAgent.delete(path).send({ version: published.version }).expect(409);
    const cleared = (await helperAgent.delete(path).send({ version: edited.version }).expect(200))
      .body.playlist;
    expect(cleared.entries[0].keyOffer).toBeNull();
    expect(
      await Audit.countDocuments({ playlistId: draft.id, kind: 'playlist_key_offer_updated' })
    ).toBe(2);
    expect(
      await Audit.countDocuments({ playlistId: draft.id, kind: 'playlist_key_offer_removed' })
    ).toBe(1);
  });
  test('builds event boundaries at local Europe/Rome time across DST and keeps Saturday morning on the same event', () => {
    expect(nextFridayWindow(new Date('2026-07-30T12:00:00Z'))).toMatchObject({
      weekKey: '2026-07-31',
      startsAt: new Date('2026-07-31T17:00:00Z'),
      votingClosesAt: new Date('2026-07-31T13:00:00Z'),
      endsAt: new Date('2026-08-01T04:00:00Z')
    });
    expect(nextFridayWindow(new Date('2026-01-08T12:00:00Z'))).toMatchObject({
      weekKey: '2026-01-09',
      startsAt: new Date('2026-01-09T18:00:00Z'),
      votingClosesAt: new Date('2026-01-09T14:00:00Z'),
      endsAt: new Date('2026-01-10T05:00:00Z')
    });
    expect(nextFridayWindow(new Date('2026-08-01T03:30:00Z')).weekKey).toBe('2026-07-31');
    expect(nextFridayWindow(new Date('2026-08-01T04:00:00Z')).weekKey).toBe('2026-08-07');
  });
  test('retains the last rotation offer when a batched refresh fails', async () => {
    const helper = await user('PriceHelper', 'helper');
    const game = await Game.create({ canonicalTitle: 'Price Game', normalizedTitle: 'price game' });
    const rotation = await Rotation.create({
      canonicalGameId: game._id,
      displayTitle: 'Price Game',
      playerCountMin: 2,
      playerCountMax: 4,
      hostMode: 'none',
      acquisitionKind: 'owned_store',
      itadStatus: 'verified',
      itadGameId: 'price-game',
      itadOffer: offer,
      addedBy: helper._id,
      updatedBy: helper._id
    });
    const failure = { bestOffers: jest.fn().mockRejectedValue(new Error('upstream unavailable')) };
    expect(await refreshRotationOffers({ itadClient: failure })).toMatchObject({
      checked: 1,
      offers: 0,
      batches: 0
    });
    expect(await Rotation.findById(rotation._id)).toMatchObject({
      itadOffer: expect.objectContaining({ price: 7.49 }),
      itadOfferError: 'ITAD price refresh failed'
    });
  });
});
