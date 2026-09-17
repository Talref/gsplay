const COMMUNITY_TIME_ZONE = 'Europe/Rome';

function zonedParts(date, timeZone = COMMUNITY_TIME_ZONE) {
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
  timeZone = COMMUNITY_TIME_ZONE
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

module.exports = { COMMUNITY_TIME_ZONE, zonedDateTimeToUtc, zonedParts };
