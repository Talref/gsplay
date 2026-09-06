const {
  createTmdbClient,
  mapMovieDetails,
  TmdbProviderError
} = require('../../src/v2/providers/tmdbClient');

describe('TMDB client', () => {
  test('searches movies and keeps only valid, useful result fields', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: {
          results: [
            {
              id: 1091,
              title: 'La cosa',
              original_title: 'The Thing',
              overview: 'Una base molto poco tranquilla.',
              poster_path: '/thing.jpg',
              release_date: '1982-06-25'
            },
            { id: 'invalid', title: 'Broken row' }
          ]
        }
      })
    };
    const client = createTmdbClient({ accessToken: 'secret', http });
    await expect(client.searchMovies('La cosa')).resolves.toEqual([
      {
        tmdbId: 1091,
        title: 'La cosa',
        originalTitle: 'The Thing',
        overview: 'Una base molto poco tranquilla.',
        posterUrl: 'https://image.tmdb.org/t/p/w500/thing.jpg',
        releaseDate: '1982-06-25',
        year: 1982
      }
    ]);
    expect(http.get).toHaveBeenCalledWith('/search/movie', {
      params: { query: 'La cosa', include_adult: false, language: 'it-IT', page: 1 },
      headers: { Authorization: 'Bearer secret' }
    });
  });

  test('maps details and tolerates missing optional fields', async () => {
    expect(
      mapMovieDetails({
        id: 1091,
        title: 'La cosa',
        overview: '',
        poster_path: null,
        vote_average: null,
        runtime: null
      })
    ).toEqual({
      tmdbId: 1091,
      title: 'La cosa',
      overview: '',
      posterUrl: null,
      rating: null,
      runtimeMinutes: null,
      tmdbUrl: 'https://www.themoviedb.org/movie/1091'
    });
  });

  test('fetches details and classifies configuration and upstream failures', async () => {
    const http = {
      get: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Request failed'), { response: { status: 503 } })
        )
    };
    await expect(
      createTmdbClient({ accessToken: 'secret', http }).getMovie(1091)
    ).rejects.toMatchObject({
      name: 'TmdbProviderError',
      status: 503
    });
    await expect(createTmdbClient({ http }).searchMovies('Thing')).rejects.toBeInstanceOf(
      TmdbProviderError
    );
  });
});
