const mongoose = require('mongoose');
const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const CanonicalGame = require('../../src/v2/models/CanonicalGame');
const CasualFridayRotationGame = require('../../src/v2/models/CasualFridayRotationGame');
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

describe('game-detail social previews', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('renders rich non-personal catalogue metadata in the initial HTML', async () => {
    const game = await CanonicalGame.create({
      canonicalTitle: 'Deep Daje & Friends',
      normalizedTitle: 'deep daje friends',
      genres: ['Adventure', 'Shooter'],
      gameModes: ['Single player', 'Co-operative', 'Multiplayer'],
      artwork: 'https://images.example/deep-daje.jpg'
    });
    const actorId = new mongoose.Types.ObjectId();
    await CasualFridayRotationGame.create({
      canonicalGameId: game._id,
      displayTitle: game.canonicalTitle,
      playerCountMin: 2,
      playerCountMax: 8,
      playerCountLabel: '2–8 compari',
      addedBy: actorId,
      updatedBy: actorId
    });

    const response = await request(app)
      .get(`/catalogue/${game._id}?shared=discord`)
      .set('Accept', 'text/html')
      .expect(200);

    expect(response.text).toContain('<title>Deep Daje &amp; Friends</title>');
    expect(response.text).toContain(
      'content="Adventure, Shooter • Multiplayer, Co-op • 2–8 compari • In rotazione Casual Friday"'
    );
    expect(response.text).toContain(
      'property="og:image" content="https://images.example/deep-daje.jpg"'
    );
    expect(response.text).toContain(
      `property="og:url" content="https://gsplay.example/catalogue/${game._id}"`
    );
    expect(response.text).toContain('name="twitter:card" content="summary_large_image"');
    expect(response.text).not.toContain('shared=discord');
    expect(response.text).not.toMatch(/owner|user|proposal/i);
  });

  test('uses sparse public metadata and the generic image when artwork is unavailable', async () => {
    const game = await CanonicalGame.create({
      canonicalTitle: 'Er Gioco Misterioso',
      normalizedTitle: 'er gioco misterioso',
      summary: '  Una storia tranquilla\nsenza dati personali e senza troppi fronzoli.  '
    });

    const response = await request(app)
      .get(`/catalogue/${game._id}`)
      .set('Accept', 'text/html')
      .expect(200);

    expect(response.text).toContain('<title>Er Gioco Misterioso</title>');
    expect(response.text).toContain(
      'content="Una storia tranquilla senza dati personali e senza troppi fronzoli."'
    );
    expect(response.text).toContain(
      'property="og:image" content="https://gsplay.example/gslogo.png"'
    );
    expect(response.text).toContain('name="twitter:card" content="summary"');
  });

  test('rejects unsafe artwork URLs and excludes retired rotation details', async () => {
    const game = await CanonicalGame.create({
      canonicalTitle: 'Retired Game',
      normalizedTitle: 'retired game',
      gameModes: ['Co-operative'],
      artwork: 'javascript:alert(1)'
    });
    const actorId = new mongoose.Types.ObjectId();
    await CasualFridayRotationGame.create({
      canonicalGameId: game._id,
      displayTitle: game.canonicalTitle,
      status: 'retired',
      playerCountMin: 2,
      playerCountMax: 4,
      addedBy: actorId,
      updatedBy: actorId
    });

    const response = await request(app)
      .get(`/catalogue/${game._id}`)
      .set('Accept', 'text/html')
      .expect(200);

    expect(response.text).toContain('content="Co-op"');
    expect(response.text).toContain(
      'property="og:image" content="https://gsplay.example/gslogo.png"'
    );
    expect(response.text).toContain('name="twitter:card" content="summary"');
    expect(response.text).not.toContain('In rotazione Casual Friday');
    expect(response.text).not.toContain('2–4');
  });

  test('falls back to generic metadata for missing, invalid, and hidden games', async () => {
    const hidden = await CanonicalGame.create({
      canonicalTitle: 'Secret Admin Game',
      normalizedTitle: 'secret admin game',
      hiddenAt: new Date()
    });

    for (const path of [
      '/catalogue/not-an-object-id',
      `/catalogue/${new mongoose.Types.ObjectId()}`,
      `/catalogue/${hidden._id}`
    ]) {
      const response = await request(app).get(path).set('Accept', 'text/html').expect(200);
      expect(response.text).toContain('<title>GSPlay</title>');
      expect(response.text).not.toContain('Secret Admin Game');
    }
  });
});
