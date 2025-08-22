// src/utils/formatters.js

/**
 * Formats a game title for use in a URL, typically for IGDB.
 * @param {string} name The original game title.
 * @returns {string} The URL-friendly formatted title.
 */
export const gameTitleFormatter = (name) => {
  if (!name) {
    return '';
  }

  let formattedTitle = name.toLowerCase();
  formattedTitle = formattedTitle.replace(/\s*-\s*/g, '-');
  formattedTitle = formattedTitle.replace(/[^a-z0-9\s-]/g, '').trim();
  formattedTitle = formattedTitle.replace(/\s+/g, '-');

  return formattedTitle;
};