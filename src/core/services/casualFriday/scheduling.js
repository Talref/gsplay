const { COMMUNITY_TIME_ZONE, zonedDateTimeToUtc, zonedParts } = require('../../time/communityTime');

const EVENT_TIME_ZONE = COMMUNITY_TIME_ZONE;

function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function nextFridayWindow(now = new Date()) {
  const local = zonedParts(now);
  const localDay = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  const usePreviousFriday = localDay === 6 && local.hour < 6;
  const days = usePreviousFriday ? -1 : (5 - localDay + 7) % 7 || (localDay === 5 ? 0 : 7);
  const friday = addLocalDays(local, days);
  const saturday = addLocalDays(friday, 1);
  const weekKey = `${friday.year}-${String(friday.month).padStart(2, '0')}-${String(friday.day).padStart(2, '0')}`;
  return {
    weekKey,
    startsAt: zonedDateTimeToUtc({ ...friday, hour: 19 }),
    votingClosesAt: zonedDateTimeToUtc({ ...friday, hour: 15 }),
    endsAt: zonedDateTimeToUtc({ ...saturday, hour: 6 })
  };
}

module.exports = { EVENT_TIME_ZONE, nextFridayWindow, zonedDateTimeToUtc, zonedParts };
