const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const RetroChallenge = require('../../src/v2/models/RetroChallenge');
const { METADATA_MARKER } = require('../../src/v2/http/socialPreview');
const { monthWindow } = require('../../src/v2/services/retroService');

const template = `<!doctype html><html><head><title>GSplay</title>${METADATA_MARKER}</head><body><div id="root"></div></body></html>`;
const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  PUBLIC_APP_URL: 'https://gsplay.example',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const app = createApp(config, { frontendTemplate: template });

async function preview() {
  return request(app).get('/retro?from=discord').set('Accept', 'text/html').expect(200);
}

describe('Retroclub social preview', () => {
  beforeEach(async () => global.testUtils.cleanupDatabase());

  test('shows the current game, platform, artwork, and curated flavor text', async () => {
    const now = new Date();
    const window = monthWindow(now);
    const month = new Intl.DateTimeFormat('it-IT', {
      month: 'long',
      timeZone: 'Europe/Rome'
    }).format(now);
    await RetroChallenge.create({
      retroGameId: 123,
      monthKey: window.monthKey,
      sequence: 1,
      status: 'active',
      active: true,
      title: 'Aqua Quest & Friends',
      consoleName: 'Super Nintendo',
      imageUrl: '/Images/aqua.jpg',
      description: 'Una cartuccia corta, cattiva e scelta apposta pe’ la comitiva.',
      scoringStartsAt: window.startsAt,
      scoringEndsAt: window.endsAt
    });

    const response = await preview();

    expect(response.text).toContain(
      `<title>Gioco di ${month}: Aqua Quest &amp; Friends</title>`
    );
    expect(response.text).toContain(
      'content="Super Nintendo • Una cartuccia corta, cattiva e scelta apposta pe’ la comitiva."'
    );
    expect(response.text).toContain(
      'property="og:image" content="https://retroachievements.org/Images/aqua.jpg"'
    );
    expect(response.text).toContain('property="og:url" content="https://gsplay.example/retro"');
    expect(response.text).toContain('name="twitter:card" content="summary_large_image"');
    expect(response.text).not.toContain('from=discord');
  });

  test('uses the Roman fallback without artwork and hides cancelled editions', async () => {
    const window = monthWindow();
    const challenge = await RetroChallenge.create({
      retroGameId: 456,
      monthKey: window.monthKey,
      sequence: 1,
      status: 'active',
      active: true,
      title: 'Mystery Cartridge',
      consoleName: 'Mega Drive',
      scoringStartsAt: window.startsAt,
      scoringEndsAt: window.endsAt
    });
    const active = await preview();
    expect(active.text).toContain('Er Retroclub ha scelto la cartuccia');
    expect(active.text).toContain(
      'property="og:image" content="https://gsplay.example/gslogo.png"'
    );
    expect(active.text).toContain('name="twitter:card" content="summary"');

    await RetroChallenge.updateOne(
      { _id: challenge._id },
      { $set: { active: false, status: 'cancelled' } }
    );
    const cancelled = await preview();
    expect(cancelled.text).toContain('<title>GSPlay</title>');
    expect(cancelled.text).not.toContain('Mystery Cartridge');
  });
});
