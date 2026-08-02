const EVENT_TIME_ZONE = 'Europe/Rome';

function zonedParts(date, timeZone = EVENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)])
  );
}

function zonedDateTimeToUtc(
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone = EVENT_TIME_ZONE
) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(result), timeZone);
    const difference =
      Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second
      ) - target;
    if (!difference) break;
    result -= difference;
  }
  return new Date(result);
}

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
    endsAt: zonedDateTimeToUtc({ ...saturday, hour: 6 })
  };
}

module.exports = { EVENT_TIME_ZONE, nextFridayWindow };
