const Birthday = require('../models/Birthday');
const ScheduledJob = require('../models/ScheduledJob');
const { cancelScheduledJobs, enqueueScheduledJob } = require('../jobs/scheduledJobService');
const { zonedDateTimeToUtc, zonedParts } = require('../time/communityTime');

const BIRTHDAY_JOB_TYPE = 'birthday_reminder';

const BIRTHDAY_ACHIEVEMENTS = Object.freeze([
  'Sopravvissuto un altro anno',
  'Tutorial ancora non completato',
  '+1 Wisdom, forse',
  'Respawn annuale completato',
  'Patch annuale installata con successo',
  'Veterano della modalità Storia',
  'Un altro giro intorno al Sole',
  'HP massimi misteriosamente invariati',
  'La build regge ancora',
  'Non era un bug, era una feature',
  'Salvataggio automatico riuscito',
  'New Game+ rimandato di un altro anno',
  'AFK dalla giovinezza',
  'Experienced Player',
  'Prestigio aumentato. Statistiche no.',
  'Season Pass rinnovato',
  'Obiettivo segreto: invecchiare',
  'Ancora nessun permaban',
  'Character progression detected',
  'Lore personale espansa',
  'Danno da caduta emotivo ridotto del 2%',
  'Nuova ruga cosmetica sbloccata',
  'Main quest ancora in corso',
  'NPC importante per la community',
  'Tempo di gioco discutibilmente alto',
  'Inventario pieno di roba inutile',
  'Skill tree sempre più confuso',
  'Checkpoint raggiunto',
  'Nessun save corrotto rilevato',
  'Difficoltà aumentata automaticamente',
  'Veterano delle patch precedenti',
  'Achievement raro: essere ancora qui',
  'DLC annuale installato',
  'Statistiche nascoste migliorate',
  'Un punto talento non assegnato',
  'Resistenza al nonsense +1',
  'Cap level ancora sconosciuto',
  'Modalità Hardcore: ancora attiva',
  'Backlog della vita aumentato',
  'Buff temporaneo: torta',
  'Debuff permanente: responsabilità',
  'Nuovo capitolo della lore sbloccato',
  'Tempo totale di gioco: preoccupante',
  'Build legacy ancora supportata',
  'Compatibilità con il mondo reale: parziale',
  'Achievement ottenuto senza guida',
  'Season finale evitato',
  'Ancora nessun ragequit definitivo',
  'Rank IRL aumentato',
  'Livello superiore raggiunto contro ogni previsione'
]);

const BIRTHDAY_WISHES = Object.freeze([
  'Che il loot sia generoso e i bug pochi.',
  "Che tu possa rollare solo critici per tutto l'anno.",
  'Che il tuo RNG sia finalmente decente.',
  'Che nessuno nerfi la tua build.',
  'Che la tua prossima quest abbia ricompense degne.',
  'Che il backlog diminuisca. Sì, certo.',
  'Che tu possa trovare tempo per giocare a tutto quello che hai comprato.',
  'Che Steam smetta di tentarti. Impossibile, ma auguri.',
  'Che la vita ti droppi almeno un leggendario.',
  'Che i tuoi compagni di party sappiano finalmente cosa stanno facendo.',
  'Che ogni boss abbia una cheese strategy.',
  'Che tu possa vivere un altro anno senza escort mission.',
  'Che il prossimo aggiornamento non rompa nulla.',
  'Che i tuoi save rimangano sempre integri.',
  'Che il tuo ping sia basso e il morale alto.',
  'Che il matchmaking ti sia clemente.',
  'Che nessuno scelga Hanzo. Qualunque cosa significhi oggi.',
  'Che la tua stamina duri più della tua voglia di socializzare.',
  'Che ogni lunedì venga hotfixato.',
  'Che il tuo inventario abbia sempre uno slot libero.',
  'Che il prossimo anno abbia meno grind.',
  'Che ogni fetch quest sia almeno ben pagata.',
  'Che la tua build resti viable fino alla prossima patch.',
  'Che i dadi non decidano di odiarti.',
  'Che tu abbia sempre abbastanza mana per arrivare a sera.',
  'Che il fast travel nella vita reale venga implementato presto.',
  'Che nessun NPC ti dia quest prima del caffè.',
  'Che il tuo party non wipi sulle meccaniche facili.',
  'Che ogni porta sospetta contenga loot e non mimic.',
  'Che la tua connessione regga proprio quando serve.',
  'Che la tua giornata abbia più checkpoint e meno boss fight.',
  'Che il prossimo anno sia almeno Very Positive.',
  'Che tu possa skippare tutte le cutscene inutili.',
  'Che nessuno ti chieda di reinstallare Windows.',
  'Che il tech support della vita risponda entro tempi umani.',
  'Che i tuoi bug personali restino solo cosmetici.',
  'Che tu possa continuare a ignorare saggiamente il meta.',
  'Che ogni patch note contenga almeno un buff per te.',
  'Che la tua lore diventi sempre più assurda.',
  'Che il prossimo anno arrivi con meno microtransazioni.',
  'Che tu trovi sempre il checkpoint prima di fare una cazzata.',
  'Che nessuno ti resetti le skill.',
  'Che i tuoi side quest siano migliori della main quest.',
  'Che tu abbia abbastanza gold per tutte le idee discutibili.',
  'Che il tuo aggro range sociale rimanga sotto controllo.',
  'Che il prossimo livello sblocchi finalmente qualcosa di utile.',
  'Che ogni party abbia almeno un healer competente.',
  'Che la realtà smetta ogni tanto di giocare in modalità Soulslike.',
  'Che tu possa continuare a livellare senza leggere il manuale.',
  'Che questo nuovo livello sia rotto quanto basta da essere divertente.'
]);

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function occurrenceDate(day, month, year) {
  if (day === 29 && month === 2 && !isLeapYear(year)) return { day: 28, month, year };
  return { day, month, year };
}

