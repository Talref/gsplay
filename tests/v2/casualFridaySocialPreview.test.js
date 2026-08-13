const mongoose = require('mongoose');
const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const CasualFridayEvent = require('../../src/v2/models/CasualFridayEvent');
const CasualFridayPlaylist = require('../../src/v2/models/CasualFridayPlaylist');
const CasualFridayPlaylistEntry = require('../../src/v2/models/CasualFridayPlaylistEntry');
const { METADATA_MARKER } = require('../../src/v2/http/socialPreview');

const template = `<!doctype html><html><head><title>GSplay</title>${METADATA_MARKER}</head><body><div id="root"></div></body></html>`;
const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  PUBLIC_APP_URL: 'https://gsplay.example',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const app = createApp(config, { frontendTemplate: template });
const actorId = new mongoose.Types.ObjectId();
const rotationId = new mongoose.Types.ObjectId();
const gameId = new mongoose.Types.ObjectId();
const startsAt = new Date('2099-08-14T17:00:00.000Z');
const votingClosesAt = new Date('2099-08-14T13:00:00.000Z');
const endsAt = new Date('2099-08-15T04:00:00.000Z');

async function createEvent(overrides = {}) {
  return CasualFridayEvent.create({
    weekKey: '2099-08-14',
    status: 'open',
    startsAt,
    votingClosesAt,
    endsAt,
    candidates: [
      {
        rotationGameId: rotationId,
        canonicalGameId: gameId,
        displayTitle: 'Candidate Game',
        playerCountMin: 2,
        playerCountMax: 8
      }
    ],
    createdBy: actorId,
    updatedBy: actorId,
    ...overrides
  });
}

async function preview() {
  return request(app).get('/casual-friday?from=discord').set('Accept', 'text/html').expect(200);
}

describe('Casual Friday lifecycle social previews', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('invites members to vote while voting is live', async () => {
    await createEvent();
    const response = await preview();

    expect(response.text).toContain('<title>Casual Friday — 14 agosto — Vota ora</title>');
    expect(response.text).toContain('Le votazioni sono aperte fino alle 15:00 di venerdì');
    expect(response.text).toContain('scegli fino a cinque giochi');
    expect(response.text).toContain(
      'property="og:url" content="https://gsplay.example/casual-friday"'
    );
    expect(response.text).not.toContain('from=discord');
  });

  test('keeps a private draft out of metadata after voting closes', async () => {
    const playlist = await CasualFridayPlaylist.create({
      weekKey: '2099-08-14',
      status: 'draft',
      startsAt,
      endsAt,
      createdBy: actorId,
      updatedBy: actorId
    });
    await createEvent({ status: 'draft', playlistId: playlist._id });
    await CasualFridayPlaylistEntry.create({
      playlistId: playlist._id,
      rotationGameId: rotationId,
      canonicalGameId: gameId,
      position: 1,
      selectedBy: actorId,
      snapshots: { game: { title: 'Private Draft Game' }, rotation: {} }
    });
    const response = await preview();

    expect(response.text).toContain('Le votazioni sono chiuse e la playlist è in preparazione');
    expect(response.text).not.toContain('Private Draft Game');
  });

  test('shows the ordered playlist after publication', async () => {
    const playlist = await CasualFridayPlaylist.create({
      weekKey: '2099-08-14',
      status: 'published',
      startsAt,
      endsAt,
      createdBy: actorId,
      updatedBy: actorId,
      publishedBy: actorId,
      publishedAt: new Date()
    });
    await createEvent({ status: 'published', playlistId: playlist._id });
    await CasualFridayPlaylistEntry.create([
      {
        playlistId: playlist._id,
        rotationGameId: rotationId,
        canonicalGameId: gameId,
        position: 2,
        selectedBy: actorId,
        snapshots: { game: { title: 'Second Game' }, rotation: { displayTitle: 'Second Game' } }
      },
      {
        playlistId: playlist._id,
        rotationGameId: new mongoose.Types.ObjectId(),
        canonicalGameId: new mongoose.Types.ObjectId(),
        position: 1,
        selectedBy: actorId,
        snapshots: {
          game: { title: 'First Game', artwork: 'https://images.example/first.jpg' },
          rotation: { displayTitle: 'First Game' }
        }
      }
    ]);
    const response = await preview();

    expect(response.text).toContain('content="Stasera: First Game • Second Game."');
    expect(response.text).toContain(
      'property="og:image" content="https://images.example/first.jpg"'
    );
    expect(response.text).toContain('name="twitter:card" content="summary_large_image"');
  });

  test('summarizes long playlists without cutting game titles', async () => {
    const playlist = await CasualFridayPlaylist.create({
      weekKey: '2099-08-14',
      status: 'published',
      startsAt,
      endsAt,
      createdBy: actorId,
      updatedBy: actorId
    });
    await createEvent({ status: 'published', playlistId: playlist._id });
    await CasualFridayPlaylistEntry.create(
      [...Array(12)].map((_, index) => ({
        playlistId: playlist._id,
        rotationGameId: new mongoose.Types.ObjectId(),
        canonicalGameId: new mongoose.Types.ObjectId(),
        position: index + 1,
        selectedBy: actorId,
        snapshots: {
          game: { title: `Legionary Adventure Number ${index + 1}` },
          rotation: { displayTitle: `Legionary Adventure Number ${index + 1}` }
        }
      }))
    );
    const response = await preview();
    const description = response.text.match(/property="og:description" content="([^"]+)"/)[1];

    expect(description.length).toBeLessThanOrEqual(220);
    expect(description).toMatch(/\+ altri \d+\.$/);
    expect(description).not.toContain('…');
  });

  test('clearly marks cancelled events and uses generic metadata when none exists', async () => {
    await createEvent({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: actorId });
    const cancelled = await preview();
    expect(cancelled.text).toContain('<title>Casual Friday — 14 agosto — Annullato</title>');
    expect(cancelled.text).toContain('La serata è stata annullata');

    await CasualFridayEvent.deleteMany({});
    const missing = await preview();
    expect(missing.text).toContain('<title>GSPlay</title>');
    expect(missing.text).not.toContain('Casual Friday —');
  });
});
