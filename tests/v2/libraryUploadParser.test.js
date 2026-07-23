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

  test('accepts repository-supported provider JSON only for the selected provider', () => {
    expect(parseLibraryUpload(Buffer.from('{"games":[{"title":"GOG Quest","app_name":"gog-9"}]}'), 'application/json', 'gog')).toEqual([{ providerGameId: 'gog-9', providerTitle: 'GOG Quest' }]);
    expect(parseLibraryUpload(Buffer.from('{"library":[{"title":"Epic Quest","app_name":42}]}'), 'application/json', 'epic')).toEqual([{ providerGameId: '42', providerTitle: 'Epic Quest' }]);
    expect(parseLibraryUpload(Buffer.from('{"library":[{"title":"Amazon Quest","app_name":"amazon-7"}]}'), 'application/json', 'amazon')).toEqual([{ providerGameId: 'amazon-7', providerTitle: 'Amazon Quest' }]);
    expect(() => parseLibraryUpload(Buffer.from('{"library":[{"title":"Wrong provider","app_name":"x"}]}'), 'application/json', 'gog')).toThrow('GOG JSON');
  });

  test('rejects binary data and CSV shapes outside the documented contract', () => {
    expect(() => parseLibraryUpload(Buffer.from([0x66, 0x00]), 'text/csv')).toThrow('binary data');
    expect(() => parseLibraryUpload(Buffer.from('title,id\nAqua,1\n'), 'text/csv')).toThrow('header must be exactly providerGameId,providerTitle');
  });
});