function nextBirthdayOccurrence({ day, month }, now = new Date()) {
  const current = zonedParts(now);
  let occurrence = occurrenceDate(day, month, current.year);
  let runAt = zonedDateTimeToUtc({ ...occurrence, hour: 0, minute: 1 });
  if (runAt <= now) {
    occurrence = occurrenceDate(day, month, current.year + 1);
    runAt = zonedDateTimeToUtc({ ...occurrence, hour: 0, minute: 1 });
  }
  return { occurrenceYear: occurrence.year, runAt };
}

function validateBirthday({ day, month, year }) {
  if (!Number.isInteger(day) || !Number.isInteger(month))
    throw new Error('Giorno e mese non validi.');
  if (year !== null && year !== undefined && !Number.isInteger(year))
    throw new Error('Anno non valido.');
  if (year !== null && year !== undefined && (year < 1 || year > 9999))
    throw new Error('Anno non valido.');
  const validationYear = year || 2000;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(validationYear, month - 1, day);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    date.getUTCFullYear() !== validationYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error('Data di compleanno non valida.');
}

function birthdayDedupeKey(guildId, discordUserId, occurrenceYear) {
  return `birthday:${guildId}:${discordUserId}:${occurrenceYear}`;
}

async function scheduleBirthday(birthday, now = new Date()) {
  const { occurrenceYear, runAt } = nextBirthdayOccurrence(birthday, now);
  return enqueueScheduledJob({
    type: BIRTHDAY_JOB_TYPE,
    payload: {
      guildId: birthday.guildId,
      discordUserId: birthday.discordUserId,
      occurrenceYear
    },
    runAt,
    dedupeKey: birthdayDedupeKey(birthday.guildId, birthday.discordUserId, occurrenceYear)
  });
}

async function setBirthday({ guildId, discordUserId, day, month, year = null }, now = new Date()) {
  validateBirthday({ day, month, year });
  const birthday = await Birthday.findOneAndUpdate(
    { guildId, discordUserId },
    { $set: { day, month, year: year ?? null } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await cancelScheduledJobs({
    type: BIRTHDAY_JOB_TYPE,
    'payload.guildId': guildId,
    'payload.discordUserId': discordUserId
  });
  const job = await scheduleBirthday(birthday, now);
  return { birthday, job };
}

async function removeBirthday({ guildId, discordUserId }) {
  const birthday = await Birthday.findOneAndDelete({ guildId, discordUserId });
  await cancelScheduledJobs({
    type: BIRTHDAY_JOB_TYPE,
    'payload.guildId': guildId,
    'payload.discordUserId': discordUserId
  });
  return Boolean(birthday);
}

function randomEntry(entries, random) {
  return entries[Math.floor(random() * entries.length)];
}

function renderBirthdayMessage(discordUserId, { random = Math.random } = {}) {
  const achievement = randomEntry(BIRTHDAY_ACHIEVEMENTS, random);
  const wish = randomEntry(BIRTHDAY_WISHES, random);
  return `🎂 **LEVEL UP!**\nOggi <@${discordUserId}> ha livellato in RL!\n\n**Achievement unlocked:** *${achievement}* 🏆\n\n${wish} 🎉`;
}

async function ensureBirthdaySchedules(now = new Date()) {
  const birthdays = await Birthday.find({});
  let scheduled = 0;
  for (const birthday of birthdays) {
    const { occurrenceYear } = nextBirthdayOccurrence(birthday, now);
    const expected = await ScheduledJob.findOne({
      dedupeKey: birthdayDedupeKey(birthday.guildId, birthday.discordUserId, occurrenceYear)
    }).select('status');
    if (!expected || expected.status === 'canceled') {
      await scheduleBirthday(birthday, now);
      scheduled += 1;
    }
  }
  return scheduled;
}

module.exports = {
  BIRTHDAY_ACHIEVEMENTS,
  BIRTHDAY_JOB_TYPE,
  BIRTHDAY_WISHES,
  birthdayDedupeKey,
  ensureBirthdaySchedules,
  nextBirthdayOccurrence,
  occurrenceDate,
  removeBirthday,
  renderBirthdayMessage,
  scheduleBirthday,
  setBirthday,
  validateBirthday
};
