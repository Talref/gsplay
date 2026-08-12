const fs = require('node:fs');
const path = require('node:path');

const METADATA_MARKER = '<!-- GSPLAY_SOCIAL_METADATA -->';
const DEFAULT_TITLE = 'GSPlay';
const DEFAULT_DESCRIPTION =
  'Giochi, serate e libbrerie della community: entra, scegli e nun fa’ aspettà tutta Roma.';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function absoluteHttpUrl(value, baseUrl, fallbackPath) {
  try {
    const url = new URL(value || fallbackPath, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
    url.hash = '';
    return url.toString();
  } catch {
    return new URL(fallbackPath, baseUrl).toString();
  }
}

function absoluteCanonicalUrl(value, baseUrl, fallbackPath) {
  try {
    const fallback = new URL(fallbackPath, baseUrl);
    const url = new URL(value || fallback, baseUrl);
    if (url.origin !== baseUrl.origin) return fallback.toString();
    url.hash = '';
    return url.toString();
  } catch {
    return new URL(fallbackPath, baseUrl).toString();
  }
}

function normalizeMetadata(config, requestPath, metadata = {}) {
  const baseUrl = new URL(config.publicAppUrl);
  const canonicalPath = requestPath.split('?')[0] || '/';
  return {
    title: metadata.title || DEFAULT_TITLE,
    description: metadata.description || DEFAULT_DESCRIPTION,
    image: absoluteHttpUrl(metadata.image, baseUrl, '/gslogo.png'),
    url: absoluteCanonicalUrl(metadata.url, baseUrl, canonicalPath),
    type: metadata.type || 'website',
    twitterCard: metadata.twitterCard || 'summary'
  };
}

function metadataTags(metadata) {
  const attribute = (value) => escapeHtml(value);
  return [
    `<meta name="description" content="${attribute(metadata.description)}" />`,
    `<link rel="canonical" href="${attribute(metadata.url)}" />`,
    `<meta property="og:title" content="${attribute(metadata.title)}" />`,
    `<meta property="og:description" content="${attribute(metadata.description)}" />`,
    `<meta property="og:image" content="${attribute(metadata.image)}" />`,
    `<meta property="og:url" content="${attribute(metadata.url)}" />`,
    `<meta property="og:type" content="${attribute(metadata.type)}" />`,
    `<meta name="twitter:card" content="${attribute(metadata.twitterCard)}" />`,
    `<meta name="twitter:title" content="${attribute(metadata.title)}" />`,
    `<meta name="twitter:description" content="${attribute(metadata.description)}" />`,
    `<meta name="twitter:image" content="${attribute(metadata.image)}" />`
  ].join('\n    ');
}

function renderHtml(template, metadata) {
  if (!template.includes(METADATA_MARKER))
    throw new Error(`Frontend HTML is missing ${METADATA_MARKER}`);
  const title = `<title>${escapeHtml(metadata.title)}</title>`;
  const withTitle = /<title>.*?<\/title>/is.test(template)
    ? template.replace(/<title>.*?<\/title>/is, title)
    : template.replace(METADATA_MARKER, `${title}\n    ${METADATA_MARKER}`);
  return withTitle.replace(METADATA_MARKER, metadataTags(metadata));
}

function acceptsSpaHtml(req) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  if (/^\/(api(?:\/|$)|uploads(?:\/|$)|health(?:\/|$))/.test(req.path)) return false;
  if (path.extname(req.path)) return false;
  return Boolean(req.accepts('html'));
}

function loadTemplate(config, options) {
  if (options.template !== undefined) return options.template;
  if (!config.isProduction && !options.templatePath) return null;
  const templatePath =
    options.templatePath || path.resolve(__dirname, '../../../gsplay-frontend/dist/index.html');
  if (fs.existsSync(templatePath)) return fs.readFileSync(templatePath, 'utf8');
  if (config.isProduction) throw new Error(`Frontend HTML was not found at ${templatePath}`);
  return null;
}

function createSocialPreviewHandler(config, options = {}) {
  const template = loadTemplate(config, options);
  if (!template) return null;
  if (!template.includes(METADATA_MARKER))
    throw new Error(`Frontend HTML is missing ${METADATA_MARKER}`);
  const resolveMetadata = options.resolveMetadata || (() => null);

  return async function socialPreviewHandler(req, res, next) {
    if (!acceptsSpaHtml(req)) return next();
    let resolved = {};
    try {
      resolved = (await resolveMetadata(req)) || {};
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          requestId: req.id,
          message: 'Social metadata resolver failed; using generic metadata',
          errorName: error.name
        })
      );
    }
    try {
      const metadata = normalizeMetadata(config, req.originalUrl, resolved);
      res.set('Cache-Control', 'no-cache');
      return res.type('html').send(renderHtml(template, metadata));
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  METADATA_MARKER,
  createSocialPreviewHandler,
  normalizeMetadata,
  renderHtml
};
