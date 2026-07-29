const request = require('supertest'); const { loadEnvironment } = require('../../src/v2/config/environment'); const { createApp } = require('../../src/v2/app'); const User = require('../../src/v2/models/User'); const Game = require('../../src/v2/models/CanonicalGame'); const Playlist = require('../../src/v2/models/CasualFridayPlaylist'); const Audit = require('../../src/v2/models/CasualFridayAudit'); const { completeElapsedPlaylists } = require('../../src/v2/services/casualFridayService');
const config = loadEnvironment({ NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) }); const app = createApp(config); const password = 'correct-horse-battery-staple';
async function user(username, role = 'member') { return User.create({ usernameNormalized: username.toLowerCase(), usernameDisplay: username, role, passwordHash: await User.hashPassword(password) }); }
async function agentFor(member) { const agent = request.agent(app); await agent.post('/api/v2/auth/login').send({ username: member.usernameDisplay, password }).expect(200); return agent; }
function rotationPayload(canonicalGameId) { return { canonicalGameId, playerCountMin: 2, playerCountMax: 8, playerCountLabel: '2–8 pals', joinInstructions: 'Join the lobby.', hostMode: 'host_runs', availabilityOverride: 'none' }; }

describe('Casual Friday core workflow', () => {
  beforeEach(() => global.testUtils.cleanupDatabase());
  test('allows Helpers to manage rotation and rejects members, duplicates, and invalid free overrides', async () => {
    const helper = await user('TrustedHelper', 'helper'); const member = await user('PlainMember'); const game = await Game.create({ canonicalTitle: 'Party Game', normalizedTitle: 'partygame' }); const helperAgent = await agentFor(helper); const memberAgent = await agentFor(member);
    await memberAgent.post('/api/v2/casual-friday/manage/rotation').send(rotationPayload(game._id.toString())).expect(403);
    await helperAgent.post('/api/v2/casual-friday/manage/rotation').send({ ...rotationPayload(game._id.toString()), availabilityOverride: 'free' }).expect(400);
    const created = await helperAgent.post('/api/v2/casual-friday/manage/rotation').send(rotationPayload(game._id.toString())).expect(201);
    await helperAgent.post('/api/v2/casual-friday/manage/rotation').send(rotationPayload(game._id.toString())).expect(409);
    await helperAgent.post(`/api/v2/casual-friday/manage/rotation/${created.body.rotation.id}/retire`).send({ reason: 'Needs patching' }).expect(204);
    const rotation = await helperAgent.get('/api/v2/casual-friday/manage/rotation').expect(200); expect(rotation.body.rotation[0]).toMatchObject({ status: 'retired', timesPlayed: 0 });
    expect(await Audit.countDocuments({ rotationGameId: created.body.rotation.id })).toBe(2);
  });
  test('enforces draft/publication lifecycle and optimistic playlist edits', async () => {
    const helper = await user('PlaylistHelper', 'helper'); const agent = await agentFor(helper); const games = await Promise.all([...Array(5)].map((_, index) => Game.create({ canonicalTitle: `Game ${index}`, normalizedTitle: `game${index}` }))); const rotations = [];
    for (const game of games) rotations.push((await agent.post('/api/v2/casual-friday/manage/rotation').send(rotationPayload(game._id.toString())).expect(201)).body.rotation);
    const draft = (await agent.post('/api/v2/casual-friday/manage/playlists').send({ weekKey: '2026-08-07', startsAt: '2026-08-07T18:00:00.000Z', endsAt: '2026-08-07T21:00:00.000Z', notes: 'Bring snacks' }).expect(201)).body.playlist;
    await agent.post(`/api/v2/casual-friday/manage/playlists/${draft.id}/publish`).send({ version: draft.version }).expect(400);
    const filled = (await agent.put(`/api/v2/casual-friday/manage/playlists/${draft.id}/entries`).send({ version: draft.version, rotationGameIds: rotations.slice(0, 4).map((item) => item.id) }).expect(200)).body.playlist;
    await agent.put(`/api/v2/casual-friday/manage/playlists/${draft.id}/entries`).send({ version: draft.version, rotationGameIds: rotations.slice(0, 4).map((item) => item.id) }).expect(409);
    const published = (await agent.post(`/api/v2/casual-friday/manage/playlists/${draft.id}/publish`).send({ version: filled.version }).expect(200)).body.playlist;
    expect(published).toMatchObject({ status: 'published', entries: expect.arrayContaining([expect.objectContaining({ game: expect.objectContaining({ title: 'Game 0' }) })]) });
    expect(await Audit.countDocuments({ playlistId: draft.id })).toBe(3);
  });
  test('only exposes active playlist to members and automatically completes elapsed playlists', async () => {
    const helper = await user('FinalHelper', 'helper'); const member = await user('Viewer'); const helperAgent = await agentFor(helper); const memberAgent = await agentFor(member); const game = await Game.create({ canonicalTitle: 'Old Game', normalizedTitle: 'oldgame' }); const rotation = (await helperAgent.post('/api/v2/casual-friday/manage/rotation').send(rotationPayload(game._id.toString())).expect(201)).body.rotation;
    const draft = (await helperAgent.post('/api/v2/casual-friday/manage/playlists').send({ weekKey: '2026-08-14', startsAt: '2026-08-14T18:00:00.000Z', endsAt: '2026-08-14T21:00:00.000Z' }).expect(201)).body.playlist;
    await helperAgent.put(`/api/v2/casual-friday/manage/playlists/${draft.id}/entries`).send({ version: draft.version, rotationGameIds: [rotation.id] }).expect(200);
    await memberAgent.get('/api/v2/casual-friday').expect(200).expect((response) => expect(response.body.playlist).toBeNull());
    await Playlist.updateOne({ _id: draft.id }, { $set: { status: 'published', endsAt: new Date('2020-01-01') } });
    expect(await completeElapsedPlaylists(new Date('2021-01-01'))).toBe(1); expect(await Playlist.findById(draft.id)).toMatchObject({ status: 'completed' });
  });
});