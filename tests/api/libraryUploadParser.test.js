const {
  parseLibraryUpload,
  resolveLibraryUpload
} = require('../../src/api/services/libraryUploadParser');

const resolveJson = (filename, value, provider) =>
  resolveLibraryUpload({
    filename,
    buffer: Buffer.from(JSON.stringify(value)),
    mimeType: 'application/json',
    provider
  });

describe('library upload parser', () => {
  test.each([
    ['gog_library.json', 'gog', 'games'],
    ['legendary_library.json', 'epic', 'library'],
    ['nile_library.json', 'amazon', 'library']
  ])('detects and validates %s', (filename, provider, key) => {
    expect(resolveJson(filename, { [key]: [{ app_name: 42, title: ' Quest ' }] })).toEqual({
      provider,
      games: [{ providerGameId: '42', providerTitle: 'Quest' }]
    });
  });

  test.each([
    ['gog_library.json', { library: [{ app_name: '1', title: 'Quest' }] }],
    ['legendary_library.json', { games: [{ app_name: '1', title: 'Quest' }] }],
    ['nile_library.json', null],
    ['gog_library.json', { games: [{ providerGameId: '1', providerTitle: 'Quest' }] }],
    ['legendary_library.json', { library: [] }],
    ['nile_library.json', { library: [{ app_name: {}, title: 'Quest' }] }],
    ['nile_library.json', { library: [{ app_name: '1', title: ' ' }] }],
    ['legendary_library.json', { library: [{ app_name: '1', title: 'x'.repeat(513) }] }],
    ['legendary_library.json', { library: [{ app_name: 'x'.repeat(257), title: 'Quest' }] }]
  ])('rejects invalid content for %s', (filename, value) => {
    expect(() => resolveJson(filename, value)).toThrow();
  });

  test('rejects ambiguous filenames, conflicting providers, and excessive game counts', () => {
    const document = { library: [{ app_name: '1', title: 'Quest' }] };
    expect(() => resolveJson('library.json', document)).toThrow('Provider cannot be determined');
    expect(() => resolveJson('legendary_library.json', document, 'amazon')).toThrow(
      'Filename identifies EPIC'
    );
    expect(() =>
      resolveJson('gog_library.json', {
        games: Array.from({ length: 5001 }, () => ({ app_name: '1', title: 'Quest' }))
      })
    ).toThrow('between 1 and 5000');
  });

  test.each([
    [Buffer.alloc(0), 'must not be empty'],
    [Buffer.from('  '), 'must not be blank'],
    [Buffer.from([0x00]), 'binary data'],
    [Buffer.from([0xff]), 'valid UTF-8'],
    [Buffer.from('{'), 'JSON is malformed']
  ])('rejects unsafe upload text', (buffer, message) => {
    expect(() =>
      resolveLibraryUpload({ buffer, filename: 'gog_library.json', mimeType: 'application/json' })
    ).toThrow(message);
  });

  test('preserves neutral imports with an explicit provider', () => {
    const games = [{ providerGameId: '1', providerTitle: 'Quest' }];
    expect(resolveJson('neutral.json', games, 'epic')).toEqual({ provider: 'epic', games });
    expect(resolveJson('neutral.json', { games }, 'amazon')).toEqual({ provider: 'amazon', games });
    expect(
      resolveLibraryUpload({
        buffer: Buffer.from('providerGameId,providerTitle\n1,Quest\n'),
        filename: 'neutral.csv',
        mimeType: 'text/csv',
        provider: 'gog'
      })
    ).toEqual({ provider: 'gog', games });
  });
  test('accepts the documented UTF-8 CSV contract including quoted commas', () => {
    const games = parseLibraryUpload(
      Buffer.from('providerGameId,providerTitle\ngog-42,"Quest, The"\n'),
      'text/csv'
    );
    expect(games).toEqual([{ providerGameId: 'gog-42', providerTitle: 'Quest, The' }]);
  });

  test('accepts an array or a games envelope in JSON', () => {
    expect(
      parseLibraryUpload(
        Buffer.from('[{"providerGameId":"epic-1","providerTitle":"Aqua Quest"}]'),
        'application/json'
      )
    ).toEqual([{ providerGameId: 'epic-1', providerTitle: 'Aqua Quest' }]);
    expect(
      parseLibraryUpload(
        Buffer.from('{"games":[{"providerGameId":"amazon-1","providerTitle":"Moonlight"}]}'),
        'application/json'
      )
    ).toEqual([{ providerGameId: 'amazon-1', providerTitle: 'Moonlight' }]);
  });

  test('accepts repository-supported provider JSON only for the selected provider', () => {
    expect(
      parseLibraryUpload(
        Buffer.from('{"games":[{"title":"GOG Quest","app_name":"gog-9"}]}'),
        'application/json',
        'gog'
      )
    ).toEqual([{ providerGameId: 'gog-9', providerTitle: 'GOG Quest' }]);
    expect(
      parseLibraryUpload(
        Buffer.from('{"library":[{"title":"Epic Quest","app_name":42}]}'),
        'application/json',
        'epic'
      )
    ).toEqual([{ providerGameId: '42', providerTitle: 'Epic Quest' }]);
    expect(
      parseLibraryUpload(
        Buffer.from('{"library":[{"title":"Amazon Quest","app_name":"amazon-7"}]}'),
        'application/json',
        'amazon'
      )
    ).toEqual([{ providerGameId: 'amazon-7', providerTitle: 'Amazon Quest' }]);
    expect(() =>
      parseLibraryUpload(
        Buffer.from('{"library":[{"title":"Wrong provider","app_name":"x"}]}'),
        'application/json',
        'gog'
      )
    ).toThrow('GOG JSON');
  });

  test('rejects binary data and CSV shapes outside the documented contract', () => {
    expect(() => parseLibraryUpload(Buffer.from([0x66, 0x00]), 'text/csv')).toThrow('binary data');
    expect(() => parseLibraryUpload(Buffer.from('title,id\nAqua,1\n'), 'text/csv')).toThrow(
      'header must be exactly providerGameId,providerTitle'
    );
  });
});
