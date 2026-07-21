import axios from 'axios';

const api = axios.create({ baseURL: '/api/v2', withCredentials: true });
let refreshPromise;
api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  const authMutation = ['/auth/login', '/auth/signup', '/auth/logout', '/auth/refresh'].includes(original?.url);
  if (error.response?.status !== 401 || original?._retried || authMutation) throw error;
  original._retried = true;
  try { refreshPromise ||= api.post('/auth/refresh').finally(() => { refreshPromise = null; }); await refreshPromise; return api(original); } catch { throw error; }
});
async function request(method, url, data, config) {
  try { return (await api({ method, url, data, ...config })).data; } catch (error) { const detail = error.response?.data?.error; throw Object.assign(new Error(detail?.message || 'Request failed.'), { status: error.response?.status, code: detail?.code }); }
}
export const authApi = { me: () => request('get', '/me'), login: (data) => request('post', '/auth/login', data), signup: (data) => request('post', '/auth/signup', data), logout: () => request('post', '/auth/logout') };
export const libraryApi = { mine: (page = 1, pageSize = 60) => request('get', `/me/library?page=${page}&pageSize=${pageSize}`), users: () => request('get', '/users'), compare: (userIds) => request('post', '/library-comparisons', { userIds }), linkSteam: (steamId) => request('put', '/me/providers/steam', { steamId }), syncSteam: () => request('post', '/me/providers/steam/sync', {}), job: (jobId) => request('get', `/me/imports/${jobId}`), upload: (provider, file) => { const data = new FormData(); data.append('provider', provider); data.append('file', file); return request('post', '/me/imports', data); } };
export const catalogueApi = { games: (query = '', page = 1, pageSize = 60) => request('get', `/games?page=${page}&pageSize=${pageSize}${query ? `&q=${encodeURIComponent(query)}` : ''}`) };
export const communityApi = { topGames: () => request('get', '/community/games/top?limit=20') };
export const retroApi = { link: (username) => request('put', '/me/retroachievements', { username }), profile: () => request('get', '/me/retroachievements/profile'), challenge: () => request('get', '/retroachievements/challenge') };
export const adminApi = { jobs: () => request('get', '/admin/jobs'), enrichmentStatus: () => request('get', '/admin/enrichment-status'), repairEnrichment: () => request('post', '/admin/enrichment-repair'), reviews: () => request('get', '/admin/matches/review'), resolveMatch: (matchId, canonicalGameId) => request('put', `/admin/matches/${matchId}`, { canonicalGameId }), activateRetroChallenge: (retroGameId, description) => request('put', '/admin/retroachievements/challenge', { retroGameId: Number(retroGameId), description }) };