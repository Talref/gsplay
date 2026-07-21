const { parseLibraryUpload } = require('../../src/v2/services/libraryUploadParser');

describe('v2 library upload parser', () => {
  test('accepts the documented UTF-8 CSV contract including quoted commas', () => {
    const games = parseLibraryUpload(Buffer.from('providerGameId,providerTitle\ngog-42,"Quest, The"\n'), 'text/csv');
    expect(games).toEqual([{ providerGameId: 'gog-42', providerTitle: 'Quest, The' }]);
  });

  test('accepts an array or a games envelope in JSON', () => {
    expect(parseLibraryUpload(Buffer.from('[{"providerGameId":"epic-1","providerTitle":"Aqua Quest"}]'), 'application/json')).toEqual([{ providerGameId: 'epic-1', providerTitle: 'Aqua Quest' }]);
    expect(parseLibraryUpload(Buffer.from('{"games":[{"providerGameId":"amazon-1","providerTitle":"Moonlight"}]}'), 'application/json')).toEqual([{ providerGameId: 'amazon-1', providerTitle: 'Moonlight' }]);
  });

  test('rejects binary data and CSV shapes outside the documented contract', () => {
    expect(() => parseLibraryUpload(Buffer.from([0x66, 0x00]), 'text/csv')).toThrow('binary data');
    expect(() => parseLibraryUpload(Buffer.from('title,id\nAqua,1\n'), 'text/csv')).toThrow('header must be exactly providerGameId,providerTitle');
  });
});