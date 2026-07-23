function normalizeTitle(title) {
  return String(title || '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}
module.exports = { normalizeTitle };