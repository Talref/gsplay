const mongoose = require('mongoose');
const Edition = require('../models/AwardsEdition');
const { ApplicationError } = require('../errors');
const { zonedParts, zonedDateTimeToUtc } = require('../time/communityTime');

const fail = (category, code, message) => {
  throw new ApplicationError(category, code, message);
};
const invalid = (message) => fail('invalid', 'invalid_request', message);
const conflict = (message) => fail('conflict', 'awards_conflict', message);
const currentYear = () => zonedParts(new Date()).year;
function text(value, label, max = 512, empty = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!empty && !value.trim()))
    invalid(`${label} is invalid`);
  return value.trim();
}
function keys(value, allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    invalid('Unsupported request fields');
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) invalid('Invalid category ID');
  return value;
}
function categoryList(value) {
  if (!Array.isArray(value) || !value.length || value.length > 30)
    invalid('Provide between 1 and 30 categories');
  return value;
}
function gameDto(game) {
  return {
    igdbId: game.igdbId,
    title: game.canonicalTitle || game.title,
    igdbUrl: game.igdbUrl,
    artwork: game.artwork || null,
    platforms: game.platforms || [],
    releaseDate: game.releaseDate || null
  };
}
function categoriesDto(categories, { finalists = false, winners = false } = {}) {
  return categories.map((category) => ({
    id: String(category._id),
    name: category.name,
    description: category.description,
    ...(finalists ? { finalists: category.finalists.map(gameDto) } : {}),
    ...(winners
      ? {
          winner: gameDto(category.finalists.find((game) => game.igdbId === category.winnerIgdbId))
        }
      : {})
  }));
}
async function current() {
  let edition = await Edition.findOne({ year: currentYear() });
  if (!edition) return null;
  const status =
    edition.status === 'nominations' && edition.nominationsCloseAt <= new Date()
      ? 'review'
      : edition.status === 'voting' && edition.votingClosesAt <= new Date()
        ? 'closed'
        : null;
  if (status) {
    await Edition.updateOne(
      { _id: edition._id, status: edition.status },
      {
        $set: { status },
        $inc: { version: 1 }
      }
    );
    edition = await Edition.findById(edition._id);
  }
  return edition;
}
function baseDto(edition) {
  return {
    id: String(edition._id),
    year: edition.year,
    status: edition.status,
    version: edition.version,
    nominationsCloseAt: edition.nominationsCloseAt || null,
    votingClosesAt: edition.votingClosesAt || null,
    publishedAt: edition.publishedAt || null
  };
}
async function memberView(user) {
  const edition = await current();
  if (!edition) return { edition: null };
  const [nominated, voted] = await Promise.all(
    ['nominations', 'ballots'].map((field) =>
      Edition.exists({ _id: edition._id, [`${field}.userId`]: user._id })
    )
  );
  const categories =
    edition.status === 'nominations'
      ? categoriesDto(edition.nominationCategories)
      : ['voting', 'published'].includes(edition.status)
        ? categoriesDto(edition.votingCategories, {
            finalists: edition.status === 'voting',
            winners: edition.status === 'published'
          })
        : [];
  return {
    edition: {
      ...baseDto(edition),
      nominated: Boolean(nominated),
      voted: Boolean(voted),
      categories
    }
  };
}
function counts(categories, submissions) {
  return categories.map((category) => {
    const games = new Map(
      category.finalists.map((game) => [game.igdbId, { ...gameDto(game), count: 0 }])
    );
    for (const submission of submissions) {
      for (const selection of submission.selections) {
        if (String(selection.categoryId) !== String(category._id)) continue;
        for (const game of selection.games) {
          if (!games.has(game.igdbId)) games.set(game.igdbId, { ...gameDto(game), count: 0 });
          games.get(game.igdbId).count += 1;
        }
      }
    }
    const results = [...games.values()].sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title)
    );
    const highest = results[0]?.count || 0;
    return {
      categoryId: String(category._id),
      name: category.name,
      games: results,
      tiedIgdbIds: results.filter((game) => game.count === highest).map((game) => game.igdbId),
      winnerIgdbId: category.winnerIgdbId || null
    };
  });
}
async function adminView() {
  const active = await current();
  if (!active) return { edition: null, year: currentYear() };
  const edition = await Edition.findById(active._id).select('+nominations +ballots');
  return {
    year: edition.year,
    edition: {
      ...baseDto(edition),
      nominationCategories: categoriesDto(edition.nominationCategories),
      votingCategories: categoriesDto(edition.votingCategories, { finalists: true }),
      nominations: edition.nominations,
      ballots: edition.ballots,
      nominationCounts: counts(edition.nominationCategories, edition.nominations),
      votingResults: counts(edition.votingCategories, edition.ballots)
    }
  };
}
async function create(user) {
  try {
    await Edition.create({ year: currentYear(), createdBy: user._id, updatedBy: user._id });
  } catch (error) {
    if (error.code === 11000) conflict('An edition already exists for this year');
    throw error;
  }
}
async function expected(body, status) {
  const edition = await current();
  if (!edition || edition.status !== status || body.version !== edition.version)
    conflict('The edition changed. Reload and check its phase before continuing.');
  return edition;
}
async function update(edition, user, changes) {
  const result = await Edition.updateOne(
    { _id: edition._id, status: edition.status, version: edition.version },
    {
      $set: { ...changes, updatedBy: user._id },
      $inc: { version: 1 }
    }
  );
  if (!result.modifiedCount) conflict('The edition changed. Reload before continuing.');
}
async function saveCategories(user, body, igdb) {
  keys(body, ['version', 'categories']);
  const edition = await current();
  if (!edition || !['draft', 'review'].includes(edition.status) || body.version !== edition.version)
    conflict('Categories can only be prepared in draft or review. Reload before continuing.');
  const voting = edition.status === 'review';
  const categories = [];
  const slugs = new Set();
  for (const category of categoryList(body.categories)) {
    keys(category, voting ? ['name', 'description', 'igdbUrls'] : ['name', 'description']);
    const row = {
      _id: new mongoose.Types.ObjectId(),
      name: text(category.name, 'Category name', 160),
      description: text(category.description ?? '', 'Description', 2000, true),
      finalists: []
    };
    if (voting) {
      if (!Array.isArray(category.igdbUrls) || category.igdbUrls.length > 30)
        invalid('Provide at most 30 finalist links per category');
      for (const url of category.igdbUrls) {
        const match = /^https:\/\/www\.igdb\.com\/games\/([a-z0-9][a-z0-9-]{0,254})$/.exec(url);
        if (!match) invalid('Use canonical https://www.igdb.com/games/<slug> links');
        slugs.add(match[1]);
        row.finalists.push(match[1]);
      }
    }
    categories.push(row);
  }
  if (voting) {
    const games = await igdb.getGamesBySlugs([...slugs]);
    for (const category of categories) {
      const seen = new Set();
      category.finalists = category.finalists.map((slug) => {
        const game = games.get(slug);
        if (!game) invalid(`IGDB game was not found: ${slug}`);
        if (seen.has(game.igdbId)) invalid('Finalists must be distinct in each category');
        seen.add(game.igdbId);
        return gameDto(game);
      });
    }
  }
  await update(edition, user, {
    [voting ? 'votingCategories' : 'nominationCategories']: categories
  });
}
function deadline(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) invalid('Choose an end date and time in Europe/Rome');
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = zonedDateTimeToUtc({ year, month, day, hour, minute });
  const parts = zonedParts(date);
  if (
    [year, month, day, hour, minute].some(
      (part, i) => part !== [parts.year, parts.month, parts.day, parts.hour, parts.minute][i]
    ) ||
    date <= new Date()
  )
    invalid('The closing date must be a valid future Europe/Rome time');
  return date;
}
async function transition(user, action, body) {
  keys(body, ['version', 'closesAt']);
  const from = {
    'start-nominations': 'draft',
    'close-nominations': 'nominations',
    'start-voting': 'review',
    'close-voting': 'voting',
    publish: 'closed'
  }[action];
  if (!from) invalid('Unknown phase action');
  const edition = await expected(body, from);
  const change = {};
  if (action === 'start-nominations') {
    if (!edition.nominationCategories.length) invalid('Prepare nomination categories first');
    Object.assign(change, { status: 'nominations', nominationsCloseAt: deadline(body.closesAt) });
  } else if (action === 'start-voting') {
    if (
      !edition.votingCategories.length ||
      edition.votingCategories.some((category) => !category.finalists.length)
    )
      invalid('Every voting category needs at least one finalist');
    Object.assign(change, { status: 'voting', votingClosesAt: deadline(body.closesAt) });
  } else if (action === 'publish') {
    if (
      !edition.votingCategories.length ||
      edition.votingCategories.some(
        (category) => !category.finalists.some((game) => game.igdbId === category.winnerIgdbId)
      )
    )
      invalid('Confirm one winner for every category first');
    Object.assign(change, { status: 'published', publishedAt: new Date() });
  } else change.status = action === 'close-nominations' ? 'review' : 'closed';
  await update(edition, user, change);
}
async function saveWinners(user, body) {
  keys(body, ['version', 'winners']);
  const edition = await expected(body, 'closed');
  if (!Array.isArray(body.winners) || body.winners.length !== edition.votingCategories.length)
    invalid('Confirm one winner for every category');
  const categories = edition.votingCategories.map((category) => {
    const matches = body.winners.filter((winner) => winner?.categoryId === String(category._id));
    if (matches.length !== 1) invalid('Confirm one winner for every category');
    keys(matches[0], ['categoryId', 'igdbId']);
    if (!category.finalists.some((game) => game.igdbId === matches[0].igdbId))
      invalid('Winner must be a finalist');
    return { ...category.toObject(), winnerIgdbId: matches[0].igdbId };
  });
  await update(edition, user, { votingCategories: categories });
}
async function search(user, query, igdb) {
  const edition = await current();
  if (!edition || edition.status !== 'nominations') conflict('Nominations are not open');
  const q = text(query, 'Search', 160);
  if (q.length < 3) invalid('Enter at least three characters');
  return { games: await igdb.searchGames(q) };
}
async function submit(user, phase, body, igdb) {
  keys(body, ['editionId', 'selections']);
  const edition = await current();
  const nomination = phase === 'nominations';
  if (
    !edition ||
    String(edition._id) !== body.editionId ||
    edition.status !== (nomination ? 'nominations' : 'voting')
  )
    conflict('This submission phase is closed');
  const field = nomination ? 'nominations' : 'ballots';
  if (await Edition.exists({ _id: edition._id, [`${field}.userId`]: user._id }))
    conflict('Your final submission has already been recorded');
  const categories = nomination ? edition.nominationCategories : edition.votingCategories;
  if (
    !Array.isArray(body.selections) ||
    !body.selections.length ||
    body.selections.length > categories.length
  )
    invalid('Choose at least one game');
  const selections = [];
  const seen = new Set();
  const requestedIds = new Set();
  for (const selection of body.selections) {
    keys(selection, ['categoryId', 'igdbIds']);
    const categoryId = id(selection.categoryId);
    const category = categories.find((entry) => String(entry._id) === categoryId);
    if (!category || seen.has(categoryId)) invalid('Unknown or repeated category');
    seen.add(categoryId);
    const ids = selection.igdbIds;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > (nomination ? 4 : 1) ||
      ids.some((value) => !Number.isSafeInteger(value) || value < 1) ||
      new Set(ids).size !== ids.length
    )
      invalid(
        nomination
          ? 'Choose 1–4 distinct games per selected category'
          : 'Choose one finalist per selected category'
      );
    ids.forEach((igdbId) => requestedIds.add(igdbId));
    selections.push({ categoryId, igdbIds: ids });
  }
  const resolved = nomination
    ? new Map((await igdb.getGamesByIds([...requestedIds])).map((game) => [game.igdbId, game]))
    : null;
  const savedSelections = selections.map(({ categoryId, igdbIds }) => {
    const category = categories.find((entry) => String(entry._id) === categoryId);
    return {
      categoryId,
      games: igdbIds.map((igdbId) => {
        const game = nomination
          ? resolved.get(igdbId)
          : category.finalists.find((entry) => entry.igdbId === igdbId);
        if (!game) invalid('Game was not found among the permitted selections');
        return gameDto(game);
      })
    };
  });
  const deadlineField = nomination ? 'nominationsCloseAt' : 'votingClosesAt';
  const result = await Edition.updateOne(
    {
      _id: edition._id,
      status: edition.status,
      [`${field}.userId`]: { $ne: user._id },
      // Use database time at the final atomic write, including after slow IGDB lookups.
      $expr: { $gt: [`$${deadlineField}`, '$$NOW'] }
    },
    {
      $push: {
        [field]: {
          userId: user._id,
          username: user.usernameDisplay,
          submittedAt: new Date(),
          selections: savedSelections
        }
      }
    }
  );
  if (!result.modifiedCount)
    conflict('The phase closed or your final submission was already recorded');
}
module.exports = {
  memberView,
  adminView,
  create,
  saveCategories,
  transition,
  saveWinners,
  search,
  submit
};
