const axios = require('axios');

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

class TmdbProviderError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'TmdbProviderError';
    this.provider = 'tmdb';
    this.status = status;
    this.code = code;
  }
}

function providerError(error) {
  return new TmdbProviderError(error.message || 'TMDB request failed', {
    status: error.response?.status,
    code: error.code
  });
}

const posterUrl = (path) =>
  typeof path === 'string' && /^\/[A-Za-z0-9._-]+$/.test(path) ? `${IMAGE_BASE_URL}${path}` : null;
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function mapSearchResult(movie) {
  const title = text(movie?.title, 300);
  if (!Number.isInteger(movie?.id) || !title) {
    return null;
  }
  const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date || '')
    ? movie.release_date
    : null;
  return {
    tmdbId: movie.id,
    title,
    originalTitle: text(movie.original_title, 300) || null,
    overview: text(movie.overview, 4000),
    posterUrl: posterUrl(movie.poster_path),
    releaseDate,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null
  };
}

function mapMovieDetails(movie) {
  const base = mapSearchResult(movie);
  if (!base) throw new TmdbProviderError('TMDB returned invalid movie details');
  return {
    tmdbId: base.tmdbId,
    title: base.title,
    overview: base.overview,
    posterUrl: base.posterUrl,
    rating:
      typeof movie.vote_average === 'number' &&
      Number.isFinite(movie.vote_average) &&
      movie.vote_average >= 0 &&
      movie.vote_average <= 10
        ? Math.round(movie.vote_average * 10) / 10
        : null,
    runtimeMinutes:
      Number.isInteger(movie.runtime) && movie.runtime > 0 && movie.runtime <= 1440
        ? movie.runtime
        : null,
    tmdbUrl: `https://www.themoviedb.org/movie/${base.tmdbId}`
  };
}

function createTmdbClient({
  accessToken,
  language = 'it-IT',
  http = axios.create({ baseURL: 'https://api.themoviedb.org/3', timeout: 8_000 })
}) {
  function configured() {
    if (!accessToken) throw new TmdbProviderError('TMDB read access token is not configured');
  }
  const request = async (path, params) => {
    configured();
    try {
      return await http.get(path, {
        params,
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (error) {
      if (error instanceof TmdbProviderError) throw error;
      throw providerError(error);
    }
  };
  return {
    async searchMovies(query) {
      const { data } = await request('/search/movie', {
        query,
        include_adult: false,
        language,
        page: 1
      });
      if (!Array.isArray(data?.results))
        throw new TmdbProviderError('TMDB returned an invalid search response');
      return data.results.map(mapSearchResult).filter(Boolean).slice(0, 20);
    },
    async getMovie(tmdbId) {
      if (!Number.isInteger(tmdbId) || tmdbId < 1)
        throw new TmdbProviderError('TMDB movie ID must be positive');
      const { data } = await request(`/movie/${tmdbId}`, { language });
      return mapMovieDetails(data);
    }
  };
}

module.exports = { createTmdbClient, mapMovieDetails, mapSearchResult, TmdbProviderError };
